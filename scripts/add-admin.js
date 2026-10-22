const path = require("node:path");
const { createDatabase } = require("../server");

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:add -- owner@example.com");
  process.exit(1);
}

const databasePath =
  process.env.DOTTY_DATABASE_PATH || path.join(__dirname, "..", "data", "dotty-elegance.sqlite");
const db = createDatabase(databasePath);
try {
  const result = db.prepare("UPDATE users SET role = 'store_admin' WHERE email = ?").run(email);
  if (result.changes === 0) {
    console.error(`No account found for ${email}. Create the account first, then run this command again.`);
    process.exitCode = 1;
  } else {
    console.log(`Store administrator access granted to ${email}.`);
  }
} finally {
  db.close();
}
