import { getDb } from '../db/connection.js';

const AUTH = app => ({ preHandler: [app.authenticate] });
const textOrNull = value => value === '' || value === undefined ? null : value;
const numberOrZero = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const hasNegative = (record, keys) => keys.some(key => record[key] !== undefined && record[key] !== null && Number(record[key]) < 0);

function refNo(db, prefix, table) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  return `${prefix}-${String(Number(row.count || 0) + 1).padStart(5, '0')}`;
}

function invalidBoundary(boundary) {
  if (!boundary) return false;
  try {
    const parsed = typeof boundary === 'string' ? JSON.parse(boundary) : boundary;
    return !parsed || typeof parsed !== 'object' || !['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'].includes(parsed.type);
  } catch {
    return true;
  }
}
function boundaryJson(boundary) {
  if (!boundary) return null;
  return JSON.stringify(typeof boundary === 'string' ? JSON.parse(boundary) : boundary);
}

export default async function fieldRoutes(app) {
  const auth = AUTH(app);

  app.get('/farms', auth, (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT f.*,
        COUNT(DISTINCT b.id) AS block_count,
        GROUP_CONCAT(DISTINCT b.name) AS block_names,
        COUNT(DISTINCT fd.id) AS field_count,
        COALESCE(MAX(field_totals.field_area_ha),0) AS field_area_ha
      FROM farms f
      LEFT JOIN farm_blocks b ON b.farm_id=f.id
      LEFT JOIN fields fd ON fd.farm_id=f.id AND fd.is_active=1
      LEFT JOIN (SELECT farm_id,SUM(area_ha) AS field_area_ha FROM fields WHERE is_active=1 GROUP BY farm_id) field_totals ON field_totals.farm_id=f.id
      GROUP BY f.id ORDER BY f.name
    `).all();
    reply.send({ success: true, data: rows });
  });

  app.post('/farms', auth, (req, reply) => {
    const db = getDb();
    const { code, name, location, area_ha, gps_boundary, notes } = req.body || {};
    if (!code?.trim() || !name?.trim()) return reply.code(400).send({ success: false, message: 'Farm code and name are required.' });
    if (hasNegative(req.body, ['area_ha'])) return reply.code(400).send({ success: false, message: 'Farm area cannot be negative.' });
    if (invalidBoundary(gps_boundary)) return reply.code(400).send({ success: false, message: 'Boundary must be valid GeoJSON (Polygon, MultiPolygon or Feature).' });
    const result = db.prepare('INSERT INTO farms (code,name,location,area_ha,gps_boundary,notes) VALUES (?,?,?,?,?,?)')
      .run(code.trim(), name.trim(), textOrNull(location), numberOrZero(area_ha), boundaryJson(gps_boundary), textOrNull(notes));
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM farms WHERE id=?').get(result.lastInsertRowid) });
  });

  app.put('/farms/:id', auth, (req, reply) => {
    const db = getDb();
    const { code, name, location, area_ha, gps_boundary, status, notes } = req.body || {};
    if (!code?.trim() || !name?.trim()) return reply.code(400).send({ success: false, message: 'Farm code and name are required.' });
    if (hasNegative(req.body, ['area_ha'])) return reply.code(400).send({ success: false, message: 'Farm area cannot be negative.' });
    if (invalidBoundary(gps_boundary)) return reply.code(400).send({ success: false, message: 'Boundary must be valid GeoJSON (Polygon, MultiPolygon or Feature).' });
    const result = db.prepare('UPDATE farms SET code=?,name=?,location=?,area_ha=?,gps_boundary=?,status=?,notes=?,updated_at=datetime(\'now\') WHERE id=?')
      .run(code.trim(), name.trim(), textOrNull(location), numberOrZero(area_ha), boundaryJson(gps_boundary), status === 'inactive' ? 'inactive' : 'active', textOrNull(notes), req.params.id);
    if (!result.changes) return reply.code(404).send({ success: false, message: 'Farm not found.' });
    reply.send({ success: true, data: db.prepare('SELECT * FROM farms WHERE id=?').get(req.params.id) });
  });

  app.get('/farms/:farmId/blocks', auth, (req, reply) => {
    reply.send({ success: true, data: getDb().prepare('SELECT * FROM farm_blocks WHERE farm_id=? ORDER BY code').all(req.params.farmId) });
  });

  app.post('/farms/:farmId/blocks', auth, (req, reply) => {
    const db = getDb();
    const { code, name, area_ha, notes } = req.body || {};
    if (!db.prepare('SELECT id FROM farms WHERE id=?').get(req.params.farmId)) return reply.code(404).send({ success: false, message: 'Farm not found.' });
    if (!code?.trim() || !name?.trim()) return reply.code(400).send({ success: false, message: 'Block code and name are required.' });
    if (hasNegative(req.body, ['area_ha'])) return reply.code(400).send({ success: false, message: 'Block area cannot be negative.' });
    const result = db.prepare('INSERT INTO farm_blocks (farm_id,code,name,area_ha,notes) VALUES (?,?,?,?,?)')
      .run(req.params.farmId, code.trim(), name.trim(), numberOrZero(area_ha), textOrNull(notes));
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM farm_blocks WHERE id=?').get(result.lastInsertRowid) });
  });

  app.get('/', auth, (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT f.*, farm.name AS farm_name, farm.code AS farm_code, b.name AS block_name,
        (SELECT crop FROM field_cycles c WHERE c.field_id=f.id ORDER BY c.planting_date DESC LIMIT 1) AS current_crop,
        (SELECT variety FROM field_cycles c WHERE c.field_id=f.id ORDER BY c.planting_date DESC LIMIT 1) AS current_variety
      FROM fields f LEFT JOIN farms farm ON farm.id=f.farm_id
      LEFT JOIN farm_blocks b ON b.id=f.block_id
      WHERE f.is_active=1 ORDER BY farm.name, b.code, f.code
    `).all();
    reply.send({ success: true, data: rows });
  });

  app.post('/', auth, (req, reply) => {
    const db = getDb();
    const { farm_id, block_id, name, code, area_ha, location, soil_type, gps_lat, gps_lng, gps_boundary, notes } = req.body || {};
    if (!name?.trim() || !code?.trim() || !farm_id) return reply.code(400).send({ success: false, message: 'Farm, field code and field name are required.' });
    if (hasNegative(req.body, ['area_ha'])) return reply.code(400).send({ success: false, message: 'Field area cannot be negative.' });
    if (invalidBoundary(gps_boundary)) return reply.code(400).send({ success: false, message: 'Boundary must be valid GeoJSON (Polygon, MultiPolygon or Feature).' });
    if (!db.prepare('SELECT id FROM farms WHERE id=?').get(farm_id)) return reply.code(400).send({ success: false, message: 'Select a valid farm.' });
    if (block_id && !db.prepare('SELECT id FROM farm_blocks WHERE id=? AND farm_id=?').get(block_id, farm_id)) return reply.code(400).send({ success: false, message: 'The selected block does not belong to this farm.' });
    const result = db.prepare('INSERT INTO fields (farm_id,block_id,name,code,area_ha,location,soil_type,gps_lat,gps_lng,gps_boundary,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(farm_id, block_id || null, name.trim(), code.trim(), numberOrZero(area_ha), textOrNull(location), textOrNull(soil_type), textOrNull(gps_lat), textOrNull(gps_lng), boundaryJson(gps_boundary), textOrNull(notes));
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM fields WHERE id=?').get(result.lastInsertRowid) });
  });

  app.put('/:id', auth, (req, reply) => {
    const db = getDb();
    const { farm_id, block_id, name, code, area_ha, location, soil_type, gps_lat, gps_lng, gps_boundary, notes, is_active } = req.body || {};
    if (!name?.trim() || !code?.trim() || !farm_id) return reply.code(400).send({ success: false, message: 'Farm, field code and field name are required.' });
    if (hasNegative(req.body, ['area_ha'])) return reply.code(400).send({ success: false, message: 'Field area cannot be negative.' });
    if (invalidBoundary(gps_boundary)) return reply.code(400).send({ success: false, message: 'Boundary must be valid GeoJSON (Polygon, MultiPolygon or Feature).' });
    if (block_id && !db.prepare('SELECT id FROM farm_blocks WHERE id=? AND farm_id=?').get(block_id, farm_id)) return reply.code(400).send({ success: false, message: 'The selected block does not belong to this farm.' });
    const result = db.prepare('UPDATE fields SET farm_id=?,block_id=?,name=?,code=?,area_ha=?,location=?,soil_type=?,gps_lat=?,gps_lng=?,gps_boundary=?,notes=?,is_active=? WHERE id=?')
      .run(farm_id, block_id || null, name.trim(), code.trim(), numberOrZero(area_ha), textOrNull(location), textOrNull(soil_type), textOrNull(gps_lat), textOrNull(gps_lng), boundaryJson(gps_boundary), textOrNull(notes), is_active ?? 1, req.params.id);
    if (!result.changes) return reply.code(404).send({ success: false, message: 'Field not found.' });
    reply.send({ success: true });
  });

  app.get('/cycles', auth, (req, reply) => {
    const db = getDb();
    const { field_id, season_id, farm_id, crop } = req.query || {};
    const where = ['1=1']; const params = [];
    if (field_id) { where.push('c.field_id=?'); params.push(field_id); }
    if (season_id) { where.push('c.season_id=?'); params.push(season_id); }
    if (farm_id) { where.push('fd.farm_id=?'); params.push(farm_id); }
    if (crop) { where.push('LOWER(c.crop)=LOWER(?)'); params.push(crop); }
    const rows = db.prepare(`
      SELECT c.*, fd.code AS field_code, fd.name AS field_name, fd.area_ha,
        farm.name AS farm_name, b.name AS block_name, s.name AS season_name,
        COALESCE(a.actual_cost,0) AS actual_cost,
        COALESCE(h.harvested_qty,0) AS harvested_qty,
        COALESCE(h.loss_qty,0) AS loss_qty,
        COALESCE(sales.sales_qty,0) AS sales_qty,
        COALESCE(sales.sales_amount,0) AS sales_amount,
        CASE WHEN fd.area_ha>0 THEN COALESCE(h.harvested_qty,0)/fd.area_ha ELSE 0 END AS yield_per_ha
      FROM field_cycles c
      JOIN fields fd ON fd.id=c.field_id
      LEFT JOIN farms farm ON farm.id=fd.farm_id
      LEFT JOIN farm_blocks b ON b.id=fd.block_id
      LEFT JOIN seasons s ON s.id=c.season_id
      LEFT JOIN (SELECT field_cycle_id,SUM(total_cost) AS actual_cost FROM field_activities GROUP BY field_cycle_id) a ON a.field_cycle_id=c.id
      LEFT JOIN (SELECT field_cycle_id,SUM(gross_qty) AS harvested_qty,SUM(loss_qty) AS loss_qty FROM field_harvests GROUP BY field_cycle_id) h ON h.field_cycle_id=c.id
      LEFT JOIN (SELECT fh.field_cycle_id,SUM(fs.qty) AS sales_qty,SUM(fs.total_amount) AS sales_amount FROM field_harvest_sales fs JOIN field_harvests fh ON fh.id=fs.harvest_id GROUP BY fh.field_cycle_id) sales ON sales.field_cycle_id=c.id
      WHERE ${where.join(' AND ')} ORDER BY c.planting_date DESC, c.id DESC
    `).all(...params);
    reply.send({ success: true, data: rows });
  });

  app.post('/cycles', auth, (req, reply) => {
    const db = getDb();
    const v = req.body || {};
    if (!v.field_id || !v.crop?.trim() || !v.variety?.trim() || !validDate(v.planting_date)) return reply.code(400).send({ success: false, message: 'Field, crop, variety and a valid planting date are required.' });
    if (hasNegative(v, ['seed_rate','expected_yield'])) return reply.code(400).send({ success: false, message: 'Seed rate and expected yield cannot be negative.' });
    if (!db.prepare('SELECT id FROM fields WHERE id=? AND is_active=1').get(v.field_id)) return reply.code(400).send({ success: false, message: 'Select an active field.' });
    if (v.season_id && !db.prepare('SELECT id FROM seasons WHERE id=?').get(v.season_id)) return reply.code(400).send({ success: false, message: 'Select a valid season.' });
    const ref = refNo(db, 'CYC', 'field_cycles');
    const result = db.prepare(`INSERT INTO field_cycles
      (ref_no,field_id,season_id,crop,variety,seed_source,seed_batch_no,land_prep_date,land_prep_machinery,planting_date,spacing,seed_rate,seed_rate_unit,expected_harvest_date,expected_yield,yield_unit,status,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ref, v.field_id, v.season_id || null, v.crop.trim(), v.variety.trim(), textOrNull(v.seed_source), textOrNull(v.seed_batch_no), textOrNull(v.land_prep_date), textOrNull(v.land_prep_machinery), v.planting_date, textOrNull(v.spacing), v.seed_rate || null, textOrNull(v.seed_rate_unit), textOrNull(v.expected_harvest_date), v.expected_yield || null, v.yield_unit || 'kg', v.status || 'planned', textOrNull(v.notes), req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM field_cycles WHERE id=?').get(result.lastInsertRowid) });
  });

  app.get('/cycles/:id', auth, (req, reply) => {
    const db = getDb();
    const cycle = db.prepare(`SELECT c.*,fd.code AS field_code,fd.name AS field_name,fd.area_ha,f.name AS farm_name,b.name AS block_name,s.name AS season_name
      FROM field_cycles c JOIN fields fd ON fd.id=c.field_id LEFT JOIN farms f ON f.id=fd.farm_id LEFT JOIN farm_blocks b ON b.id=fd.block_id LEFT JOIN seasons s ON s.id=c.season_id WHERE c.id=?`).get(req.params.id);
    if (!cycle) return reply.code(404).send({ success: false, message: 'Crop cycle not found.' });
    cycle.activities = db.prepare('SELECT a.*,p.name AS product_name,a2.code AS asset_code,w.name AS warehouse_name,u.name AS applied_by_name FROM field_activities a LEFT JOIN products p ON p.id=a.product_id LEFT JOIN assets a2 ON a2.id=a.asset_id LEFT JOIN warehouses w ON w.id=a.warehouse_id LEFT JOIN users u ON u.id=a.applied_by WHERE a.field_cycle_id=? ORDER BY a.date DESC,a.id DESC').all(cycle.id);
    cycle.harvests = db.prepare('SELECT h.*,COALESCE((SELECT SUM(qty) FROM field_harvest_sales WHERE harvest_id=h.id),0) AS sold_qty,COALESCE((SELECT SUM(total_amount) FROM field_harvest_sales WHERE harvest_id=h.id),0) AS sales_amount FROM field_harvests h WHERE h.field_cycle_id=? ORDER BY h.harvest_date DESC').all(cycle.id);
    for (const harvest of cycle.harvests) {
      harvest.sales = db.prepare('SELECT * FROM field_harvest_sales WHERE harvest_id=? ORDER BY sale_date DESC,id DESC').all(harvest.id);
    }
    reply.send({ success: true, data: cycle });
  });

  app.put('/cycles/:id', auth, (req, reply) => {
    const db = getDb();
    const { status, expected_harvest_date, expected_yield, notes } = req.body || {};
    if (status && !['planned','active','harvested','closed'].includes(status)) return reply.code(400).send({ success: false, message: 'Invalid crop cycle status.' });
    const result = db.prepare("UPDATE field_cycles SET status=COALESCE(?,status),expected_harvest_date=?,expected_yield=?,notes=?,updated_at=datetime('now') WHERE id=?")
      .run(status || null, textOrNull(expected_harvest_date), expected_yield ?? null, textOrNull(notes), req.params.id);
    if (!result.changes) return reply.code(404).send({ success: false, message: 'Crop cycle not found.' });
    reply.send({ success: true });
  });

  app.post('/cycles/:id/activities', auth, (req, reply) => {
    const db = getDb();
    const v = req.body || {};
    const allowed = ['land_preparation','fertiliser','chemical','irrigation','rainfall','scouting','crop_health','weeding','planting','other'];
    const cycle = db.prepare('SELECT id,field_id,season_id FROM field_cycles WHERE id=?').get(req.params.id);
    if (!cycle) return reply.code(404).send({ success: false, message: 'Crop cycle not found.' });
    if (!validDate(v.date) || !allowed.includes(v.activity_type)) return reply.code(400).send({ success: false, message: 'A valid activity date and activity type are required.' });
    if (hasNegative(v, ['quantity','rainfall_mm','application_rate','workers','labour_hours','labour_cost','machinery_hours','machinery_cost','input_cost','other_cost'])) return reply.code(400).send({ success: false, message: 'Recorded quantities, rates and costs cannot be negative.' });
    if (['fertiliser','chemical'].includes(v.activity_type) && (!v.product_id || !v.input_batch_no || numberOrZero(v.quantity) <= 0)) {
      return reply.code(400).send({ success: false, message: 'Fertiliser and chemical records require a catalogued product, batch/lot and positive applied quantity.' });
    }
    if (v.activity_type === 'chemical' && (!v.product_id || !v.input_batch_no || !v.application_rate || !v.application_rate_unit || !v.recommendation_ref || !v.authorised_by_name || !v.authorised_by_qualification)) {
      return reply.code(400).send({ success: false, message: 'Chemical applications require a catalogued product, batch, approved label rate and unit, recommendation reference, and authoriser name and qualification. The system does not prescribe chemical rates.' });
    }
    let product = null;
    let stockBalance = null;
    if (v.product_id) {
      if (!v.warehouse_id || numberOrZero(v.quantity) <= 0) return reply.code(400).send({ success: false, message: 'Choose a store and enter a positive quantity when issuing a product to the field.' });
      product = db.prepare('SELECT id,cost_price,unit FROM products WHERE id=? AND is_active=1').get(v.product_id);
      if (!product) return reply.code(400).send({ success: false, message: 'Select an active inventory product.' });
      stockBalance = db.prepare('SELECT qty_on_hand FROM stock_balances WHERE product_id=? AND warehouse_id=?').get(v.product_id, v.warehouse_id);
      if (!stockBalance || Number(stockBalance.qty_on_hand) < numberOrZero(v.quantity)) return reply.code(400).send({ success: false, message: `Insufficient stock in the selected store. Available: ${Number(stockBalance?.qty_on_hand || 0)} ${product.unit}.` });
    }
    const inputCost = product
      ? numberOrZero(v.quantity) * Number(product.cost_price || 0)
      : numberOrZero(v.input_cost);
    const labourCost = numberOrZero(v.labour_cost);
    const machineryCost = numberOrZero(v.machinery_cost);
    const otherCost = numberOrZero(v.other_cost);
    const totalCost = inputCost + labourCost + machineryCost + otherCost;
    let result;
    db.exec('BEGIN IMMEDIATE');
    try {
      result = db.prepare(`INSERT INTO field_activities
        (field_cycle_id,date,activity_type,description,product_id,warehouse_id,input_batch_no,application_rate,application_rate_unit,target_pest,recommendation_ref,authorised_by_name,authorised_by_qualification,applied_by,quantity,quantity_unit,rainfall_mm,observation,severity,action_taken,workers,labour_hours,labour_cost,machinery_name,asset_id,machinery_hours,machinery_cost,input_cost,other_cost,total_cost,notes,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.params.id, v.date, v.activity_type, textOrNull(v.description), v.product_id || null, v.warehouse_id || null, textOrNull(v.input_batch_no), v.application_rate ?? null, textOrNull(v.application_rate_unit), textOrNull(v.target_pest), textOrNull(v.recommendation_ref), textOrNull(v.authorised_by_name), textOrNull(v.authorised_by_qualification), req.user.id, numberOrZero(v.quantity), textOrNull(v.quantity_unit) || product?.unit || null, v.rainfall_mm ?? null, textOrNull(v.observation), textOrNull(v.severity), textOrNull(v.action_taken), numberOrZero(v.workers), numberOrZero(v.labour_hours), labourCost, textOrNull(v.machinery_name), v.asset_id || null, numberOrZero(v.machinery_hours), machineryCost, inputCost, otherCost, totalCost, textOrNull(v.notes), req.user.id);
      if (product) {
        const currentQty = Number(stockBalance.qty_on_hand);
        const movementSummary = db.prepare(`SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN type IN ('receipt','transfer_in','opening','adjustment') THEN qty WHEN type IN ('issue','transfer_out') THEN -qty ELSE 0 END),0) AS balance FROM stock_movements WHERE product_id=? AND warehouse_id=?`).get(product.id, v.warehouse_id);
        const openingQty = Math.max(0, currentQty - Number(movementSummary.balance || 0));
        if (!movementSummary.count && currentQty > 0) {
          const openingRef = refNo(db, 'FIO', 'stock_movements');
          db.prepare("INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,ref_doc,notes,created_by) VALUES (?,'opening',?,?,?,?,?,'FIELD_OPENING','Opening balance recorded before first field issue',?)")
            .run(openingRef, product.id, v.warehouse_id, currentQty, Number(product.cost_price || 0), currentQty * Number(product.cost_price || 0), req.user.id);
        } else if (openingQty > 0.000001) {
          const openingRef = refNo(db, 'FIO', 'stock_movements');
          db.prepare("INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,ref_doc,notes,created_by) VALUES (?,'opening',?,?,?,?,?,'FIELD_OPENING','Opening balance reconciled before field issue',?)")
            .run(openingRef, product.id, v.warehouse_id, openingQty, Number(product.cost_price || 0), openingQty * Number(product.cost_price || 0), req.user.id);
        }
        const movementRef = refNo(db, 'FIS', 'stock_movements');
        const movement = db.prepare("INSERT INTO stock_movements (ref_no,type,product_id,warehouse_id,qty,unit_cost,total_cost,ref_doc,ref_id,notes,created_by) VALUES (?,'issue',?,?,?,?,?,'FIELD_ACTIVITY',?,?,?)")
          .run(movementRef, product.id, v.warehouse_id, numberOrZero(v.quantity), Number(product.cost_price || 0), inputCost, result.lastInsertRowid, `Field cycle ${cycle.id} · ${v.input_batch_no || 'batch not specified'}`, req.user.id);
        db.prepare('UPDATE field_activities SET stock_movement_id=? WHERE id=?').run(movement.lastInsertRowid, result.lastInsertRowid);
        db.prepare("UPDATE stock_balances SET qty_on_hand=?,updated_at=datetime('now') WHERE product_id=? AND warehouse_id=?")
          .run(currentQty - numberOrZero(v.quantity), product.id, v.warehouse_id);
        if (cycle.season_id) {
          const issueRef = refNo(db, 'FII', 'input_issues');
          db.prepare('INSERT INTO input_issues (ref_no,field_id,field_cycle_id,season_id,product_id,warehouse_id,date,qty,unit_cost,total_cost,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(issueRef, cycle.field_id, cycle.id, cycle.season_id, product.id, v.warehouse_id, v.date, numberOrZero(v.quantity), Number(product.cost_price || 0), inputCost, textOrNull(v.notes) || `Issued for ${v.activity_type} · ${v.input_batch_no || 'batch not specified'}`, req.user.id);
        }
      }
      db.prepare("UPDATE field_cycles SET status=CASE WHEN status='planned' THEN 'active' ELSE status END,updated_at=datetime('now') WHERE id=?").run(req.params.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM field_activities WHERE id=?').get(result.lastInsertRowid) });
  });

  app.post('/cycles/:id/harvests', auth, (req, reply) => {
    const db = getDb();
    const v = req.body || {};
    if (!db.prepare('SELECT id FROM field_cycles WHERE id=?').get(req.params.id)) return reply.code(404).send({ success: false, message: 'Crop cycle not found.' });
    if (!validDate(v.harvest_date) || numberOrZero(v.gross_qty) <= 0) return reply.code(400).send({ success: false, message: 'A valid harvest date and gross quantity greater than zero are required.' });
    if (hasNegative(v, ['gross_qty','grade_a_qty','grade_b_qty','grade_c_qty','reject_qty','loss_qty'])) return reply.code(400).send({ success: false, message: 'Harvest grades and quantities cannot be negative.' });
    const graded = ['grade_a_qty','grade_b_qty','grade_c_qty','reject_qty','loss_qty'].reduce((sum, key) => sum + numberOrZero(v[key]), 0);
    if (graded > Number(v.gross_qty)) return reply.code(400).send({ success: false, message: 'Grades, rejects and losses cannot exceed gross harvest quantity.' });
    const ref = refNo(db, 'HAR', 'field_harvests');
    const result = db.prepare(`INSERT INTO field_harvests
      (ref_no,field_cycle_id,harvest_date,gross_qty,grade_a_qty,grade_b_qty,grade_c_qty,reject_qty,loss_qty,unit,storage_location,warehouse_id,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ref, req.params.id, v.harvest_date, numberOrZero(v.gross_qty), numberOrZero(v.grade_a_qty), numberOrZero(v.grade_b_qty), numberOrZero(v.grade_c_qty), numberOrZero(v.reject_qty), numberOrZero(v.loss_qty), v.unit || 'kg', textOrNull(v.storage_location), v.warehouse_id || null, textOrNull(v.notes), req.user.id);
    db.prepare("UPDATE field_cycles SET status='harvested',updated_at=datetime('now') WHERE id=?").run(req.params.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM field_harvests WHERE id=?').get(result.lastInsertRowid) });
  });

  app.post('/harvests/:id/sales', auth, (req, reply) => {
    const db = getDb();
    const v = req.body || {};
    const harvest = db.prepare(`SELECT h.*, CASE WHEN h.grade_a_qty+h.grade_b_qty+h.grade_c_qty>0 THEN h.grade_a_qty+h.grade_b_qty+h.grade_c_qty ELSE h.gross_qty-h.reject_qty-h.loss_qty END AS saleable_qty,
      COALESCE((SELECT SUM(qty) FROM field_harvest_sales WHERE harvest_id=h.id),0) AS sold_qty FROM field_harvests h WHERE h.id=?`).get(req.params.id);
    if (!harvest) return reply.code(404).send({ success: false, message: 'Harvest record not found.' });
    if (!validDate(v.sale_date) || numberOrZero(v.qty) <= 0) return reply.code(400).send({ success: false, message: 'A valid sale date and quantity greater than zero are required.' });
    if (hasNegative(v, ['qty','unit_price'])) return reply.code(400).send({ success: false, message: 'Sale quantities and price cannot be negative.' });
    if (numberOrZero(v.qty) > harvest.saleable_qty - harvest.sold_qty) return reply.code(400).send({ success: false, message: 'Sale quantity exceeds the remaining saleable harvest.' });
    const amount = numberOrZero(v.qty) * numberOrZero(v.unit_price);
    const result = db.prepare('INSERT INTO field_harvest_sales (harvest_id,sale_date,customer_name,qty,unit,unit_price,total_amount,invoice_id,sale_ref,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.params.id, v.sale_date, textOrNull(v.customer_name), numberOrZero(v.qty), v.unit || harvest.unit, numberOrZero(v.unit_price), amount, v.invoice_id || null, textOrNull(v.sale_ref), textOrNull(v.notes), req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM field_harvest_sales WHERE id=?').get(result.lastInsertRowid) });
  });

  app.get('/comparisons', auth, (req, reply) => {
    const db = getDb();
    const { season_id, farm_id, crop } = req.query || {};
    const where = ['1=1']; const params = [];
    if (season_id) { where.push('c.season_id=?'); params.push(season_id); }
    if (farm_id) { where.push('fd.farm_id=?'); params.push(farm_id); }
    if (crop) { where.push('LOWER(c.crop)=LOWER(?)'); params.push(crop); }
    const data = db.prepare(`SELECT c.id,c.ref_no,c.crop,c.variety,c.yield_unit,c.status,c.season_id,s.name AS season_name,
      f.name AS farm_name,fd.code AS field_code,fd.name AS field_name,fd.area_ha,
      COALESCE(a.cost,0) AS actual_cost,COALESCE(h.yield,0) AS yield,COALESCE(sales.revenue,0) AS revenue,
      CASE WHEN fd.area_ha>0 THEN COALESCE(h.yield,0)/fd.area_ha ELSE 0 END AS yield_per_ha,
      CASE WHEN fd.area_ha>0 THEN COALESCE(a.cost,0)/fd.area_ha ELSE 0 END AS cost_per_ha
      FROM field_cycles c JOIN fields fd ON fd.id=c.field_id LEFT JOIN farms f ON f.id=fd.farm_id LEFT JOIN seasons s ON s.id=c.season_id
      LEFT JOIN (SELECT field_cycle_id,SUM(total_cost) cost FROM field_activities GROUP BY field_cycle_id) a ON a.field_cycle_id=c.id
      LEFT JOIN (SELECT field_cycle_id,SUM(gross_qty-reject_qty-loss_qty) yield FROM field_harvests GROUP BY field_cycle_id) h ON h.field_cycle_id=c.id
      LEFT JOIN (SELECT h.field_cycle_id,SUM(s.total_amount) revenue FROM field_harvest_sales s JOIN field_harvests h ON h.id=s.harvest_id GROUP BY h.field_cycle_id) sales ON sales.field_cycle_id=c.id
      WHERE ${where.join(' AND ')} ORDER BY c.crop,c.variety,f.name,fd.code`).all(...params);
    reply.send({ success: true, data });
  });
}
