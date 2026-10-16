import { getDb } from '../db/connection.js';

function genCode(prefix, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(code, ${prefix.length + 2}) AS INTEGER)) as n FROM customers WHERE code LIKE ?`).get(`${prefix}-%`);
  const n = (row?.n || 0) + 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

export default async function customerRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // GET /api/customers
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM customers ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT * FROM customers ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    reply.send({ success: true, data: rows, total, page: +page, limit: +limit });
  });

  // GET /api/customers/:id
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return reply.code(404).send({ success: false, message: 'Customer not found' });
    // Get ledger (invoices + receipts)
    const invoices = db.prepare('SELECT ref_no, date, total, status, balance_due, "invoice" as type FROM invoices WHERE customer_id = ? ORDER BY date DESC').all(customer.id);
    const receipts = db.prepare('SELECT ref_no, date, amount as total, mode, "receipt" as type FROM receipts WHERE customer_id = ? ORDER BY date DESC').all(customer.id);
    reply.send({ success: true, data: { ...customer, ledger: [...invoices, ...receipts].sort((a, b) => b.date.localeCompare(a.date)) } });
  });

  // POST /api/customers
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { name, phone, email, address, credit_limit, notes } = req.body;
    if (!name) return reply.code(400).send({ success: false, message: 'Name is required' });
    const code = genCode('CUST', db);
    const result = db.prepare(`
      INSERT INTO customers (code, name, phone, email, address, credit_limit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, phone || null, email || null, address || null, credit_limit || 0, notes || null);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    reply.code(201).send({ success: true, data: customer });
  });

  // PUT /api/customers/:id
  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const { name, phone, email, address, credit_limit, notes, is_active } = req.body;
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return reply.code(404).send({ success: false, message: 'Customer not found' });
    db.prepare(`
      UPDATE customers SET name=?, phone=?, email=?, address=?, credit_limit=?, notes=?, is_active=?, updated_at=datetime('now')
      WHERE id=?
    `).run(name, phone || null, email || null, address || null, credit_limit || 0, notes || null, is_active ?? 1, req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    reply.send({ success: true, data: customer });
  });

  // DELETE /api/customers/:id (soft delete)
  app.delete('/:id', AUTH, (req, reply) => {
    const db = getDb();
    db.prepare("UPDATE customers SET is_active=0, updated_at=datetime('now') WHERE id=?").run(req.params.id);
    reply.send({ success: true, message: 'Customer deactivated' });
  });
}
