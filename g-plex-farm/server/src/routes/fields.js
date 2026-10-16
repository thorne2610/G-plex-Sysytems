import { getDb } from '../db/connection.js';
export default async function fieldRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare('SELECT * FROM fields WHERE is_active=1 ORDER BY name').all() });
  });
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { name, code, area_ha, location, soil_type, gps_lat, gps_lng, notes } = req.body;
    if (!name || !code) return reply.code(400).send({ success: false, message: 'Name and code required' });
    const res = db.prepare('INSERT INTO fields (name,code,area_ha,location,soil_type,gps_lat,gps_lng,notes) VALUES (?,?,?,?,?,?,?,?)').run(name, code, area_ha || 0, location || null, soil_type || null, gps_lat || null, gps_lng || null, notes || null);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM fields WHERE id=?').get(res.lastInsertRowid) });
  });
  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const { name, area_ha, location, soil_type, notes, is_active } = req.body;
    db.prepare('UPDATE fields SET name=?,area_ha=?,location=?,soil_type=?,notes=?,is_active=? WHERE id=?').run(name, area_ha, location, soil_type, notes, is_active ?? 1, req.params.id);
    reply.send({ success: true });
  });
}
