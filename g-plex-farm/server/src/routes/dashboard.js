import { getDb } from '../db/connection.js';

export default async function dashboardRoutes(app) {
  app.get('/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const db = getDb();

    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // KPI 1: Today's receipts / sales
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM receipts WHERE date = ?
    `).get(today);

    // KPI 2: Outstanding invoices balance
    const outstanding = db.prepare(`
      SELECT COALESCE(SUM(balance_due), 0) as total
      FROM invoices
      WHERE status IN ('posted','partial','overdue')
    `).get();

    // KPI 3: Total stock value
    const stockValue = db.prepare(`
      SELECT COALESCE(SUM(sb.qty_on_hand * p.cost_price), 0) as total
      FROM stock_balances sb
      JOIN products p ON p.id = sb.product_id
    `).get();

    // KPI 4: Active customers
    const activeCustomers = db.prepare(
      'SELECT COUNT(*) as total FROM customers WHERE is_active = 1'
    ).get();

    // KPI 5: Low stock items
    const lowStock = db.prepare(`
      SELECT COUNT(*) as total FROM (
        SELECT p.id, COALESCE(SUM(sb.qty_on_hand), 0) as qty
        FROM products p
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.is_active = 1 AND p.reorder_level > 0
        GROUP BY p.id
        HAVING qty <= p.reorder_level
      )
    `).get();

    // KPI 6: Active fields
    const activeFields = db.prepare(
      'SELECT COUNT(*) as total FROM fields WHERE is_active = 1'
    ).get();

    // Monthly sales chart (last 6 months)
    const salesChart = db.prepare(`
      SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount), 0) as total
      FROM receipts
      WHERE date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month
    `).all();

    // Recent transactions (last 10 invoices + receipts)
    const recentInvoices = db.prepare(`
      SELECT i.ref_no, i.date, i.total, i.status, c.name as customer_name, 'invoice' as type
      FROM invoices i JOIN customers c ON c.id = i.customer_id
      ORDER BY i.created_at DESC LIMIT 5
    `).all();

    const recentReceipts = db.prepare(`
      SELECT r.ref_no, r.date, r.amount as total, 'paid' as status, c.name as customer_name, 'receipt' as type
      FROM receipts r JOIN customers c ON c.id = r.customer_id
      ORDER BY r.created_at DESC LIMIT 5
    `).all();

    const recentActivity = [...recentInvoices, ...recentReceipts]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    // Low stock products list
    const lowStockItems = db.prepare(`
      SELECT p.name, p.unit, p.reorder_level, p.sku,
             COALESCE(SUM(sb.qty_on_hand), 0) as qty_on_hand
      FROM products p
      LEFT JOIN stock_balances sb ON sb.product_id = p.id
      WHERE p.is_active = 1 AND p.reorder_level > 0
      GROUP BY p.id
      HAVING qty_on_hand <= p.reorder_level
      LIMIT 10
    `).all();

    reply.send({
      success: true,
      data: {
        kpis: {
          todaySales: todaySales.total,
          outstandingInvoices: outstanding.total,
          stockValue: stockValue.total,
          activeCustomers: activeCustomers.total,
          lowStockItems: lowStock.total,
          activeFields: activeFields.total,
        },
        salesChart,
        recentActivity,
        lowStockItems,
      },
    });
  });
}
