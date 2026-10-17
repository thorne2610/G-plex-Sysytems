// Customer feedback & CSAT module tables.
// Purely additive: uses CREATE TABLE IF NOT EXISTS, so existing databases
// (including users and passwords) are never modified.
export const FEEDBACK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS feedback_tickets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no        TEXT    UNIQUE,
  customer_id      INTEGER REFERENCES customers(id),
  customer_name    TEXT    NOT NULL,
  email            TEXT,
  phone            TEXT,
  category         TEXT    NOT NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  priority         TEXT    NOT NULL DEFAULT 'Medium',
  status           TEXT    NOT NULL DEFAULT 'Open',
  incident_date    TEXT,
  assigned_dept    TEXT,
  assigned_to      TEXT,
  title            TEXT    NOT NULL,
  description      TEXT,
  attachment_name  TEXT,
  resolution_date  TEXT,
  resolution_notes TEXT,
  created_by       INTEGER REFERENCES users(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES feedback_tickets(id) ON DELETE CASCADE,
  author      TEXT    NOT NULL,
  note        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_status   ON feedback_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback_tickets(category);
CREATE INDEX IF NOT EXISTS idx_feedback_notes    ON feedback_notes(ticket_id);
`;
