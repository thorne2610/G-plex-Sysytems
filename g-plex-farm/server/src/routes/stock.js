import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function updateBalance(db, product_id, warehouse_id) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type IN ('receipt','transfer_in','opening','adjustment') THEN qty
                            WHEN type IN ('issue','transfer_out') THEN -qty ELSE 0 END), 0) as bal
    FROM stock_movements WHERE product_id=? AND warehouse_id=?
  `).get(product_id, warehouse_id);
  const qty = Math.max(result.bal, 0);
  db.prepare(`
    INSERT INTO stock_balances (product_id, warehouse_id, qty_on_hand, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(product_id, warehouse_id) DO UPDATE SET qty_on_hand=excluded.qty_on_hand, updated_at=excluded.updated_at
  `).run(product_id, warehouse_id, qty);
  return qty;
}

export default async function stockRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // GET /api/stock/balances
  app.get('/balances', AUTH, (req, reply) => {
    const db = getDb();
    const { warehouse_id, low_stock } = req.query;
    let where = 'WHERE p.is_active=1'; const params = [];
    if (warehouse_id) { where += ' AND sb.warehouse_id=?'; params.push(warehouse_id); }
    let rows = db.prepare(`
      SELECT p.id, p.sku, p.name, p.unit, p.reorder_level, p.cost_price, p.selling_price,
             w.name as warehouse_name, sb.warehouse_id,
             COALESCE(sb.qty_on_hand, 0) as qty_on_hand,
             COALESCE(sb.qty_on_hand, 0) * p.cost_price as stock_value
      FROM products p
      LEFT JOIN stock_balances sb ON sb.product_id=p.id
      LEFT JOIN warehouses w ON w.id=sb.warehouse_id
      ${where} ORDER BY p.name
    `).all(...params);
    if (low_stock === 'true') {
      rows = rows.filter(r => r.qty_on_hand <= r.reorder_level);
    }
    reply.send({ success: true, data: rows });
  });

  // GET /api/stock/movements
  app.get('/movements', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, type, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1'; const params = [];
    if (product_id) { where += ' AND sm.product_id=?'; params.push(product_id); }
    if (warehouse_id) { where += ' AND sm.warehouse_id=?'; params.push(warehouse_id); }
    if (type) { where += ' AND sm.type=?'; params.push(type); }
    const rows = db.prepare(`
      SELECT sm.*, p.name as product_name, p.unit, w.name as warehouse_name, u.name as created_by_name
      FROM stock_movements sm
      JOIN products p ON p.id=sm.product_id
      JOIN warehouses w ON w.id=sm.warehouse_id
      JOIN users u ON u.id=sm.created_by
      ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    reply.send({ success: true, data: rows });
  });

  // POST /api/stock/receive
  app.post('/receive', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, qty, unit_cost, notes, ref_doc } = req.body;
    if (!product_id || !warehouse_id || !qty) return reply.code(400).send({ success: false, message: 'product_id, warehouse_id and qty required' });
    const ref_no = nextRef('SMR', 'stock_movements', 'ref_no', db);
    db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,ref_doc,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ref_no, 'receipt', product_id, warehouse_id, qty, unit_cost || 0, qty * (unit_cost || 0), ref_doc || null, notes || null, req.user.id);
    const new_qty = updateBalance(db, product_id, warehouse_id);
    reply.code(201).send({ success: true, data: { ref_no, new_qty_on_hand: new_qty } });
  });

  // POST /api/stock/issue
  app.post('/issue', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, qty, notes, ref_doc } = req.body;
    if (!product_id || !warehouse_id || !qty) return reply.code(400).send({ success: false, message: 'product_id, warehouse_id and qty required' });
    const balance = db.prepare('SELECT qty_on_hand FROM stock_balances WHERE product_id=? AND warehouse_id=?').get(product_id, warehouse_id);
    if (!balance || balance.qty_on_hand < qty) return reply.code(400).send({ success: false, message: 'Insufficient stock' });
    const product = db.prepare('SELECT cost_price FROM products WHERE id=?').get(product_id);
    const ref_no = nextRef('SMI', 'stock_movements', 'ref_no', db);
    db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,ref_doc,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ref_no, 'issue', product_id, warehouse_id, qty, product.cost_price, qty * product.cost_price, ref_doc || null, notes || null, req.user.id);
    const new_qty = updateBalance(db, product_id, warehouse_id);
    reply.code(201).send({ success: true, data: { ref_no, new_qty_on_hand: new_qty } });
  });

  // POST /api/stock/transfer
  app.post('/transfer', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, from_warehouse_id, to_warehouse_id, qty, notes } = req.body;
    if (!product_id || !from_warehouse_id || !to_warehouse_id || !qty) return reply.code(400).send({ success: false, message: 'product_id, from/to warehouse_id and qty required' });
    const balance = db.prepare('SELECT qty_on_hand FROM stock_balances WHERE product_id=? AND warehouse_id=?').get(product_id, from_warehouse_id);
    if (!balance || balance.qty_on_hand < qty) return reply.code(400).send({ success: false, message: 'Insufficient stock in source warehouse' });
    const product = db.prepare('SELECT cost_price FROM products WHERE id=?').get(product_id);
    const ref_out = nextRef('SMT', 'stock_movements', 'ref_no', db);
    db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(ref_out, 'transfer_out', product_id, from_warehouse_id, qty, product.cost_price, qty * product.cost_price, notes || null, req.user.id);
    const ref_in = nextRef('SMT', 'stock_movements', 'ref_no', db);
    db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(ref_in, 'transfer_in', product_id, to_warehouse_id, qty, product.cost_price, qty * product.cost_price, notes || null, req.user.id);
    updateBalance(db, product_id, from_warehouse_id);
    updateBalance(db, product_id, to_warehouse_id);
    reply.code(201).send({ success: true, data: { ref_out, ref_in } });
  });

  // POST /api/stock/adjust
  app.post('/adjust', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, new_qty, notes } = req.body;
    const current = db.prepare('SELECT COALESCE(qty_on_hand,0) as q FROM stock_balances WHERE product_id=? AND warehouse_id=?').get(product_id, warehouse_id);
    const diff = (new_qty || 0) - (current?.q || 0);
    const ref_no = nextRef('SMA', 'stock_movements', 'ref_no', db);
    db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(ref_no, 'adjustment', product_id, warehouse_id, Math.abs(diff), 0, 0, notes || `Adjustment: ${diff >= 0 ? '+' : ''}${diff}`, req.user.id);
    const new_balance = updateBalance(db, product_id, warehouse_id);
    reply.code(201).send({ success: true, data: { ref_no, new_qty_on_hand: new_balance } });
  });
}
