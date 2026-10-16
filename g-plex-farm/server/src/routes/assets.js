import { getDb } from '../db/connection.js';
export default async function assetRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare("SELECT a.*,e.name AS operator_name FROM assets a LEFT JOIN employees e ON e.id=a.assigned_operator_id WHERE a.status != 'disposed' ORDER BY a.name").all() });
  });
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const asset = db.prepare('SELECT a.*,e.name AS operator_name FROM assets a LEFT JOIN employees e ON e.id=a.assigned_operator_id WHERE a.id=?').get(req.params.id);
    if (!asset) return reply.code(404).send({ success: false, message: 'Asset not found' });
    const fuel = db.prepare('SELECT * FROM fuel_logs WHERE asset_id=? ORDER BY date DESC LIMIT 20').all(asset.id);
    const maintenance = db.prepare('SELECT * FROM maintenance_records WHERE asset_id=? ORDER BY date DESC LIMIT 20').all(asset.id);
    reply.send({ success: true, data: { ...asset, fuel_logs: fuel, maintenance_records: maintenance } });
  });
  app.get('/work-logs', AUTH, (req, reply) => {
    const rows = getDb().prepare(`SELECT w.*,a.code AS asset_code,a.name AS asset_name,e.name AS operator_name,
      f.name AS farm_name,fd.code AS field_code,g.name AS grower_name
      FROM machinery_work_logs w JOIN assets a ON a.id=w.asset_id LEFT JOIN employees e ON e.id=w.operator_id
      LEFT JOIN farms f ON f.id=w.farm_id LEFT JOIN fields fd ON fd.id=w.field_id LEFT JOIN growers g ON g.id=w.grower_id
      ORDER BY w.work_date DESC,w.id DESC LIMIT 500`).all();
    reply.send({ success: true, data: rows });
  });
  app.post('/work-logs', AUTH, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!v.asset_id || !v.work_date || !v.service_type?.trim()) return reply.code(400).send({ success: false, message: 'Machine, date and service type are required.' });
    for (const key of ['hours','fuel_litres','acreage','rate_per_acre','meter_start','meter_end']) {
      if (v[key] !== undefined && Number(v[key]) < 0) return reply.code(400).send({ success: false, message: `${key.replaceAll('_',' ')} cannot be negative.` });
    }
    if (v.meter_start !== undefined && v.meter_end !== undefined && Number(v.meter_end) < Number(v.meter_start)) return reply.code(400).send({ success: false, message: 'Meter end cannot be lower than meter start.' });
    if (v.field_id && v.farm_id && !db.prepare('SELECT id FROM fields WHERE id=? AND farm_id=?').get(v.field_id,v.farm_id)) return reply.code(400).send({ success: false, message: 'Selected field does not belong to the selected farm.' });
    const ref = `MW-${String(db.prepare('SELECT COUNT(*) AS n FROM machinery_work_logs').get().n + 1).padStart(5,'0')}`;
    const acreage = Number(v.acreage || 0); const rate = Number(v.rate_per_acre || 0);
    const hours = v.meter_start !== undefined && v.meter_end !== undefined ? Number(v.meter_end) - Number(v.meter_start) : Number(v.hours || 0);
    const result = db.prepare(`INSERT INTO machinery_work_logs (ref_no,asset_id,operator_id,farm_id,field_id,grower_id,work_date,service_type,meter_start,meter_end,hours,fuel_litres,acreage,rate_per_acre,amount_billed,status,bill_ref,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ref,v.asset_id,v.operator_id || null,v.farm_id || null,v.field_id || null,v.grower_id || null,v.work_date,v.service_type.trim(),v.meter_start ?? null,v.meter_end ?? null,hours,Number(v.fuel_litres || 0),acreage,rate,acreage*rate,v.status || 'planned',v.bill_ref || null,v.notes || null,req.user.id);
    if (v.meter_end !== undefined) db.prepare('UPDATE assets SET hour_meter=MAX(hour_meter,?) WHERE id=?').run(Number(v.meter_end),v.asset_id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM machinery_work_logs WHERE id=?').get(result.lastInsertRowid) });
  });
  app.patch('/work-logs/:id/status', AUTH, (req, reply) => {
    const status = req.body?.status;
    if (!['planned','in_progress','completed','billed'].includes(status)) return reply.code(400).send({ success: false, message: 'Invalid work order status.' });
    const db = getDb(); const current = db.prepare('SELECT status FROM machinery_work_logs WHERE id=?').get(req.params.id);
    if (!current) return reply.code(404).send({ success: false, message: 'Work sheet not found.' });
    const allowed = { planned: ['in_progress','completed'], in_progress: ['completed'], completed: ['billed'], billed: [] };
    if (!allowed[current.status].includes(status)) return reply.code(409).send({ success: false, message: `Cannot move work sheet from ${current.status} to ${status}.` });
    db.prepare("UPDATE machinery_work_logs SET status=?,updated_at=datetime('now') WHERE id=?").run(status,req.params.id);
    reply.send({ success: true });
  });
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { code, name, type, serial_no, make, model, purchase_date, purchase_cost, useful_life_yrs, salvage_value, notes, assigned_operator_id, hour_meter, odometer_reading, insurance_expiry, inspection_due, licence_expiry } = req.body;
    if (!code || !name || !type) return reply.code(400).send({ success: false, message: 'code, name and type required' });
    const current_value = (purchase_cost || 0) - (salvage_value || 0);
    const res = db.prepare('INSERT INTO assets (code,name,type,serial_no,make,model,purchase_date,purchase_cost,useful_life_yrs,salvage_value,current_value,notes,assigned_operator_id,hour_meter,odometer_reading,insurance_expiry,inspection_due,licence_expiry) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(code, name, type, serial_no || null, make || null, model || null, purchase_date || null, purchase_cost || 0, useful_life_yrs || 5, salvage_value || 0, current_value, notes || null, assigned_operator_id || null, hour_meter || 0, odometer_reading || 0, insurance_expiry || null, inspection_due || null, licence_expiry || null);
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
    const { date, description, cost, done_by, next_service_date, spare_parts_cost, downtime_hours, notes } = req.body;
    const res = db.prepare('INSERT INTO maintenance_records (asset_id,date,description,cost,done_by,next_service_date,spare_parts_cost,downtime_hours,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.params.id, date, description, cost || 0, done_by || null, next_service_date || null, spare_parts_cost || 0, downtime_hours || 0, notes || null, req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM maintenance_records WHERE id=?').get(res.lastInsertRowid) });
  });
}
