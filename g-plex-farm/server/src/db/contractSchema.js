// Contract farming workflow tables. Purely additive (CREATE TABLE IF NOT EXISTS):
// existing growers, POS credit and stock data are never altered by this file.
export const CONTRACT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS grower_contracts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_no           TEXT    UNIQUE,
  grower_id             INTEGER NOT NULL REFERENCES growers(id),
  crop                  TEXT    NOT NULL,
  variety               TEXT,
  season                TEXT,
  contracted_acres      REAL    NOT NULL CHECK (contracted_acres > 0),
  verified_acres        REAL,
  planting_date         TEXT,
  expected_harvest_date TEXT,
  expected_yield_kg     REAL    NOT NULL DEFAULT 0,
  agreed_price_per_kg   REAL    NOT NULL DEFAULT 0,
  input_budget          REAL    NOT NULL DEFAULT 0,
  production_budget     REAL    NOT NULL DEFAULT 0,
  terms                 TEXT,
  status                TEXT    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','harvesting','settled','closed','cancelled')),
  cancel_reason         TEXT,
  created_by            INTEGER REFERENCES users(id),
  approved_by           INTEGER REFERENCES users(id),
  approved_at           TEXT,
  settled_at            TEXT,
  closed_at             TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contract_visits (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id        INTEGER NOT NULL REFERENCES grower_contracts(id) ON DELETE CASCADE,
  visit_date         TEXT    NOT NULL,
  visit_type         TEXT    NOT NULL DEFAULT 'field_visit' CHECK (visit_type IN ('inspection','field_visit','pre_harvest')),
  acres_verified     REAL,
  crop_stage         TEXT,
  estimated_yield_kg REAL,
  findings           TEXT,
  next_visit_date    TEXT,
  visited_by         INTEGER REFERENCES users(id),
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contract_deliveries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id    INTEGER NOT NULL REFERENCES grower_contracts(id) ON DELETE CASCADE,
  delivery_date  TEXT    NOT NULL,
  quantity_kg    REAL    NOT NULL CHECK (quantity_kg > 0),
  rejected_kg    REAL    NOT NULL DEFAULT 0 CHECK (rejected_kg >= 0),
  grade          TEXT,
  price_per_kg   REAL    NOT NULL DEFAULT 0,
  gross_value    REAL    NOT NULL DEFAULT 0,
  notes          TEXT,
  received_by    INTEGER REFERENCES users(id),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contract_settlements (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id           INTEGER NOT NULL UNIQUE REFERENCES grower_contracts(id),
  gross_value           REAL    NOT NULL DEFAULT 0,
  input_recovery        REAL    NOT NULL DEFAULT 0,
  other_deductions      REAL    NOT NULL DEFAULT 0,
  other_deductions_note TEXT,
  net_payable           REAL    NOT NULL DEFAULT 0,
  credit_payment_ref    TEXT,
  notes                 TEXT,
  settled_by            INTEGER REFERENCES users(id),
  settled_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contract_payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id   INTEGER NOT NULL REFERENCES grower_contracts(id),
  ref_no        TEXT    UNIQUE,
  amount        REAL    NOT NULL CHECK (amount > 0),
  payment_date  TEXT    NOT NULL,
  method        TEXT    NOT NULL DEFAULT 'mpesa' CHECK (method IN ('cash','bank','mpesa','cheque')),
  reference     TEXT,
  paid_by       INTEGER REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contracts_grower ON grower_contracts(grower_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_visits  ON contract_visits(contract_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_contract_deliv   ON contract_deliveries(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_pay     ON contract_payments(contract_id);
`;
