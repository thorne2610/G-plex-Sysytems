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

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
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

function allocateLots(db, productId, warehouseId, qty, selectedBatchId = null) {
  let batches = db.prepare(`
    SELECT * FROM stock_batches
    WHERE product_id=? AND warehouse_id=? AND status='available' AND qty_on_hand>0
      AND (expiry_date IS NULL OR expiry_date>=date('now'))
    ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date, received_date, id
  `).all(productId, warehouseId);
  if (selectedBatchId) batches = batches.filter(batch => Number(batch.id) === Number(selectedBatchId));
  const available = batches.reduce((sum, batch) => sum + Number(batch.qty_on_hand), 0);
  if (available + 1e-9 < qty) throw fail(`Not enough eligible stock for the selected warehouse. Available: ${available}`);
  const allocations = [];
  let remaining = qty;
  for (const batch of batches) {
    if (remaining <= 1e-9) break;
    const allocated = Math.min(Number(batch.qty_on_hand), remaining);
    db.prepare(`UPDATE stock_batches SET qty_on_hand=qty_on_hand-?,status=CASE WHEN qty_on_hand-?<=0 THEN 'depleted' ELSE 'available' END,updated_at=datetime('now') WHERE id=?`)
      .run(allocated, allocated, batch.id);
    allocations.push({ batch, qty: allocated });
    remaining -= allocated;
  }
  return allocations;
}

export default async function posRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.post('/transact', AUTH, (req, reply) => {
    const db = getDb();
    const {
      type = 'sale', farmer_name, grower_id, contract_ref, warehouse_id,
      payment_method = 'cash', recovery_plan, due_date, items = [], notes,
    } = req.body || {};

    if (!['sale', 'credit_issue'].includes(type)) return reply.code(400).send({ success: false, message: 'Transaction type must be sale or credit_issue.' });
    if (!farmer_name?.trim()) return reply.code(400).send({ success: false, message: 'Farmer or customer name is required.' });
    if (!warehouse_id) return reply.code(400).send({ success: false, message: 'Select the store issuing the products.' });
    if (!Array.isArray(items) || !items.length) return reply.code(400).send({ success: false, message: 'At least one item is required in cart.' });
    if (type === 'credit_issue' && !grower_id) return reply.code(400).send({ success: false, message: 'Input credit can only be issued to a registered contract farmer.' });
    if (type === 'sale' && !['cash','mpesa','bank','cheque'].includes(payment_method)) return reply.code(400).send({ success: false, message: 'Choose a valid payment channel. Use Input Credit for farmer account issues.' });

    try {
      const receipt = inTransaction(db, () => {
        const grower = grower_id ? db.prepare("SELECT * FROM growers WHERE id=? AND status='active'").get(grower_id) : null;
        if (grower_id && !grower) throw fail('The selected farmer is not active or no longer exists.');
        if (type === 'credit_issue' && grower.input_credit < 0) throw fail('Farmer account balance is invalid; contact finance before issuing inputs.');
        const warehouse = db.prepare('SELECT id FROM warehouses WHERE id=? AND is_active=1').get(warehouse_id);
        if (!warehouse) throw fail('The selected store is not active.');

        const lines = items.map((item) => {
          const qty = Number(item.qty);
          if (!item.product_id || !Number.isFinite(qty) || qty <= 0) throw fail('Each cart item needs a product and a quantity greater than zero.');
          const product = db.prepare('SELECT id,sku,name,unit,cost_price,selling_price,vat_pct,is_active FROM products WHERE id=?').get(item.product_id);
          if (!product || !product.is_active) throw fail('One of the selected products is no longer active. Refresh the POS and try again.');
          const unit_price = Number(product.selling_price || 0);
          return { product, qty, unit_price, subtotal: qty * unit_price, vat_pct: Number(product.vat_pct ?? 16), batch_id: item.batch_id || null };
        });
        const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
        const tax_amount = lines.reduce((sum, line) => sum + line.subtotal * line.vat_pct / 100, 0);
        const total = subtotal + tax_amount;
        const ref_no = nextRef(type === 'credit_issue' ? 'CRD' : 'POS', 'pos_transactions', 'ref_no', db);
        const inserted = db.prepare(`
          INSERT INTO pos_transactions (ref_no,type,farmer_name,grower_id,warehouse_id,contract_ref,payment_method,recovery_plan,due_date,subtotal,tax_amount,total,notes,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(ref_no, type, farmer_name.trim(), grower?.id || null, warehouse_id, contract_ref || grower?.contract_ref || null,
          type === 'credit_issue' ? 'farmer_account' : payment_method, recovery_plan || null, due_date || null,
          subtotal, tax_amount, total, notes || null, req.user.id);
        const transactionId = inserted.lastInsertRowid;
        const insertItem = db.prepare(`INSERT INTO pos_transaction_items (transaction_id,product_id,batch_id,lot_number,qty,unit_price,line_total) VALUES (?,?,?,?,?,?,?)`);
        const insertMovement = db.prepare(`INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,ref_doc,ref_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
        const receiptItems = [];

        for (const line of lines) {
          const allocations = allocateLots(db, line.product.id, warehouse_id, line.qty, line.batch_id);
          for (const { batch, qty } of allocations) {
            const lineTotal = qty * line.unit_price;
            insertItem.run(transactionId, line.product.id, batch.id, batch.batch_number, qty, line.unit_price, lineTotal);
            const movementRef = nextRef('POSI', 'stock_movements', 'ref_no', db);
            insertMovement.run(movementRef, 'issue', line.product.id, warehouse_id, batch.id, qty, batch.unit_cost, qty * batch.unit_cost, 'POS', transactionId,
              `${type === 'sale' ? 'Sale' : 'Farmer input credit'} ${ref_no} · ${farmer_name.trim()}`, req.user.id);
            receiptItems.push({ product: line.product.name, sku: line.product.sku, batch: batch.batch_number, quantity: qty, unit: line.product.unit, unit_price: line.unit_price, total: lineTotal });
          }
          updateStockBalance(db, line.product.id, warehouse_id);
        }

        let credit_balance = null;
        if (type === 'credit_issue') {
          db.prepare("UPDATE growers SET input_credit=input_credit+?,updated_at=datetime('now') WHERE id=?").run(total, grower.id);
          credit_balance = db.prepare('SELECT input_credit FROM growers WHERE id=?').get(grower.id).input_credit;
        }
        return { id: transactionId, ref_no, type, farmer_name: farmer_name.trim(), warehouse_id, subtotal, tax_amount, total, items: receiptItems, credit_balance };
      });

      reply.code(201).send({
        success: true,
        data: receipt,
        message: receipt.type === 'sale' ? `Sale confirmed: ${receipt.ref_no}` : `Input credit issued: ${receipt.ref_no}`,
      });
    } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  });

  app.get('/history', AUTH, (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT pt.*,u.name as cashier_name,w.name as warehouse_name,
        (SELECT COUNT(*) FROM pos_transaction_items pti WHERE pti.transaction_id=pt.id) as item_count
      FROM pos_transactions pt LEFT JOIN users u ON u.id=pt.created_by LEFT JOIN warehouses w ON w.id=pt.warehouse_id
      ORDER BY pt.created_at DESC LIMIT 100
    `).all();
    reply.send({ success: true, data: rows });
  });

  app.get('/credit-ledger', AUTH, (req, reply) => {
    const db = getDb();
    const { grower_id } = req.query;
    const growers = db.prepare(`SELECT id,code,name,input_credit,contract_ref FROM growers WHERE status IN ('active','completed') ${grower_id ? 'AND id=?' : ''} ORDER BY name`).all(...(grower_id ? [grower_id] : []));
    const issues = db.prepare(`SELECT ref_no,grower_id,contract_ref,total,due_date,recovery_plan,created_at FROM pos_transactions WHERE type='credit_issue' ${grower_id ? 'AND grower_id=?' : ''} ORDER BY created_at DESC LIMIT 100`).all(...(grower_id ? [grower_id] : []));
    const payments = db.prepare(`SELECT p.*,g.code,g.name,u.name as received_by FROM grower_credit_payments p JOIN growers g ON g.id=p.grower_id LEFT JOIN users u ON u.id=p.created_by ${grower_id ? 'WHERE p.grower_id=?' : ''} ORDER BY p.date DESC,p.id DESC LIMIT 100`).all(...(grower_id ? [grower_id] : []));
    reply.send({ success: true, data: { growers, issues, payments } });
  });

  app.post('/credit-payments', AUTH, (req, reply) => {
    const db = getDb();
    const { grower_id, amount, mode = 'cash', date, reference, notes } = req.body || {};
    const paymentAmount = Number(amount);
    if (!grower_id || !Number.isFinite(paymentAmount) || paymentAmount <= 0) return reply.code(400).send({ success: false, message: 'Select a farmer and enter a repayment greater than zero.' });
    if (!['cash','bank','mpesa','cheque','harvest_recovery'].includes(mode)) return reply.code(400).send({ success: false, message: 'Select a supported repayment method.' });
    try {
      const payment = inTransaction(db, () => {
        const grower = db.prepare('SELECT * FROM growers WHERE id=?').get(grower_id);
        if (!grower) throw fail('Farmer account was not found.');
        if (paymentAmount > Number(grower.input_credit) + 0.000001) throw fail(`Repayment exceeds the outstanding balance of KES ${Number(grower.input_credit).toLocaleString()}.`);
        const ref_no = nextRef('GRP', 'grower_credit_payments', 'ref_no', db);
        db.prepare('INSERT INTO grower_credit_payments (ref_no,grower_id,amount,date,mode,reference,notes,created_by) VALUES (?,?,?,?,?,?,?,?)')
          .run(ref_no, grower_id, paymentAmount, date || new Date().toISOString().slice(0, 10), mode, reference || null, notes || null, req.user.id);
        db.prepare("UPDATE growers SET input_credit=input_credit-?,updated_at=datetime('now') WHERE id=?").run(paymentAmount, grower_id);
        return { ref_no, grower_id: grower.id, farmer_name: grower.name, amount: paymentAmount, balance: Number(grower.input_credit) - paymentAmount };
      });
      reply.code(201).send({ success: true, data: payment, message: `Repayment recorded: ${payment.ref_no}` });
    } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  });

  app.get('/cash-up', AUTH, (req, reply) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const totals = db.prepare(`
      SELECT payment_method,type,COUNT(*) as count,COALESCE(SUM(total),0) as total_amount
      FROM pos_transactions WHERE created_at>=? GROUP BY payment_method,type
    `).all(`${today} 00:00:00`);
    const summary = db.prepare(`SELECT COUNT(*) as total_txns,COALESCE(SUM(total),0) as grand_total FROM pos_transactions WHERE created_at>=?`).get(`${today} 00:00:00`);
    const repayments = db.prepare(`SELECT mode,COUNT(*) as count,COALESCE(SUM(amount),0) as amount FROM grower_credit_payments WHERE date=? GROUP BY mode`).all(today);
    const repaymentTotal = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM grower_credit_payments WHERE date=?').get(today).total;
    reply.send({ success: true, data: { date: today, summary: { ...summary, repayments_total: repaymentTotal }, breakdown: totals, repayments } });
  });
}
