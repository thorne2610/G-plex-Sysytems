import { getDb } from '../db/connection.js';

const VISIT_INTERVAL_DAYS = 14;   // a contract with no visit for longer than this is flagged
const HARVEST_WINDOW_DAYS = 14;   // contracts whose expected harvest is this close are flagged
const GRADES = ['A', 'B', 'C', 'Reject'];
const METHODS = ['cash', 'bank', 'mpesa', 'cheque'];
const VISIT_TYPES = ['inspection', 'field_visit', 'pre_harvest'];

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === '' || v == null ? NaN : Number(v));
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const daysBetween = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);

class Problem extends Error {
  constructor(message, status = 400) { super(message); this.statusCode = status; }
}

function nextRef(db, prefix, table, field) {
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(${field}, ${prefix.length + 2}) AS INTEGER)) AS n FROM ${table} WHERE ${field} LIKE ?`).get(`${prefix}-%`);
  return `${prefix}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

function inTransaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Value of inputs the farmer took on credit through the POS since this contract was approved.
function inputsFor(db, c) {
  if (!c.approved_at) return [];
  const until = c.closed_at ? c.closed_at.slice(0, 10) : '9999-12-31';
  return db.prepare(`
    SELECT id, ref_no, total, created_at, due_date, recovery_plan
    FROM pos_transactions
    WHERE type = 'credit_issue' AND grower_id = ?
      AND date(created_at) >= date(?) AND date(created_at) <= date(?)
    ORDER BY created_at
  `).all(c.grower_id, c.approved_at, until);
}

function totalsFor(db, c) {
  const d = db.prepare(`
    SELECT COALESCE(SUM(quantity_kg),0) AS delivered_kg,
           COALESCE(SUM(quantity_kg - rejected_kg),0) AS accepted_kg,
           COALESCE(SUM(gross_value),0) AS gross_value
    FROM contract_deliveries WHERE contract_id = ?`).get(c.id);
  const inputs = inputsFor(db, c);
  const inputsValue = round2(inputs.reduce((s, t) => s + Number(t.total), 0));
  const settlement = db.prepare('SELECT * FROM contract_settlements WHERE contract_id = ?').get(c.id) || null;
  const paid = round2(db.prepare('SELECT COALESCE(SUM(amount),0) AS p FROM contract_payments WHERE contract_id = ?').get(c.id).p);
  const net = settlement ? Number(settlement.net_payable) : null;
  const last = db.prepare('SELECT MAX(visit_date) AS d FROM contract_visits WHERE contract_id = ?').get(c.id).d;
  const acres = Number(c.verified_acres || c.contracted_acres);
  return {
    delivered_kg: round2(d.delivered_kg),
    accepted_kg: round2(d.accepted_kg),
    gross_value: round2(d.gross_value),
    inputs_value: inputsValue,
    inputs_over_budget: c.input_budget > 0 && inputsValue > Number(c.input_budget),
    last_visit_date: last || null,
    paid,
    net_payable: net,
    balance_due: net == null ? null : round2(net - paid),
    yield_per_acre_kg: acres > 0 && d.accepted_kg > 0 ? round2(d.accepted_kg / acres) : null,
    inputs, settlement,
  };
}

export default async function contractRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  const APPROVERS = { preHandler: [app.authenticate, app.authorise(['admin', 'managing_director', 'farm_manager'])] };
  const SETTLERS = { preHandler: [app.authenticate, app.authorise(['admin', 'managing_director', 'accountant'])] };
  const PAYERS = { preHandler: [app.authenticate, app.authorise(['admin', 'accountant'])] };
  const CLOSERS = { preHandler: [app.authenticate, app.authorise(['admin', 'managing_director', 'farm_manager', 'accountant'])] };

  const guard = (handler) => (req, reply) => {
    try { return handler(req, reply); } catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ success: false, message: error.message });
      throw error;
    }
  };
  const loadContract = (db, id) => {
    const c = db.prepare(`
      SELECT c.*, g.name AS grower_name, g.code AS grower_code, g.phone AS grower_phone, g.location AS grower_location,
             g.national_id AS grower_national_id, g.input_credit AS grower_credit_balance, g.status AS grower_status
      FROM grower_contracts c JOIN growers g ON g.id = c.grower_id WHERE c.id = ?`).get(id);
    if (!c) throw new Problem('Contract not found', 404);
    return c;
  };
  const detail = (db, id) => {
    const c = loadContract(db, id);
    return {
      ...c,
      ...totalsFor(db, c),
      visits: db.prepare('SELECT v.*, u.name AS officer FROM contract_visits v LEFT JOIN users u ON u.id = v.visited_by WHERE v.contract_id = ? ORDER BY v.visit_date DESC, v.id DESC').all(id),
      deliveries: db.prepare('SELECT d.*, u.name AS received_by_name FROM contract_deliveries d LEFT JOIN users u ON u.id = d.received_by WHERE d.contract_id = ? ORDER BY d.delivery_date DESC, d.id DESC').all(id),
      payments: db.prepare('SELECT p.*, u.name AS paid_by_name FROM contract_payments p LEFT JOIN users u ON u.id = p.paid_by WHERE p.contract_id = ? ORDER BY p.payment_date DESC, p.id DESC').all(id),
    };
  };

  app.get('/meta', AUTH, (req, reply) => reply.send({
    success: true,
    data: {
      grades: GRADES, methods: METHODS, visit_types: VISIT_TYPES,
      visit_interval_days: VISIT_INTERVAL_DAYS, harvest_window_days: HARVEST_WINDOW_DAYS,
    },
  }));

  // Automatic flags: approaching harvest, overdue visits, input over-issuance, unpaid farmer balances.
  app.get('/alerts', AUTH, guard((req, reply) => {
    const db = getDb();
    const t = today();
    const live = db.prepare(`SELECT c.*, g.name AS grower_name FROM grower_contracts c JOIN growers g ON g.id = c.grower_id
                             WHERE c.status IN ('active','harvesting')`).all();
    const approaching_harvest = [];
    const overdue_visits = [];
    const over_issuance = [];
    for (const c of live) {
      const base = { id: c.id, contract_no: c.contract_no, grower_name: c.grower_name, crop: c.crop };
      if (c.status === 'active' && c.expected_harvest_date) {
        const days = daysBetween(t, c.expected_harvest_date);
        if (days <= HARVEST_WINDOW_DAYS) {
          approaching_harvest.push({ ...base, expected_harvest_date: c.expected_harvest_date, days_left: days,
            message: days < 0 ? `Harvest was due ${-days} day(s) ago and no delivery is recorded.` : `Harvest due in ${days} day(s).` });
        }
      }
      const lastVisit = db.prepare('SELECT MAX(visit_date) AS d, MAX(next_visit_date) AS n FROM contract_visits WHERE contract_id = ?').get(c.id);
      const since = lastVisit.d || (c.approved_at ? c.approved_at.slice(0, 10) : null);
      if (since) {
        const gap = daysBetween(since, t);
        const missedPlanned = lastVisit.n && lastVisit.n < t && (!lastVisit.d || lastVisit.d < lastVisit.n);
        if (gap > VISIT_INTERVAL_DAYS || missedPlanned) {
          overdue_visits.push({ ...base, last_visit: lastVisit.d || null, days_since: gap,
            message: lastVisit.d ? `Last visit ${gap} day(s) ago.` : `No visit recorded since approval (${gap} day(s)).` });
        }
      }
      if (c.input_budget > 0) {
        const value = inputsFor(db, c).reduce((s, x) => s + Number(x.total), 0);
        if (value > c.input_budget) {
          over_issuance.push({ ...base, issued: round2(value), budget: c.input_budget,
            message: `Inputs issued KES ${round2(value).toLocaleString()} exceed the approved budget of KES ${Number(c.input_budget).toLocaleString()}.` });
        }
      }
    }
    const unpaid_balances = db.prepare(`
      SELECT c.id, c.contract_no, g.name AS grower_name, c.crop,
             s.net_payable, COALESCE((SELECT SUM(amount) FROM contract_payments p WHERE p.contract_id = c.id),0) AS paid
      FROM grower_contracts c JOIN growers g ON g.id = c.grower_id JOIN contract_settlements s ON s.contract_id = c.id
      WHERE c.status = 'settled'`).all()
      .map((r) => ({ ...r, balance: round2(r.net_payable - r.paid) }))
      .filter((r) => r.balance > 0.004)
      .map((r) => ({ ...r, message: `Farmer is still owed KES ${r.balance.toLocaleString()}.` }));
    reply.send({ success: true, data: { approaching_harvest, overdue_visits, over_issuance, unpaid_balances,
      total: approaching_harvest.length + overdue_visits.length + over_issuance.length + unpaid_balances.length } });
  }));

  app.get('/', AUTH, guard((req, reply) => {
    const db = getDb();
    const { status, grower_id: growerId, q } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND c.status = ?'; params.push(status); }
    if (growerId) { where += ' AND c.grower_id = ?'; params.push(Number(growerId)); }
    if (q) { where += ' AND (c.contract_no LIKE ? OR g.name LIKE ? OR c.crop LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const rows = db.prepare(`SELECT c.*, g.name AS grower_name, g.code AS grower_code FROM grower_contracts c JOIN growers g ON g.id = c.grower_id ${where} ORDER BY c.id DESC`).all(...params)
      .map((c) => { const { inputs, settlement, ...t } = totalsFor(db, c); return { ...c, ...t, has_settlement: !!settlement }; });
    const kpi = {
      total: rows.length,
      active: rows.filter((r) => ['active', 'harvesting'].includes(r.status)).length,
      acres: round2(rows.filter((r) => ['active', 'harvesting'].includes(r.status)).reduce((s, r) => s + Number(r.verified_acres || r.contracted_acres), 0)),
      expected_kg: round2(rows.filter((r) => ['active', 'harvesting'].includes(r.status)).reduce((s, r) => s + Number(r.expected_yield_kg), 0)),
      owed_to_farmers: round2(rows.filter((r) => r.status === 'settled').reduce((s, r) => s + Number(r.balance_due || 0), 0)),
    };
    reply.send({ success: true, data: rows, kpi });
  }));

  app.get('/:id', AUTH, guard((req, reply) => {
    reply.send({ success: true, data: detail(getDb(), req.params.id) });
  }));

  // Step 1-2: register contract for a verified farmer (draft until inspected and approved).
  app.post('/', AUTH, guard((req, reply) => {
    const db = getDb();
    const v = req.body || {};
    const grower = db.prepare('SELECT * FROM growers WHERE id = ?').get(v.grower_id);
    if (!grower) throw new Problem('Select a registered farmer.');
    if (grower.status !== 'active') throw new Problem(`This farmer is ${grower.status}. Only active farmers can be contracted.`);
    const crop = clean(v.crop);
    const acres = num(v.contracted_acres);
    if (!crop) throw new Problem('Enter the crop.');
    if (!(acres > 0)) throw new Problem('Contracted acreage must be greater than zero.');
    for (const key of ['planting_date', 'expected_harvest_date']) {
      if (v[key] && !dateOk(v[key])) throw new Problem('Dates must be valid (YYYY-MM-DD).');
    }
    if (v.planting_date && v.expected_harvest_date && v.expected_harvest_date < v.planting_date) {
      throw new Problem('Expected harvest cannot be before planting.');
    }
    const money = (key) => { const n = v[key] === undefined || v[key] === '' ? 0 : Number(v[key]); if (!(n >= 0)) throw new Problem(`${key.replace(/_/g, ' ')} cannot be negative.`); return n; };
    const dup = db.prepare("SELECT contract_no FROM grower_contracts WHERE grower_id=? AND crop=? AND COALESCE(season,'')=COALESCE(?, '') AND status NOT IN ('cancelled','closed')").get(grower.id, crop, clean(v.season));
    if (dup) throw new Problem(`This farmer already has an open ${crop} contract for that season (${dup.contract_no}).`);

    const id = inTransaction(db, () => {
      const res = db.prepare(`
        INSERT INTO grower_contracts (grower_id, crop, variety, season, contracted_acres, planting_date, expected_harvest_date,
          expected_yield_kg, agreed_price_per_kg, input_budget, production_budget, terms, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        grower.id, crop, clean(v.variety), clean(v.season), acres, clean(v.planting_date), clean(v.expected_harvest_date),
        money('expected_yield_kg'), money('agreed_price_per_kg'), money('input_budget'), money('production_budget'), clean(v.terms), req.user.id);
      const newId = Number(res.lastInsertRowid);
      db.prepare('UPDATE grower_contracts SET contract_no = ? WHERE id = ?').run(`CF-${new Date().getFullYear()}-${1000 + newId}`, newId);
      return newId;
    });
    reply.code(201).send({ success: true, data: detail(db, id) });
  }));

  app.patch('/:id', AUTH, guard((req, reply) => {
    const db = getDb();
    const c = loadContract(db, req.params.id);
    if (!['draft', 'active', 'harvesting'].includes(c.status)) throw new Problem('This contract can no longer be edited.');
    const v = req.body || {};
    const editableAfterApproval = ['expected_harvest_date', 'expected_yield_kg', 'terms'];
    const all = ['crop', 'variety', 'season', 'contracted_acres', 'planting_date', 'expected_harvest_date', 'expected_yield_kg', 'agreed_price_per_kg', 'input_budget', 'production_budget', 'terms'];
    const allowed = c.status === 'draft' ? all : editableAfterApproval;
    const sets = []; const params = [];
    for (const key of allowed) {
      if (v[key] === undefined) continue;
      let value = v[key];
      if (['contracted_acres'].includes(key) && !(Number(value) > 0)) throw new Problem('Acreage must be greater than zero.');
      if (['expected_yield_kg', 'agreed_price_per_kg', 'input_budget', 'production_budget'].includes(key)) {
        value = Number(value || 0); if (!(value >= 0)) throw new Problem('Amounts cannot be negative.');
      } else if (key.endsWith('_date')) {
        if (value && !dateOk(value)) throw new Problem('Dates must be valid (YYYY-MM-DD).'); value = value || null;
      } else if (typeof value === 'string') value = clean(value);
      sets.push(`${key} = ?`); params.push(value);
    }
    if (!sets.length) throw new Problem('Nothing to change.');
    db.prepare(`UPDATE grower_contracts SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params, c.id);
    reply.send({ success: true, data: detail(db, c.id) });
  }));

  // Step 3: approve contract, crop and production budget (needs a farm inspection and a verified farmer).
  app.post('/:id/approve', APPROVERS, guard((req, reply) => {
    const db = getDb();
    const c = loadContract(db, req.params.id);
    if (c.status !== 'draft') throw new Problem('Only a draft contract can be approved.');
    if (c.grower_status !== 'active') throw new Problem('The farmer is not active.');
    if (!c.grower_national_id || !c.grower_phone) throw new Problem('Complete the farmer\'s national ID and phone number on the Contract Growers page before approving.');
    const inspection = db.prepare("SELECT acres_verified FROM contract_visits WHERE contract_id=? AND visit_type='inspection' AND acres_verified > 0 ORDER BY visit_date DESC, id DESC LIMIT 1").get(c.id);
    if (!inspection) throw new Problem('Record a farm inspection with the verified acreage before approving.');
    if (!(c.agreed_price_per_kg > 0)) throw new Problem('Enter the agreed price per kg before approving.');
    db.prepare("UPDATE grower_contracts SET status='active', verified_acres=?, approved_by=?, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
      .run(inspection.acres_verified, req.user.id, c.id);
    reply.send({ success: true, data: detail(db, c.id), message: `Contract ${c.contract_no} approved.` });
  }));

  app.post('/:id/cancel', APPROVERS, guard((req, reply) => {
    const db = getDb();
    const c = loadContract(db, req.params.id);
    if (!['draft', 'active'].includes(c.status)) throw new Problem('Only a draft or active contract with no deliveries can be cancelled.');
    if (db.prepare('SELECT COUNT(*) AS n FROM contract_deliveries WHERE contract_id=?').get(c.id).n) throw new Problem('Deliveries are already recorded; settle the contract instead.');
    const reason = clean(req.body?.reason);
    if (!reason) throw new Problem('Give a reason for cancelling.');
    db.prepare("UPDATE grower_contracts SET status='cancelled', cancel_reason=?, updated_at=datetime('now') WHERE id=?").run(reason, c.id);
    reply.send({ success: true, data: detail(db, c.id) });
  }));

  // Step 2 & 5: inspections and field visits.
  app.post('/:id/visits', AUTH, guard((req, reply) => {
    const db = getDb();
    const c = loadContract(db, req.params.id);
    if (['settled', 'closed', 'cancelled'].includes(c.status)) throw new Problem('Visits can no longer be added to this contract.');
    const v = req.body || {};
    const type = VISIT_TYPES.includes(v.visit_type) ? v.visit_type : 'field_visit';
    const date = v.visit_date || today();
    if (!dateOk(date)) throw new Problem('Enter a valid visit date.');
    if (date > today()) throw new Problem('A visit cannot be dated in the future.');
    if (v.next_visit_date && !dateOk(v.next_visit_date)) throw new Problem('Enter a valid next visit date.');
    const acres = v.acres_verified === undefined || v.acres_verified === '' ? null : Number(v.acres_verified);
    if (acres != null && !(acres > 0)) throw new Problem('Verified acreage must be greater than zero.');
    if (type === 'inspection' && acres == null) throw new Problem('An inspection must record the verified acreage.');
    const est = v.estimated_yield_kg === undefined || v.estimated_yield_kg === '' ? null : Number(v.estimated_yield_kg);
    if (est != null && !(est >= 0)) throw new Problem('Estimated yield cannot be negative.');
    inTransaction(db, () => {
      db.prepare(`INSERT INTO contract_visits (contract_id, visit_date, visit_type, acres_verified, crop_stage, estimated_yield_kg, findings, next_visit_date, visited_by)
                  VALUES (?,?,?,?,?,?,?,?,?)`).run(c.id, date, type, acres, clean(v.crop_stage), est, clean(v.findings), clean(v.next_visit_date), req.user.id);
      if (acres != null && type === 'inspection') db.prepare("UPDATE grower_contracts SET verified_acres=?, updated_at=datetime('now') WHERE id=?").run(acres, c.id);
    });
    reply.code(201).send({ success: true, data: detail(db, c.id) });
  }));

  // Step 6: produce delivered, with grade and rejects.
  app.post('/:id/deliveries', AUTH, guard((req, reply) => {
    const db = getDb();
    const c = loadContract(db, req.params.id);
    if (!['active', 'harvesting'].includes(c.status)) throw new Problem('Deliveries can only be recorded for an approved, unsettled contract.');
    const v = req.body || {};
    const qty = Number(v.quantity_kg);
    const rejected = v.rejected_kg === undefined || v.rejected_kg === '' ? 0 : Number(v.rejected_kg);
    const price = v.price_per_kg === undefined || v.price_per_kg === '' ? Number(c.agreed_price_per_kg) : Number(v.price_per_kg);
    const date = v.delivery_date || today();
    if (!(qty > 0)) throw new Problem('Quantity delivered must be greater than zero.');
    if (!(rejected >= 0) || rejected > qty) throw new Problem('Rejected quantity must be between zero and the quantity delivered.');
    if (!(price >= 0)) throw new Problem('Price cannot be negative.');
    if (!dateOk(date) || date > today()) throw new Problem('Enter a valid delivery date (not in the future).');
    if (v.grade && !GRADES.includes(v.grade)) throw new Problem('Choose a valid grade.');
    const gross = round2((qty - rejected) * price);
    inTransaction(db, () => {
      db.prepare(`INSERT INTO contract_deliveries (contract_id, delivery_date, quantity_kg, rejected_kg, grade, price_per_kg, gross_value, notes, received_by)
                  VALUES (?,?,?,?,?,?,?,?,?)`).run(c.id, date, qty, rejected, clean(v.grade), price, gross, clean(v.notes), req.user.id);
      db.prepare("UPDATE grower_contracts SET status='harvesting', updated_at=datetime('now') WHERE id=? AND status='active'").run(c.id);
    });
    reply.code(201).send({ success: true, data: detail(db, c.id) });
  }));

  // Step 7: payment calculation. Recovers outstanding input credit through the existing farmer credit ledger.
  app.post('/:id/settle', SETTLERS, guard((req, reply) => {
    const db = getDb();
    const v = req.body || {};
    const out = inTransaction(db, () => {
      const c = loadContract(db, req.params.id);
      if (!['active', 'harvesting'].includes(c.status)) throw new Problem('Only an active or harvesting contract can be settled.');
      const t = totalsFor(db, c);
      if (!(t.accepted_kg > 0)) throw new Problem('Record at least one accepted delivery before settling.');
      const gross = t.gross_value;
      const credit = Number(db.prepare('SELECT input_credit FROM growers WHERE id=?').get(c.grower_id).input_credit);
      const recovery = v.input_recovery === undefined || v.input_recovery === '' ? Math.min(gross, credit) : Number(v.input_recovery);
      const other = v.other_deductions === undefined || v.other_deductions === '' ? 0 : Number(v.other_deductions);
      if (!(recovery >= 0) || !(other >= 0)) throw new Problem('Deductions cannot be negative.');
      if (recovery > credit + 0.000001) throw new Problem(`Input recovery exceeds the farmer's outstanding input credit of KES ${credit.toLocaleString()}.`);
      if (other > 0 && !clean(v.other_deductions_note)) throw new Problem('Explain the other deductions.');
      if (recovery + other > gross + 0.000001) throw new Problem('Deductions are more than the value of the produce delivered.');
      const net = round2(gross - recovery - other);

      let paymentRef = null;
      if (recovery > 0) {
        // keep to the POS ledger's own numbering style (GRP-001)
        const row = db.prepare("SELECT MAX(CAST(SUBSTR(ref_no, 5) AS INTEGER)) AS n FROM grower_credit_payments WHERE ref_no LIKE 'GRP-%'").get();
        paymentRef = `GRP-${String((row?.n || 0) + 1).padStart(3, '0')}`;
        db.prepare('INSERT INTO grower_credit_payments (ref_no, grower_id, amount, date, mode, reference, notes, created_by) VALUES (?,?,?,?,?,?,?,?)')
          .run(paymentRef, c.grower_id, recovery, today(), 'harvest_recovery', c.contract_no, `Harvest recovery for ${c.contract_no}`, req.user.id);
        db.prepare("UPDATE growers SET input_credit = input_credit - ?, updated_at = datetime('now') WHERE id = ?").run(recovery, c.grower_id);
      }
      db.prepare(`INSERT INTO contract_settlements (contract_id, gross_value, input_recovery, other_deductions, other_deductions_note, net_payable, credit_payment_ref, notes, settled_by)
                  VALUES (?,?,?,?,?,?,?,?,?)`).run(c.id, gross, recovery, other, clean(v.other_deductions_note), net, paymentRef, clean(v.notes), req.user.id);
      db.prepare("UPDATE grower_contracts SET status='settled', settled_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(c.id);
      return c.id;
    });
    reply.send({ success: true, data: detail(db, out), message: 'Settlement calculated and input credit recovered.' });
  }));

  // Payments made to the farmer after settlement.
  app.post('/:id/payments', PAYERS, guard((req, reply) => {
    const db = getDb();
    const v = req.body || {};
    const id = inTransaction(db, () => {
      const c = loadContract(db, req.params.id);
      if (c.status !== 'settled') throw new Problem('Payments can only be made once the contract is settled (and before it is closed).');
      const t = totalsFor(db, c);
      const amount = Number(v.amount);
      const method = METHODS.includes(v.method) ? v.method : 'mpesa';
      const date = v.payment_date || today();
      if (!(amount > 0)) throw new Problem('Enter an amount greater than zero.');
      if (amount > t.balance_due + 0.004) throw new Problem(`Payment exceeds the balance due of KES ${t.balance_due.toLocaleString()}.`);
      if (!dateOk(date) || date > today()) throw new Problem('Enter a valid payment date (not in the future).');
      const ref = nextRef(db, 'CFP', 'contract_payments', 'ref_no');
      db.prepare('INSERT INTO contract_payments (contract_id, ref_no, amount, payment_date, method, reference, paid_by) VALUES (?,?,?,?,?,?,?)')
        .run(c.id, ref, round2(amount), date, method, clean(v.reference), req.user.id);
      return c.id;
    });
    reply.code(201).send({ success: true, data: detail(db, id) });
  }));

  // Step 8: close the contract and finish the season record.
  app.post('/:id/close', CLOSERS, guard((req, reply) => {
    const db = getDb();
    const c = loadContract(db, req.params.id);
    if (c.status !== 'settled') throw new Problem('Settle the contract before closing it.');
    const t = totalsFor(db, c);
    if (t.balance_due > 0.004) throw new Problem(`The farmer is still owed KES ${t.balance_due.toLocaleString()}. Record the payment first.`);
    db.prepare("UPDATE grower_contracts SET status='closed', closed_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(c.id);
    reply.send({ success: true, data: detail(db, c.id), message: `Contract ${c.contract_no} closed.` });
  }));
}
