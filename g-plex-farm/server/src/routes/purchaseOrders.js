import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

export default async function purchaseOrderRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1'; const params = [];
    if (search) { where += ' AND (po.ref_no LIKE ? OR s.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status) { where += ' AND po.status=?'; params.push(status); }
    const rows = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id ${where} ORDER BY po.date DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    reply.send({ success: true, data: rows });
  });

  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const po = db.prepare('SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?').get(req.params.id);
    if (!po) return reply.code(404).send({ success: false, message: 'PO not found' });
    const items = db.prepare('SELECT poi.*, p.name as product_name, p.unit FROM purchase_order_items poi JOIN products p ON p.id=poi.product_id WHERE poi.po_id=?').all(po.id);
    reply.send({ success: true, data: { ...po, items } });
  });

  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { supplier_id, date, expected_date, notes, items = [] } = req.body;
    if (!supplier_id || !date) return reply.code(400).send({ success: false, message: 'supplier_id and date required' });
    const ref_no = nextRef('PO', 'purchase_orders', 'ref_no', db);
    let subtotal = 0;
    const priced = items.map(it => { const lt = it.qty * it.unit_price; subtotal += lt; return { ...it, line_total: lt }; });
    const vat = subtotal * 0.16;
    const total = subtotal + vat;
    const res = db.prepare('INSERT INTO purchase_orders (ref_no,supplier_id,date,expected_date,status,subtotal,vat_amount,total,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ref_no, supplier_id, date, expected_date || null, 'draft', subtotal, vat, total, notes || null, req.user.id);
    const poId = res.lastInsertRowid;
    const ins = db.prepare('INSERT INTO purchase_order_items (po_id,product_id,qty,unit_price,line_total) VALUES (?,?,?,?,?)');
    priced.forEach(it => ins.run(poId, it.product_id, it.qty, it.unit_price, it.line_total));
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId) });
  });

  app.put('/:id/status', AUTH, (req, reply) => {
    const db = getDb();
    db.prepare("UPDATE purchase_orders SET status=?, updated_at=datetime('now') WHERE id=?").run(req.body.status, req.params.id);
    reply.send({ success: true });
  });
}
