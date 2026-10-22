const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createApplicationServer, createDatabase } = require("../server");

let directory;
let database;
let server;
let baseUrl;
let customerCookie;
let adminCookie;
let orderId;

async function request(route, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== "GET" ? { Origin: baseUrl } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  return { response, payload, cookie: response.headers.get("set-cookie") };
}

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "dotty-elegance-"));
  database = createDatabase(path.join(directory, "test.sqlite"));
  server = createApplicationServer(database, { production: false });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (database) {
    database.close();
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

test("serves the storefront and keeps database files private", async () => {
  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);

  const serverSource = await fetch(`${baseUrl}/server.js`);
  assert.equal(serverSource.status, 404);
  const privatePath = await fetch(`${baseUrl}/data/dotty-elegance.sqlite`);
  assert.equal(privatePath.status, 404);
});

test("registers customers with an HttpOnly session and enforces account access", async () => {
  const rejected = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: "customer@example.com",
      password: "short",
      fullName: "Dotty Customer",
      phone: "+254712345678"
    }
  });
  assert.equal(rejected.response.status, 400);

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: "customer@example.com",
      password: "a-secure-test-password",
      fullName: "Dotty Customer",
      phone: "+254712345678"
    }
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.payload.user.email, "customer@example.com");
  assert.match(registration.cookie, /HttpOnly/);
  assert.match(registration.cookie, /SameSite=Strict/);
  customerCookie = registration.cookie.split(";")[0];

  const profile = await request("/api/auth/me", { cookie: customerCookie });
  assert.equal(profile.payload.user.fullName, "Dotty Customer");

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: "customer@example.com",
      password: "a-secure-test-password",
      fullName: "Dotty Customer",
      phone: "+254712345678"
    }
  });
  assert.equal(duplicate.response.status, 409);

  const blockedOrigin = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://attacker.example", Cookie: customerCookie }
  });
  assert.equal(blockedOrigin.status, 403);
});

test("stores customer data, favorites, and server-priced orders", async () => {
  const savedProfile = await request("/api/account/profile", {
    method: "PATCH",
    cookie: customerCookie,
    body: {
      fullName: "Dotty Customer",
      phone: "+254712345678",
      deliveryAddress: "Nairobi, Kenya"
    }
  });
  assert.equal(savedProfile.response.status, 200);

  const favorite = await request("/api/favorites", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: "bob" }
  });
  assert.equal(favorite.response.status, 201);
  const favorites = await request("/api/favorites", { cookie: customerCookie });
  assert.equal(favorites.payload.favorites[0].id, "bob");

  const order = await request("/api/orders", {
    method: "POST",
    cookie: customerCookie,
    body: {
      deliveryAddress: "Nairobi, Kenya",
      contactPhone: "+254712345678",
      items: [{ productId: "bob", quantity: 2, priceKes: 1 }]
    }
  });
  assert.equal(order.response.status, 201);
  assert.equal(order.payload.totalKes, 17000);
  orderId = order.payload.orderId;

  const history = await request("/api/orders", { cookie: customerCookie });
  assert.equal(history.payload.orders.length, 1);
  assert.equal(history.payload.orders[0].items[0].unitPriceKes, 8500);

  const unauthorizedAdmin = await request("/api/admin/orders", { cookie: customerCookie });
  assert.equal(unauthorizedAdmin.response.status, 403);
});

test("allows store admins to update order status and invalidates sessions on password change", async () => {
  database.prepare("UPDATE users SET role = 'store_admin' WHERE email = ?")
    .run("customer@example.com");
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "customer@example.com", password: "a-secure-test-password" }
  });
  assert.equal(login.response.status, 200);
  adminCookie = login.cookie.split(";")[0];

  const orders = await request("/api/admin/orders", { cookie: adminCookie });
  assert.equal(orders.response.status, 200);
  assert.equal(orders.payload.orders[0].id, orderId);

  const status = await request(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "shipped" }
  });
  assert.equal(status.response.status, 200);

  const history = await request("/api/orders", { cookie: customerCookie });
  assert.equal(history.payload.orders[0].status, "shipped");

  const changedPassword = await request("/api/account/password", {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      currentPassword: "a-secure-test-password",
      newPassword: "another-secure-password"
    }
  });
  assert.equal(changedPassword.response.status, 200);
  assert.match(changedPassword.cookie, /Max-Age=0/);

  const revoked = await request("/api/auth/me", { cookie: adminCookie });
  assert.equal(revoked.payload.user, null);
});
