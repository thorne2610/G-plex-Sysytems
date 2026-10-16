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
- Farm, block and unique field registers, including acreage, location and GeoJSON farm/field boundary capture.
- Crop-agnostic production cycles with seed source/batch, land preparation, planting, spacing, seed rate and expected harvest records.
- Field activity logs for applications, irrigation, rainfall, scouting, crop health, labour, machine hours and actual costs. Product issues can decrement a selected store balance and are linked to a stock movement.
- Graded harvest, rejects/losses, storage location and harvest-sale records, with field/season/variety yield and cost comparisons.
- Chemical use records require a manually entered product-label/guidance reference, approved rate and named/qualified authoriser; the application does not calculate or prescribe pesticide rates.
- Existing machinery/assets register, fuel logs and service records.

The POS and other browser screens use the app's local API and SQLite database. Configure real prices, tax, credit limits, approval rights, stock policy and payment reconciliation before operational use.

## Planned against the full G-Plex requirements

Further delivery is still needed for field boundary drawing and offline sync, input lot/expiry controls, harvest-to-store posting and invoice reconciliation, full contract inspection and farmer settlement, equipment work sheets and mechanisation billing, HR/attendance/timesheets/piece-rate/payroll/safety, budgets and general-ledger posting, procurement approvals, dispatch and proof of delivery, audit history, granular permissions, notifications, barcode/QR traceability and production hosting/backup controls. See [task.md](task.md) for the current coverage and delivery sequence. The prototype should not be treated as a complete production ERP.

## Data and security

- SQLite files are stored in server/data/ and are excluded from version control.
- Environment files are excluded from version control. Never commit production secrets, customer/farmer records or database files.
- Set NODE_ENV=production and serve the application behind HTTPS before production use. Production cookies use the secure flag.
- Arrange verified backups and a tested restore process before using the system for business records.
- The initial administrator is created only for a new database, using the email and password configured in server/.env. Existing administrator accounts are not reset by startup.
