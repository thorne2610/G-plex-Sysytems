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

function inTransaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function eligibleBatches(db, productId, warehouseId) {
  return db.prepare(`
    SELECT * FROM stock_batches
    WHERE product_id=? AND warehouse_id=? AND status='available' AND qty_on_hand>0
      AND (expiry_date IS NULL OR expiry_date>=date('now'))
    ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date, received_date, id
  `).all(productId, warehouseId);
}

function allocateBatchStock(db, productId, warehouseId, qty, selectedBatchId = null) {
  let batches = eligibleBatches(db, productId, warehouseId);
  if (selectedBatchId) batches = batches.filter(batch => Number(batch.id) === Number(selectedBatchId));
  const available = batches.reduce((sum, batch) => sum + Number(batch.qty_on_hand), 0);
  if (available + 1e-9 < qty) throw invalid(`Insufficient unexpired batch stock. Available: ${available}`);
  let remaining = qty;
  const allocations = [];
  for (const batch of batches) {
    if (remaining <= 1e-9) break;
    const taken = Math.min(Number(batch.qty_on_hand), remaining);
    db.prepare(`UPDATE stock_batches SET qty_on_hand=qty_on_hand-?, status=CASE WHEN qty_on_hand-?<=0 THEN 'depleted' ELSE 'available' END, updated_at=datetime('now') WHERE id=?`)
      .run(taken, taken, batch.id);
    allocations.push({ batch, qty: taken });
    remaining -= taken;
  }
  return allocations;
}

function receiveIntoBatch(db, { product_id, warehouse_id, batch_number, manufacturer_batch, expiry_date, supplier_id, seed_lot_id, qty, unit_cost, received_date, notes }) {
  const existing = db.prepare('SELECT * FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=?').get(product_id, warehouse_id, batch_number);
  if (existing && existing.status === 'quarantined') throw invalid(`Batch ${batch_number} is quarantined and cannot receive additional stock`);
  const expired = expiry_date && expiry_date < new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO stock_batches (product_id,warehouse_id,batch_number,manufacturer_batch,received_date,expiry_date,supplier_id,seed_lot_id,qty_on_hand,unit_cost,status,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(product_id,warehouse_id,batch_number) DO UPDATE SET
      manufacturer_batch=COALESCE(excluded.manufacturer_batch,stock_batches.manufacturer_batch),
      expiry_date=COALESCE(excluded.expiry_date,stock_batches.expiry_date),
      supplier_id=COALESCE(excluded.supplier_id,stock_batches.supplier_id),
      seed_lot_id=COALESCE(excluded.seed_lot_id,stock_batches.seed_lot_id),
      qty_on_hand=stock_batches.qty_on_hand+excluded.qty_on_hand,
      unit_cost=excluded.unit_cost,
      status=CASE WHEN COALESCE(excluded.expiry_date,stock_batches.expiry_date)<date('now') THEN 'expired' ELSE 'available' END,
      notes=COALESCE(excluded.notes,stock_batches.notes),updated_at=datetime('now')
  `).run(product_id, warehouse_id, batch_number, manufacturer_batch || null, received_date || new Date().toISOString().slice(0, 10), expiry_date || null, supplier_id || null, seed_lot_id || null, qty, unit_cost || 0, expired ? 'expired' : 'available', notes || null);
  return db.prepare('SELECT * FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=?').get(product_id, warehouse_id, batch_number);
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
      SELECT sm.*, p.name as product_name, p.unit, w.name as warehouse_name, u.name as created_by_name, b.batch_number
      FROM stock_movements sm
      JOIN products p ON p.id=sm.product_id
      JOIN warehouses w ON w.id=sm.warehouse_id
      JOIN users u ON u.id=sm.created_by
      LEFT JOIN stock_batches b ON b.id=sm.batch_id
      ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    reply.send({ success: true, data: rows });
  });

  app.get('/batches', AUTH, (req, reply) => {
    const db = getDb();
    const { warehouse_id, product_id, status } = req.query;
    let where = 'WHERE 1=1'; const params = [];
    if (warehouse_id) { where += ' AND b.warehouse_id=?'; params.push(warehouse_id); }
    if (product_id) { where += ' AND b.product_id=?'; params.push(product_id); }
    if (status) { where += ' AND b.status=?'; params.push(status); }
    const rows = db.prepare(`
      SELECT b.*,p.sku,p.name as product_name,p.unit,w.name as warehouse_name,s.name as supplier_name,
        CASE WHEN b.expiry_date IS NOT NULL AND b.expiry_date<date('now') THEN 'expired'
             WHEN b.expiry_date IS NOT NULL AND b.expiry_date<=date('now','+30 days') THEN 'expiring_soon'
             ELSE b.status END as expiry_state
      FROM stock_batches b JOIN products p ON p.id=b.product_id JOIN warehouses w ON w.id=b.warehouse_id
      LEFT JOIN suppliers s ON s.id=b.supplier_id
      ${where} ORDER BY CASE WHEN b.expiry_date IS NULL THEN 1 ELSE 0 END,b.expiry_date,b.received_date
    `).all(...params);
    reply.send({ success: true, data: rows });
  });

  app.get('/available-batches', AUTH, (req, reply) => {
    const db = getDb();
    const { warehouse_id, product_id } = req.query;
    let where = "WHERE b.status='available' AND b.qty_on_hand>0 AND (b.expiry_date IS NULL OR b.expiry_date>=date('now'))"; const params = [];
    if (warehouse_id) { where += ' AND b.warehouse_id=?'; params.push(warehouse_id); }
    if (product_id) { where += ' AND b.product_id=?'; params.push(product_id); }
    const rows = db.prepare(`SELECT b.*,p.sku,p.name as product_name,p.unit,w.name as warehouse_name FROM stock_batches b JOIN products p ON p.id=b.product_id JOIN warehouses w ON w.id=b.warehouse_id ${where} ORDER BY CASE WHEN b.expiry_date IS NULL THEN 1 ELSE 0 END,b.expiry_date,b.received_date`).all(...params);
    reply.send({ success: true, data: rows });
  });

  // POST /api/stock/receive
  app.post('/receive', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, qty, unit_cost, notes, ref_doc, batch_number, manufacturer_batch, expiry_date, supplier_id, seed_lot_id, received_date } = req.body;
    if (!product_id || !warehouse_id || !Number.isFinite(Number(qty)) || Number(qty) <= 0 || !batch_number?.trim()) return reply.code(400).send({ success: false, message: 'product_id, warehouse_id, positive qty and batch_number are required' });
    const ref_no = nextRef('SMR', 'stock_movements', 'ref_no', db);
    try {
      const result = inTransaction(db, () => {
        const batch = receiveIntoBatch(db, { product_id, warehouse_id, batch_number: batch_number.trim(), manufacturer_batch, expiry_date, supplier_id, seed_lot_id, qty: Number(qty), unit_cost: Number(unit_cost) || 0, received_date, notes });
        db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,ref_doc,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(ref_no, 'receipt', product_id, warehouse_id, batch.id, qty, Number(unit_cost) || 0, qty * (Number(unit_cost) || 0), ref_doc || null, notes || `Received batch ${batch_number.trim()}`, req.user.id);
        return { batch, new_qty_on_hand: updateBalance(db, product_id, warehouse_id) };
      });
      reply.code(201).send({ success: true, data: { ref_no, batch_number: result.batch.batch_number, new_qty_on_hand: result.new_qty_on_hand } });
    } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  });

  // POST /api/stock/issue
  app.post('/issue', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, qty, notes, ref_doc, batch_id } = req.body;
    if (!product_id || !warehouse_id || !Number.isFinite(Number(qty)) || Number(qty) <= 0) return reply.code(400).send({ success: false, message: 'product_id, warehouse_id and a positive qty are required' });
    try {
      const result = inTransaction(db, () => {
        const allocations = allocateBatchStock(db, product_id, warehouse_id, Number(qty), batch_id || null);
        const refs = [];
        allocations.forEach(({ batch, qty: allocated }, index) => {
          const base = nextRef('SMI', 'stock_movements', 'ref_no', db);
          const ref_no = allocations.length === 1 ? base : `${base}-${index + 1}`;
          refs.push(ref_no);
          db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,ref_doc,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .run(ref_no, 'issue', product_id, warehouse_id, batch.id, allocated, batch.unit_cost, allocated * batch.unit_cost, ref_doc || null, notes || `Issued batch ${batch.batch_number}`, req.user.id);
        });
        return { refs, new_qty_on_hand: updateBalance(db, product_id, warehouse_id) };
      });
      reply.code(201).send({ success: true, data: { ref_no: result.refs[0], movement_refs: result.refs, new_qty_on_hand: result.new_qty_on_hand } });
    } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  });

  // POST /api/stock/transfer
  app.post('/transfer', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, from_warehouse_id, to_warehouse_id, qty, notes, batch_id } = req.body;
    if (!product_id || !from_warehouse_id || !to_warehouse_id || from_warehouse_id === to_warehouse_id || !Number.isFinite(Number(qty)) || Number(qty) <= 0) return reply.code(400).send({ success: false, message: 'Select different source and target stores and enter a positive qty' });
    try {
      const result = inTransaction(db, () => {
        const allocations = allocateBatchStock(db, product_id, from_warehouse_id, Number(qty), batch_id || null);
        const refs = [];
        allocations.forEach(({ batch, qty: allocated }, index) => {
          const ref = nextRef('SMT', 'stock_movements', 'ref_no', db);
          const ref_out = `${ref}-OUT`, ref_in = `${ref}-IN`;
          refs.push({ ref_out, ref_in, batch_number: batch.batch_number });
          const movedBatch = receiveIntoBatch(db, {
            product_id, warehouse_id: to_warehouse_id, batch_number: batch.batch_number,
            manufacturer_batch: batch.manufacturer_batch, expiry_date: batch.expiry_date,
            supplier_id: batch.supplier_id, seed_lot_id: batch.seed_lot_id,
            qty: allocated, unit_cost: batch.unit_cost, received_date: batch.received_date,
            notes: `Transferred from warehouse ${from_warehouse_id}`,
          });
          const movement = db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
          movement.run(ref_out, 'transfer_out', product_id, from_warehouse_id, batch.id, allocated, batch.unit_cost, allocated * batch.unit_cost, notes || `Transfer to warehouse ${to_warehouse_id}`, req.user.id);
          movement.run(ref_in, 'transfer_in', product_id, to_warehouse_id, movedBatch.id, allocated, batch.unit_cost, allocated * batch.unit_cost, notes || `Transfer from warehouse ${from_warehouse_id}`, req.user.id);
        });
        updateBalance(db, product_id, from_warehouse_id);
        updateBalance(db, product_id, to_warehouse_id);
        return refs;
      });
      reply.code(201).send({ success: true, data: { movements: result } });
    } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  });

  // POST /api/stock/adjust
  app.post('/adjust', AUTH, (req, reply) => {
    const db = getDb();
    const { product_id, warehouse_id, new_qty, notes } = req.body;
    if (!product_id || !warehouse_id || !Number.isFinite(Number(new_qty)) || Number(new_qty) < 0) return reply.code(400).send({ success: false, message: 'product_id, warehouse_id and a non-negative physical count are required' });
    const current = db.prepare('SELECT COALESCE(qty_on_hand,0) as q FROM stock_balances WHERE product_id=? AND warehouse_id=?').get(product_id, warehouse_id);
    const diff = Number(new_qty) - (current?.q || 0);
    try {
      const result = inTransaction(db, () => {
        const ref_no = nextRef('SMA', 'stock_movements', 'ref_no', db);
        if (diff > 0) {
          const product = db.prepare('SELECT cost_price FROM products WHERE id=?').get(product_id);
          const batch = receiveIntoBatch(db, { product_id, warehouse_id, batch_number: `ADJ-${ref_no}`, qty: diff, unit_cost: product?.cost_price || 0, notes: notes || 'Positive stock-count adjustment' });
          db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ref_no, 'adjustment', product_id, warehouse_id, batch.id, diff, batch.unit_cost, diff * batch.unit_cost, notes || null, req.user.id);
        } else if (diff < 0) {
          const allocations = allocateBatchStock(db, product_id, warehouse_id, Math.abs(diff));
          allocations.forEach(({ batch, qty }, index) => {
            db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(allocations.length === 1 ? ref_no : `${ref_no}-${index + 1}`, 'issue', product_id, warehouse_id, batch.id, qty, batch.unit_cost, qty * batch.unit_cost, notes || 'Negative stock-count adjustment', req.user.id);
          });
        }
        return { ref_no, new_qty_on_hand: updateBalance(db, product_id, warehouse_id) };
      });
      reply.code(201).send({ success: true, data: result });
    } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  });
}
