# G-Plex iFarm — implementation status

This is an in-progress web ERP prototype. The checks below describe what is currently present in source, not a claim that the full integrated system is production-ready.

## Implemented in the current source

- [x] Responsive desktop/tablet/mobile web client, Fastify API, SQLite persistence and protected routes.
- [x] Customer sales workflow: quotations, sales orders, invoices, receipts and farmer POS for cash sales or input credit.
- [x] Product catalogue, multiple warehouses, stock balances/movements, purchase orders and goods-received notes.
- [x] Contract-farmer register, seed-quality lot records and basic quality sign-off.
- [x] Farm → block → uniquely identified field hierarchy, including farm acreage/location and GeoJSON boundary storage.
- [x] Crop-agnostic field cycles with crop/variety, season, seed source/batch, land-preparation details, planting date, spacing/rate, expected harvest and yield.
- [x] Field activity log for fertiliser/chemical applications, irrigation, rainfall, scouting, crop health, labour, machinery hours and costs.
- [x] Optional field input issue from a selected warehouse, with stock sufficiency check, inventory movement, input cost and batch reference.
- [x] Chemical application capture requires an entered label/guidance reference, approved rate and named/qualified authoriser; the application does not calculate or prescribe rates.
- [x] Field-cycle harvest, grading, reject/loss, store/location, harvest sales and variety/field/season comparisons for recorded marketable yield, cost per hectare and revenue.
- [x] Existing asset register, fuel logs and service records; these are the base for the expanded machinery workflow.

## Still required for the integrated-system scope

- [ ] Complete field-service workflows: map drawing/GPS capture, agronomist approval identity/permissions, planned versus actual inputs, batch/expiry controls for all stores, audited stock reservation, crop-cycle edits and offline capture/sync.
- [ ] Harvest-to-warehouse posting, lot-level grading and storage movements, customer sales/invoice reconciliation, dispatch, delivery notes and proof of delivery.
- [ ] Full contract farmer workflow: registration verification, contracts, field inspections, input-support approvals, soil testing, financing, deliveries, deductions, settlement and closure.
- [ ] Machinery/fleet operations: assigned operators, hour-meter/odometer history, daily work sheets, field-service costing, fuel issue/consumption reconciliation, work orders, spare parts, breakdown downtime, insurance/licence/inspection alerts and mechanisation billing by farmer and acreage.
- [ ] HR and payroll: employee/worker records, department and contract, attendance, approved timesheets, field/piece-rate work approvals, leave, payroll runs, allowances/deductions, safety training/incidents/PPE and performance reporting.
- [ ] Fertiliser/chemical governance: approved catalogue, suppliers/prices, lot and expiry management, storage controls, agronomist-authorised plans, application-versus-plan exceptions, safety data and access to applicable Kenyan guidance.
- [ ] Finance controls: budgets, approvals, expense capture, general-ledger posting, bank/payment reconciliation, farm/field/crop profitability and budget-versus-actual reports.
- [ ] Procurement requisition and approval limits, supplier quote comparison, invoice/payment matching and audit-ready approvals.
- [ ] Audit history for all sensitive actions, granular roles/permissions, MFA, notifications, exports, backups/restore procedures and production monitoring.

## Delivery sequence

1. Organization hierarchy and access model: farms, blocks, stores, departments, staff and role assignments.
2. Crop and contract operations: field plans, approved inputs, inspections, attendance/time capture, harvest and farmer settlement.
3. Stock and machinery traceability: lot/expiry balances, authorised issue/returns, maintenance/spares and field work sheets.
4. Finance, procurement, dispatch and approval flows with auditable accounting links.
5. Offline field capture/sync, management analytics, security review, migration rehearsal, backup/restore rehearsal and a controlled pilot.

Before operational use, G-Plex should confirm the company’s approval policy, Kenyan tax/accounting and payroll treatment, data-protection controls, seed certification obligations, chemical safety process and farm boundary data. The current prototype uses SQLite for local/LAN demonstration; hosting, concurrency and recovery requirements must be assessed before a multi-site production rollout.
