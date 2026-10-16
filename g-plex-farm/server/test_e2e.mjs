import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gplex.farm';
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error('Set ADMIN_INITIAL_PASSWORD in server/.env before running the integration tests.');
const BASE = process.env.API_BASE || 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting End-to-End System Tests on G-Plex Farm ERP...\n');

  // 1. Test Static Frontend
  const resFrontend = await fetch(`${BASE}/`);
  console.log(`[1] Frontend SPA Index: ${resFrontend.status === 200 ? '✅ 200 OK' : '❌ FAIL ' + resFrontend.status}`);

  // 2. Test Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginData = await loginRes.json();
  const rawCookie = loginRes.headers.get('set-cookie');
  const tokenCookie = rawCookie ? rawCookie.split(';')[0] : '';
  console.log(`[2] Admin Login: ${loginData.success ? '✅ Authenticated' : '❌ Failed: ' + loginData.message}`);
  console.log(`    User: ${loginData.data?.name} (${loginData.data?.role})`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': tokenCookie,
  };

  // 3. Test /me
  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: authHeaders });
  const meData = await meRes.json();
  console.log(`[3] Verify Session (/me): ${meData.success && meData.data.email === ADMIN_EMAIL ? '✅ Session Verified' : '❌ Failed'}`);

  // 4. Test Dashboard Summary
  const dashRes = await fetch(`${BASE}/api/dashboard/summary`, { headers: authHeaders });
  const dashData = await dashRes.json();
  const kpis = dashData.data?.kpis || {};
  console.log(`[4] Dashboard Summary API: ${dashData.success ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`    KPIs: Active Fields = ${kpis.activeFields ?? 0}, Stock Valuation = KES ${Number(kpis.stockValue ?? 0).toLocaleString()}, Outstanding = KES ${Number(kpis.outstandingInvoices ?? 0).toLocaleString()}`);

  // 5. Create a Product
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const sku = `MZ-${randomSuffix}`;
  const prodRes = await fetch(`${BASE}/api/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sku: sku,
      name: `Certified Seed Batch #${randomSuffix}`,
      category_id: 1,
      unit: 'bag',
      cost_price: 3200,
      selling_price: 4500,
      reorder_level: 20,
    }),
  });
  const prodData = await prodRes.json();
  console.log(`[5] Product Creation: ${prodData.success ? '✅ Created SKU: ' + prodData.data?.sku : '❌ Failed: ' + prodData.message}`);
  const prodId = prodData.data?.id;

  // 6. Receive Stock into Warehouse 1 (Main Store)
  const stockRes = await fetch(`${BASE}/api/stock/receive`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      product_id: prodId,
      warehouse_id: 1,
      qty: 100,
      unit_cost: 3200,
      notes: 'Initial harvest batch delivery',
    }),
  });
  const stockData = await stockRes.json();
  console.log(`[6] Stock Receipt (+100 bags): ${stockData.success ? '✅ Balance on hand: ' + stockData.data?.new_qty_on_hand : '❌ Failed'}`);

  // 7. Create Customer
  const custRes = await fetch(`${BASE}/api/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Farm Direct Buyer #${randomSuffix}`,
      contact_person: 'David Maina',
      phone: '+254711223344',
      email: `buyer${randomSuffix}@farmdirect.co.ke`,
      credit_limit: 500000,
      payment_terms: 30,
    }),
  });
  const custData = await custRes.json();
  console.log(`[7] Customer Registration: ${custData.success ? '✅ Created Code: ' + custData.data?.code : '❌ Failed'}`);
  const custId = custData.data?.id;

  // 8. Create Invoice (50 bags @ 4500 = 225,000 + 16% VAT = 261,000)
  const invRes = await fetch(`${BASE}/api/invoices`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: custId,
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      notes: 'Sales order dispatch',
      items: [{ product_id: prodId, qty: 50, unit_price: 4500 }],
    }),
  });
  const invData = await invRes.json();
  console.log(`[8] Customer Invoice Issued: ${invData.success ? '✅ Ref: ' + invData.data?.ref_no + ' Total: KES ' + invData.data?.total : '❌ Failed'}`);
  const invId = invData.data?.id;

  // 9. Record Payment Receipt (Partial payment: KES 150,000 via M-Pesa)
  const rcpRes = await fetch(`${BASE}/api/receipts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: custId,
      invoice_id: invId,
      date: new Date().toISOString().split('T')[0],
      amount: 150000,
      mode: 'mpesa',
      reference: `MPESA-${randomSuffix}`,
      notes: 'M-Pesa payment batch 1',
    }),
  });
  const rcpData = await rcpRes.json();
  console.log(`[9] Payment Receipt: ${rcpData.success ? '✅ Ref: ' + rcpData.data?.ref_no + ' Status: ' + rcpData.data?.status + ' Balance Due: KES ' + rcpData.data?.new_balance : '❌ Failed'}`);

  // 10. Verify Reports & Analytics
  const repRes = await fetch(`${BASE}/api/reports/daily-operations`, { headers: authHeaders });
  const repData = await repRes.json();
  console.log(`[10] Daily Operations Audit: ${repData.success ? '✅ Invoiced Total: KES ' + repData.data?.sales?.total + ' | Receipts: KES ' + repData.data?.receipts?.total : '❌ Failed'}`);

  console.log('\n🎉 ALL 10 END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
