import { getDb } from '../db/connection.js';
export default async function assetRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare("SELECT * FROM assets WHERE status != 'disposed' ORDER BY name").all() });
  });
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const asset = db.prepare('SELECT * FROM assets WHERE id=?').get(req.params.id);
    if (!asset) return reply.code(404).send({ success: false, message: 'Asset not found' });
    const fuel = db.prepare('SELECT * FROM fuel_logs WHERE asset_id=? ORDER BY date DESC LIMIT 20').all(asset.id);
    const maintenance = db.prepare('SELECT * FROM maintenance_records WHERE asset_id=? ORDER BY date DESC LIMIT 20').all(asset.id);
    reply.send({ success: true, data: { ...asset, fuel_logs: fuel, maintenance_records: maintenance } });
  });
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { code, name, type, serial_no, make, model, purchase_date, purchase_cost, useful_life_yrs, salvage_value, notes } = req.body;
    if (!code || !name || !type) return reply.code(400).send({ success: false, message: 'code, name and type required' });
    const current_value = (purchase_cost || 0) - (salvage_value || 0);
    const res = db.prepare('INSERT INTO assets (code,name,type,serial_no,make,model,purchase_date,purchase_cost,useful_life_yrs,salvage_value,current_value,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(code, name, type, serial_no || null, make || null, model || null, purchase_date || null, purchase_cost || 0, useful_life_yrs || 5, salvage_value || 0, current_value, notes || null);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM assets WHERE id=?').get(res.lastInsertRowid) });
  });
  app.post('/:id/fuel', AUTH, (req, reply) => {
    const db = getDb();
    const { date, litres, cost_per_ltr, odometer, operator, notes } = req.body;
    const total = (litres || 0) * (cost_per_ltr || 0);
    const res = db.prepare('INSERT INTO fuel_logs (asset_id,date,litres,cost_per_ltr,total_cost,odometer,operator,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(req.params.id, date, litres || 0, cost_per_ltr || 0, total, odometer || null, operator || null, notes || null, req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM fuel_logs WHERE id=?').get(res.lastInsertRowid) });
  });
  app.post('/:id/maintenance', AUTH, (req, reply) => {
    const db = getDb();
    const { date, description, cost, done_by, next_service_date, notes } = req.body;
    const res = db.prepare('INSERT INTO maintenance_records (asset_id,date,description,cost,done_by,next_service_date,notes,created_by) VALUES (?,?,?,?,?,?,?,?)').run(req.params.id, date, description, cost || 0, done_by || null, next_service_date || null, notes || null, req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM maintenance_records WHERE id=?').get(res.lastInsertRowid) });
  });
}
