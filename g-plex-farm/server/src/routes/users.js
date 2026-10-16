import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';

export default async function userRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };
  const ADMIN_ONLY = { preHandler: [app.authenticate, app.authorise(['admin'])] };

  // GET /api/users — list all users
  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const rows = db.prepare('SELECT id, name, email, role, department, phone, is_active, created_at, updated_at FROM users ORDER BY name').all();
    reply.send({ success: true, data: rows });
  });

  // GET /api/users/:id
  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, department, phone, is_active, created_at, updated_at FROM users WHERE id=?').get(req.params.id);
    if (!user) return reply.code(404).send({ success: false, message: 'User not found' });
    reply.send({ success: true, data: user });
  });

  // POST /api/users — admin creates a new user
  app.post('/', ADMIN_ONLY, async (req, reply) => {
    const db = getDb();
    const { name, email, password, role, department, phone } = req.body;
    if (!name || !email || !password || !role) {
      return reply.code(400).send({ success: false, message: 'name, email, password, and role are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim());
    if (existing) {
      return reply.code(409).send({ success: false, message: 'A user with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const res = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, department, phone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email.toLowerCase().trim(), hash, role, department || null, phone || null);

    const newUser = db.prepare('SELECT id, name, email, role, department, phone, is_active, created_at FROM users WHERE id=?').get(res.lastInsertRowid);
    reply.code(201).send({ success: true, data: newUser });
  });

  // PUT /api/users/:id — update user details/role
  app.put('/:id', ADMIN_ONLY, (req, reply) => {
    const db = getDb();
    const { name, role, department, phone, is_active } = req.body;
    db.prepare(`
      UPDATE users
      SET name=?, role=?, department=?, phone=?, is_active=?, updated_at=datetime('now')
      WHERE id=?
    `).run(name, role, department || null, phone || null, is_active ?? 1, req.params.id);

    const updated = db.prepare('SELECT id, name, email, role, department, phone, is_active, created_at, updated_at FROM users WHERE id=?').get(req.params.id);
    reply.send({ success: true, data: updated });
  });

  // PUT /api/users/:id/password — update password
  app.put('/:id/password', AUTH, async (req, reply) => {
    const db = getDb();
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return reply.code(400).send({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
      return reply.code(403).send({ success: false, message: 'Forbidden' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(hash, req.params.id);
    reply.send({ success: true, message: 'Password updated successfully' });
  });
}
