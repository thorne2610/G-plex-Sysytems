import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

export default async function receiptRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { customer_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1'; const params = [];
    if (customer_id) { where += ' AND r.customer_id=?'; params.push(customer_id); }
    const rows = db.prepare(`SELECT r.*, c.name as customer_name, i.ref_no as invoice_ref FROM receipts r JOIN customers c ON c.id=r.customer_id JOIN invoices i ON i.id=r.invoice_id ${where} ORDER BY r.date DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    reply.send({ success: true, data: rows });
  });

  // POST /api/receipts — record a payment
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { customer_id, invoice_id, date, amount, mode, reference, notes } = req.body;
    if (!customer_id || !invoice_id || !date || !amount) {
      return reply.code(400).send({ success: false, message: 'customer_id, invoice_id, date and amount are required' });
    }
    const invoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(invoice_id);
    if (!invoice) return reply.code(404).send({ success: false, message: 'Invoice not found' });
    if (amount > invoice.balance_due + 0.01) {
      return reply.code(400).send({ success: false, message: `Amount exceeds balance due of KES ${invoice.balance_due.toFixed(2)}` });
    }

    const ref_no = nextRef('RCP', 'receipts', 'ref_no', db);

    // Record receipt
    db.prepare('INSERT INTO receipts (ref_no,customer_id,invoice_id,date,amount,mode,reference,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(ref_no, customer_id, invoice_id, date, amount, mode || 'cash', reference || null, notes || null, req.user.id);

    // Update invoice
    const newPaid = invoice.amount_paid + amount;
    const newBalance = invoice.total - newPaid;
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';
    db.prepare("UPDATE invoices SET amount_paid=?, balance_due=?, status=?, updated_at=datetime('now') WHERE id=?").run(newPaid, Math.max(newBalance, 0), newStatus, invoice_id);

    // Update customer balance
    db.prepare("UPDATE customers SET balance=balance-?, updated_at=datetime('now') WHERE id=?").run(amount, customer_id);

    reply.code(201).send({ success: true, data: { ref_no, new_balance: Math.max(newBalance, 0), status: newStatus } });
  });
}
