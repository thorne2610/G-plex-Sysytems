# G-Plex iFarm — implementation status

This repository contains the current web prototype, not the full 21-section integrated-system scope. Checkboxes below describe implementation coverage in the current source.

## Available in the prototype
- [x] Responsive React web client and Fastify API with SQLite.
- [x] Authentication, user management and role checks on protected API routes.
- [x] Customer sales workflow: quotations, orders, invoices and receipts.
- [x] Product catalogue, warehouses, stock movements, purchase orders and GRNs.
- [x] Contract grower register, seed-quality lots and quality-status workflow.
- [x] Farmer POS: buy-now counter sales and input credit issues linked to a grower/contract, with configured recovery plan.
- [x] Fields register, asset register and report screens.

## Partial or not yet delivered from the detailed requirements
- [ ] Multiple farm records and farm-to-field/warehouse/department ownership hierarchy.
- [ ] Field activity logs for planting, scouting, irrigation, spraying, labour and costs.
- [ ] Fertiliser/chemical application plans, label and safety records, expiry and approvals.
- [ ] Harvest, grading, storage, seed-to-customer traceability, QR/barcodes and customer reservations.
- [ ] Complete contract workflow: inspections, approved budgets, deliveries, deductions, settlement and closure.
- [ ] Equipment work orders, operator logs, mechanisation billing, fuel control and maintenance scheduling.
- [ ] HR records, attendance, timesheets, piece-rate approval, leave and payroll.
- [ ] Purchase requisition/quotation approvals and supplier invoice/payment matching.
- [ ] Budgets, general-ledger posting, farm/field/crop profitability and budget-versus-actual controls.
- [ ] Dispatch, delivery notes, transport allocation and proof of delivery.
- [ ] Configurable approval limits, MFA, notification integrations and offline field capture/sync.
- [ ] Full audit history and role-aware report exports.

## Next implementation sequence
1. Secure setup and repository hygiene; preserve database and secrets outside Git.
2. Organization model: farms, stores, seasons, fields, departments and role assignments.
3. Production and contract workflows: crop plans, field records, input issues, inspections, harvest and settlement.
4. Inventory traceability and guarded approvals across POS, stores and dispatch.
5. Machinery, labour, procurement and finance cost flows.
6. Reporting, notifications, offline field capture, migration, backups and pilot rollout.

Production use requires review of Kenyan tax/accounting treatment, data-protection controls, seed certification rules, employment/payroll requirements and actual company approval policies.
