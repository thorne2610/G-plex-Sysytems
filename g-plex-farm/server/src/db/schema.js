// G-Plex Farm ERP — Complete SQLite Database Schema
// All 8 modules defined here

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

/* ─────────────────────────────────────────────
   CORE / SHARED
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  farm_name  TEXT    NOT NULL DEFAULT 'G-Plex Farm',
  currency   TEXT    NOT NULL DEFAULT 'KES',
  date_format TEXT   NOT NULL DEFAULT 'DD/MM/YYYY',
  fy_start   TEXT    NOT NULL DEFAULT '01/01',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('admin','farm_manager','accountant','store_keeper','sales_officer','procurement_officer')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  action      TEXT    NOT NULL,
  table_name  TEXT    NOT NULL,
  record_id   INTEGER,
  old_values  TEXT,
  new_values  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ─────────────────────────────────────────────
   MODULE 1 — CUSTOMERS & SALES
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS customers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  credit_limit REAL    NOT NULL DEFAULT 0,
  balance      REAL    NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no       TEXT    NOT NULL UNIQUE,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  date         TEXT    NOT NULL,
  expiry_date  TEXT,
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
  subtotal     REAL    NOT NULL DEFAULT 0,
  vat_amount   REAL    NOT NULL DEFAULT 0,
  total        REAL    NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  description  TEXT,
  qty          REAL    NOT NULL DEFAULT 1,
  unit_price   REAL    NOT NULL DEFAULT 0,
  discount_pct REAL    NOT NULL DEFAULT 0,
  line_total   REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no        TEXT    NOT NULL UNIQUE,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  quotation_id  INTEGER REFERENCES quotations(id),
  date          TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','partial','fulfilled','cancelled')),
  subtotal      REAL    NOT NULL DEFAULT 0,
  vat_amount    REAL    NOT NULL DEFAULT 0,
  total         REAL    NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  description    TEXT,
  qty            REAL    NOT NULL DEFAULT 1,
  unit_price     REAL    NOT NULL DEFAULT 0,
  line_total     REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no         TEXT    NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  sales_order_id INTEGER REFERENCES sales_orders(id),
  date           TEXT    NOT NULL,
  due_date       TEXT,
  status         TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','partial','paid','overdue','cancelled')),
  subtotal       REAL    NOT NULL DEFAULT 0,
  vat_amount     REAL    NOT NULL DEFAULT 0,
  total          REAL    NOT NULL DEFAULT 0,
  amount_paid    REAL    NOT NULL DEFAULT 0,
  balance_due    REAL    NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  description TEXT,
  qty         REAL    NOT NULL DEFAULT 1,
  unit_price  REAL    NOT NULL DEFAULT 0,
  vat_pct     REAL    NOT NULL DEFAULT 16,
  line_total  REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS receipts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no       TEXT    NOT NULL UNIQUE,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id),
  date         TEXT    NOT NULL,
  amount       REAL    NOT NULL DEFAULT 0,
  mode         TEXT    NOT NULL DEFAULT 'cash' CHECK(mode IN ('cash','bank','mpesa','cheque')),
  reference    TEXT,
  notes        TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ─────────────────────────────────────────────
   MODULE 2 — INVENTORY & STORES
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS product_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  parent_id   INTEGER REFERENCES product_categories(id),
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sku             TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  category_id     INTEGER REFERENCES product_categories(id),
  unit            TEXT    NOT NULL DEFAULT 'kg',
  cost_price      REAL    NOT NULL DEFAULT 0,
  selling_price   REAL    NOT NULL DEFAULT 0,
  reorder_level   REAL    NOT NULL DEFAULT 0,
  vat_pct         REAL    NOT NULL DEFAULT 16,
  is_active       INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warehouses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  location    TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no        TEXT    NOT NULL UNIQUE,
  type          TEXT    NOT NULL CHECK(type IN ('receipt','issue','transfer_out','transfer_in','adjustment','opening')),
  product_id    INTEGER NOT NULL REFERENCES products(id),
  warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id),
  batch_id      INTEGER REFERENCES stock_batches(id),
  qty           REAL    NOT NULL DEFAULT 0,
  unit_cost     REAL    NOT NULL DEFAULT 0,
  total_cost    REAL    NOT NULL DEFAULT 0,
  ref_doc       TEXT,
  ref_id        INTEGER,
  notes         TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_balances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  qty_on_hand  REAL    NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES products(id),
  warehouse_id    INTEGER NOT NULL REFERENCES warehouses(id),
  batch_number    TEXT NOT NULL,
  manufacturer_batch TEXT,
  received_date   TEXT NOT NULL DEFAULT (date('now')),
  expiry_date     TEXT,
  supplier_id     INTEGER REFERENCES suppliers(id),
  seed_lot_id     INTEGER REFERENCES seed_lots(id),
  qty_on_hand     REAL NOT NULL DEFAULT 0,
  unit_cost       REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','quarantined','expired','depleted')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, warehouse_id, batch_number)
);

/* ─────────────────────────────────────────────
   MODULE 3 — ASSETS & MACHINERY
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS assets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK(type IN ('tractor','vehicle','implement','equipment','other')),
  serial_no       TEXT,
  make            TEXT,
  model           TEXT,
  purchase_date   TEXT,
  purchase_cost   REAL    NOT NULL DEFAULT 0,
  useful_life_yrs INTEGER NOT NULL DEFAULT 5,
  salvage_value   REAL    NOT NULL DEFAULT 0,
  current_value   REAL    NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','disposed')),
  assigned_operator_id INTEGER REFERENCES employees(id),
  hour_meter      REAL NOT NULL DEFAULT 0,
  odometer_reading REAL NOT NULL DEFAULT 0,
  insurance_expiry TEXT,
  inspection_due TEXT,
  licence_expiry TEXT,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_depreciation (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id        INTEGER NOT NULL REFERENCES assets(id),
  period          TEXT    NOT NULL,
  depreciation    REAL    NOT NULL DEFAULT 0,
  book_value      REAL    NOT NULL DEFAULT 0,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fuel_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id     INTEGER NOT NULL REFERENCES assets(id),
  date         TEXT    NOT NULL,
  litres       REAL    NOT NULL DEFAULT 0,
  cost_per_ltr REAL    NOT NULL DEFAULT 0,
  total_cost   REAL    NOT NULL DEFAULT 0,
  odometer     REAL,
  operator     TEXT,
  notes        TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id          INTEGER NOT NULL REFERENCES assets(id),
  date              TEXT    NOT NULL,
  description       TEXT    NOT NULL,
  cost              REAL    NOT NULL DEFAULT 0,
  done_by           TEXT,
  next_service_date TEXT,
  spare_parts_cost REAL NOT NULL DEFAULT 0,
  downtime_hours REAL NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  worker_type TEXT NOT NULL CHECK(worker_type IN ('permanent','seasonal','casual','operator','agronomist','contractor')),
  department TEXT,
  job_title TEXT,
  phone TEXT,
  email TEXT,
  contract_ref TEXT,
  start_date TEXT,
  end_date TEXT,
  pay_type TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_type IN ('monthly','daily','hourly','piece_rate')),
  base_rate REAL NOT NULL DEFAULT 0 CHECK(base_rate >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  work_date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  hours REAL NOT NULL DEFAULT 0 CHECK(hours >= 0),
  status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','absent','leave','offsite')),
  farm_id INTEGER REFERENCES farms(id),
  notes TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS labour_work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  farm_id INTEGER REFERENCES farms(id),
  field_id INTEGER REFERENCES fields(id),
  task TEXT NOT NULL,
  worker_count INTEGER NOT NULL DEFAULT 1 CHECK(worker_count > 0),
  hours REAL NOT NULL DEFAULT 0 CHECK(hours >= 0),
  acreage REAL NOT NULL DEFAULT 0 CHECK(acreage >= 0),
  quantity REAL NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  quantity_unit TEXT,
  pay_type TEXT NOT NULL DEFAULT 'hourly' CHECK(pay_type IN ('hourly','daily','piece_rate','unpaid')),
  agreed_rate REAL NOT NULL DEFAULT 0 CHECK(agreed_rate >= 0),
  amount REAL NOT NULL DEFAULT 0 CHECK(amount >= 0),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected','paid')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL CHECK(days > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS safety_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  record_type TEXT NOT NULL CHECK(record_type IN ('training','incident','ppe')),
  event_date TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT,
  expiry_date TEXT,
  action_taken TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paid')),
  gross_total REAL NOT NULL DEFAULT 0,
  deduction_total REAL NOT NULL DEFAULT 0,
  net_total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  paid_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  earnings REAL NOT NULL DEFAULT 0 CHECK(earnings >= 0),
  allowances REAL NOT NULL DEFAULT 0 CHECK(allowances >= 0),
  deductions REAL NOT NULL DEFAULT 0 CHECK(deductions >= 0),
  net_pay REAL NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE(payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS machinery_work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  operator_id INTEGER REFERENCES employees(id),
  farm_id INTEGER REFERENCES farms(id),
  field_id INTEGER REFERENCES fields(id),
  grower_id INTEGER REFERENCES growers(id),
  work_date TEXT NOT NULL,
  service_type TEXT NOT NULL,
  meter_start REAL,
  meter_end REAL,
  hours REAL NOT NULL DEFAULT 0 CHECK(hours >= 0),
  fuel_litres REAL NOT NULL DEFAULT 0 CHECK(fuel_litres >= 0),
  acreage REAL NOT NULL DEFAULT 0 CHECK(acreage >= 0),
  rate_per_acre REAL NOT NULL DEFAULT 0 CHECK(rate_per_acre >= 0),
  amount_billed REAL NOT NULL DEFAULT 0 CHECK(amount_billed >= 0),
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','billed')),
  bill_ref TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(work_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_labour_status_date ON labour_work_logs(status, work_date);
CREATE INDEX IF NOT EXISTS idx_machinery_work_date ON machinery_work_logs(work_date, status);

/* ─────────────────────────────────────────────
   MODULE 4 — ACCOUNTS & FINANCE
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  type        TEXT    NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),
  parent_id   INTEGER REFERENCES chart_of_accounts(id),
  is_active   INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no      TEXT    NOT NULL UNIQUE,
  date        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),
  ref_doc     TEXT,
  ref_id      INTEGER,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  debit      REAL    NOT NULL DEFAULT 0,
  credit     REAL    NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  account_no      TEXT,
  bank_name       TEXT,
  opening_balance REAL    NOT NULL DEFAULT 0,
  current_balance REAL    NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  period_start TEXT    NOT NULL,
  period_end   TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','closed')),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id  INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  amount     REAL    NOT NULL DEFAULT 0
);

/* ─────────────────────────────────────────────
   MODULE 5 — FARM INPUTS
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS farms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  location    TEXT,
  area_ha     REAL NOT NULL DEFAULT 0,
  gps_boundary TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS farm_blocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id     INTEGER NOT NULL REFERENCES farms(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  area_ha     REAL NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(farm_id, code)
);

CREATE TABLE IF NOT EXISTS fields (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id     INTEGER REFERENCES farms(id),
  block_id    INTEGER REFERENCES farm_blocks(id),
  name        TEXT    NOT NULL,
  code        TEXT    NOT NULL UNIQUE,
  area_ha     REAL    NOT NULL DEFAULT 0,
  location    TEXT,
  soil_type   TEXT,
  gps_boundary TEXT,
  gps_lat     REAL,
  gps_lng     REAL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seasons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  start_date  TEXT    NOT NULL,
  end_date    TEXT,
  status      TEXT    NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','closed')),
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS input_plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  field_id    INTEGER NOT NULL REFERENCES fields(id),
  season_id   INTEGER NOT NULL REFERENCES seasons(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  planned_qty REAL    NOT NULL DEFAULT 0,
  planned_cost REAL   NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS input_issues (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no        TEXT    NOT NULL UNIQUE,
  field_id      INTEGER NOT NULL REFERENCES fields(id),
  field_cycle_id INTEGER REFERENCES field_cycles(id),
  season_id     INTEGER NOT NULL REFERENCES seasons(id),
  product_id    INTEGER NOT NULL REFERENCES products(id),
  warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id),
  date          TEXT    NOT NULL,
  qty           REAL    NOT NULL DEFAULT 0,
  unit_cost     REAL    NOT NULL DEFAULT 0,
  total_cost    REAL    NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS labour_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  field_id    INTEGER NOT NULL REFERENCES fields(id),
  season_id   INTEGER NOT NULL REFERENCES seasons(id),
  date        TEXT    NOT NULL,
  activity    TEXT    NOT NULL,
  workers     INTEGER NOT NULL DEFAULT 1,
  hours       REAL    NOT NULL DEFAULT 8,
  rate        REAL    NOT NULL DEFAULT 0,
  total_cost  REAL    NOT NULL DEFAULT 0,
  notes       TEXT,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ─────────────────────────────────────────────
   MODULE 6 — FARM PRODUCTION & OUTPUTS
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS plantings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  field_id        INTEGER NOT NULL REFERENCES fields(id),
  season_id       INTEGER NOT NULL REFERENCES seasons(id),
  crop_variety    TEXT    NOT NULL,
  area_planted_ha REAL    NOT NULL DEFAULT 0,
  planting_date   TEXT    NOT NULL,
  expected_yield  REAL,
  yield_unit      TEXT    NOT NULL DEFAULT 'kg',
  status          TEXT    NOT NULL DEFAULT 'planted' CHECK(status IN ('planned','planted','growing','harvested')),
  notes           TEXT,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* A crop cycle is the complete, crop-agnostic production history for a field. */
CREATE TABLE IF NOT EXISTS field_cycles (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no              TEXT NOT NULL UNIQUE,
  field_id            INTEGER NOT NULL REFERENCES fields(id),
  season_id           INTEGER REFERENCES seasons(id),
  crop                TEXT NOT NULL,
  variety             TEXT NOT NULL,
  seed_source         TEXT,
  seed_batch_no       TEXT,
  land_prep_date      TEXT,
  land_prep_machinery TEXT,
  planting_date       TEXT NOT NULL,
  spacing             TEXT,
  seed_rate           REAL,
  seed_rate_unit      TEXT,
  expected_harvest_date TEXT,
  expected_yield      REAL,
  yield_unit          TEXT NOT NULL DEFAULT 'kg',
  status              TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','harvested','closed')),
  notes               TEXT,
  created_by          INTEGER NOT NULL REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS field_activities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  field_cycle_id  INTEGER NOT NULL REFERENCES field_cycles(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  activity_type   TEXT NOT NULL CHECK(activity_type IN ('land_preparation','fertiliser','chemical','irrigation','rainfall','scouting','crop_health','weeding','planting','other')),
  description     TEXT,
  product_id      INTEGER REFERENCES products(id),
  warehouse_id    INTEGER REFERENCES warehouses(id),
  stock_movement_id INTEGER REFERENCES stock_movements(id),
  input_batch_no  TEXT,
  application_rate REAL,
  application_rate_unit TEXT,
  target_pest     TEXT,
  recommendation_ref TEXT,
  authorised_by_name TEXT,
  authorised_by_qualification TEXT,
  applied_by      INTEGER REFERENCES users(id),
  quantity        REAL NOT NULL DEFAULT 0,
  quantity_unit  TEXT,
  rainfall_mm    REAL,
  observation    TEXT,
  severity       TEXT,
  action_taken   TEXT,
  workers        INTEGER NOT NULL DEFAULT 0,
  labour_hours   REAL NOT NULL DEFAULT 0,
  labour_cost    REAL NOT NULL DEFAULT 0,
  machinery_name TEXT,
  asset_id       INTEGER REFERENCES assets(id),
  machinery_hours REAL NOT NULL DEFAULT 0,
  machinery_cost REAL NOT NULL DEFAULT 0,
  input_cost     REAL NOT NULL DEFAULT 0,
  other_cost     REAL NOT NULL DEFAULT 0,
  total_cost     REAL NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS field_harvests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no          TEXT NOT NULL UNIQUE,
  field_cycle_id  INTEGER NOT NULL REFERENCES field_cycles(id),
  harvest_date    TEXT NOT NULL,
  gross_qty       REAL NOT NULL DEFAULT 0,
  grade_a_qty     REAL NOT NULL DEFAULT 0,
  grade_b_qty     REAL NOT NULL DEFAULT 0,
  grade_c_qty     REAL NOT NULL DEFAULT 0,
  reject_qty      REAL NOT NULL DEFAULT 0,
  loss_qty        REAL NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'kg',
  storage_location TEXT,
  warehouse_id    INTEGER REFERENCES warehouses(id),
  notes           TEXT,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS field_harvest_sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  harvest_id      INTEGER NOT NULL REFERENCES field_harvests(id) ON DELETE CASCADE,
  sale_date       TEXT NOT NULL,
  customer_name   TEXT,
  qty             REAL NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'kg',
  unit_price      REAL NOT NULL DEFAULT 0,
  total_amount    REAL NOT NULL DEFAULT 0,
  invoice_id      INTEGER REFERENCES invoices(id),
  sale_ref        TEXT,
  notes           TEXT,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crop_activities (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  planting_id  INTEGER NOT NULL REFERENCES plantings(id),
  date         TEXT    NOT NULL,
  activity_type TEXT   NOT NULL CHECK(activity_type IN ('ploughing','planting','fertilising','spraying','irrigation','weeding','harvesting','other')),
  description  TEXT,
  cost         REAL    NOT NULL DEFAULT 0,
  done_by      TEXT,
  notes        TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS harvests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no           TEXT    NOT NULL UNIQUE,
  planting_id      INTEGER NOT NULL REFERENCES plantings(id),
  harvest_date     TEXT    NOT NULL,
  gross_qty        REAL    NOT NULL DEFAULT 0,
  unit             TEXT    NOT NULL DEFAULT 'kg',
  storage_location TEXT,
  warehouse_id     INTEGER REFERENCES warehouses(id),
  notes            TEXT,
  created_by       INTEGER NOT NULL REFERENCES users(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grading_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  harvest_id   INTEGER NOT NULL REFERENCES harvests(id),
  date         TEXT    NOT NULL,
  grade_a      REAL    NOT NULL DEFAULT 0,
  grade_b      REAL    NOT NULL DEFAULT 0,
  grade_c      REAL    NOT NULL DEFAULT 0,
  rejects      REAL    NOT NULL DEFAULT 0,
  unit         TEXT    NOT NULL DEFAULT 'kg',
  notes        TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS produce_losses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  harvest_id   INTEGER NOT NULL REFERENCES harvests(id),
  date         TEXT    NOT NULL,
  qty_lost     REAL    NOT NULL DEFAULT 0,
  unit         TEXT    NOT NULL DEFAULT 'kg',
  reason       TEXT    NOT NULL,
  reported_by  INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ─────────────────────────────────────────────
   MODULE 7 — SUPPLIERS & PROCUREMENT
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  payment_terms   INTEGER NOT NULL DEFAULT 30,
  balance         REAL    NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no      TEXT    NOT NULL UNIQUE,
  date        TEXT    NOT NULL,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  status      TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected','ordered')),
  total       REAL    NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id       INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         REAL    NOT NULL DEFAULT 1,
  estimated_price REAL NOT NULL DEFAULT 0,
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no       TEXT    NOT NULL UNIQUE,
  supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
  pr_id        INTEGER REFERENCES purchase_requests(id),
  date         TEXT    NOT NULL,
  expected_date TEXT,
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','partial','received','cancelled')),
  subtotal     REAL    NOT NULL DEFAULT 0,
  vat_amount   REAL    NOT NULL DEFAULT 0,
  total        REAL    NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         REAL    NOT NULL DEFAULT 1,
  unit_price  REAL    NOT NULL DEFAULT 0,
  line_total  REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goods_received_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no       TEXT    NOT NULL UNIQUE,
  po_id        INTEGER NOT NULL REFERENCES purchase_orders(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  date         TEXT    NOT NULL,
  received_by  INTEGER NOT NULL REFERENCES users(id),
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted')),
  notes        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grn_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  grn_id       INTEGER NOT NULL REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  qty_ordered  REAL    NOT NULL DEFAULT 0,
  qty_received REAL    NOT NULL DEFAULT 0,
  unit_price   REAL    NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date  TEXT,
  line_total   REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no       TEXT    NOT NULL UNIQUE,
  supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
  grn_id       INTEGER REFERENCES goods_received_notes(id),
  invoice_no   TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  due_date     TEXT,
  amount       REAL    NOT NULL DEFAULT 0,
  amount_paid  REAL    NOT NULL DEFAULT 0,
  balance_due  REAL    NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid')),
  notes        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no              TEXT    NOT NULL UNIQUE,
  supplier_invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id),
  supplier_id         INTEGER NOT NULL REFERENCES suppliers(id),
  date                TEXT    NOT NULL,
  amount              REAL    NOT NULL DEFAULT 0,
  mode                TEXT    NOT NULL DEFAULT 'bank' CHECK(mode IN ('cash','bank','cheque','mpesa')),
  reference           TEXT,
  bank_account_id     INTEGER REFERENCES bank_accounts(id),
  notes               TEXT,
  created_by          INTEGER NOT NULL REFERENCES users(id),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ─────────────────────────────────────────────
   MODULE 9 — CONTRACT GROWERS & SEED QUALITY
───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS growers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  phone            TEXT,
  national_id      TEXT,
  location         TEXT,
  contract_ref     TEXT,
  contracted_acres REAL    NOT NULL DEFAULT 0,
  crop             TEXT,
  input_credit     REAL    NOT NULL DEFAULT 0,
  next_action      TEXT,
  status           TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','suspended','completed')),
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seed_lots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lot_number      TEXT    NOT NULL UNIQUE,
  product_id      INTEGER REFERENCES products(id),
  variety         TEXT    NOT NULL,
  pack_size       TEXT,
  germination_pct REAL,
  purity_pct      REAL,
  moisture_pct    REAL,
  status          TEXT    NOT NULL DEFAULT 'awaiting_signoff' CHECK(status IN ('released','awaiting_signoff','lab_sample_due','rejected')),
  certificate_no  TEXT,
  qty_available   REAL    NOT NULL DEFAULT 0,
  unit            TEXT    NOT NULL DEFAULT 'bags',
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pos_transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no          TEXT    NOT NULL UNIQUE,
  type            TEXT    NOT NULL CHECK(type IN ('sale','credit_issue')),
  farmer_name     TEXT    NOT NULL,
  grower_id       INTEGER REFERENCES growers(id),
  warehouse_id    INTEGER REFERENCES warehouses(id),
  contract_ref    TEXT,
  payment_method  TEXT,
  recovery_plan   TEXT,
  due_date        TEXT,
  subtotal        REAL    NOT NULL DEFAULT 0,
  tax_amount      REAL    NOT NULL DEFAULT 0,
  total           REAL    NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  INTEGER NOT NULL REFERENCES pos_transactions(id),
  product_id      INTEGER NOT NULL REFERENCES products(id),
  batch_id        INTEGER REFERENCES stock_batches(id),
  lot_number      TEXT,
  qty             REAL    NOT NULL DEFAULT 1,
  unit_price      REAL    NOT NULL DEFAULT 0,
  line_total      REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS grower_credit_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no      TEXT NOT NULL UNIQUE,
  grower_id   INTEGER NOT NULL REFERENCES growers(id),
  amount      REAL NOT NULL CHECK(amount > 0),
  date        TEXT NOT NULL DEFAULT (date('now')),
  mode        TEXT NOT NULL DEFAULT 'cash' CHECK(mode IN ('cash','bank','mpesa','cheque','harvest_recovery')),
  reference   TEXT,
  notes       TEXT,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ─────────────────────────────────────────────
   INDEXES
───────────────────────────────────────────── */
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_warehouse ON stock_batches(product_id, warehouse_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_grower_credit_payments_grower_date ON grower_credit_payments(grower_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_growers_code ON growers(code);
CREATE INDEX IF NOT EXISTS idx_seed_lots_lot ON seed_lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_farm_blocks_farm ON farm_blocks(farm_id, code);
CREATE INDEX IF NOT EXISTS idx_field_cycles_field_season ON field_cycles(field_id, season_id, planting_date);
CREATE INDEX IF NOT EXISTS idx_field_cycles_crop_variety ON field_cycles(crop, variety);
CREATE INDEX IF NOT EXISTS idx_field_activities_cycle_date ON field_activities(field_cycle_id, date);
CREATE INDEX IF NOT EXISTS idx_field_harvests_cycle_date ON field_harvests(field_cycle_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_field_harvest_sales_harvest_date ON field_harvest_sales(harvest_id, sale_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_activities_stock_movement ON field_activities(stock_movement_id) WHERE stock_movement_id IS NOT NULL;
`;
