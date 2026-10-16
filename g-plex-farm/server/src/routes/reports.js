import { getDb } from '../db/connection.js';

export default async function reportRoutes(app) {
  const AUTH = { preHandler: [app.authenticate] };

  // GET /api/reports/daily-operations
  app.get('/daily-operations', AUTH, (req, reply) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const salesToday = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM invoices WHERE date = ?
    `).get(today);

    const receiptsToday = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM receipts WHERE date = ?
    `).get(today);

    const stockMovementsToday = db.prepare(`
      SELECT sm.type, COUNT(*) as count, COALESCE(SUM(sm.qty), 0) as total_qty
      FROM stock_movements sm
      WHERE sm.created_at >= ?
      GROUP BY sm.type
    `).all(`${today} 00:00:00`);

    const recentInvoices = db.prepare(`
      SELECT i.id, i.ref_no, i.date, i.total, i.status, c.name as customer_name
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      ORDER BY i.created_at DESC LIMIT 10
    `).all();

    reply.send({
      success: true,
      data: {
        date: today,
        sales: salesToday,
        receipts: receiptsToday,
        stock_movements: stockMovementsToday,
        recent_invoices: recentInvoices
      }
    });
  });

  // GET /api/reports/inventory-valuation
  app.get('/inventory-valuation', AUTH, (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT p.id, p.sku, p.name, p.unit, p.cost_price, p.selling_price, pc.name as category_name,
             w.name as warehouse_name,
             COALESCE(sb.qty_on_hand, 0) as qty_on_hand,
             COALESCE(sb.qty_on_hand, 0) * p.cost_price as valuation_cost,
             COALESCE(sb.qty_on_hand, 0) * p.selling_price as valuation_retail
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN stock_balances sb ON sb.product_id = p.id
      LEFT JOIN warehouses w ON w.id = sb.warehouse_id
      WHERE p.is_active = 1
      ORDER BY p.name
    `).all();

    const summary = rows.reduce((acc, row) => {
      acc.total_items += 1;
      acc.total_cost_valuation += Number(row.valuation_cost) || 0;
      acc.total_retail_valuation += Number(row.valuation_retail) || 0;
      return acc;
    }, { total_items: 0, total_cost_valuation: 0, total_retail_valuation: 0 });

    reply.send({ success: true, data: rows, summary });
  });

  // GET /api/reports/sales-summary
  app.get('/sales-summary', AUTH, (req, reply) => {
    const db = getDb();
    const { start_date, end_date } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      where += ' AND i.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND i.date <= ?';
      params.push(end_date);
    }

    const byCustomer = db.prepare(`
      SELECT c.id, c.code, c.name,
             COUNT(i.id) as invoice_count,
             COALESCE(SUM(i.total), 0) as total_sales,
             COALESCE(SUM(i.amount_paid), 0) as total_collected,
             COALESCE(SUM(i.balance_due), 0) as outstanding_balance
      FROM customers c
      JOIN invoices i ON i.customer_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY total_sales DESC
    `).all(...params);

    const totalSales = db.prepare(`
      SELECT COUNT(*) as count,
             COALESCE(SUM(subtotal), 0) as subtotal,
             COALESCE(SUM(vat_amount), 0) as vat,
             COALESCE(SUM(total), 0) as grand_total,
             COALESCE(SUM(amount_paid), 0) as total_paid,
             COALESCE(SUM(balance_due), 0) as total_balance
      FROM invoices i
      ${where}
    `).get(...params);

    reply.send({
      success: true,
      data: {
        summary: totalSales,
        by_customer: byCustomer
      }
    });
  });

  // GET /api/reports/aged-debtors
  app.get('/aged-debtors', AUTH, (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.id, c.code, c.name, c.phone, c.email, c.credit_limit, c.balance,
             (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.balance_due > 0) as unpaid_invoices,
             (SELECT MIN(date) FROM invoices i WHERE i.customer_id = c.id AND i.balance_due > 0) as oldest_unpaid_date
      FROM customers c
      WHERE c.balance > 0
      ORDER BY c.balance DESC
    `).all();

    const totalReceivable = rows.reduce((sum, r) => sum + (Number(r.balance) || 0), 0);

    reply.send({
      success: true,
      data: rows,
      total_receivable: totalReceivable
    });
  });

  // GET /api/reports/profit-loss
  app.get('/profit-loss', AUTH, (req, reply) => {
    const db = getDb();
    const { start_date, end_date } = req.query;
    let invWhere = "WHERE status != 'cancelled'";
    let expWhere = "WHERE status != 'cancelled'";
    const invParams = [];
    const expParams = [];

    if (start_date) {
      invWhere += ' AND date >= ?';
      invParams.push(start_date);
      expWhere += ' AND date >= ?';
      expParams.push(start_date);
    }
    if (end_date) {
      invWhere += ' AND date <= ?';
      invParams.push(end_date);
      expWhere += ' AND date <= ?';
      expParams.push(end_date);
    }

    const revenue = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as net_sales, COALESCE(SUM(total), 0) as gross_sales
      FROM invoices ${invWhere}
    `).get(...invParams);

    const procurementExpenses = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_expenses
      FROM supplier_invoices ${expWhere}
    `).get(...expParams);

    const fuelExpenses = db.prepare(`
      SELECT COALESCE(SUM(total_cost), 0) as total_fuel
      FROM fuel_logs ${start_date ? 'WHERE date >= ?' : ''} ${end_date ? (start_date ? 'AND' : 'WHERE') + ' date <= ?' : ''}
    `).get(...[start_date, end_date].filter(Boolean));

    const maintenanceExpenses = db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as total_maintenance
      FROM maintenance_records ${start_date ? 'WHERE date >= ?' : ''} ${end_date ? (start_date ? 'AND' : 'WHERE') + ' date <= ?' : ''}
    `).get(...[start_date, end_date].filter(Boolean));

    const totalCosts = (procurementExpenses?.total_expenses || 0) + (fuelExpenses?.total_fuel || 0) + (maintenanceExpenses?.total_maintenance || 0);
    const netProfit = (revenue?.gross_sales || 0) - totalCosts;

    reply.send({
      success: true,
      data: {
        revenue: {
          gross_sales: revenue?.gross_sales || 0,
          net_sales: revenue?.net_sales || 0
        },
        expenses: {
          procurement: procurementExpenses?.total_expenses || 0,
          fuel: fuelExpenses?.total_fuel || 0,
          maintenance: maintenanceExpenses?.total_maintenance || 0,
          total: totalCosts
        },
        net_profit: netProfit
      }
    });
  });
}
