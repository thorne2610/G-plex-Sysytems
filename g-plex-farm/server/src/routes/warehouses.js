import { getDb } from '../db/connection.js';

export default async function warehouseRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare('SELECT * FROM warehouses WHERE is_active=1 ORDER BY name').all() });
  });
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { name, location } = req.body;
    const res = db.prepare('INSERT INTO warehouses (name, location) VALUES (?,?)').run(name, location || null);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM warehouses WHERE id=?').get(res.lastInsertRowid) });
  });
  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    db.prepare('UPDATE warehouses SET name=?, location=? WHERE id=?').run(req.body.name, req.body.location || null, req.params.id);
    reply.send({ success: true });
  });
}
