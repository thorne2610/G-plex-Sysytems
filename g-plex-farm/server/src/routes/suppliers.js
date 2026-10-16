import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

export default async function supplierRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search } = req.query;
    let where = 'WHERE is_active=1'; const params = [];
    if (search) { where += ' AND (name LIKE ? OR code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    reply.send({ success: true, data: db.prepare(`SELECT * FROM suppliers ${where} ORDER BY name`).all(...params) });
  });

  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const s = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
    if (!s) return reply.code(404).send({ success: false, message: 'Supplier not found' });
    const invoices = db.prepare('SELECT * FROM supplier_invoices WHERE supplier_id=? ORDER BY date DESC LIMIT 20').all(s.id);
    reply.send({ success: true, data: { ...s, invoices } });
  });

  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { name, contact_person, phone, email, address, payment_terms, notes } = req.body;
    if (!name) return reply.code(400).send({ success: false, message: 'Name is required' });
    const code = nextRef('SUP', 'suppliers', 'code', db);
    const res = db.prepare('INSERT INTO suppliers (code,name,contact_person,phone,email,address,payment_terms,notes) VALUES (?,?,?,?,?,?,?,?)').run(code, name, contact_person || null, phone || null, email || null, address || null, payment_terms || 30, notes || null);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM suppliers WHERE id=?').get(res.lastInsertRowid) });
  });

  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const { name, contact_person, phone, email, address, payment_terms, notes, is_active } = req.body;
    db.prepare("UPDATE suppliers SET name=?,contact_person=?,phone=?,email=?,address=?,payment_terms=?,notes=?,is_active=?,updated_at=datetime('now') WHERE id=?").run(name, contact_person, phone, email, address, payment_terms, notes, is_active ?? 1, req.params.id);
    reply.send({ success: true, data: db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id) });
  });
}
