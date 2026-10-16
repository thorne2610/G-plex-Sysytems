import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function updateBalance(db, product_id, warehouse_id) {
  const result = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type IN ('receipt','transfer_in','opening','adjustment') THEN qty WHEN type IN ('issue','transfer_out') THEN -qty ELSE 0 END), 0) as bal FROM stock_movements WHERE product_id=? AND warehouse_id=?`).get(product_id, warehouse_id);
  const qty = Math.max(result.bal, 0);
  db.prepare(`INSERT INTO stock_balances (product_id, warehouse_id, qty_on_hand, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(product_id, warehouse_id) DO UPDATE SET qty_on_hand=excluded.qty_on_hand, updated_at=excluded.updated_at`).run(product_id, warehouse_id, qty);
  return qty;
}

export default async function grnRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const rows = db.prepare('SELECT grn.*, po.ref_no as po_ref_no, s.name as supplier_name, w.name as warehouse_name FROM goods_received_notes grn JOIN purchase_orders po ON po.id=grn.po_id JOIN suppliers s ON s.id=po.supplier_id JOIN warehouses w ON w.id=grn.warehouse_id ORDER BY grn.date DESC LIMIT 100').all();
    reply.send({ success: true, data: rows });
  });

  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const grn = db.prepare('SELECT grn.*, po.ref_no as po_ref_no, s.name as supplier_name, w.name as warehouse_name FROM goods_received_notes grn JOIN purchase_orders po ON po.id=grn.po_id JOIN suppliers s ON s.id=po.supplier_id JOIN warehouses w ON w.id=grn.warehouse_id WHERE grn.id=?').get(req.params.id);
    if (!grn) return reply.code(404).send({ success: false, message: 'GRN not found' });
    const items = db.prepare('SELECT gi.*, p.name as product_name, p.unit FROM grn_items gi JOIN products p ON p.id=gi.product_id WHERE gi.grn_id=?').all(grn.id);
    reply.send({ success: true, data: { ...grn, items } });
  });

  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { po_id, warehouse_id, date, notes, items = [] } = req.body;
    if (!po_id || !warehouse_id || !date) return reply.code(400).send({ success: false, message: 'po_id, warehouse_id and date required' });
    const ref_no = nextRef('GRN', 'goods_received_notes', 'ref_no', db);
    const res = db.prepare('INSERT INTO goods_received_notes (ref_no,po_id,warehouse_id,date,received_by,status,notes) VALUES (?,?,?,?,?,?,?)').run(ref_no, po_id, warehouse_id, date, req.user.id, 'draft', notes || null);
    const grnId = res.lastInsertRowid;
    const ins = db.prepare('INSERT INTO grn_items (grn_id,product_id,qty_ordered,qty_received,unit_price,batch_number,expiry_date,line_total) VALUES (?,?,?,?,?,?,?,?)');
    items.forEach(it => ins.run(grnId, it.product_id, it.qty_ordered || 0, it.qty_received || 0, it.unit_price || 0, it.batch_number || null, it.expiry_date || null, (it.qty_received || 0) * (it.unit_price || 0)));
    reply.code(201).send({ success: true, data: { grn_id: grnId, ref_no } });
  });

  // POST /api/grn/:id/post — confirm GRN and increase stock
  app.post('/:id/post', AUTH, (req, reply) => {
    const db = getDb();
    const grn = db.prepare('SELECT grn.*, po.supplier_id FROM goods_received_notes grn JOIN purchase_orders po ON po.id=grn.po_id WHERE grn.id=?').get(req.params.id);
    if (!grn) return reply.code(404).send({ success: false, message: 'GRN not found' });
    if (grn.status === 'posted') return reply.code(400).send({ success: false, message: 'GRN already posted' });
    const items = db.prepare('SELECT * FROM grn_items WHERE grn_id=?').all(grn.id);
    const insertSM = db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,batch_id,qty,unit_cost,total_cost,ref_doc,ref_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    const receiveBatch = db.prepare(`
      INSERT INTO stock_batches (product_id,warehouse_id,batch_number,received_date,expiry_date,supplier_id,qty_on_hand,unit_cost,status,notes)
      VALUES (?,?,?,?,?,?,?,?,'available',?)
      ON CONFLICT(product_id,warehouse_id,batch_number) DO UPDATE SET
        qty_on_hand=stock_batches.qty_on_hand+excluded.qty_on_hand,
        expiry_date=COALESCE(excluded.expiry_date,stock_batches.expiry_date),
        supplier_id=COALESCE(excluded.supplier_id,stock_batches.supplier_id),
        unit_cost=excluded.unit_cost,status='available',updated_at=datetime('now')
    `);
    let smIdx = 0;
    try {
      db.exec('BEGIN IMMEDIATE');
      for (const item of items) {
        if (item.qty_received > 0) {
          const batchNumber = item.batch_number || `GRN-${grn.ref_no}-${item.product_id}`;
          receiveBatch.run(item.product_id, grn.warehouse_id, batchNumber, grn.date, item.expiry_date || null, grn.supplier_id, item.qty_received, item.unit_price, `Received on ${grn.ref_no}`);
          const batch = db.prepare('SELECT id FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=?').get(item.product_id, grn.warehouse_id, batchNumber);
          const ref_no = `SMR-${grn.id}-${++smIdx}`;
          insertSM.run(ref_no, 'receipt', item.product_id, grn.warehouse_id, batch.id, item.qty_received, item.unit_price, item.line_total, 'GRN', grn.id, `GRN receipt: ${grn.ref_no}`, req.user.id);
          updateBalance(db, item.product_id, grn.warehouse_id);
          db.prepare("UPDATE products SET cost_price=? WHERE id=?").run(item.unit_price, item.product_id);
        }
      }
      db.prepare("UPDATE goods_received_notes SET status='posted' WHERE id=?").run(grn.id);
      db.prepare("UPDATE purchase_orders SET status='received', updated_at=datetime('now') WHERE id=?").run(grn.po_id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    reply.send({ success: true, message: 'GRN posted — stock updated' });
  });
}
