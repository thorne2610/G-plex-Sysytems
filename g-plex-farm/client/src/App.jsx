import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from './store/authStore.js';

import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Quotations from './pages/Quotations.jsx';
import SalesOrders from './pages/SalesOrders.jsx';
import Invoices from './pages/Invoices.jsx';
import Receipts from './pages/Receipts.jsx';
import Products from './pages/Products.jsx';
import StockMovements from './pages/StockMovements.jsx';
import Suppliers from './pages/Suppliers.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import GRN from './pages/GRN.jsx';
import Fields from './pages/Fields.jsx';
import Assets from './pages/Assets.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import POS from './pages/POS.jsx';
import Growers from './pages/Growers.jsx';
import ContractFarming from './pages/ContractFarming.jsx';
import SeedQuality from './pages/SeedQuality.jsx';
import Staff from './pages/Staff.jsx';
import MachineryWork from './pages/MachineryWork.jsx';
import Feedback from './pages/Feedback.jsx';
import AuditLog from './pages/AuditLog.jsx';
import RolesAccess from './pages/RolesAccess.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f7fa',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌾</div>
        <Spin size="large" tip="Loading G-Plex Farm ERP..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="fields" element={<Fields />} />
        <Route path="growers" element={<Growers />} />
        <Route path="contracts" element={<ContractFarming />} />
        <Route path="seed-quality" element={<SeedQuality />} />
        <Route path="customers" element={<Customers />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="sales-orders" element={<SalesOrders />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="products" element={<Products />} />
        <Route path="stock" element={<StockMovements />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="grn" element={<GRN />} />
        <Route path="assets" element={<Assets />} />
        <Route path="machinery-work" element={<MachineryWork />} />
        <Route path="staff" element={<Staff />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="roles" element={<RolesAccess />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
