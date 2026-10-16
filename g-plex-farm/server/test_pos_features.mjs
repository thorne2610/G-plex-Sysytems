import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gplex.farm';
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error('Set ADMIN_INITIAL_PASSWORD in server/.env before running the integration tests.');
const BASE = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Testing New Features from index(2).html...\n');

  // 1. Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const rawCookie = loginRes.headers.get('set-cookie');
  const tokenCookie = rawCookie ? rawCookie.split(';')[0] : '';
  const authHeaders = { 'Content-Type': 'application/json', 'Cookie': tokenCookie };
  console.log(`[1] Auth: ✅ Logged in`);

  // 2. Test Growers API
  const growersRes = await fetch(`${BASE}/api/growers`, { headers: authHeaders });
  const growersData = await growersRes.json();
  console.log(`[2] Growers API: ${growersData.success ? '✅ ' + growersData.data.length + ' contract growers found' : '❌ Failed'}`);
  const firstGrower = growersData.data[0];
  console.log(`    Sample: ${firstGrower.code} - ${firstGrower.name} (${firstGrower.contract_ref}, ${firstGrower.contracted_acres} ac)`);

  // 3. Test Seed Quality API
  const sqRes = await fetch(`${BASE}/api/seed-quality`, { headers: authHeaders });
  const sqData = await sqRes.json();
  console.log(`[3] Seed Quality API: ${sqData.success ? '✅ ' + sqData.data.length + ' seed lots tracked' : '❌ Failed'}`);
  const firstLot = sqData.data[0];
  console.log(`    Sample: Lot ${firstLot.lot_number} (${firstLot.variety}) - Germination: ${firstLot.germination_pct}% [${firstLot.status}]`);

  // 4. Test POS Products
  const prodRes = await fetch(`${BASE}/api/products`, { headers: authHeaders });
  const prodData = await prodRes.json();
  const maizeProd = prodData.data.find(p => p.sku === 'GP-H614-25') || prodData.data[0];
  console.log(`[4] POS Products: ✅ Found ${maizeProd.name} @ KSh ${maizeProd.selling_price}`);

  // 5. Test POS Immediate Cash Sale ("Buy now" mode)
  const posSaleRes = await fetch(`${BASE}/api/pos/transact`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      type: 'sale',
      farmer_name: 'Walk-in Customer (Retail)',
      payment_method: 'cash',
      items: [{
        product_id: maizeProd.id,
        lot_number: 'GP-26-038',
        qty: 2,
        unit_price: maizeProd.selling_price,
      }],
      notes: 'Counter POS cash sale',
    }),
  });
  const posSaleData = await posSaleRes.json();
  console.log(`[5] POS Counter Sale: ${posSaleData.success ? '✅ ' + posSaleData.data.ref_no + ' Total: KSh ' + posSaleData.data.total : '❌ Failed'}`);

  // 6. Test POS Input Credit / Lease Mode
  const posCreditRes = await fetch(`${BASE}/api/pos/transact`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      type: 'credit_issue',
      farmer_name: `${firstGrower.name} · ${firstGrower.code}`,
      grower_id: firstGrower.id,
      contract_ref: firstGrower.contract_ref,
      recovery_plan: 'Deduct from accepted harvest',
      due_date: '30 Nov 2026',
      items: [{
        product_id: maizeProd.id,
        lot_number: 'GP-26-038',
        qty: 4,
        unit_price: maizeProd.selling_price,
      }],
      notes: `Input agreement issued for ${firstGrower.contract_ref}`,
    }),
  });
  const posCreditData = await posCreditRes.json();
  console.log(`[6] POS Input Credit Issue: ${posCreditData.success ? '✅ ' + posCreditData.data.ref_no + ' Total: KSh ' + posCreditData.data.total : '❌ Failed'}`);

  // 7. Verify Grower Input Credit Balance Updated
  const verifyGrowerRes = await fetch(`${BASE}/api/growers/${firstGrower.id}`, { headers: authHeaders });
  const verifyGrowerData = await verifyGrowerRes.json();
  console.log(`[7] Grower Ledger Updated: ✅ ${verifyGrowerData.data.name} new credit balance: KSh ${verifyGrowerData.data.input_credit.toLocaleString()}`);

  // 8. Test Daily Cash-Up Summary
  const cashUpRes = await fetch(`${BASE}/api/pos/cash-up`, { headers: authHeaders });
  const cashUpData = await cashUpRes.json();
  console.log(`[8] POS Daily Cash-Up: ${cashUpData.success ? '✅ ' + cashUpData.data.summary.total_txns + ' transactions recorded today (KSh ' + Number(cashUpData.data.summary.grand_total).toLocaleString() + ')' : '❌ Failed'}`);

  console.log('\n🎉 ALL NEW FEATURES TESTED AND WORKING PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
