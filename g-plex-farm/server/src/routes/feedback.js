import { getDb } from '../db/connection.js';

export const FEEDBACK_CATEGORIES = [
  'Technical Support',
  'Billing & Payments',
  'Sales & Onboarding',
  'Product Quality',
  'Delivery & Logistics',
  'Customer Service',
];
export const FEEDBACK_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const FEEDBACK_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
export const FEEDBACK_DEPARTMENTS = [
  'Farm Operations',
  'Finance & Invoicing',
  'Seed Quality & Agronomy',
  'Logistics & Dispatch',
  'Customer Success',
  'Executive Office',
];

const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isDone = (s) => s === 'Resolved' || s === 'Closed';
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

export default async function feedbackRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  const withNotes = (db, ticket) => ({
    ...ticket,
    notes: db
      .prepare('SELECT id, author, note, created_at FROM feedback_notes WHERE ticket_id = ? ORDER BY created_at, id')
      .all(ticket.id),
  });

  // GET /api/feedback/meta — dropdown values used by the client
  app.get('/meta', AUTH, (req, reply) => {
    reply.send({
      success: true,
      data: {
        categories: FEEDBACK_CATEGORIES,
        statuses: FEEDBACK_STATUSES,
        priorities: FEEDBACK_PRIORITIES,
        departments: FEEDBACK_DEPARTMENTS,
      },
    });
  });

  // GET /api/feedback/summary — CSAT dashboard figures
  app.get('/summary', AUTH, (req, reply) => {
    const db = getDb();
    const totals = db.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(ROUND(AVG(rating), 2), 0) AS avg_rating,
             SUM(CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved,
             SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open_count,
             SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
             SUM(CASE WHEN priority = 'Urgent' AND status NOT IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS urgent_open,
             SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS satisfied
      FROM feedback_tickets
    `).get();
    const total = Number(totals.total || 0);
    const resolved = Number(totals.resolved || 0);

    const avgRes = db.prepare(`
      SELECT ROUND(AVG((julianday(resolution_date) - julianday(created_at)) * 24), 1) AS hours
      FROM feedback_tickets
      WHERE resolution_date IS NOT NULL AND status IN ('Resolved','Closed')
    `).get();

    const ratingRows = db.prepare('SELECT rating, COUNT(*) AS count FROM feedback_tickets GROUP BY rating').all();
    const distribution = [5, 4, 3, 2, 1].map((r) => ({
      rating: r,
      count: Number(ratingRows.find((x) => x.rating === r)?.count || 0),
    }));

    const byCategory = db.prepare(`
      SELECT category,
             COUNT(*) AS total,
             SUM(CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved,
             ROUND(AVG(rating), 2) AS avg_rating
      FROM feedback_tickets GROUP BY category ORDER BY total DESC
    `).all();

    const byDepartment = db.prepare(`
      SELECT COALESCE(assigned_dept, 'Unassigned') AS department,
             COUNT(*) AS total,
             SUM(CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved
      FROM feedback_tickets GROUP BY COALESCE(assigned_dept, 'Unassigned') ORDER BY total DESC
    `).all();

    const trend = db.prepare(`
      SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS total, ROUND(AVG(rating), 2) AS avg_rating
      FROM feedback_tickets GROUP BY substr(created_at, 1, 7) ORDER BY month DESC LIMIT 12
    `).all().reverse();

    reply.send({
      success: true,
      data: {
        total,
        resolved,
        open: Number(totals.open_count || 0),
        in_progress: Number(totals.in_progress || 0),
        urgent_open: Number(totals.urgent_open || 0),
        avg_rating: Number(totals.avg_rating || 0),
        resolution_rate: total ? Math.round((resolved / total) * 100) : 0,
        satisfaction_pct: total ? Math.round((Number(totals.satisfied || 0) / total) * 100) : 0,
        avg_resolution_hours: avgRes?.hours ?? null,
        distribution,
        by_category: byCategory,
        by_department: byDepartment,
        trend,
      },
    });
  });

  // GET /api/feedback — list with filters
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { status, priority, category, rating, dept, q, from, to } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND t.status = ?'; params.push(status); }
    if (priority) { where += ' AND t.priority = ?'; params.push(priority); }
    if (category) { where += ' AND t.category = ?'; params.push(category); }
    if (dept) { where += ' AND t.assigned_dept = ?'; params.push(dept); }
    if (rating) { where += ' AND t.rating = ?'; params.push(Number(rating)); }
    if (from && dateOk(from)) { where += ' AND date(t.created_at) >= date(?)'; params.push(from); }
    if (to && dateOk(to)) { where += ' AND date(t.created_at) <= date(?)'; params.push(to); }
    if (q) {
      where += ' AND (t.ticket_no LIKE ? OR t.customer_name LIKE ? OR t.title LIKE ? OR t.email LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    const rows = db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM feedback_notes n WHERE n.ticket_id = t.id) AS note_count
      FROM feedback_tickets t ${where}
      ORDER BY
        CASE t.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        t.created_at DESC
    `).all(...params);
    reply.send({ success: true, data: rows, total: rows.length });
  });

  // GET /api/feedback/:id — one ticket with its notes
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM feedback_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return reply.code(404).send({ success: false, message: 'Ticket not found' });
    reply.send({ success: true, data: withNotes(db, ticket) });
  });

  // POST /api/feedback — log a new ticket
  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const v = req.body || {};
    const customerName = clean(v.customer_name);
    const title = clean(v.title);
    const rating = Number(v.rating);

    if (!customerName || !title || !clean(v.category)) {
      return reply.code(400).send({ success: false, message: 'Customer name, category and subject are required.' });
    }
    if (!FEEDBACK_CATEGORIES.includes(v.category)) {
      return reply.code(400).send({ success: false, message: 'Choose a valid category.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return reply.code(400).send({ success: false, message: 'Rating must be a whole number from 1 to 5.' });
    }
    const priority = FEEDBACK_PRIORITIES.includes(v.priority) ? v.priority : 'Medium';
    const status = FEEDBACK_STATUSES.includes(v.status) ? v.status : 'Open';
    if (v.incident_date && !dateOk(v.incident_date)) {
      return reply.code(400).send({ success: false, message: 'Incident date must be a valid date.' });
    }
    let customerId = null;
    if (v.customer_id) {
      const c = db.prepare('SELECT id FROM customers WHERE id = ?').get(v.customer_id);
      if (!c) return reply.code(400).send({ success: false, message: 'Selected customer was not found.' });
      customerId = c.id;
    }

    let created;
    db.exec('BEGIN IMMEDIATE');
    try {
      const res = db.prepare(`
        INSERT INTO feedback_tickets
          (customer_id, customer_name, email, phone, category, rating, priority, status, incident_date,
           assigned_dept, assigned_to, title, description, attachment_name, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        customerId, customerName, clean(v.email), clean(v.phone), v.category, rating, priority, status,
        clean(v.incident_date), clean(v.assigned_dept), clean(v.assigned_to), title, clean(v.description),
        clean(v.attachment_name), req.user.id,
      );
      const id = Number(res.lastInsertRowid);
      const ticketNo = `CMP-${new Date().getFullYear()}-${String(1000 + id)}`;
      db.prepare('UPDATE feedback_tickets SET ticket_no = ? WHERE id = ?').run(ticketNo, id);
      db.prepare('INSERT INTO feedback_notes (ticket_id, author, note) VALUES (?,?,?)')
        .run(id, 'System', `Ticket logged by ${req.user.name}.`);
      db.exec('COMMIT');
      created = id;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const ticket = db.prepare('SELECT * FROM feedback_tickets WHERE id = ?').get(created);
    reply.code(201).send({ success: true, data: withNotes(db, ticket) });
  });

  // PATCH /api/feedback/:id — status, priority, assignment, resolution
  app.patch('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM feedback_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return reply.code(404).send({ success: false, message: 'Ticket not found' });
    const v = req.body || {};

    const next = {
      status: v.status ?? ticket.status,
      priority: v.priority ?? ticket.priority,
      assigned_dept: v.assigned_dept !== undefined ? clean(v.assigned_dept) : ticket.assigned_dept,
      assigned_to: v.assigned_to !== undefined ? clean(v.assigned_to) : ticket.assigned_to,
      resolution_notes: v.resolution_notes !== undefined ? clean(v.resolution_notes) : ticket.resolution_notes,
    };
    if (!FEEDBACK_STATUSES.includes(next.status)) {
      return reply.code(400).send({ success: false, message: 'Choose a valid status.' });
    }
    if (!FEEDBACK_PRIORITIES.includes(next.priority)) {
      return reply.code(400).send({ success: false, message: 'Choose a valid priority.' });
    }
    if (isDone(next.status) && !next.resolution_notes) {
      return reply.code(400).send({ success: false, message: 'Add resolution notes before resolving or closing a ticket.' });
    }

    let resolutionDate = ticket.resolution_date;
    if (isDone(next.status) && !resolutionDate) resolutionDate = new Date().toISOString();
    if (!isDone(next.status)) resolutionDate = null;

    const changes = [];
    if (next.status !== ticket.status) changes.push(`Status: ${ticket.status} → ${next.status}`);
    if (next.priority !== ticket.priority) changes.push(`Priority: ${ticket.priority} → ${next.priority}`);
    if (next.assigned_dept !== ticket.assigned_dept) changes.push(`Department: ${ticket.assigned_dept || 'Unassigned'} → ${next.assigned_dept || 'Unassigned'}`);
    if (next.assigned_to !== ticket.assigned_to) changes.push(`Assigned to: ${ticket.assigned_to || 'Unassigned'} → ${next.assigned_to || 'Unassigned'}`);

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        UPDATE feedback_tickets
        SET status=?, priority=?, assigned_dept=?, assigned_to=?, resolution_notes=?, resolution_date=?,
            updated_at=datetime('now')
        WHERE id=?
      `).run(next.status, next.priority, next.assigned_dept, next.assigned_to, next.resolution_notes, resolutionDate, ticket.id);
      if (changes.length) {
        db.prepare('INSERT INTO feedback_notes (ticket_id, author, note) VALUES (?,?,?)')
          .run(ticket.id, req.user.name, changes.join('; '));
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const updated = db.prepare('SELECT * FROM feedback_tickets WHERE id = ?').get(ticket.id);
    reply.send({ success: true, data: withNotes(db, updated) });
  });

  // POST /api/feedback/:id/notes — add an investigation note
  app.post('/:id/notes', AUTH, (req, reply) => {
    const db = getDb();
    const ticket = db.prepare('SELECT id FROM feedback_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return reply.code(404).send({ success: false, message: 'Ticket not found' });
    const note = clean(req.body?.note);
    if (!note) return reply.code(400).send({ success: false, message: 'Write a note first.' });
    db.prepare('INSERT INTO feedback_notes (ticket_id, author, note) VALUES (?,?,?)').run(ticket.id, req.user.name, note);
    db.prepare("UPDATE feedback_tickets SET updated_at = datetime('now') WHERE id = ?").run(ticket.id);
    const full = db.prepare('SELECT * FROM feedback_tickets WHERE id = ?').get(ticket.id);
    reply.code(201).send({ success: true, data: withNotes(db, full) });
  });
}
