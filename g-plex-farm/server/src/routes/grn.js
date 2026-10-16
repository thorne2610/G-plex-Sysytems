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
    const ins = db.prepare('INSERT INTO grn_items (grn_id,product_id,qty_ordered,qty_received,unit_price,line_total) VALUES (?,?,?,?,?,?)');
    items.forEach(it => ins.run(grnId, it.product_id, it.qty_ordered || 0, it.qty_received || 0, it.unit_price || 0, (it.qty_received || 0) * (it.unit_price || 0)));
    reply.code(201).send({ success: true, data: { grn_id: grnId, ref_no } });
  });

  // POST /api/grn/:id/post — confirm GRN and increase stock
  app.post('/:id/post', AUTH, (req, reply) => {
    const db = getDb();
    const grn = db.prepare('SELECT * FROM goods_received_notes WHERE id=?').get(req.params.id);
    if (!grn) return reply.code(404).send({ success: false, message: 'GRN not found' });
    if (grn.status === 'posted') return reply.code(400).send({ success: false, message: 'GRN already posted' });
    const items = db.prepare('SELECT * FROM grn_items WHERE grn_id=?').all(grn.id);
    const insertSM = db.prepare('INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,ref_doc,ref_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    let smIdx = 0;
    for (const item of items) {
      if (item.qty_received > 0) {
        const ref_no = nextRef('SMR', 'stock_movements', 'ref_no', db) + `_${++smIdx}`;
        insertSM.run(`GRN-${grn.ref_no}-${smIdx}`, 'receipt', item.product_id, grn.warehouse_id, item.qty_received, item.unit_price, item.line_total, 'GRN', grn.id, `GRN receipt: ${grn.ref_no}`, req.user.id);
        updateBalance(db, item.product_id, grn.warehouse_id);
        db.prepare("UPDATE products SET cost_price=? WHERE id=?").run(item.unit_price, item.product_id);
      }
    }
    db.prepare("UPDATE goods_received_notes SET status='posted' WHERE id=?").run(grn.id);
    db.prepare("UPDATE purchase_orders SET status='received', updated_at=datetime('now') WHERE id=?").run(grn.po_id);
    reply.send({ success: true, message: 'GRN posted — stock updated' });
  });
}
