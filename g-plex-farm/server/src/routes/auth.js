import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';

export default async function authRoutes(app) {
  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (!user) {
      return reply.code(401).send({ success: false, message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ success: false, message: 'Invalid email or password' });
    }

    const token = app.jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      { expiresIn: '12h' }
    );

    reply
      .setCookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      })
      .send({
        success: true,
        data: { id: user.id, name: user.name, email: user.email, role: user.role },
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
  });

  // POST /api/auth/logout
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' }).send({ success: true });
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(request.user.id);
    reply.send({ success: true, data: user, user });
  });
}
