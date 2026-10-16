import { getDb } from '../db/connection.js';
export default async function seasonRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all() });
  });
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { name, start_date, end_date, notes } = req.body;
    if (!name || !start_date) return reply.code(400).send({ success: false, message: 'Name and start_date required' });
    const res = db.prepare('INSERT INTO seasons (name,start_date,end_date,status,notes) VALUES (?,?,?,?,?)').run(name, start_date, end_date || null, 'planned', notes || null);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM seasons WHERE id=?').get(res.lastInsertRowid) });
  });
  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    db.prepare('UPDATE seasons SET name=?,start_date=?,end_date=?,status=?,notes=? WHERE id=?').run(req.body.name, req.body.start_date, req.body.end_date, req.body.status, req.body.notes, req.params.id);
    reply.send({ success: true });
  });
}
