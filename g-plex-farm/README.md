# G-Plex Farm Management ERP

G-Plex iFarm is a responsive web application for central farm operations, customer sales, stores, procurement, contracted growers and seed quality. It is designed for desktop, tablet and mobile browsers and can run on a local computer or LAN.

## Run locally

Requirements: Node.js 24 or newer (the server uses Node's built-in node:sqlite).

1. From this folder, copy server/.env.example to server/.env.
2. In server/.env, set a unique JWT_SECRET of at least 32 characters and a unique ADMIN_INITIAL_PASSWORD of at least 12 characters. Keep this file private.
3. Install dependencies and start the app:

       npm install
       npm start

npm start builds the React client and starts Fastify. Open http://localhost:3000.

For local development with Vite hot reload, use npm run dev; the API runs on port 3000 and the client on port 5173.

## Current prototype capabilities

- Dashboard, login, individual accounts and role-based API authorization.
- Customer directory, quotations, sales orders, invoices and receipts.
- Multi-warehouse product catalogue, stock movements, purchase orders and goods received notes.
- Contract grower register and seed-lot quality records.
- Farmer POS for counter purchases and approved seed/fertiliser issues on a grower account, with harvest deduction, instalment or service-point recovery options.
- Fields, machinery/assets and operational reports.

The POS and other browser screens use the app's local API and SQLite database. Configure real prices, tax, credit limits, approval rights, stock policy and payment reconciliation before operational use.

## Planned against the full G-Plex requirements

The detailed integrated-system brief also calls for a full multi-farm hierarchy; field activity, input application and harvest workflows; contract inspection and produce settlement; equipment work orders and mechanisation billing; HR, attendance and payroll; budgets, approvals and accounting posting; dispatch and proof of delivery; batch-level stock eligibility/expiry controls; notifications; barcode/QR traceability; and offline field capture/sync. Those capabilities require additional implementation and operational sign-off; the current prototype should not be treated as a complete production ERP.

## Data and security

- SQLite files are stored in server/data/ and are excluded from version control.
- Environment files are excluded from version control. Never commit production secrets, customer/farmer records or database files.
- Set NODE_ENV=production and serve the application behind HTTPS before production use. Production cookies use the secure flag.
- Arrange verified backups and a tested restore process before using the system for business records.
- The initial administrator is created only for a new database, using the email and password configured in server/.env. Existing administrator accounts are not reset by startup.
