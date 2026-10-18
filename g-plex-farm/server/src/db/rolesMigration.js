import { mkdirSync } from 'fs';
import path from 'path';
import { getDb } from './connection.js';
import { ROLE_KEYS } from '../auth/permissions.js';

// The original users table only allowed six role values. This widens that rule to the
// full set of job roles WITHOUT changing any user rows or passwords: a backup is taken
// first, every row is copied across unchanged, and the result is verified before commit.
// It only runs when the old rule is still in place.
// Older installs have a users table without department and phone, which the Users screen needs.
// Adding a column never changes existing rows.
export function ensureUserColumns() {
  const db = getDb();
  const have = new Set(db.prepare("PRAGMA table_info('users')").all().map((c) => c.name));
  if (!have.has('department')) db.exec('ALTER TABLE users ADD COLUMN department TEXT');
  if (!have.has('phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
}

export function ensureRoleSupport() {
  const db = getDb();
  ensureUserColumns();
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!row?.sql) return;

  const checkRe = /CHECK\s*\(\s*role\s+IN\s*\([^)]*\)\s*\)/i;
  const current = row.sql.match(checkRe);
  if (!current) return;
  if (ROLE_KEYS.every((r) => current[0].includes(`'${r}'`))) return; // already up to date

  // 1) Consistent backup copy of the whole database before touching anything.
  const file = db.prepare('PRAGMA database_list').all().find((d) => d.name === 'main')?.file;
  if (file) {
    const dir = path.join(path.dirname(file), 'backups');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(dir, `before-roles-${stamp}.db`).replace(/'/g, "''");
    db.exec(`VACUUM INTO '${target}'`);
    console.log(`✅ Database backup saved: ${target.replace(/''/g, "'")}`);
  }

  // 2) Rebuild the users table with the wider rule, keeping every column and row.
  const columns = db.prepare("PRAGMA table_info('users')").all().map((c) => `"${c.name}"`).join(',');
  const rebuildSql = row.sql
    .replace(checkRe, `CHECK(role IN (${ROLE_KEYS.map((r) => `'${r}'`).join(',')}))`)
    .replace(/CREATE TABLE\s+(IF NOT EXISTS\s+)?("?users"?)/i, 'CREATE TABLE users_rebuild');
  const extras = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='users' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
  const fingerprint = () => db.prepare(
    "SELECT COUNT(*) AS n, COALESCE(group_concat(id || ':' || password_hash || ':' || email || ':' || role || ':' || is_active, '|'), '') AS sig FROM (SELECT * FROM users ORDER BY id)",
  ).get();
  const before = fingerprint();

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(rebuildSql);
      db.exec(`INSERT INTO users_rebuild (${columns}) SELECT ${columns} FROM users`);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_rebuild RENAME TO users');
      for (const extra of extras) db.exec(extra.sql);
      const after = fingerprint();
      if (after.n !== before.n || after.sig !== before.sig) throw new Error('User data check failed after rebuild; changes rolled back.');
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed after rebuild; changes rolled back.');
      db.exec('COMMIT');
      console.log('✅ User roles upgraded (all existing users and passwords unchanged)');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
