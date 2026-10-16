import { getDb } from '../db/connection.js';

export default async function productRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  app.get('/categories', AUTH, (req, reply) => {
    const db = getDb();
    reply.send({ success: true, data: db.prepare('SELECT * FROM product_categories ORDER BY name').all() });
  });

  app.get('/', AUTH, (req, reply) => {
    const db = getDb();
    const { search, category_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE p.is_active=1'; const params = [];
    if (search) { where += ' AND (p.name LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category_id) { where += ' AND p.category_id=?'; params.push(category_id); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM products p ${where}`).get(...params).c;
    const rows = db.prepare(`
      SELECT p.*, pc.name as category_name,
             COALESCE((SELECT SUM(sb.qty_on_hand) FROM stock_balances sb WHERE sb.product_id=p.id), 0) as total_stock
      FROM products p LEFT JOIN product_categories pc ON pc.id=p.category_id ${where} ORDER BY p.name LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    reply.send({ success: true, data: rows, total });
  });

  app.get('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const product = db.prepare('SELECT p.*, pc.name as category_name FROM products p LEFT JOIN product_categories pc ON pc.id=p.category_id WHERE p.id=?').get(req.params.id);
    if (!product) return reply.code(404).send({ success: false, message: 'Product not found' });
    const balances = db.prepare('SELECT sb.*, w.name as warehouse_name FROM stock_balances sb JOIN warehouses w ON w.id=sb.warehouse_id WHERE sb.product_id=?').all(product.id);
    const movements = db.prepare('SELECT sm.*, w.name as warehouse_name FROM stock_movements sm JOIN warehouses w ON w.id=sm.warehouse_id WHERE sm.product_id=? ORDER BY sm.created_at DESC LIMIT 20').all(product.id);
    reply.send({ success: true, data: { ...product, balances, movements } });
  });

  app.post('/', AUTH, (req, reply) => {
    const db = getDb();
    const { sku, name, category_id, unit, cost_price, selling_price, reorder_level, vat_pct, description } = req.body;
    if (!sku || !name) return reply.code(400).send({ success: false, message: 'SKU and name are required' });
    const result = db.prepare('INSERT INTO products (sku,name,category_id,unit,cost_price,selling_price,reorder_level,vat_pct,description) VALUES (?,?,?,?,?,?,?,?,?)').run(sku, name, category_id || null, unit || 'kg', cost_price || 0, selling_price || 0, reorder_level || 0, vat_pct ?? 16, description || null);
    reply.code(201).send({ success: true, data: db.prepare('SELECT * FROM products WHERE id=?').get(result.lastInsertRowid) });
  });

  app.put('/:id', AUTH, (req, reply) => {
    const db = getDb();
    const { name, category_id, unit, cost_price, selling_price, reorder_level, vat_pct, description, is_active } = req.body;
    db.prepare("UPDATE products SET name=?,category_id=?,unit=?,cost_price=?,selling_price=?,reorder_level=?,vat_pct=?,description=?,is_active=?,updated_at=datetime('now') WHERE id=?").run(name, category_id || null, unit, cost_price, selling_price, reorder_level, vat_pct, description, is_active ?? 1, req.params.id);
    reply.send({ success: true, data: db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id) });
  });
}
