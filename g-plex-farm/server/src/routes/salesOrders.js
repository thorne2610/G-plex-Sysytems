import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

export default async function salesOrderRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1'; const params = [];
    if (search) { where += ' AND (so.ref_no LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status) { where += ' AND so.status = ?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM sales_orders so JOIN customers c ON c.id=so.customer_id ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT so.*, c.name as customer_name FROM sales_orders so JOIN customers c ON c.id=so.customer_id ${where} ORDER BY so.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    reply.send({ success: true, data: rows, total });
  });

  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const so = db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so JOIN customers c ON c.id=so.customer_id WHERE so.id=?').get(req.params.id);
    if (!so) return reply.code(404).send({ success: false, message: 'Sales order not found' });
    const items = db.prepare('SELECT soi.*, p.name as product_name, p.unit FROM sales_order_items soi JOIN products p ON p.id=soi.product_id WHERE soi.sales_order_id=?').all(so.id);
    reply.send({ success: true, data: { ...so, items } });
  });

  // POST — create sales order manually (items)
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { customer_id, date, notes, items = [] } = req.body;
    if (!customer_id || !date) return reply.code(400).send({ success: false, message: 'customer_id and date required' });
    const ref_no = nextRef('SO', 'sales_orders', 'ref_no', db);
    let subtotal = 0;
    const priced = items.map(it => {
      const lt = it.qty * it.unit_price;
      subtotal += lt;
      return { ...it, line_total: lt };
    });
    const vat_amount = subtotal * 0.16;
    const total = subtotal + vat_amount;
    const res = db.prepare('INSERT INTO sales_orders (ref_no,customer_id,date,status,subtotal,vat_amount,total,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(ref_no, customer_id, date, 'confirmed', subtotal, vat_amount, total, notes || null, req.user.id);
    const soId = res.lastInsertRowid;
    const ins = db.prepare('INSERT INTO sales_order_items (sales_order_id,product_id,qty,unit_price,line_total) VALUES (?,?,?,?,?)');
    priced.forEach(it => ins.run(soId, it.product_id, it.qty, it.unit_price, it.line_total));
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM sales_orders WHERE id=?').get(soId) });
  });

  // POST /:id/invoice — generate invoice from order
  app.post('/:id/invoice', AUTH, (req, reply) => {
    const db = getDb();
    const items = db.prepare('SELECT soi.*, so.customer_id, so.subtotal, so.vat_amount, so.total, so.notes FROM sales_order_items soi JOIN sales_orders so ON so.id=soi.sales_order_id WHERE soi.sales_order_id=?').all(req.params.id);
    if (!items.length) return reply.code(404).send({ success: false, message: 'Order not found or empty' });
    const { due_date } = req.body;
    const first = items[0];
    const refNo = nextRef('INV', 'invoices', 'ref_no', db);
    const today = new Date().toISOString().split('T')[0];
    const invRes = db.prepare('INSERT INTO invoices (ref_no,customer_id,sales_order_id,date,due_date,status,subtotal,vat_amount,total,balance_due,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(refNo, first.customer_id, req.params.id, today, due_date || null, 'posted', first.subtotal, first.vat_amount, first.total, first.total, first.notes, req.user.id);
    const invId = invRes.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id,product_id,qty,unit_price,vat_pct,line_total) VALUES (?,?,?,?,?,?)');
    items.forEach(it => ins.run(invId, it.product_id, it.qty, it.unit_price, 16, it.line_total));
    db.prepare("UPDATE customers SET balance=balance+?, updated_at=datetime('now') WHERE id=?").run(first.total, first.customer_id);
    db.prepare("UPDATE sales_orders SET status='fulfilled', updated_at=datetime('now') WHERE id=?").run(req.params.id);
    reply.send({ success: true, data: { invoice_id: invId, ref_no: refNo } });
  });

  app.put('/:id/status', AUTH, (req, reply) => {
    const db = getDb();
    db.prepare("UPDATE sales_orders SET status=?, updated_at=datetime('now') WHERE id=?").run(req.body.status, req.params.id);
    reply.send({ success: true });
  });
}
