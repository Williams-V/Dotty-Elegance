# Dotty Elegance

A mobile-friendly storefront for Dotty Elegance, a Nairobi-based beauty brand. It includes a self-managed Node.js backend with a local SQLite database for customer accounts, favorites, and order tracking.

## Features

- Home, shop, about, and contact pages
- Responsive catalog with product filters and a browser-saved order basket
- Customer accounts with scrypt-hashed passwords and HttpOnly session cookies
- Customer profiles, saved favorites, checkout, and order history
- Store-admin dashboard to update order status
- Simple FAQ customer-service chatbot with WhatsApp handoff
- SQLite database owned by the store; no managed database account required
- No payment processing; checkout submits an order request for the store to confirm

## Requirements

- Node.js 24 or later
- npm (included with Node.js)

The server uses Node's built-in SQLite module; there are no third-party npm dependencies.

## Run locally

Open a terminal in the project folder and run:

```sh
npm start
```

Open <http://localhost:3000>. Keep the Node process running while using the site. Do not open the HTML files directly or use a separate static-file server: the same-origin Node server provides the account and order API.

The SQLite database is created automatically at `data/dotty-elegance.sqlite` the first time the server starts. It is excluded from static site access.

## Store administrator

1. Start the server and register the store owner's customer account from **My Account**.
2. Stop the server.
3. In the project folder, grant that account store-admin access:

   ```sh
   npm run admin:add -- owner@example.com
   ```

4. Restart the server and sign in. Open <http://localhost:3000/admin.html>.

Only grant administrator access to trusted store owners. The admin command updates the user's role in the local database and does not change the password.

## Database and backups

SQLite keeps data in `data/dotty-elegance.sqlite`. To choose a different database file:

```sh
DOTTY_DATABASE_PATH=/path/to/dotty-elegance.sqlite npm start
```

On Windows PowerShell:

```powershell
$env:DOTTY_DATABASE_PATH = "D:\DottyData\dotty-elegance.sqlite"
npm start
```

Back up the database regularly, preferably while the server is stopped, and store backups somewhere private. The database contains customer emails, password hashes, delivery details, favorites, and order history; do not publish or commit it.

## Deployment

The app is a Node server, not a static-only website. Deploy it to a host that supports a persistent Node process and durable disk storage for SQLite. Configure the host to run `npm start`, set `NODE_ENV=production`, expose its assigned `PORT`, and bind `HOST=0.0.0.0` if required by the platform. Use HTTPS in production so session cookies are Secure. Ensure the SQLite data directory is on a persistent volume, and back it up.

Do not deploy the site to GitHub Pages or another static-only host if you need accounts or order tracking. For multiple server instances or horizontally scaled hosting, use a database server rather than a local SQLite file.

## Catalog and order statuses

- Product definitions and initial prices are seeded in `server.js`; product IDs are derived from the product image filenames used in `shop.html`.
- When adding or changing catalog items, update both `shop.html` and the `PRODUCTS` list in `server.js`.
- Order totals are calculated from server-side product prices, not browser-submitted prices.
- Customers see order status in **My Account**. A store admin updates it in `admin.html`: pending, confirmed, preparing, ready for delivery, shipped, delivered, or cancelled.
- The basket is stored in the customer's browser until checkout; submitted orders and their item/price snapshots are saved in SQLite.

## Customer-service chatbot

The chatbot uses fixed answers in `customer-support.js` and can hand customers off to WhatsApp. It does not use an AI service, send chat transcripts to a server, process payments, or request passwords, card numbers, PINs, or verification codes.

## Security notes

- Passwords are hashed with Node.js `scrypt`; plaintext passwords are not stored.
- Sessions use random tokens stored as hashes in SQLite and are sent in HttpOnly, SameSite=Strict cookies.
- Login and registration attempts are rate-limited. Mutating API requests validate their browser origin.
- Static file serving exposes only the storefront's public pages, scripts, styles, and product images; it does not serve the database or backend source files.
- Use HTTPS, trusted administrator accounts, regular backups, and a private persistent data volume in production.
- There is no self-service email password reset because that would require configuring and maintaining an email delivery service. Customers can contact the store; signed-in customers can change their password from their account.
- This app does not collect payment details or process payments.

## Tests

Run the API and database integration tests with:

```sh
npm test
```
