import { getDb } from '../db/connection.js';

export default async function seedQualityRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // GET /api/seed-quality
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { status, variety } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      where += ' AND sl.status = ?';
      params.push(status);
    }
    if (variety) {
      where += ' AND sl.variety LIKE ?';
      params.push(`%${variety}%`);
    }

    const rows = db.prepare(`
      SELECT sl.*, p.name as product_name
      FROM seed_lots sl
      LEFT JOIN products p ON p.id = sl.product_id
      ${where}
      ORDER BY sl.created_at DESC
    `).all(...params);

    const metrics = db.prepare(`
      SELECT COUNT(*) as total_lots,
             COALESCE(AVG(germination_pct), 0) as avg_germination,
             SUM(CASE WHEN status='awaiting_signoff' THEN 1 ELSE 0 END) as awaiting_signoff,
             SUM(CASE WHEN status='lab_sample_due' THEN 1 ELSE 0 END) as lab_sample_due,
             SUM(CASE WHEN status='released' THEN 1 ELSE 0 END) as released_lots
      FROM seed_lots
    `).get();

    reply.send({ success: true, data: rows, metrics });
  });

  // POST /api/seed-quality
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const {
      lot_number, product_id, variety, pack_size,
      germination_pct, purity_pct, moisture_pct, status,
      certificate_no, qty_available, unit, notes
    } = req.body;

    if (!lot_number || !variety) {
      return reply.code(400).send({ success: false, message: 'lot_number and variety are required' });
    }

    const res = db.prepare(`
      INSERT INTO seed_lots (
        lot_number, product_id, variety, pack_size, germination_pct, purity_pct,
        moisture_pct, status, certificate_no, qty_available, unit, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lot_number, product_id || null, variety, pack_size || '25 kg bag',
      germination_pct || null, purity_pct || null, moisture_pct || null,
      status || 'awaiting_signoff', certificate_no || null,
      qty_available || 0, unit || 'bags', notes || null
    );

    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM seed_lots WHERE id = ?').get(res.lastInsertRowid) });
  });

  // PUT /api/seed-quality/:id/status
  app.put('/:id/status', AUTH, (req, reply) => {
    const db = getDb();
    const { status, certificate_no, germination_pct } = req.body;
    db.prepare(`
      UPDATE seed_lots
      SET status = ?,
          certificate_no = COALESCE(?, certificate_no),
          germination_pct = COALESCE(?, germination_pct),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(status, certificate_no || null, germination_pct || null, req.params.id);

    reply.send({ success: true, data: db.prepare('SELECT * FROM seed_lots WHERE id = ?').get(req.params.id) });
  });
}
