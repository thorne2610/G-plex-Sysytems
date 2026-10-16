import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Space, Tag, Typography } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  ExperimentOutlined,
  InboxOutlined,
  SwapOutlined,
  FileTextOutlined,
  ShopOutlined,
  ToolOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatRole = (role) => {
    if (!role) return '';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getInitials = (name) => {
    if (!name) return 'GP';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Overview',
    },
    {
      key: '/pos',
      icon: <ShoppingOutlined />,
      label: 'Point of Sale (POS)',
    },
    {
      key: '/fields',
      icon: <EnvironmentOutlined />,
      label: 'Farms & Fields',
    },
    {
      key: '/growers',
      icon: <TeamOutlined />,
      label: 'Contract Growers',
    },
    {
      key: '/seed-quality',
      icon: <ExperimentOutlined />,
      label: 'Seed Quality & Testing',
    },
    {
      key: 'inventory-group',
      icon: <InboxOutlined />,
      label: 'Inventory & Stores',
      children: [
        { key: '/products', icon: <InboxOutlined />, label: 'Inputs & Seed Catalogue' },
        { key: '/stock', icon: <SwapOutlined />, label: 'Stock Movements & Stores' },
      ],
    },
    {
      key: 'sales-group',
      icon: <FileTextOutlined />,
      label: 'Sales & Dispatch',
      children: [
        { key: '/customers', icon: <TeamOutlined />, label: 'Customer Directory' },
        { key: '/quotations', icon: <FileTextOutlined />, label: 'Quotations' },
        { key: '/sales-orders', icon: <ShoppingOutlined />, label: 'Sales Orders' },
        { key: '/invoices', icon: <DollarOutlined />, label: 'Tax Invoices' },
        { key: '/receipts', icon: <CheckCircleOutlined />, label: 'Payment Receipts' },
      ],
    },
    {
      key: 'procurement-group',
      icon: <ShopOutlined />,
      label: 'Procurement & Vendors',
      children: [
        { key: '/suppliers', icon: <ShopOutlined />, label: 'Suppliers' },
        { key: '/purchase-orders', icon: <FileDoneOutlined />, label: 'Purchase Orders' },
        { key: '/grn', icon: <CheckCircleOutlined />, label: 'Goods Received (GRN)' },
      ],
    },
    {
      key: 'assets-group',
      icon: <ToolOutlined />,
      label: 'Machinery & Assets',
      children: [
        { key: '/assets', icon: <ToolOutlined />, label: 'Fleet & Equipment' },
      ],
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Finance & Reports',
    },
    ...(user?.role === 'admin' ? [{
      key: '/users',
      icon: <TeamOutlined />,
      label: 'User Management',
    }] : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f6f5ed' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={245}
        style={{
          background: '#153d2d',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
          boxShadow: '2px 0 10px rgba(0,0,0,0.05)',
        }}
      >
        {/* Brand header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '18px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{
            background: '#c8ef76',
            color: '#153d2d',
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            fontWeight: 900,
            flexShrink: 0,
          }}>
            G
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: '#fff', lineHeight: 1.1 }}>
                G-PLEX SEEDS
              </div>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a9c3a9', marginTop: 2 }}>
                FIELDWORK, CONNECTED
              </div>
            </div>
          )}
        </div>

        {/* Workspace Indicator */}
        {!collapsed && (
          <div style={{
            margin: '14px 14px 8px',
            padding: '10px 12px',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#c6d6bf',
            fontSize: 11,
          }}>
            <strong style={{ display: 'block', color: '#fff', fontSize: 11, marginBottom: 2 }}>
              Operations workspace
            </strong>
            Kenya · 4 farms · 2 stores
          </div>
        )}

        {/* Menu Navigation */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['inventory-group', 'sales-group']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          theme="dark"
          style={{
            background: 'transparent',
            marginTop: 6,
            borderRight: 0,
            fontSize: 12,
          }}
        />

        {/* Sync Status Badge in Sidebar */}
        {!collapsed && (
          <div style={{
            margin: '20px 14px 10px',
            padding: '10px 12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 8,
            color: '#c5d4c3',
            fontSize: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#fff' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c8ef76', display: 'inline-block' }} />
              All changes synced
            </div>
            <div style={{ paddingLeft: 13, color: '#a8bca5', marginTop: 2 }}>
              Offline forms ready
            </div>
          </div>
        )}

        {/* User Profile Footer */}
        {!collapsed && (
          <div style={{
            margin: '10px 14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 8px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: '#e3a66d',
              color: '#462b19',
              fontWeight: 800,
              fontSize: 11,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              {getInitials(user?.name)}
            </div>
            <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'Jane Mwangi'}
              </div>
              <div style={{ fontSize: 10, color: '#9cb39c' }}>
                {formatRole(user?.role) || 'Operations Manager'}
              </div>
            </div>
          </div>
        )}
      </Sider>

      <Layout style={{ background: '#f6f5ed' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fffefae0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e6dc',
          height: 60,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(10px)',
        }}>
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <div style={{ fontSize: 12, color: '#738075' }}>
              G-Plex / <strong style={{ color: '#17372b' }}>{location.pathname.replace('/', '').toUpperCase() || 'OVERVIEW'}</strong>
            </div>
          </Space>

          <Space size="middle">
            <Tag color="green" style={{ background: '#eaf2dc', borderColor: '#c8ef76', color: '#153d2d', fontWeight: 600 }}>
              {formatRole(user?.role)}
            </Tag>
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ fontSize: 12 }}
            >
              Sign out
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: '20px 24px', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
