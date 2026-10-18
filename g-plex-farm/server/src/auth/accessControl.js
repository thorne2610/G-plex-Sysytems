import { getDb } from '../db/connection.js';
import { MODULES, ROLES, can, moduleForUrl, neededLevel, permissionsForRole, roleLabel } from './permissions.js';

const SECRET_KEY = /pass|token|secret|hash/i;

function redact(value, depth = 0) {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[hidden]' : redact(v, depth + 1)]));
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

function writeAudit({ userId, action, table, recordId, newValues }) {
  try {
    getDb().prepare('INSERT INTO audit_log (user_id, action, table_name, record_id, new_values) VALUES (?,?,?,?,?)')
      .run(userId, action, table, recordId ?? null, newValues ? JSON.stringify(newValues).slice(0, 4000) : null);
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

export default async function registerAccessControl(app) {
  // 1) Enforce permissions on every API request, using the user's CURRENT role.
  app.addHook('preHandler', async (request, reply) => {
    const url = request.raw.url || '';
    if (!url.startsWith('/api/') || url.startsWith('/api/auth/')) return;
    if (/^\/api\/users\/\d+\/password$/.test(url.split('?')[0])) return; // self-service; route checks owner/admin

    try { await request.jwtVerify(); } catch { return; } // route's own authenticate sends the 401

    const row = getDb().prepare('SELECT role, is_active FROM users WHERE id = ?').get(request.user.id);
    if (!row || !row.is_active) {
      return reply.code(401).send({ success: false, message: 'This account is no longer active. Please contact an administrator.' });
    }
    request.user.role = row.role; // role changes apply immediately, not after token expiry

    if (url.startsWith('/api/access/')) return;
    const module = moduleForUrl(url);
    if (!module) return; // not a mapped module (e.g. health checks)
    const level = neededLevel(request.method);
    if (!can(row.role, module, level)) {
      const name = MODULES.find((m) => m.key === module)?.label || module;
      return reply.code(403).send({
        success: false,
        message: `Your role (${roleLabel(row.role)}) cannot ${level === 'view' ? 'view' : 'change'} ${name}.`,
      });
    }
  });

  // 2) Record who changed what, and sign-ins, in the audit log.
  app.addHook('onSend', async (request, reply, payload) => {
    request._auditPayload = typeof payload === 'string' ? payload : null;
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    const url = (request.raw.url || '').split('?')[0];
    if (!url.startsWith('/api/') || reply.statusCode >= 400) return;

    let body = null;
    try { body = request._auditPayload ? JSON.parse(request._auditPayload) : null; } catch { /* ignore */ }

    if (url === '/api/auth/login' && request.method === 'POST') {
      const id = body?.data?.id;
      if (id) writeAudit({ userId: id, action: 'LOGIN', table: 'auth', recordId: id });
      return;
    }
    if (url.startsWith('/api/auth/') || !request.user?.id) return;
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

    const module = moduleForUrl(url) || 'other';
    const recordId = Number(request.params?.id) || Number(body?.data?.id) || null;
    writeAudit({
      userId: request.user.id,
      action: `${request.method} ${url.replace(/^\/api\//, '')}`,
      table: module,
      recordId,
      newValues: redact(request.body),
    });
  });

  // 3) Endpoints the app uses to learn what the signed-in user may do.
  app.get('/api/access/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    reply.send({
      success: true,
      data: {
        role: request.user.role,
        role_label: roleLabel(request.user.role),
        permissions: permissionsForRole(request.user.role),
      },
    });
  });

  app.get('/api/access/matrix', { preHandler: [app.authenticate] }, async (request, reply) => {
    reply.send({
      success: true,
      data: {
        roles: ROLES,
        modules: MODULES,
        matrix: Object.fromEntries(ROLES.map((r) => [r.key, permissionsForRole(r.key)])),
      },
    });
  });

  // 4) Audit log viewer (view permission on the 'audit' module is enforced by the hook above).
  app.get('/api/audit', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { user_id: userId, module, action, from, to, limit } = request.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (userId) { where += ' AND a.user_id = ?'; params.push(Number(userId)); }
    if (module) { where += ' AND a.table_name = ?'; params.push(module); }
    if (action) { where += ' AND a.action LIKE ?'; params.push(`%${action}%`); }
    if (from) { where += ' AND date(a.created_at) >= date(?)'; params.push(from); }
    if (to) { where += ' AND date(a.created_at) <= date(?)'; params.push(to); }
    const max = Math.min(Number(limit) || 300, 1000);
    const rows = getDb().prepare(`
      SELECT a.id, a.created_at, a.action, a.table_name AS module, a.record_id, a.new_values,
             u.name AS user_name, u.email AS user_email, u.role AS user_role
      FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ${where} ORDER BY a.id DESC LIMIT ${max}
    `).all(...params);
    reply.send({ success: true, data: rows });
  });
}
