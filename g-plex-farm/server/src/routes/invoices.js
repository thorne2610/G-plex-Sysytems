import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

export default async function invoiceRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, status, customer_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1'; const params = [];
    if (search) { where += ' AND (i.ref_no LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status) { where += ' AND i.status = ?'; params.push(status); }
    if (customer_id) { where += ' AND i.customer_id = ?'; params.push(customer_id); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM invoices i JOIN customers c ON c.id=i.customer_id ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT i.*, c.name as customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id ${where} ORDER BY i.date DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    reply.send({ success: true, data: rows, total });
  });

  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const inv = db.prepare('SELECT i.*, c.name as customer_name, c.phone, c.address FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=?').get(req.params.id);
    if (!inv) return reply.code(404).send({ success: false, message: 'Invoice not found' });
    const items = db.prepare('SELECT ii.*, p.name as product_name, p.unit FROM invoice_items ii JOIN products p ON p.id=ii.product_id WHERE ii.invoice_id=?').all(inv.id);
    const payments = db.prepare('SELECT * FROM receipts WHERE invoice_id=? ORDER BY date').all(inv.id);
    reply.send({ success: true, data: { ...inv, items, payments } });
  });

  // POST — create invoice directly
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { customer_id, date, due_date, notes, items = [] } = req.body;
    if (!customer_id || !date) return reply.code(400).send({ success: false, message: 'customer_id and date required' });
    const ref_no = nextRef('INV', 'invoices', 'ref_no', db);
    let subtotal = 0;
    const priced = items.map(it => {
      const lt = it.qty * it.unit_price;
      subtotal += lt;
      return { ...it, line_total: lt };
    });
    const vat_amount = subtotal * 0.16;
    const total = subtotal + vat_amount;
    const res = db.prepare('INSERT INTO invoices (ref_no,customer_id,date,due_date,status,subtotal,vat_amount,total,amount_paid,balance_due,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(ref_no, customer_id, date, due_date || null, 'posted', subtotal, vat_amount, total, 0, total, notes || null, req.user.id);
    const invId = res.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id,product_id,qty,unit_price,vat_pct,line_total) VALUES (?,?,?,?,?,?)');
    priced.forEach(it => ins.run(invId, it.product_id, it.qty, it.unit_price, 16, it.line_total));
    db.prepare("UPDATE customers SET balance=balance+?, updated_at=datetime('now') WHERE id=?").run(total, customer_id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM invoices WHERE id=?').get(invId) });
  });

  // Check and update overdue invoices
  app.post('/check-overdue', AUTH, (req, reply) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    db.prepare("UPDATE invoices SET status='overdue' WHERE status IN ('posted','partial') AND due_date < ? AND due_date IS NOT NULL").run(today);
    reply.send({ success: true });
  });
}
