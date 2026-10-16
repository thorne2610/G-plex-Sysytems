import { getDb } from '../db/connection.js';

function nextRef(prefix, table, field, db) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(3, '0')}`;
}

export default async function growerRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // GET /api/growers
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (name LIKE ? OR code LIKE ? OR location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const rows = db.prepare(`SELECT * FROM growers ${where} ORDER BY code`).all(...params);
    const summary = db.prepare(`
      SELECT COUNT(*) as total_growers,
             COALESCE(SUM(contracted_acres), 0) as total_acres,
             COALESCE(SUM(input_credit), 0) as total_credit_issued
      FROM growers WHERE status = 'active'
    `).get();

    reply.send({ success: true, data: rows, summary });
  });

  // GET /api/growers/:id
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const grower = db.prepare('SELECT * FROM growers WHERE id = ?').get(req.params.id);
    if (!grower) return reply.code(404).send({ success: false, message: 'Grower not found' });
    const transactions = db.prepare('SELECT * FROM pos_transactions WHERE grower_id = ? ORDER BY created_at DESC').all(grower.id);
    reply.send({ success: true, data: { ...grower, transactions } });
  });

  // POST /api/growers
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { name, phone, national_id, location, contract_ref, contracted_acres, crop, next_action, notes } = req.body;
    if (!name) return reply.code(400).send({ success: false, message: 'Grower name is required' });

    const code = nextRef('GR', 'growers', 'code', db);
    const res = db.prepare(`
      INSERT INTO growers (code, name, phone, national_id, location, contract_ref, contracted_acres, crop, next_action, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, name, phone || null, national_id || null, location || null,
      contract_ref || 'Long Rains 2026', contracted_acres || 0, crop || null,
      next_action || 'Field visit', notes || null
    );

    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM growers WHERE id = ?').get(res.lastInsertRowid) });
  });

  // PUT /api/growers/:id
  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const { name, phone, national_id, location, contract_ref, contracted_acres, crop, next_action, status, notes } = req.body;
    db.prepare(`
      UPDATE growers
      SET name=?, phone=?, national_id=?, location=?, contract_ref=?, contracted_acres=?, crop=?, next_action=?, status=?, notes=?, updated_at=datetime('now')
      WHERE id=?
    `).run(
      name, phone || null, national_id || null, location || null, contract_ref || null,
      contracted_acres || 0, crop || null, next_action || null, status || 'active', notes || null,
      req.params.id
    );

    reply.send({ success: true, data: db.prepare('SELECT * FROM growers WHERE id = ?').get(req.params.id) });
  });
}
