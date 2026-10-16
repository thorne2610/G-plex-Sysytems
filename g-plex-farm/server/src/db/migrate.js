import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './connection.js';
import { SCHEMA_SQL } from './schema.js';
import bcrypt from 'bcryptjs';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

export function runMigrations() {
  const db = getDb();

  // Run all schema SQL
  db.exec(SCHEMA_SQL);

  // Additive upgrades for installations created before farm hierarchy fields were introduced.
  const fieldColumns = new Set(db.prepare("PRAGMA table_info('fields')").all().map(column => column.name));
  if (!fieldColumns.has('farm_id')) db.exec('ALTER TABLE fields ADD COLUMN farm_id INTEGER REFERENCES farms(id)');
  if (!fieldColumns.has('block_id')) db.exec('ALTER TABLE fields ADD COLUMN block_id INTEGER REFERENCES farm_blocks(id)');
  if (!fieldColumns.has('gps_boundary')) db.exec('ALTER TABLE fields ADD COLUMN gps_boundary TEXT');
  const issueColumns = new Set(db.prepare("PRAGMA table_info('input_issues')").all().map(column => column.name));
  if (!issueColumns.has('field_cycle_id')) db.exec('ALTER TABLE input_issues ADD COLUMN field_cycle_id INTEGER REFERENCES field_cycles(id)');
  const activityColumns = new Set(db.prepare("PRAGMA table_info('field_activities')").all().map(column => column.name));
  const activityUpgrades = [
    ['warehouse_id', 'INTEGER REFERENCES warehouses(id)'],
    ['stock_movement_id', 'INTEGER REFERENCES stock_movements(id)'],
    ['application_rate', 'REAL'],
    ['application_rate_unit', 'TEXT'],
    ['target_pest', 'TEXT'],
    ['recommendation_ref', 'TEXT'],
    ['authorised_by_name', 'TEXT'],
    ['authorised_by_qualification', 'TEXT'],
    ['applied_by', 'INTEGER REFERENCES users(id)'],
  ];
  for (const [column, definition] of activityUpgrades) {
    if (!activityColumns.has(column)) db.exec(`ALTER TABLE field_activities ADD COLUMN ${column} ${definition}`);
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_fields_farm_block ON fields(farm_id, block_id, code)');

  console.log('✅ Database schema applied');
}

export async function seedDatabase() {
  const db = getDb();

  // ── Settings ─────────────────────────────────────────────────
  const settingsExists = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!settingsExists) {
    db.prepare(`
      INSERT INTO settings (id, farm_name, currency, date_format, fy_start)
      VALUES (1, 'G-Plex Farm', 'KES', 'DD/MM/YYYY', '01/01')
    `).run();
    console.log('✅ Default settings inserted');
  }

  // Give legacy installations a farm parent so their existing fields remain visible.
  let defaultFarm = db.prepare('SELECT id FROM farms ORDER BY id LIMIT 1').get();
  if (!defaultFarm) {
    const created = db.prepare("INSERT INTO farms (code,name,location,notes) VALUES ('FARM-001','G-Plex Main Farm','Kenya','Default farm created during upgrade; update this record with the actual farm boundary and acreage.')").run();
    defaultFarm = { id: created.lastInsertRowid };
  }

    // ── Default Admin User ────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gplex.farm';
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!adminExists) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!initialPassword || initialPassword.length < 12) {
      throw new Error('Set ADMIN_INITIAL_PASSWORD (at least 12 characters) in server/.env before creating the first administrator.');
    }
    const hash = await bcrypt.hash(initialPassword, 12);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('System Administrator', ?, ?, 'admin')")
      .run(adminEmail, hash);
    console.log('✅ Initial administrator created for ' + adminEmail);
  }
  // ── Default Warehouses ──────────────────────────────────────
  const warehouseCount = db.prepare('SELECT COUNT(*) as c FROM warehouses').get();
  if (warehouseCount.c === 0) {
    const insertWH = db.prepare('INSERT INTO warehouses (name, location) VALUES (?, ?)');
    [
      ['Main Store', 'Farm HQ'],
      ['Chemicals Store', 'Farm HQ - Chemical Room'],
      ['Produce Store', 'Farm HQ - Cold Room'],
      ['Spare Parts Store', 'Workshop'],
    ].forEach(([name, location]) => insertWH.run(name, location));
    console.log('✅ Default warehouses created');
  }

  // ── Product Categories ────────────────────────────────────────
  const catCount = db.prepare('SELECT COUNT(*) as c FROM product_categories').get();
  if (catCount.c === 0) {
    const insertCat = db.prepare('INSERT INTO product_categories (name, description) VALUES (?, ?)');
    [
      ['Seeds', 'Crop seeds and planting materials'],
      ['Fertilisers', 'Organic and inorganic fertilisers'],
      ['Chemicals', 'Pesticides, herbicides and fungicides'],
      ['Packaging', 'Bags, crates and packaging materials'],
      ['Spare Parts', 'Machinery and vehicle spare parts'],
      ['Harvested Produce', 'Graded and stored farm produce'],
      ['General Supplies', 'Miscellaneous farm supplies'],
    ].forEach(([name, desc]) => insertCat.run(name, desc));
    console.log('✅ Default product categories created');
  }

  // ── Chart of Accounts (Standard Farm COA) ────────────────────
  const coaCount = db.prepare('SELECT COUNT(*) as c FROM chart_of_accounts').get();
  if (coaCount.c === 0) {
    const insertCOA = db.prepare(`
      INSERT INTO chart_of_accounts (code, name, type, parent_id) VALUES (?, ?, ?, ?)
    `);
    const coa = [
      // ASSETS
      { code: '1000', name: 'ASSETS', type: 'asset', parent: null },
      { code: '1100', name: 'Current Assets', type: 'asset', parent: '1000' },
      { code: '1110', name: 'Cash on Hand', type: 'asset', parent: '1100' },
      { code: '1120', name: 'Bank Account', type: 'asset', parent: '1100' },
      { code: '1130', name: 'Accounts Receivable', type: 'asset', parent: '1100' },
      { code: '1140', name: 'Inventory - Inputs', type: 'asset', parent: '1100' },
      { code: '1150', name: 'Inventory - Produce', type: 'asset', parent: '1100' },
      { code: '1200', name: 'Non-Current Assets', type: 'asset', parent: '1000' },
      { code: '1210', name: 'Land', type: 'asset', parent: '1200' },
      { code: '1220', name: 'Machinery & Equipment', type: 'asset', parent: '1200' },
      { code: '1221', name: 'Accumulated Depreciation', type: 'asset', parent: '1220' },
      // LIABILITIES
      { code: '2000', name: 'LIABILITIES', type: 'liability', parent: null },
      { code: '2100', name: 'Current Liabilities', type: 'liability', parent: '2000' },
      { code: '2110', name: 'Accounts Payable', type: 'liability', parent: '2100' },
      { code: '2120', name: 'VAT Payable', type: 'liability', parent: '2100' },
      { code: '2200', name: 'Long-Term Liabilities', type: 'liability', parent: '2000' },
      { code: '2210', name: 'Bank Loans', type: 'liability', parent: '2200' },
      // EQUITY
      { code: '3000', name: 'EQUITY', type: 'equity', parent: null },
      { code: '3100', name: "Owner's Capital", type: 'equity', parent: '3000' },
      { code: '3200', name: 'Retained Earnings', type: 'equity', parent: '3000' },
      // INCOME
      { code: '4000', name: 'INCOME', type: 'income', parent: null },
      { code: '4100', name: 'Crop Sales Revenue', type: 'income', parent: '4000' },
      { code: '4200', name: 'Livestock Sales Revenue', type: 'income', parent: '4000' },
      { code: '4300', name: 'Other Income', type: 'income', parent: '4000' },
      // EXPENSES
      { code: '5000', name: 'EXPENSES', type: 'expense', parent: null },
      { code: '5100', name: 'Cost of Production', type: 'expense', parent: '5000' },
      { code: '5110', name: 'Seed Costs', type: 'expense', parent: '5100' },
      { code: '5120', name: 'Fertiliser Costs', type: 'expense', parent: '5100' },
      { code: '5130', name: 'Chemical Costs', type: 'expense', parent: '5100' },
      { code: '5140', name: 'Labour Costs', type: 'expense', parent: '5100' },
      { code: '5150', name: 'Irrigation Costs', type: 'expense', parent: '5100' },
      { code: '5200', name: 'Machinery & Equipment', type: 'expense', parent: '5000' },
      { code: '5210', name: 'Fuel & Lubricants', type: 'expense', parent: '5200' },
      { code: '5220', name: 'Repairs & Maintenance', type: 'expense', parent: '5200' },
      { code: '5230', name: 'Depreciation Expense', type: 'expense', parent: '5200' },
      { code: '5300', name: 'Administrative Expenses', type: 'expense', parent: '5000' },
      { code: '5310', name: 'Salaries & Wages', type: 'expense', parent: '5300' },
      { code: '5320', name: 'Utilities', type: 'expense', parent: '5300' },
      { code: '5330', name: 'Office Supplies', type: 'expense', parent: '5300' },
      { code: '5400', name: 'Finance Costs', type: 'expense', parent: '5000' },
      { code: '5410', name: 'Bank Charges', type: 'expense', parent: '5400' },
      { code: '5420', name: 'Loan Interest', type: 'expense', parent: '5400' },
    ];

    // Build lookup map
    const codeToId = {};
    for (const row of coa) {
      const parentId = row.parent ? codeToId[row.parent] : null;
      const result = insertCOA.run(row.code, row.name, row.type, parentId);
      codeToId[row.code] = result.lastInsertRowid;
    }
    console.log('✅ Chart of accounts seeded (40 accounts)');
  }

  // ── Default Farm Fields (Growing Landscape) ──────────────────
  const fieldCount = db.prepare('SELECT COUNT(*) as c FROM fields').get();
  if (fieldCount.c === 0) {
    const insertField = db.prepare('INSERT INTO fields (code, name, area_ha, location, soil_type, notes) VALUES (?, ?, ?, ?, ?, ?)');
    insertField.run('MUTHAIGA-A3', 'Muthaiga Plot A3', 17.0, 'Muthaiga Block', 'Volcanic Loam', '42 acres under Maize seed H614. Roguing complete.');
    insertField.run('KILIMO-B1', 'Kilimo Plot B1', 12.5, 'Kilimo Sector', 'Sandy Clay', '31 acres under Bean seed Rosecoco. Germination count due.');
    insertField.run('KIRINYAGA-C2', 'Kirinyaga Plot C2', 10.5, 'Kirinyaga Zone', 'Red Loam', '26 acres under Maize seed H614. Growing well.');
    console.log('✅ Default fields seeded (Muthaiga, Kilimo, Kirinyaga)');
  }

  db.prepare('UPDATE fields SET farm_id=? WHERE farm_id IS NULL').run(defaultFarm.id);
  db.prepare('UPDATE farms SET area_ha=COALESCE((SELECT SUM(area_ha) FROM fields WHERE farm_id=farms.id),area_ha) WHERE id=? AND area_ha=0').run(defaultFarm.id);

  // ── Default POS Products & Seed Lots ─────────────────────────
  const prodCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE sku IN (?,?,?,?)').get('GP-H614-25', 'GP-ROSE-10', 'NPK-1717-50', 'KNAP-16L');
  if (prodCount.c === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (sku, name, category_id, unit, cost_price, selling_price, reorder_level, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const p1 = insertProd.run('GP-H614-25', 'Certified maize seed · H614', 1, 'bag', 1800, 2450, 15, '25 kg bag · Lot GP-26-038');
    const p2 = insertProd.run('GP-ROSE-10', 'Bean seed · Rosecoco', 1, 'bag', 850, 1180, 10, '10 kg bag · Lot GP-26-042');
    const p3 = insertProd.run('NPK-1717-50', 'NPK fertilizer · 17:17:17', 2, 'bag', 3400, 4300, 10, '50 kg bag · Lot NPK-26-09');
    const p4 = insertProd.run('KNAP-16L', 'Knapsack sprayer', 7, 'unit', 4800, 6500, 5, '16 L · Returnable equipment');

    // Add stock in Warehouse 1 (Main Store)
    const insertBal = db.prepare('INSERT INTO stock_balances (product_id, warehouse_id, qty_on_hand) VALUES (?, ?, ?)');
    insertBal.run(p1.lastInsertRowid, 1, 84);
    insertBal.run(p2.lastInsertRowid, 1, 46);
    insertBal.run(p3.lastInsertRowid, 1, 25);
    insertBal.run(p4.lastInsertRowid, 1, 6);
    console.log('✅ Default POS input products and store stock seeded');
  }

  // ── Seed Quality Lots ────────────────────────────────────────
  const lotCount = db.prepare('SELECT COUNT(*) as c FROM seed_lots').get();
  if (lotCount.c === 0) {
    const insertLot = db.prepare(`
      INSERT INTO seed_lots (lot_number, variety, pack_size, germination_pct, purity_pct, moisture_pct, status, certificate_no, qty_available, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLot.run('GP-26-041', 'H614', '25 kg bag', 94.0, 99.4, 12.2, 'awaiting_signoff', 'KEPHIS-2026-9041', 250, 'bags');
    insertLot.run('GP-26-038', 'Rosecoco', '10 kg bag', 92.0, 99.1, 11.8, 'released', 'KEPHIS-2026-8838', 180, 'bags');
    insertLot.run('GP-26-035', 'H614', '25 kg bag', null, 98.8, 13.0, 'lab_sample_due', null, 300, 'bags');
    console.log('✅ Default seed lots seeded');
  }

  // ── Contract Growers ─────────────────────────────────────────
  const growerCount = db.prepare('SELECT COUNT(*) as c FROM growers').get();
  if (growerCount.c === 0) {
    const insertGrower = db.prepare(`
      INSERT INTO growers (code, name, phone, national_id, location, contract_ref, contracted_acres, crop, input_credit, next_action, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertGrower.run('GR-128', 'Demo Farmer 128', null, null, 'Kirinyaga / Muthaiga', 'Long Rains 2026', 4.2, 'Certified maize seed · H614', 14500, 'Delivery booking', 'active');
    insertGrower.run('GR-204', 'Demo Farmer 204', null, null, 'Nakuru / Kilimo', 'Long Rains 2026', 2.8, 'Bean seed · Rosecoco', 8200, 'Field visit', 'active');
    insertGrower.run('GR-251', 'Demo Farmer 251', null, null, 'Thika / Ridge', 'Short Rains 2026', 3.5, 'Certified maize seed · H614', 0, 'Input issue', 'active');
    console.log('✅ Demo contract growers seeded (no personal contact or identity data)');
  }

  console.log('\n🌱 G-Plex Farm ERP database ready!');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/db/migrate.js')) {
  runMigrations();
  await seedDatabase();
}
