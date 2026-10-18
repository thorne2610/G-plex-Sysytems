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
- Store batch/lot records with received and expiry dates, supplier traceability, batch-level movement history and earliest-expiry-first stock issue from POS and field activities.
- Contract grower register and seed-lot quality records.
- Farmer POS for walk-in counter purchases and registered-grower input credit, with store selection, tax based on product VAT configuration, receipt lot traceability, recovery terms and repayment recording against the farmer balance.
- Farm, block and unique field registers, including acreage, location and GeoJSON farm/field boundary capture.
- Crop-agnostic production cycles with seed source/batch, land preparation, planting, spacing, seed rate and expected harvest records.
- Field activity logs for applications, irrigation, rainfall, scouting, crop health, labour, machine hours and actual costs. Product issues can decrement a selected store balance and are linked to a stock movement.
- Graded harvest, rejects/losses, storage location and harvest-sale records, with field/season/variety yield and cost comparisons.
- Chemical use records require a manually entered product-label/guidance reference, approved rate and named/qualified authoriser; the application does not calculate or prescribe pesticide rates.
- Existing machinery/assets register, fuel logs and service records.
- Staff register for permanent, seasonal and casual workers, operators, agronomists and service providers; attendance clock records, farm/field work sheets, headcount, hours, acreage, piece-rate calculations and manager approvals.
- Leave requests and safety training, incident and PPE records, with employee linking and expiry/follow-up fields.
- Payroll draft runs with employee earnings, allowances, deductions and approval/payment status. Drafts use monthly base pay, approved attendance for daily/hourly pay and approved piece-rate work. Statutory calculations and general-ledger posting are not implemented.
- Machinery assignments, hour-meter and odometer baselines, insurance/inspection/licence dates, maintenance parts and downtime, and machinery work sheets linked to assets, operators, farms, fields and contracted growers. Per-acre service amounts are calculated from acreage and rate, then progressed through planned, active, completed and billed states.
- Customer Feedback & CSAT: complaint and feedback tickets (optionally linked to a customer) with category, 1-5 CSAT rating, priority, status, department/officer assignment, investigation notes with change history, filters, a CSAT dashboard (rating distribution, category averages, monthly trend, department load) and PDF reports for a single ticket or a management summary. Tables are added with CREATE TABLE IF NOT EXISTS, so existing data and accounts are not altered. This module replaces the earlier standalone feedback-csat-system prototype.
- Roles & access: 12 job roles (administrator, managing director, farm manager, agronomist, storekeeper, machinery manager, HR officer, accountant, procurement officer, sales officer, farmer field officer, auditor). Each role can view or change only the areas it needs; the server enforces this on every request and the menu hides what a user cannot open. A role or deactivation takes effect immediately. The Roles & Access page shows the full matrix. Payroll is prepared by HR and approved by the Accountant, Managing Director or Administrator.
- Audit log: records sign-ins and every create/update/delete (who, when, area, record and the details sent, with passwords hidden). Read-only for the administrator, managing director and auditor.
- On first start after upgrading, the database is backed up to server/data/backups and the users table is widened to allow the new roles; existing users and passwords are copied across unchanged and verified.
- Contract farming: farmer contracts with a full workflow (draft, farm inspection with verified acreage, approval of crop and budgets, monitoring visits, deliveries with grades and rejects, settlement, payments to the farmer, closure and a PDF season report). Inputs the farmer takes on credit through Point of Sale are counted against the contract's input budget; at settlement the outstanding input credit is recovered from the harvest through the existing farmer credit ledger (as a harvest recovery). Automatic flags show contracts approaching harvest, overdue farmer visits (14 days), input over-issuance and unpaid farmer balances.

The POS and other browser screens use the app's local API and SQLite database. Seed/fertiliser issued to a farmer is recorded as credit because these inputs are consumed; physical-return leasing is not used for them. Configure real prices, tax, credit limits, approval rights, stock policy and payment reconciliation before operational use.

## Planned against the full G-Plex requirements

Further delivery is still needed for field boundary drawing and offline sync, batch quarantine/recall controls and expiry alerts, harvest-to-store posting and invoice reconciliation, full contract inspection and farmer settlement, automated machinery invoice posting, statutory payroll calculations and bank payment files, payroll-to-ledger posting, leave balances, budgets and general-ledger posting, procurement approvals, dispatch and proof of delivery, audited credit limits and approvals, granular permissions, notifications, barcode/QR traceability and production hosting/backup controls. See [task.md](task.md) for the current coverage and delivery sequence. The prototype should not be treated as a complete production ERP.

## Data and security

- SQLite files are stored in server/data/ and are excluded from version control.
- Environment files are excluded from version control. Never commit production secrets, customer/farmer records or database files.
- Set NODE_ENV=production and serve the application behind HTTPS before production use. Production cookies use the secure flag.
- Arrange verified backups and a tested restore process before using the system for business records.
- The initial administrator is created only for a new database, using the email and password configured in server/.env. Existing administrator accounts are not reset by startup.
