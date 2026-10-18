// Role-based access: who can see (view) or change (edit) each part of the system.
// 'edit' includes 'view'. A module a role is not listed for is hidden and blocked.

export const ROLES = [
  { key: 'admin',               label: 'System Administrator' },
  { key: 'managing_director',   label: 'Managing Director' },
  { key: 'farm_manager',        label: 'Farm Manager' },
  { key: 'agronomist',          label: 'Agronomist' },
  { key: 'store_keeper',        label: 'Storekeeper' },
  { key: 'machinery_manager',   label: 'Machinery Manager' },
  { key: 'hr_officer',          label: 'HR Officer' },
  { key: 'accountant',          label: 'Accountant' },
  { key: 'procurement_officer', label: 'Procurement Officer' },
  { key: 'sales_officer',       label: 'Sales Officer' },
  { key: 'field_officer',       label: 'Farmer Field Officer' },
  { key: 'auditor',             label: 'Auditor (read-only)' },
];
export const ROLE_KEYS = ROLES.map((r) => r.key);

export const MODULES = [
  { key: 'dashboard',  label: 'Overview dashboard' },
  { key: 'customers',  label: 'Customers' },
  { key: 'products',   label: 'Products & catalogue' },
  { key: 'stock',      label: 'Stock & warehouses' },
  { key: 'sales',      label: 'Quotations & sales orders' },
  { key: 'billing',    label: 'Invoices & receipts' },
  { key: 'pos',        label: 'Point of sale' },
  { key: 'suppliers',  label: 'Suppliers' },
  { key: 'purchasing', label: 'Purchase orders' },
  { key: 'grn',        label: 'Goods received' },
  { key: 'fields',     label: 'Farms, fields & crops' },
  { key: 'growers',    label: 'Contract growers' },
  { key: 'contracts',  label: 'Contract farming' },
  { key: 'seed_quality', label: 'Seed quality' },
  { key: 'assets',     label: 'Machinery & assets' },
  { key: 'staff',      label: 'Staff, attendance & leave' },
  { key: 'payroll',    label: 'Payroll' },
  { key: 'reports',    label: 'Finance & reports' },
  { key: 'feedback',   label: 'Customer feedback & CSAT' },
  { key: 'users',      label: 'User management' },
  { key: 'audit',      label: 'Audit log' },
];
const MODULE_KEYS = MODULES.map((m) => m.key);

// Everyone who is signed in can look these up (forms across the system need them).
const BASELINE_VIEW = ['dashboard', 'customers', 'products', 'stock', 'suppliers', 'fields',
  'growers', 'seed_quality', 'assets', 'staff', 'feedback'];

const GRANTS = {
  admin: { ...Object.fromEntries(MODULE_KEYS.map((m) => [m, 'edit'])), audit: 'view' },
  managing_director: {
    contracts: 'edit', sales: 'edit', billing: 'edit', purchasing: 'edit', payroll: 'edit', feedback: 'edit',
    staff: 'edit', pos: 'view', grn: 'view', reports: 'view', audit: 'view',
  },
  farm_manager: { contracts: 'edit', fields: 'edit', growers: 'edit', seed_quality: 'edit', staff: 'edit', feedback: 'edit', reports: 'view' },
  agronomist: { fields: 'edit', seed_quality: 'edit', contracts: 'edit' },
  store_keeper: { stock: 'edit', grn: 'edit', pos: 'edit', purchasing: 'view', contracts: 'view' },
  machinery_manager: { assets: 'edit' },
  hr_officer: { staff: 'edit', payroll: 'edit' },
  accountant: { contracts: 'edit', billing: 'edit', payroll: 'edit', sales: 'view', pos: 'view', purchasing: 'view', grn: 'view', reports: 'view' },
  procurement_officer: { suppliers: 'edit', purchasing: 'edit', grn: 'edit', reports: 'view' },
  sales_officer: { customers: 'edit', sales: 'edit', pos: 'edit', feedback: 'edit', billing: 'view' },
  field_officer: { growers: 'edit', contracts: 'edit', feedback: 'edit' },
  auditor: {
    ...Object.fromEntries(MODULE_KEYS.filter((m) => m !== 'users').map((m) => [m, 'view'])),
  },
};

const RANK = { none: 0, view: 1, edit: 2 };
const best = (a, b) => (RANK[a] >= RANK[b] ? a : b);

export function permissionsForRole(role) {
  const out = Object.fromEntries(MODULE_KEYS.map((m) => [m, 'none']));
  if (!GRANTS[role]) return out; // unknown role: no access
  for (const m of BASELINE_VIEW) out[m] = 'view';
  for (const [m, level] of Object.entries(GRANTS[role])) out[m] = best(out[m], level);
  return out;
}

// URL → module. Longest/most specific prefix first.
const URL_MODULES = [
  ['/api/staff/payroll-runs', 'payroll'],
  ['/api/staff', 'staff'],
  ['/api/dashboard', 'dashboard'],
  ['/api/customers', 'customers'],
  ['/api/products', 'products'],
  ['/api/warehouses', 'stock'],
  ['/api/stock', 'stock'],
  ['/api/quotations', 'sales'],
  ['/api/sales-orders', 'sales'],
  ['/api/invoices', 'billing'],
  ['/api/receipts', 'billing'],
  ['/api/pos', 'pos'],
  ['/api/suppliers', 'suppliers'],
  ['/api/purchase-orders', 'purchasing'],
  ['/api/grn', 'grn'],
  ['/api/fields', 'fields'],
  ['/api/seasons', 'fields'],
  ['/api/growers', 'growers'],
  ['/api/contracts', 'contracts'],
  ['/api/seed-quality', 'seed_quality'],
  ['/api/assets', 'assets'],
  ['/api/reports', 'reports'],
  ['/api/feedback', 'feedback'],
  ['/api/users', 'users'],
  ['/api/audit', 'audit'],
];

export function moduleForUrl(url) {
  const path = String(url).split('?')[0].replace(/\/+$/, '');
  for (const [prefix, module] of URL_MODULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return module;
  }
  return null;
}

export function neededLevel(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase()) ? 'view' : 'edit';
}

export function can(role, module, level) {
  return RANK[permissionsForRole(role)[module] || 'none'] >= RANK[level];
}

export function roleLabel(role) {
  return ROLES.find((r) => r.key === role)?.label || role;
}
