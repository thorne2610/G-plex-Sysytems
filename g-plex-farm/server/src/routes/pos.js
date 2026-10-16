import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function updateStockBalance(db, productId, warehouseId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type IN ('receipt','transfer_in','opening','adjustment') THEN qty
                            WHEN type IN ('issue','transfer_out') THEN -qty ELSE 0 END), 0) as bal
    FROM stock_movements WHERE product_id=? AND warehouse_id=?
  `).get(productId, warehouseId);
  const qty = Math.max(result.bal, 0);
  db.prepare(`
    INSERT INTO stock_balances (product_id, warehouse_id, qty_on_hand, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(product_id, warehouse_id) DO UPDATE SET qty_on_hand=excluded.qty_on_hand, updated_at=excluded.updated_at
  `).run(productId, warehouseId, qty);
  return qty;
}

export default async function posRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // POST /api/pos/transact
  app.post('/transact', AUTH, (req, reply) => {
    const db = getDb();
    const {
      type = 'sale',
      farmer_name,
      grower_id,
      contract_ref,
      payment_method = 'cash',
      recovery_plan,
      due_date,
      items = [],
      notes,
    } = req.body;

    if (!farmer_name) {
      return reply.code(400).send({ success: false, message: 'Farmer or customer name is required' });
    }
    if (!items.length) {
      return reply.code(400).send({ success: false, message: 'At least one item is required in cart' });
    }

    const prefix = type === 'credit_issue' ? 'CRD' : 'POS';
    const ref_no = nextRef(prefix, 'pos_transactions', 'ref_no', db);

    let subtotal = 0;
    const pricedItems = items.map(it => {
      const line = Number(it.qty) * Number(it.unit_price);
      subtotal += line;
      return { ...it, line_total: line };
    });
    const tax_amount = subtotal * 0.16;
    const total = subtotal + tax_amount;

    // 1. Insert POS Transaction
    const res = db.prepare(`
      INSERT INTO pos_transactions (
        ref_no, type, farmer_name, grower_id, contract_ref, payment_method,
        recovery_plan, due_date, subtotal, tax_amount, total, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ref_no, type, farmer_name, grower_id || null, contract_ref || null,
      payment_method, recovery_plan || null, due_date || null,
      subtotal, tax_amount, total, notes || null, req.user.id
    );

    const txnId = res.lastInsertRowid;

    // 2. Insert items and decrement warehouse stock
    const insItem = db.prepare(`
      INSERT INTO pos_transaction_items (transaction_id, product_id, lot_number, qty, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertSM = db.prepare(`
      INSERT INTO stock_movements (ref_no, type, product_id, warehouse_id, qty, unit_cost, total_cost, ref_doc, ref_id, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let itemIdx = 0;
    for (const item of pricedItems) {
      insItem.run(txnId, item.product_id, item.lot_number || null, item.qty, item.unit_price, item.line_total);

      // Decrement stock from Main Store (warehouse 1)
      const smRef = nextRef('SMI', 'stock_movements', 'ref_no', db) + `_${++itemIdx}`;
      const prod = db.prepare('SELECT cost_price FROM products WHERE id=?').get(item.product_id);
      const unitCost = prod?.cost_price || 0;

      insertSM.run(
        smRef, 'issue', item.product_id, 1, item.qty, unitCost, item.qty * unitCost,
        'POS', txnId, `POS ${type}: ${ref_no} to ${farmer_name}`, req.user.id
      );
      updateStockBalance(db, item.product_id, 1);
    }

    // 3. If credit issue, update grower balance
    if (type === 'credit_issue' && grower_id) {
      db.prepare(`
        UPDATE growers
        SET input_credit = input_credit + ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(total, grower_id);
    }

    reply.code(201).send({
      success: true,
      data: {
        id: txnId,
        ref_no,
        type,
        farmer_name,
        total,
        items_count: items.length,
      },
      message: type === 'sale' ? `Sale confirmed: ${ref_no}` : `Input credit issued: ${ref_no}`,
    });
  });

  // GET /api/pos/history
  app.get('/history', AUTH, (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT pt.*, u.name as cashier_name,
             (SELECT COUNT(*) FROM pos_transaction_items pti WHERE pti.transaction_id=pt.id) as item_count
      FROM pos_transactions pt
      JOIN users u ON u.id = pt.created_by
      ORDER BY pt.created_at DESC
      LIMIT 50
    `).all();
    reply.send({ success: true, data: rows });
  });

  // GET /api/pos/cash-up
  app.get('/cash-up', AUTH, (req, reply) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const totals = db.prepare(`
      SELECT payment_method, type,
             COUNT(*) as count,
             COALESCE(SUM(total), 0) as total_amount
      FROM pos_transactions
      WHERE created_at >= ?
      GROUP BY payment_method, type
    `).all(`${today} 00:00:00`);

    const summary = db.prepare(`
      SELECT COUNT(*) as total_txns, COALESCE(SUM(total), 0) as grand_total
      FROM pos_transactions
      WHERE created_at >= ?
    `).get(`${today} 00:00:00`);

    reply.send({ success: true, data: { date: today, summary, breakdown: totals } });
  });
}
