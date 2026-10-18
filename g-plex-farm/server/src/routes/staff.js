import { getDb } from '../db/connection.js';

const auth = app => ({ preHandler: [app.authenticate] });
const clean = value => value === '' || value === undefined ? null : value;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateOk = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function staffRoutes(app) {
  const secured = auth(app);
  const management = { preHandler: [app.authenticate, app.authorise(['admin','managing_director','farm_manager','hr_officer'])] };
  const payrollAccess = { preHandler: [app.authenticate, app.authorise(['admin','managing_director','accountant','hr_officer'])] };
  const payrollView = { preHandler: [app.authenticate, app.authorise(['admin','managing_director','accountant','hr_officer','auditor'])] };
  const payrollApprove = { preHandler: [app.authenticate, app.authorise(['admin','managing_director','accountant'])] };

  app.get('/employees', secured, (req, reply) => {
    const db = getDb();
    const payField = ['admin','managing_director','accountant','hr_officer','auditor'].includes(req.user.role) ? 'e.base_rate,' : '';
    reply.send({ success: true, data: db.prepare(`SELECT e.id,e.employee_no,e.name,e.worker_type,e.department,e.job_title,e.phone,e.email,e.contract_ref,e.start_date,e.end_date,e.pay_type,${payField}e.status,e.notes,e.created_at,e.updated_at,
      (SELECT COUNT(*) FROM attendance_records a WHERE a.employee_id=e.id AND a.work_date>=date('now','-30 day')) attendance_days,
      (SELECT COUNT(*) FROM labour_work_logs l WHERE l.employee_id=e.id AND l.status='approved') approved_tasks
      FROM employees e ORDER BY e.status DESC,e.name`).all() });
  });

  app.post('/employees', management, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!v.employee_no?.trim() || !v.name?.trim()) return reply.code(400).send({ success: false, message: 'Employee number and name are required.' });
    if (!['permanent','seasonal','casual','operator','agronomist','contractor'].includes(v.worker_type)) return reply.code(400).send({ success: false, message: 'Select a valid worker type.' });
    if (!['monthly','daily','hourly','piece_rate'].includes(v.pay_type || 'monthly') || num(v.base_rate) < 0) return reply.code(400).send({ success: false, message: 'Pay basis or rate is invalid.' });
    try {
      const result = db.prepare(`INSERT INTO employees (employee_no,name,worker_type,department,job_title,phone,email,contract_ref,start_date,end_date,pay_type,base_rate,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.employee_no.trim(),v.name.trim(),v.worker_type,clean(v.department),clean(v.job_title),clean(v.phone),clean(v.email),clean(v.contract_ref),clean(v.start_date),clean(v.end_date),v.pay_type || 'monthly',num(v.base_rate),clean(v.notes));
      reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM employees WHERE id=?').get(result.lastInsertRowid) });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return reply.code(409).send({ success: false, message: 'That employee number is already in use.' });
      throw error;
    }
  });

  app.patch('/employees/:id', management, (req, reply) => {
    const status = req.body?.status;
    if (!['active','inactive'].includes(status)) return reply.code(400).send({ success: false, message: 'Status must be active or inactive.' });
    const result = getDb().prepare("UPDATE employees SET status=?,updated_at=datetime('now') WHERE id=?").run(status,req.params.id);
    if (!result.changes) return reply.code(404).send({ success: false, message: 'Employee not found.' });
    reply.send({ success: true });
  });

  app.get('/attendance', secured, (req, reply) => {
    const db = getDb(); const from = req.query?.from || '0000-01-01'; const to = req.query?.to || '9999-12-31';
    reply.send({ success: true, data: db.prepare(`SELECT a.*,e.employee_no,e.name AS employee_name,f.name AS farm_name,u.name AS approver_name
      FROM attendance_records a JOIN employees e ON e.id=a.employee_id LEFT JOIN farms f ON f.id=a.farm_id LEFT JOIN users u ON u.id=a.approved_by
      WHERE a.work_date BETWEEN ? AND ? ORDER BY a.work_date DESC,e.name`).all(from,to) });
  });

  app.post('/attendance', secured, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!v.employee_id || !dateOk(v.work_date)) return reply.code(400).send({ success: false, message: 'Select a worker and a valid work date.' });
    if (num(v.hours) < 0 || num(v.hours) > 24) return reply.code(400).send({ success: false, message: 'Hours must be between 0 and 24.' });
    try {
      const result = db.prepare(`INSERT INTO attendance_records (employee_id,work_date,clock_in,clock_out,hours,status,farm_id,notes,created_by)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(v.employee_id,v.work_date,clean(v.clock_in),clean(v.clock_out),num(v.hours),v.status || 'present',v.farm_id || null,clean(v.notes),req.user.id);
      reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM attendance_records WHERE id=?').get(result.lastInsertRowid) });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return reply.code(409).send({ success: false, message: 'Attendance is already recorded for this worker and date.' });
      throw error;
    }
  });

  app.patch('/attendance/:id/approve', management, (req, reply) => {
    const result = getDb().prepare("UPDATE attendance_records SET approved_by=?,approved_at=datetime('now') WHERE id=? AND approved_at IS NULL").run(req.user.id,req.params.id);
    if (!result.changes) return reply.code(409).send({ success: false, message: 'Attendance entry was not found or is already approved.' });
    reply.send({ success: true });
  });

  app.get('/work-logs', secured, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare(`SELECT l.*,e.name AS employee_name,f.name AS farm_name,fd.code AS field_code,u.name AS approver_name
      FROM labour_work_logs l LEFT JOIN employees e ON e.id=l.employee_id LEFT JOIN farms f ON f.id=l.farm_id LEFT JOIN fields fd ON fd.id=l.field_id LEFT JOIN users u ON u.id=l.approved_by
      ORDER BY l.work_date DESC,l.id DESC LIMIT 500`).all() });
  });

  app.post('/work-logs', secured, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!dateOk(v.work_date) || !v.task?.trim()) return reply.code(400).send({ success: false, message: 'Task and valid work date are required.' });
    if ([v.worker_count,v.hours,v.acreage,v.quantity,v.agreed_rate].some(x => x !== undefined && num(x) < 0) || num(v.worker_count || 1) < 1) return reply.code(400).send({ success: false, message: 'Work quantities and rates cannot be negative.' });
    const amount = v.amount !== undefined ? num(v.amount) : (v.pay_type === 'piece_rate' ? num(v.quantity) * num(v.agreed_rate) : 0);
    const result = db.prepare(`INSERT INTO labour_work_logs (work_date,employee_id,farm_id,field_id,task,worker_count,hours,acreage,quantity,quantity_unit,pay_type,agreed_rate,amount,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.work_date,v.employee_id || null,v.farm_id || null,v.field_id || null,v.task.trim(),Math.max(1,num(v.worker_count || 1)),num(v.hours),num(v.acreage),num(v.quantity),clean(v.quantity_unit),v.pay_type || 'hourly',num(v.agreed_rate),amount,clean(v.notes),req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM labour_work_logs WHERE id=?').get(result.lastInsertRowid) });
  });

  app.patch('/work-logs/:id/review', management, (req, reply) => {
    const status = req.body?.status;
    if (!['approved','rejected'].includes(status)) return reply.code(400).send({ success: false, message: 'Review status must be approved or rejected.' });
    const result = getDb().prepare("UPDATE labour_work_logs SET status=?,approved_by=?,approved_at=datetime('now') WHERE id=? AND status='submitted'").run(status,req.user.id,req.params.id);
    if (!result.changes) return reply.code(409).send({ success: false, message: 'Only submitted work entries can be reviewed.' });
    reply.send({ success: true });
  });

  app.get('/leave', secured, (req, reply) => reply.send({ success: true, data: getDb().prepare(`SELECT l.*,e.employee_no,e.name AS employee_name,u.name AS approver_name FROM leave_requests l JOIN employees e ON e.id=l.employee_id LEFT JOIN users u ON u.id=l.approved_by ORDER BY l.start_date DESC`).all() }));
  app.post('/leave', secured, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!v.employee_id || !v.leave_type?.trim() || !dateOk(v.start_date) || !dateOk(v.end_date) || v.end_date < v.start_date || num(v.days) <= 0) return reply.code(400).send({ success: false, message: 'Worker, leave type, valid dates and positive days are required.' });
    const result = db.prepare('INSERT INTO leave_requests (employee_id,leave_type,start_date,end_date,days,reason,created_by) VALUES (?,?,?,?,?,?,?)').run(v.employee_id,v.leave_type.trim(),v.start_date,v.end_date,num(v.days),clean(v.reason),req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(result.lastInsertRowid) });
  });
  app.patch('/leave/:id/review', management, (req, reply) => {
    if (!['approved','rejected'].includes(req.body?.status)) return reply.code(400).send({ success: false, message: 'Review status must be approved or rejected.' });
    const result = getDb().prepare("UPDATE leave_requests SET status=?,approved_by=?,approved_at=datetime('now') WHERE id=? AND status='pending'").run(req.body.status,req.user.id,req.params.id);
    if (!result.changes) return reply.code(409).send({ success: false, message: 'Only pending leave requests can be reviewed.' });
    reply.send({ success: true });
  });

  app.get('/safety', secured, (req, reply) => reply.send({ success: true, data: getDb().prepare(`SELECT s.*,e.name AS employee_name FROM safety_records s LEFT JOIN employees e ON e.id=s.employee_id ORDER BY s.event_date DESC,s.id DESC`).all() }));
  app.post('/safety', secured, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!['training','incident','ppe'].includes(v.record_type) || !dateOk(v.event_date) || !v.description?.trim()) return reply.code(400).send({ success: false, message: 'Select a safety record type, date and description.' });
    const result = db.prepare('INSERT INTO safety_records (employee_id,record_type,event_date,description,severity,expiry_date,action_taken,created_by) VALUES (?,?,?,?,?,?,?,?)').run(v.employee_id || null,v.record_type,v.event_date,v.description.trim(),clean(v.severity),clean(v.expiry_date),clean(v.action_taken),req.user.id);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM safety_records WHERE id=?').get(result.lastInsertRowid) });
  });

  app.get('/payroll-runs', payrollView, (req, reply) => reply.send({ success: true, data: getDb().prepare('SELECT * FROM payroll_runs ORDER BY period_start DESC,id DESC').all() }));
  app.get('/payroll-runs/:id', payrollView, (req, reply) => {
    const db = getDb(); const run = db.prepare('SELECT * FROM payroll_runs WHERE id=?').get(req.params.id);
    if (!run) return reply.code(404).send({ success: false, message: 'Payroll run not found.' });
    run.lines = db.prepare('SELECT p.*,e.employee_no,e.name AS employee_name FROM payroll_lines p JOIN employees e ON e.id=p.employee_id WHERE p.payroll_run_id=? ORDER BY e.name').all(run.id);
    reply.send({ success: true, data: run });
  });
  app.post('/payroll-runs', payrollAccess, (req, reply) => {
    const db = getDb(); const v = req.body || {};
    if (!dateOk(v.period_start) || !dateOk(v.period_end) || v.period_end < v.period_start) return reply.code(400).send({ success: false, message: 'Provide a valid payroll period.' });
    if (db.prepare('SELECT id FROM payroll_runs WHERE period_start=? AND period_end=?').get(v.period_start,v.period_end)) return reply.code(409).send({ success: false, message: 'A payroll run already exists for this period.' });
    const ref = `PAY-${String(db.prepare('SELECT COUNT(*) AS n FROM payroll_runs').get().n + 1).padStart(5,'0')}`;
    let run;
    db.exec('BEGIN IMMEDIATE');
    try {
      const created = db.prepare('INSERT INTO payroll_runs (ref_no,period_start,period_end,notes,created_by) VALUES (?,?,?,?,?)').run(ref,v.period_start,v.period_end,clean(v.notes),req.user.id);
      run = Number(created.lastInsertRowid);
      const people = db.prepare("SELECT * FROM employees WHERE status='active' AND (start_date IS NULL OR start_date<=?) AND (end_date IS NULL OR end_date>=?) ORDER BY id").all(v.period_end,v.period_start);
      const line = db.prepare('INSERT INTO payroll_lines (payroll_run_id,employee_id,earnings,allowances,deductions,net_pay,notes) VALUES (?,?,?,?,?,?,?)');
      const adjustment = new Map((Array.isArray(v.adjustments) ? v.adjustments : []).map(item => [Number(item.employee_id),item]));
      for (const employee of people) {
        const att = db.prepare("SELECT COUNT(*) AS days,COALESCE(SUM(hours),0) AS hours FROM attendance_records WHERE employee_id=? AND work_date BETWEEN ? AND ? AND status IN ('present','offsite') AND approved_at IS NOT NULL").get(employee.id,v.period_start,v.period_end);
        const piece = db.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM labour_work_logs WHERE employee_id=? AND work_date BETWEEN ? AND ? AND status='approved' AND pay_type='piece_rate'").get(employee.id,v.period_start,v.period_end);
        let earnings = Number(piece.amount || 0);
        if (employee.pay_type === 'monthly') earnings += Number(employee.base_rate || 0);
        else if (employee.pay_type === 'daily') earnings += Number(employee.base_rate || 0) * Number(att.days || 0);
        else if (employee.pay_type === 'hourly') earnings += Number(employee.base_rate || 0) * Number(att.hours || 0);
        const adj = adjustment.get(Number(employee.id)) || {};
        const allowances = Math.max(0,num(adj.allowances)); const deductions = Math.max(0,num(adj.deductions));
        line.run(run,employee.id,earnings,allowances,deductions,earnings+allowances-deductions,clean(adj.notes));
      }
      db.prepare(`UPDATE payroll_runs SET gross_total=(SELECT COALESCE(SUM(earnings+allowances),0) FROM payroll_lines WHERE payroll_run_id=?),
        deduction_total=(SELECT COALESCE(SUM(deductions),0) FROM payroll_lines WHERE payroll_run_id=?),
        net_total=(SELECT COALESCE(SUM(net_pay),0) FROM payroll_lines WHERE payroll_run_id=?) WHERE id=?`).run(run,run,run,run);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM payroll_runs WHERE id=?').get(run) });
  });
  app.patch('/payroll-runs/:id/status', payrollApprove, (req, reply) => {
    const status = req.body?.status; const db = getDb();
    if (!['approved','paid'].includes(status)) return reply.code(400).send({ success: false, message: 'Status must be approved or paid.' });
    const old = db.prepare('SELECT status FROM payroll_runs WHERE id=?').get(req.params.id);
    if (!old) return reply.code(404).send({ success: false, message: 'Payroll run not found.' });
    if ((status === 'approved' && old.status !== 'draft') || (status === 'paid' && old.status !== 'approved')) return reply.code(409).send({ success: false, message: 'Payroll must move from draft to approved to paid.' });
    db.prepare(`UPDATE payroll_runs SET status=?,${status === 'approved' ? 'approved_by=?,approved_at=datetime(\'now\')' : 'paid_by=?,paid_at=datetime(\'now\')'} WHERE id=?`).run(status,req.user.id,req.params.id);
    reply.send({ success: true });
  });
}
