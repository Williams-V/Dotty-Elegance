const { createHash, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { createServer: createHttpServer } = require("node:http");
const { readFile, stat } = require("node:fs/promises");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const scryptAsync = promisify(scrypt);
const ROOT = __dirname;
const DEFAULT_DATABASE_PATH = path.join(ROOT, "data", "dotty-elegance.sqlite");
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_LENGTH_MIN = 12;
const MAX_BODY_BYTES = 16 * 1024;
const ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "shipped",
  "delivered",
  "cancelled"
]);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
const PUBLIC_FILES = new Set([
  "about.html",
  "account.html",
  "account.js",
  "admin.html",
  "admin.js",
  "contact.html",
  "customer-support.js",
  "index.html",
  "script.js",
  "shop.html",
  "style.css"
]);

const PRODUCTS = [
  ["bob", "Bob wig (Available in all colors)", "wigs", 8500, "images2/bob.jpg"],
  ["bob-2", "Bob Wig - 14 Inches", "wigs", 6500, "images2/Bob 2.jpeg"],
  ["bodywave", "Body Wave Bundle - 20 Inches", "wigs", 12000, "images2/bodywave.jpg"],
  ["bodywave-2", "Body Wave Wig - 14 Inches", "wigs", 16500, "images2/Bodywave 2.jpeg"],
  ["bodywave-3", "Body Wave Wig - 14 Inches", "wigs", 16500, "images2/Bodywave 3.jpeg"],
  ["bodywave-4", "Body Wave Wig - 14 Inches", "wigs", 16500, "images2/Bodywave 4.jpeg"],
  ["curly", "Curly Wig - 16 Inches", "wigs", 17500, "images2/curly.jpg"],
  ["curly-2", "Curly Wig", "wigs", 16500, "images2/Curly 2.jpeg"],
  ["curly-3", "Curly Wig", "wigs", 16500, "images2/Curly 3.jpeg"],
  ["curly-4", "Curly Wig", "wigs", 16500, "images2/Curly 4.jpeg"],
  ["straight-1", "Straight Wig", "wigs", 16500, "images2/Straight 1.jpeg"],
  ["straight-2", "Straight Wig - 14 Inches", "wigs", 16500, "images2/Straight 2.jpeg"],
  ["kinky-straight-1", "Kinky Straight Wig - 14 Inches", "wigs", 16500, "images2/Kinky straight 1.jpeg"],
  ["braids-1", "Braids Wig - 14 Inches", "wigs", 16500, "images2/braids 1.jpeg"],
  ["pixie", "Pixie Wig", "wigs", 16500, "images2/Pixie.jpeg"],
  ["brazilian-human-curly-hair-bundles", "Brazilian Human Curly Hair Bundles", "weaves", 16500, "images2/Brazilian Human curly hair Bundles.jpeg"],
  ["kinky-straight-human-hair-bundle", "Kinky Straight Human Hair Bundle", "weaves", 16500, "images2/kinky straight human hair bundle.jpeg"],
  ["body-wave-human-hair-bundles", "Body Wave Human Hair Bundles", "weaves", 16500, "images2/Body Wave Human Hair Bundles.jpeg"],
  ["straight-hair-weave-bundles", "Straight Hair Weave Bundles", "weaves", 16500, "images2/Straight Hair Weave Bundles .jpeg"],
  ["straight-human-hair-bundles", "Straight Human Hair Bundles", "weaves", 16500, "images2/Straight human hair bundles.jpeg"]
];

function createDatabase(databasePath = DEFAULT_DATABASE_PATH) {
  const directory = path.dirname(databasePath);
  require("node:fs").mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'store_admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('wigs', 'weaves')),
      price_kes INTEGER NOT NULL CHECK (price_kes > 0),
      image_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered', 'cancelled')),
      total_kes INTEGER NOT NULL DEFAULT 0 CHECK (total_kes >= 0),
      delivery_address TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS orders_customer_created_at_idx
      ON orders(customer_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
      unit_price_kes INTEGER NOT NULL CHECK (unit_price_kes > 0)
    );
    CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
  `);

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price_kes, image_url)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  db.exec("BEGIN");
  try {
    PRODUCTS.forEach((product) => insertProduct.run(...product));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  return db;
}

function jsonResponse(response, statusCode, value, additionalHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...additionalHeaders
  });
  response.end(JSON.stringify(value));
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 0) {
        return [];
      }
      return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
    })
  );
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    deliveryAddress: user.delivery_address,
    role: user.role
  };
}

function validateEmail(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateText(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}

function createRateLimiter() {
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;
  return (key) => {
    const now = Date.now();
    const previous = attempts.get(key);
    if (!previous || now - previous.startedAt >= windowMs) {
      attempts.set(key, { startedAt: now, count: 1 });
      return true;
    }
    previous.count += 1;
    return previous.count <= maxAttempts;
  };
}

function createApplicationServer(db, { production = process.env.NODE_ENV === "production" } = {}) {
  const allowAttempt = createRateLimiter();
  const getUserById = db.prepare("SELECT * FROM users WHERE id = ?");
  const getSessionUser = db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `);

  async function readJsonBody(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        throw error;
      }
      chunks.push(chunk);
    }
    if (!chunks.length) {
      return {};
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      const error = new Error("Request body must be valid JSON.");
      error.statusCode = 400;
      throw error;
    }
  }

  function setSessionCookie(response, token) {
    const parts = [
      `dotty_session=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${SESSION_DURATION_MS / 1000}`
    ];
    if (production) {
      parts.push("Secure");
    }
    response.setHeader("Set-Cookie", parts.join("; "));
  }

  function clearSessionCookie(response) {
    const parts = ["dotty_session=", "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
    if (production) {
      parts.push("Secure");
    }
    response.setHeader("Set-Cookie", parts.join("; "));
  }

  function currentUser(request) {
    const token = parseCookies(request.headers.cookie).dotty_session;
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return null;
    }
    const user = getSessionUser.get(hashToken(token), Date.now());
    return user || null;
  }

  function checkOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) {
      return true;
    }
    try {
      return new URL(origin).host === request.headers.host;
    } catch {
      return false;
    }
  }

  async function serveStatic(pathname, request, response) {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      jsonResponse(response, 400, { error: "Invalid URL path." });
      return;
    }
    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
    if (relativePath.split(/[\\/]/).some((part) => !part || part.startsWith("."))) {
      jsonResponse(response, 404, { error: "Not found." });
      return;
    }

    const filePath = path.resolve(ROOT, relativePath);
    const isPublicImage = relativePath.startsWith("images2/") &&
      [".jpeg", ".jpg", ".png", ".svg", ".webp"].includes(path.extname(filePath).toLowerCase());
    if (
      !filePath.startsWith(`${ROOT}${path.sep}`) ||
      (!PUBLIC_FILES.has(relativePath) && !isPublicImage)
    ) {
      jsonResponse(response, 404, { error: "Not found." });
      return;
    }
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        jsonResponse(response, 404, { error: "Not found." });
        return;
      }
      const body = await readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": [".html", ".js", ".css"].includes(extension)
          ? "no-cache"
          : "public, max-age=3600"
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        jsonResponse(response, 404, { error: "Not found." });
        return;
      }
      throw error;
    }
  }

  const handleRequest = async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    if (production) {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const { pathname } = url;
      const method = request.method;

      if (pathname.startsWith("/api/") && !checkOrigin(request) && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        jsonResponse(response, 403, { error: "Request origin is not allowed." });
        return;
      }
      if (method === "OPTIONS" && pathname.startsWith("/api/")) {
        response.writeHead(204, { Allow: "GET, HEAD, POST, PATCH, DELETE, OPTIONS" });
        response.end();
        return;
      }

      if (pathname === "/api/health" && method === "GET") {
        db.prepare("SELECT 1").get();
        jsonResponse(response, 200, { status: "ok" });
        return;
      }

      if (pathname === "/api/auth/register" && method === "POST") {
        const ip = request.socket.remoteAddress || "unknown";
        if (!allowAttempt(`register:${ip}`)) {
          jsonResponse(response, 429, { error: "Too many account attempts. Please try again later." });
          return;
        }
        const body = await readJsonBody(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";
        if (!validateEmail(email)) {
          jsonResponse(response, 400, { error: "Enter a valid email address." });
          return;
        }
        if (!validateText(fullName, 2, 120)) {
          jsonResponse(response, 400, { error: "Enter your name (2 to 120 characters)." });
          return;
        }
        if (!validateText(phone, 7, 30)) {
          jsonResponse(response, 400, { error: "Enter a valid phone number." });
          return;
        }
        if (typeof body.password !== "string" || body.password.length < PASSWORD_LENGTH_MIN || body.password.length > 128) {
          jsonResponse(response, 400, { error: `Password must be at least ${PASSWORD_LENGTH_MIN} characters.` });
          return;
        }
        const salt = randomBytes(16).toString("hex");
        const passwordHash = await scryptAsync(body.password, salt, 64);
        let result;
        try {
          result = db.prepare(`
            INSERT INTO users (email, password_salt, password_hash, full_name, phone)
            VALUES (?, ?, ?, ?, ?)
          `).run(email, salt, passwordHash.toString("hex"), fullName, phone);
        } catch (error) {
          if (error.errcode === 2067 || String(error.code).includes("CONSTRAINT_UNIQUE")) {
            jsonResponse(response, 409, { error: "An account with this email already exists." });
            return;
          }
          throw error;
        }
        const user = getUserById.get(Number(result.lastInsertRowid));
        const token = randomBytes(32).toString("hex");
        db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
          .run(hashToken(token), user.id, Date.now() + SESSION_DURATION_MS);
        setSessionCookie(response, token);
        jsonResponse(response, 201, { user: publicUser(user) });
        return;
      }

      if (pathname === "/api/auth/login" && method === "POST") {
        const ip = request.socket.remoteAddress || "unknown";
        if (!allowAttempt(`login:${ip}`)) {
          jsonResponse(response, 429, { error: "Too many sign-in attempts. Please try again later." });
          return;
        }
        const body = await readJsonBody(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (!user || typeof body.password !== "string") {
          jsonResponse(response, 401, { error: "Email or password is incorrect." });
          return;
        }
        const passwordHash = await scryptAsync(body.password, user.password_salt, 64);
        const expectedHash = Buffer.from(user.password_hash, "hex");
        if (passwordHash.length !== expectedHash.length || !timingSafeEqual(passwordHash, expectedHash)) {
          jsonResponse(response, 401, { error: "Email or password is incorrect." });
          return;
        }
        const token = randomBytes(32).toString("hex");
        db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
          .run(hashToken(token), user.id, Date.now() + SESSION_DURATION_MS);
        setSessionCookie(response, token);
        jsonResponse(response, 200, { user: publicUser(user) });
        return;
      }

      if (pathname === "/api/auth/logout" && method === "POST") {
        const token = parseCookies(request.headers.cookie).dotty_session;
        if (token && /^[a-f0-9]{64}$/.test(token)) {
          db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
        }
        clearSessionCookie(response);
        jsonResponse(response, 200, { success: true });
        return;
      }

      if (pathname === "/api/auth/me" && method === "GET") {
        const user = currentUser(request);
        jsonResponse(response, 200, { user: user ? publicUser(user) : null });
        return;
      }

      if (!pathname.startsWith("/api/")) {
        if (method === "GET" || method === "HEAD") {
          await serveStatic(pathname, request, response);
        } else {
          jsonResponse(response, 405, { error: "Method not allowed." });
        }
        return;
      }

      const user = currentUser(request);
      if (!user) {
        jsonResponse(response, 401, { error: "Sign in to continue." });
        return;
      }

      if (pathname === "/api/account/profile" && method === "PATCH") {
        const body = await readJsonBody(request);
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";
        const address = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
        if (!validateText(fullName, 2, 120) || !validateText(phone, 7, 30) || address.length > 500) {
          jsonResponse(response, 400, { error: "Enter a valid name, phone number, and delivery address." });
          return;
        }
        db.prepare("UPDATE users SET full_name = ?, phone = ?, delivery_address = ? WHERE id = ?")
          .run(fullName, phone, address, user.id);
        jsonResponse(response, 200, {
          user: publicUser(getUserById.get(user.id))
        });
        return;
      }

      if (pathname === "/api/account/password" && method === "PATCH") {
        const body = await readJsonBody(request);
        if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string" ||
            body.newPassword.length < PASSWORD_LENGTH_MIN || body.newPassword.length > 128) {
          jsonResponse(response, 400, { error: `Enter your current password and a new password of at least ${PASSWORD_LENGTH_MIN} characters.` });
          return;
        }
        const storedUser = getUserById.get(user.id);
        const currentHash = await scryptAsync(body.currentPassword, storedUser.password_salt, 64);
        const expectedHash = Buffer.from(storedUser.password_hash, "hex");
        if (currentHash.length !== expectedHash.length || !timingSafeEqual(currentHash, expectedHash)) {
          jsonResponse(response, 401, { error: "Current password is incorrect." });
          return;
        }
        const salt = randomBytes(16).toString("hex");
        const newHash = await scryptAsync(body.newPassword, salt, 64);
        db.prepare("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?")
          .run(salt, newHash.toString("hex"), user.id);
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
        clearSessionCookie(response);
        jsonResponse(response, 200, { success: true });
        return;
      }

      if (pathname === "/api/products" && method === "GET") {
        const products = db.prepare(`
          SELECT id, name, category, price_kes AS priceKes, image_url AS imageUrl
          FROM products WHERE is_active = 1 ORDER BY category, id
        `).all();
        jsonResponse(response, 200, { products });
        return;
      }

      if (pathname === "/api/favorites" && method === "GET") {
        const favorites = db.prepare(`
          SELECT products.id, products.name, products.category,
            products.price_kes AS priceKes, products.image_url AS imageUrl
          FROM favorites
          JOIN products ON products.id = favorites.product_id
          WHERE favorites.user_id = ? AND products.is_active = 1
          ORDER BY favorites.created_at DESC
        `).all(user.id);
        jsonResponse(response, 200, { favorites });
        return;
      }

      if (pathname === "/api/favorites" && method === "POST") {
        const body = await readJsonBody(request);
        if (typeof body.productId !== "string") {
          jsonResponse(response, 400, { error: "Choose a valid product." });
          return;
        }
        const product = db.prepare("SELECT id FROM products WHERE id = ? AND is_active = 1").get(body.productId);
        if (!product) {
          jsonResponse(response, 404, { error: "Product is not available." });
          return;
        }
        db.prepare("INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)")
          .run(user.id, product.id);
        jsonResponse(response, 201, { success: true });
        return;
      }

      const favoriteMatch = pathname.match(/^\/api\/favorites\/([a-z0-9-]+)$/);
      if (favoriteMatch && method === "DELETE") {
        db.prepare("DELETE FROM favorites WHERE user_id = ? AND product_id = ?")
          .run(user.id, favoriteMatch[1]);
        jsonResponse(response, 200, { success: true });
        return;
      }

      if (pathname === "/api/orders" && method === "GET") {
        const orders = db.prepare(`
          SELECT id, status, total_kes AS totalKes, delivery_address AS deliveryAddress,
            created_at AS createdAt
          FROM orders WHERE customer_id = ? ORDER BY created_at DESC
        `).all(user.id);
        const getItems = db.prepare(`
          SELECT product_id AS productId, product_name AS productName,
            image_url AS imageUrl, quantity, unit_price_kes AS unitPriceKes
          FROM order_items WHERE order_id = ?
        `);
        orders.forEach((order) => {
          order.items = getItems.all(order.id);
        });
        jsonResponse(response, 200, { orders });
        return;
      }

      if (pathname === "/api/orders" && method === "POST") {
        const body = await readJsonBody(request);
        if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
          jsonResponse(response, 400, { error: "An order must contain between 1 and 50 products." });
          return;
        }
        if (!validateText(body.deliveryAddress, 5, 500) || !validateText(body.contactPhone, 7, 30)) {
          jsonResponse(response, 400, { error: "Enter a valid delivery address and phone number." });
          return;
        }

        const normalizedItems = new Map();
        for (const item of body.items) {
          if (!item || typeof item.productId !== "string" || !Number.isInteger(item.quantity) ||
              item.quantity < 1 || item.quantity > 20) {
            jsonResponse(response, 400, { error: "Each product quantity must be between 1 and 20." });
            return;
          }
          normalizedItems.set(
            item.productId,
            (normalizedItems.get(item.productId) || 0) + item.quantity
          );
          if (normalizedItems.get(item.productId) > 20) {
            jsonResponse(response, 400, { error: "You can order up to 20 of the same item." });
            return;
          }
        }

        const products = [];
        for (const [productId, quantity] of normalizedItems) {
          const product = db.prepare(`
            SELECT id, name, image_url, price_kes
            FROM products WHERE id = ? AND is_active = 1
          `).get(productId);
          if (!product) {
            jsonResponse(response, 400, { error: "A product in your order is no longer available." });
            return;
          }
          products.push({ ...product, quantity });
        }

        const orderId = randomBytes(16).toString("hex");
        db.exec("BEGIN IMMEDIATE");
        let totalKes;
        try {
          const insertOrder = db.prepare(`
            INSERT INTO orders (id, customer_id, total_kes, delivery_address, contact_phone)
            VALUES (?, ?, ?, ?, ?)
          `);
          const insertItem = db.prepare(`
            INSERT INTO order_items
              (order_id, product_id, product_name, image_url, quantity, unit_price_kes)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          totalKes = products.reduce(
            (sum, product) => sum + product.price_kes * product.quantity,
            0
          );
          insertOrder.run(
            orderId,
            user.id,
            totalKes,
            body.deliveryAddress.trim(),
            body.contactPhone.trim()
          );
          products.forEach((product) => {
            insertItem.run(
              orderId,
              product.id,
              product.name,
              product.image_url,
              product.quantity,
              product.price_kes
            );
          });
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
        jsonResponse(response, 201, { orderId, totalKes, status: "pending" });
        return;
      }

      if (pathname === "/api/admin/orders" && method === "GET") {
        if (user.role !== "store_admin") {
          jsonResponse(response, 403, { error: "Store administrator access is required." });
          return;
        }
        const orders = db.prepare(`
          SELECT orders.id, orders.status, orders.total_kes AS totalKes,
            orders.delivery_address AS deliveryAddress, orders.contact_phone AS contactPhone,
            orders.created_at AS createdAt, users.full_name AS customerName,
            users.email AS customerEmail
          FROM orders JOIN users ON users.id = orders.customer_id
          ORDER BY orders.created_at DESC
        `).all();
        const getItems = db.prepare(`
          SELECT product_name AS productName, quantity, unit_price_kes AS unitPriceKes
          FROM order_items WHERE order_id = ?
        `);
        orders.forEach((order) => {
          order.items = getItems.all(order.id);
        });
        jsonResponse(response, 200, { orders });
        return;
      }

      const adminOrderMatch = pathname.match(/^\/api\/admin\/orders\/([a-f0-9]{32})$/);
      if (adminOrderMatch && method === "PATCH") {
        if (user.role !== "store_admin") {
          jsonResponse(response, 403, { error: "Store administrator access is required." });
          return;
        }
        const body = await readJsonBody(request);
        if (!ORDER_STATUSES.has(body.status)) {
          jsonResponse(response, 400, { error: "Choose a valid order status." });
          return;
        }
        const result = db.prepare(`
          UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(body.status, adminOrderMatch[1]);
        if (result.changes === 0) {
          jsonResponse(response, 404, { error: "Order not found." });
          return;
        }
        jsonResponse(response, 200, { success: true });
        return;
      }

      jsonResponse(response, 404, { error: "API route not found." });
    } catch (error) {
      if (error.statusCode) {
        jsonResponse(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Request failed:", error);
      if (!response.headersSent) {
        jsonResponse(response, 500, { error: "The request could not be completed. Please try again." });
      } else {
        response.destroy(error);
      }
    }
  };

  return createHttpServer((request, response) => {
    handleRequest(request, response);
  });
}

if (require.main === module) {
  const databasePath = process.env.DOTTY_DATABASE_PATH || DEFAULT_DATABASE_PATH;
  const db = createDatabase(databasePath);
  const server = createApplicationServer(db);
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`Dotty Elegance is running at http://${host}:${port}`);
    console.log(`SQLite database: ${databasePath}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(() => {
        db.close();
        process.exit(0);
      });
    });
  }
}

module.exports = { createApplicationServer, createDatabase };
