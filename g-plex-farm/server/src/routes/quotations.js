import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function calcTotals(items) {
  let subtotal = 0;
  const priced = items.map(it => {
    const lineTotal = it.qty * it.unit_price * (1 - (it.discount_pct || 0) / 100);
    subtotal += lineTotal;
    return { ...it, line_total: lineTotal };
  });
  const vat_amount = subtotal * 0.16;
  return { items: priced, subtotal, vat_amount, total: subtotal + vat_amount };
}

export default async function quotationRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // GET /api/quotations
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1'; const params = [];
    if (search) { where += ' AND (q.ref_no LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status) { where += ' AND q.status = ?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM quotations q JOIN customers c ON c.id=q.customer_id ${where}`).get(...params).c;
    const rows = db.prepare(`
      SELECT q.*, c.name as customer_name FROM quotations q
      JOIN customers c ON c.id=q.customer_id ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    reply.send({ success: true, data: rows, total });
  });

  // GET /api/quotations/:id
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const q = db.prepare('SELECT q.*, c.name as customer_name, c.phone as customer_phone FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=?').get(req.params.id);
    if (!q) return reply.code(404).send({ success: false, message: 'Quotation not found' });
    const items = db.prepare('SELECT qi.*, p.name as product_name, p.unit FROM quotation_items qi JOIN products p ON p.id=qi.product_id WHERE qi.quotation_id=?').all(q.id);
    reply.send({ success: true, data: { ...q, items } });
  });

  // POST /api/quotations
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { customer_id, date, expiry_date, notes, items = [] } = req.body;
    if (!customer_id || !date) return reply.code(400).send({ success: false, message: 'customer_id and date required' });
    const ref_no = nextRef('QTN', 'quotations', 'ref_no', db);
    const { items: priced, subtotal, vat_amount, total } = calcTotals(items);
    const result = db.prepare(`INSERT INTO quotations (ref_no,customer_id,date,expiry_date,status,subtotal,vat_amount,total,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ref_no, customer_id, date, expiry_date || null, 'draft', subtotal, vat_amount, total, notes || null, req.user.id);
    const qid = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO quotation_items (quotation_id,product_id,description,qty,unit_price,discount_pct,line_total) VALUES (?,?,?,?,?,?,?)');
    priced.forEach(it => insertItem.run(qid, it.product_id, it.description || null, it.qty, it.unit_price, it.discount_pct || 0, it.line_total));
    const quotation = db.prepare('SELECT * FROM quotations WHERE id=?').get(qid);
    reply.code(201).send({ success: true, data: quotation });
  });

  // PUT /api/quotations/:id/status
  app.put('/:id/status', AUTH, (req, reply) => {
    const db = getDb();
    const { status } = req.body;
    db.prepare("UPDATE quotations SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    reply.send({ success: true });
  });

  // POST /api/quotations/:id/convert — convert quotation to sales order
  app.post('/:id/convert', AUTH, (req, reply) => {
    const db = getDb();
    const q = db.prepare('SELECT q.*, qi.product_id, qi.qty, qi.unit_price, qi.line_total FROM quotations q JOIN quotation_items qi ON qi.quotation_id=q.id WHERE q.id=?').all(req.params.id);
    if (!q.length) return reply.code(404).send({ success: false, message: 'Quotation not found' });
    const quot = q[0];
    const ref_no = nextRef('SO', 'sales_orders', 'ref_no', db);
    const soResult = db.prepare(`INSERT INTO sales_orders (ref_no,customer_id,quotation_id,date,status,subtotal,vat_amount,total,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ref_no, quot.customer_id, quot.id, new Date().toISOString().split('T')[0], 'confirmed', quot.subtotal, quot.vat_amount, quot.total, quot.notes, req.user.id);
    const soId = soResult.lastInsertRowid;
    const insertSOI = db.prepare('INSERT INTO sales_order_items (sales_order_id,product_id,qty,unit_price,line_total) VALUES (?,?,?,?,?)');
    q.forEach(it => insertSOI.run(soId, it.product_id, it.qty, it.unit_price, it.line_total));
    db.prepare("UPDATE quotations SET status='accepted', updated_at=datetime('now') WHERE id=?").run(quot.id);
    reply.send({ success: true, data: { sales_order_id: soId, ref_no } });
  });

  // DELETE /api/quotations/:id
  app.delete('/:id', AUTH, (req, reply) => {
    const db = getDb();
    db.prepare('DELETE FROM quotations WHERE id=?').run(req.params.id);
    reply.send({ success: true });
  });
}
