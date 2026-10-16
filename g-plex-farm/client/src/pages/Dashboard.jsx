import React, { useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Alert, Space, Button, Spin, Checkbox } from 'antd';
import {
  DollarOutlined,
  WarningOutlined,
  EnvironmentOutlined,
  ShoppingOutlined,
  InboxOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Approve seed inspection (Lot GP-26-041)', time: '09:30', done: false, dept: 'Quality' },
    { id: 2, text: 'Review grower delivery (Mercy N. · 1,250 kg)', time: '11:00', done: false, dept: 'Operations' },
    { id: 3, text: 'Authorize weekly fertilizer dispatch to Kilimo block', time: '14:15', done: true, dept: 'Stores' },
  ]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => api.get('/dashboard/summary'),
  });

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Loading G-Plex Operations Dashboard..." />
      </div>
    );
  }

  const kpis = data?.data?.kpis || {};
  const todaySales = kpis.todaySales ?? kpis.revenue_today ?? 0;
  const outstandingInvoices = kpis.outstandingInvoices ?? kpis.unpaid_invoices_amount ?? 0;
  const stockValuation = kpis.stockValue ?? kpis.inventory_valuation ?? 0;
  const activeFields = kpis.activeFields ?? kpis.active_fields ?? 0;
  const activeCustomers = kpis.activeCustomers ?? 0;

  const trend = (data?.data?.salesChart || data?.data?.sales_trend || []).map(item => ({
    date: item.month || item.date,
    total: Number(item.total) || 0,
  }));

  const lowStock = data?.data?.lowStockItems || data?.data?.low_stock_items || [];
  const recentActivity = data?.data?.recentActivity || data?.data?.recent_activity || [];

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#628059', fontWeight: 700, textTransform: 'uppercase' }}>
            KENYA CULTIVATION · LONG RAINS 2026
          </div>
          <Title level={3} style={{ margin: '4px 0 2px', color: '#153d2d' }}>
            Farm Operations Overview
          </Title>
          <Text type="secondary">
            Live overview across 4 regional farms, 2 stores, and 286 contract growers.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Sync Updates
          </Button>
          <Button
            type="primary"
            icon={<ShoppingOutlined />}
            onClick={() => navigate('/pos')}
            style={{ backgroundColor: '#153d2d', borderColor: '#153d2d', fontWeight: 600 }}
          >
            Open Point of Sale
          </Button>
        </Space>
      </div>

      {lowStock.length > 0 && (
        <Alert
          message={`${lowStock.length} items have reached or fallen below reorder level`}
          description={
            <Space wrap orientation="horizontal">
              {lowStock.map((it, idx) => (
                <Tag color="error" key={idx}>
                  {it.name}: <strong>{it.qty_on_hand}</strong> {it.unit} (Min: {it.reorder_level})
                </Tag>
              ))}
            </Space>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Top 4 Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 15px rgba(23, 55, 43, 0.05)' }}>
            <div style={{ fontSize: 11, color: '#738075', letterSpacing: '0.08em', fontWeight: 600 }}>ACTIVE REGIONAL FARMS</div>
            <div style={{ fontSize: 26, fontWeight: 750, color: '#153d2d', margin: '6px 0 2px' }}>04 / 04</div>
            <div style={{ fontSize: 11, color: '#628059' }}>All reporting active this season</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 15px rgba(23, 55, 43, 0.05)' }}>
            <div style={{ fontSize: 11, color: '#738075', letterSpacing: '0.08em', fontWeight: 600 }}>CONTRACT GROWERS</div>
            <div style={{ fontSize: 26, fontWeight: 750, color: '#153d2d', margin: '6px 0 2px' }}>286</div>
            <div style={{ fontSize: 11, color: '#628059' }}>12 new contracted this season</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 15px rgba(23, 55, 43, 0.05)' }}>
            <div style={{ fontSize: 11, color: '#738075', letterSpacing: '0.08em', fontWeight: 600 }}>CERTIFIED SEED IN STORE</div>
            <div style={{ fontSize: 26, fontWeight: 750, color: '#153d2d', margin: '6px 0 2px' }}>18.4 t</div>
            <div style={{ fontSize: 11, color: '#628059' }}>92% lot traceability confirmed</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 15px rgba(23, 55, 43, 0.05)' }}>
            <div style={{ fontSize: 11, color: '#738075', letterSpacing: '0.08em', fontWeight: 600 }}>INVENTORY VALUATION</div>
            <div style={{ fontSize: 24, fontWeight: 750, color: '#153d2d', margin: '6px 0 2px' }}>
              KSh {Number(stockValuation || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#628059' }}>Total input & harvest stock</div>
          </Card>
        </Col>
      </Row>

      {/* Visual Landscape & Field Conditions Weather Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Landscape Map Card */}
        <Col xs={24} lg={15}>
          <Card
            bordered={false}
            title={
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#17372b' }}>Growing landscape</div>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 400 }}>Live field overview · 4 farms · 99 acres under seed</div>
              </div>
            }
            extra={<Button size="small" onClick={() => navigate('/fields')}>Open Map</Button>}
            style={{ borderRadius: 12 }}
          >
            {/* Visual plot representation from index(2).html */}
            <div style={{
              height: 200,
              borderRadius: 12,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(155deg, #e6ead2, #d6e3bd 52%, #b7d3a4)',
              border: '1px solid #dae2c8',
              padding: 16,
            }}>
              <div style={{
                position: 'absolute',
                left: '12%',
                top: '25%',
                transform: 'rotate(-5deg)',
                background: '#315e3d',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                boxShadow: '0 4px 10px rgba(23, 55, 43, 0.2)',
                border: '2px solid #fff',
              }}>
                MUTHAIGA · 42 ac (Maize H614)
              </div>

              <div style={{
                position: 'absolute',
                left: '42%',
                top: '48%',
                transform: 'rotate(2deg)',
                background: '#7f9c47',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                boxShadow: '0 4px 10px rgba(23, 55, 43, 0.2)',
                border: '2px solid #fff',
              }}>
                KILIMO · 31 ac (Bean Rosecoco)
              </div>

              <div style={{
                position: 'absolute',
                right: '10%',
                top: '22%',
                transform: 'rotate(-3deg)',
                background: '#bc8251',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                boxShadow: '0 4px 10px rgba(23, 55, 43, 0.2)',
                border: '2px solid #fff',
              }}>
                KIRINYAGA · 26 ac (Maize H614)
              </div>

              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                background: 'rgba(255, 253, 240, 0.92)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                color: '#344b36',
                fontWeight: 600,
              }}>
                🌾 99 acres under seed production · Continuous monitoring
              </div>
            </div>
          </Card>
        </Col>

        {/* Field Weather Conditions Card */}
        <Col xs={24} lg={9}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              background: '#eaf2dc',
              minHeight: 275,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#5b7156', fontWeight: 700, textTransform: 'uppercase' }}>
              FIELD CONDITIONS
            </div>
            <Title level={4} style={{ margin: '4px 0 0', color: '#17372b' }}>
              Kirinyaga County
            </Title>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#153d2d', letterSpacing: '-0.04em', margin: '10px 0 2px' }}>
              23°C
            </div>
            <p style={{ fontSize: 12, color: '#5c6e57', margin: '0 0 20px' }}>
              Partly cloudy · light afternoon showers expected after 3:00 PM
            </p>

            <div style={{ display: 'flex', gap: 24, fontSize: 11, color: '#687860' }}>
              <div>
                RAINFALL
                <b style={{ display: 'block', fontSize: 13, color: '#344b36', marginTop: 2 }}>8 mm</b>
              </div>
              <div>
                SOIL MOISTURE
                <b style={{ display: 'block', fontSize: 13, color: '#344b36', marginTop: 2 }}>Optimal</b>
              </div>
              <div>
                WIND
                <b style={{ display: 'block', fontSize: 13, color: '#344b36', marginTop: 2 }}>12 km/h</b>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Field Activity & Daily Focus Checklist */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            bordered={false}
            title={
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#17372b' }}>Recent field activity</div>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 400 }}>Agronomy and crop health team reports</div>
              </div>
            }
            extra={<Button size="small" onClick={() => navigate('/fields')}>View all</Button>}
            style={{ borderRadius: 12 }}
          >
            <Table
              dataSource={[
                { key: '1', plot: 'Muthaiga · Plot A3', activity: 'Roguing inspection', owner: 'Peter K.', status: 'Complete' },
                { key: '2', plot: 'Kilimo · Plot B1', activity: 'Germination count', owner: 'Lucy W.', status: 'Due today' },
                { key: '3', plot: 'Kirinyaga · Plot C2', activity: 'Top-dressing application', owner: 'Mercy N.', status: 'In progress' },
              ]}
              pagination={false}
              size="small"
              columns={[
                { title: 'FARM / FIELD', dataIndex: 'plot', key: 'plot', render: (p) => <Text strong>{p}</Text> },
                { title: 'ACTIVITY', dataIndex: 'activity', key: 'activity' },
                { title: 'AGRONOMIST', dataIndex: 'owner', key: 'owner' },
                {
                  title: 'STATUS',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s) => (
                    <Tag color={s === 'Complete' ? 'green' : s === 'Due today' ? 'orange' : 'blue'}>
                      {s}
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Daily Focus Checklist */}
        <Col xs={24} lg={10}>
          <Card
            bordered={false}
            title={
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#17372b' }}>Today's focus</div>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 400 }}>Assigned operational priorities</div>
              </div>
            }
            style={{ borderRadius: 12 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tasks.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: t.done ? 'line-through' : 'none',
                      color: t.done ? '#999' : '#17372b',
                    }}>
                      {t.text}
                    </div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                      <Tag color="default" style={{ fontSize: 9 }}>{t.dept}</Tag> {t.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Sales Trend Chart */}
      <Card
        title="Monthly Collections & Revenue Trend (KES)"
        bordered={false}
        style={{ borderRadius: 12, marginTop: 16 }}
      >
        {trend.length > 0 ? (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip formatter={(value) => [`KSh ${Number(value).toLocaleString()}`, 'Collections']} />
                <Area type="monotone" dataKey="total" stroke="#2e7d32" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            No recent sales transactions recorded yet.
          </div>
        )}
      </Card>
    </div>
  );
}
