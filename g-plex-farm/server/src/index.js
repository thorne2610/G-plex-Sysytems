import dotenv from 'dotenv';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import { runMigrations, seedDatabase } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import customerRoutes from './routes/customers.js';
import quotationRoutes from './routes/quotations.js';
import salesOrderRoutes from './routes/salesOrders.js';
import invoiceRoutes from './routes/invoices.js';
import receiptRoutes from './routes/receipts.js';
import productRoutes from './routes/products.js';
import warehouseRoutes from './routes/warehouses.js';
import stockRoutes from './routes/stock.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import grnRoutes from './routes/grn.js';
import fieldRoutes from './routes/fields.js';
import seasonRoutes from './routes/seasons.js';
import assetRoutes from './routes/assets.js';
import staffRoutes from './routes/staff.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import posRoutes from './routes/pos.js';
import growerRoutes from './routes/growers.js';
import seedQualityRoutes from './routes/seedQuality.js';
import feedbackRoutes from './routes/feedback.js';
import contractRoutes from './routes/contracts.js';
import registerAccessControl from './auth/accessControl.js';
import { getDb } from './db/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Set JWT_SECRET (at least 32 characters) in server/.env before starting G-Plex Farm ERP.');
}

const app = Fastify({ logger: { level: 'info' } });

// ── Plugins ────────────────────────────────────────────────────
await app.register(fastifyCors, {
  origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
  credentials: true,
});

await app.register(fastifyCookie);

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
  cookie: { cookieName: 'token', signed: false },
});

// ── Auth Decorator ─────────────────────────────────────────────
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
    // Always use the user's current role/status from the database, not the one in the token.
    const current = getDb().prepare('SELECT role, is_active FROM users WHERE id = ?').get(request.user.id);
    if (!current || !current.is_active) {
      return reply.code(401).send({ success: false, message: 'Unauthorised — please log in' });
    }
    request.user.role = current.role;
  } catch (err) {
    reply.code(401).send({ success: false, message: 'Unauthorised — please log in' });
  }
});

app.decorate('authorise', function (roles) {
  return async function (request, reply) {
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ success: false, message: 'Forbidden — insufficient permissions' });
    }
  };
});

// ── Access control & audit trail (applies to every /api route below) ──
await registerAccessControl(app);

// ── API Routes ─────────────────────────────────────────────────
const API = '/api';
app.register(authRoutes,         { prefix: `${API}/auth` });
app.register(dashboardRoutes,    { prefix: `${API}/dashboard` });
app.register(customerRoutes,     { prefix: `${API}/customers` });
app.register(quotationRoutes,    { prefix: `${API}/quotations` });
app.register(salesOrderRoutes,   { prefix: `${API}/sales-orders` });
app.register(invoiceRoutes,      { prefix: `${API}/invoices` });
app.register(receiptRoutes,      { prefix: `${API}/receipts` });
app.register(productRoutes,      { prefix: `${API}/products` });
app.register(warehouseRoutes,    { prefix: `${API}/warehouses` });
app.register(stockRoutes,        { prefix: `${API}/stock` });
app.register(supplierRoutes,     { prefix: `${API}/suppliers` });
app.register(purchaseOrderRoutes,{ prefix: `${API}/purchase-orders` });
app.register(grnRoutes,          { prefix: `${API}/grn` });
app.register(fieldRoutes,        { prefix: `${API}/fields` });
app.register(seasonRoutes,       { prefix: `${API}/seasons` });
app.register(assetRoutes,        { prefix: `${API}/assets` });
app.register(staffRoutes,        { prefix: `${API}/staff` });
app.register(reportRoutes,       { prefix: `${API}/reports` });
app.register(userRoutes,         { prefix: `${API}/users` });
app.register(posRoutes,          { prefix: `${API}/pos` });
app.register(growerRoutes,       { prefix: `${API}/growers` });
app.register(seedQualityRoutes,  { prefix: `${API}/seed-quality` });
app.register(feedbackRoutes,     { prefix: `${API}/feedback` });
app.register(contractRoutes,     { prefix: `${API}/contracts` });

// ── Serve React SPA (Production) ───────────────────────────────
const distPath = join(__dirname, '../../client/dist');
if (existsSync(distPath)) {
  await app.register(fastifyStatic, { root: distPath, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url.startsWith('/api')) {
      return reply.code(404).send({ success: false, message: 'API route not found' });
    }
    reply.sendFile('index.html');
  });
}

// ── Start ──────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');

try {
  // Run migrations and seed
  runMigrations();
  await seedDatabase();

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 G-Plex Farm ERP running at http://localhost:${PORT}`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Press Ctrl+C to stop\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
