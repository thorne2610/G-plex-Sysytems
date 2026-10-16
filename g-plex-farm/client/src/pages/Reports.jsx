import React, { useState } from 'react';
import { Tabs, Card, Table, Statistic, Row, Col, Typography, Tag, Space, DatePicker, Button, Spin } from 'antd';
import { BarChartOutlined, DollarOutlined, InboxOutlined, UserOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily');

  const { data: dailyOps, isLoading: loadingDaily } = useQuery({
    queryKey: ['reportDailyOps'],
    queryFn: () => api.get('/reports/daily-operations'),
  });

  const { data: inventoryVal, isLoading: loadingInv } = useQuery({
    queryKey: ['reportInventoryVal'],
    queryFn: () => api.get('/reports/inventory-valuation'),
  });

  const { data: agedDebtors, isLoading: loadingDebtors } = useQuery({
    queryKey: ['reportAgedDebtors'],
    queryFn: () => api.get('/reports/aged-debtors'),
  });

  const { data: pnl, isLoading: loadingPnl } = useQuery({
    queryKey: ['reportPnl'],
    queryFn: () => api.get('/reports/profit-loss'),
  });

  const daily = dailyOps?.data || {};
  const inv = inventoryVal?.data || [];
  const invSummary = inventoryVal?.summary || {};
  const debtors = agedDebtors?.data || [];
  const pnlData = pnl?.data || {};

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Management Reports & Analytics</Title>
        <Text type="secondary">Financial summaries, inventory valuation, operational audits, and debtors</Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'daily',
              label: 'Daily Operations',
              children: (
                <div>
                  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={24} sm={12} md={6}>
                      <Card style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <Statistic
                          title="Today's Invoiced Sales"
                          value={daily.sales?.total || 0}
                          prefix="KES "
                          valueStyle={{ color: '#389e0d', fontWeight: 700 }}
                        />
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          {daily.sales?.count || 0} invoices issued
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card style={{ backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}>
                        <Statistic
                          title="Payments Collected Today"
                          value={daily.receipts?.total || 0}
                          prefix="KES "
                          valueStyle={{ color: '#096dd9', fontWeight: 700 }}
                        />
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          {daily.receipts?.count || 0} payments received
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  <Title level={5}>Stock Movement Breakdown Today</Title>
                  <Table
                    dataSource={daily.stock_movements || []}
                    rowKey="type"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Movement Type', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t?.toUpperCase()}</Tag> },
                      { title: 'Count', dataIndex: 'count', key: 'count' },
                      { title: 'Total Quantity Moved', dataIndex: 'total_qty', key: 'total_qty', render: (q) => <Text strong>{q}</Text> },
                    ]}
                    locale={{ emptyText: 'No stock movements recorded today' }}
                    style={{ marginBottom: 20 }}
                  />

                  <Title level={5}>Recent Invoices</Title>
                  <Table
                    dataSource={daily.recent_invoices || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Invoice', dataIndex: 'ref_no', key: 'ref_no' },
                      { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
                      { title: 'Date', dataIndex: 'date', key: 'date' },
                      { title: 'Total', dataIndex: 'total', key: 'total', render: (t) => `KES ${Number(t).toLocaleString()}` },
                      { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag>{s?.toUpperCase()}</Tag> },
                    ]}
                    locale={{ emptyText: 'No recent invoices' }}
                  />
                </div>
              ),
            },
            {
              key: 'inventory',
              label: 'Inventory Valuation',
              children: (
                <div>
                  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={24} sm={12} md={6}>
                      <Card style={{ backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}>
                        <Statistic
                          title="Total Items in Stock"
                          value={invSummary.total_items || 0}
                          valueStyle={{ color: '#1d39c4', fontWeight: 700 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <Statistic
                          title="Total Stock Cost Valuation"
                          value={invSummary.total_cost_valuation || 0}
                          prefix="KES "
                          valueStyle={{ color: '#389e0d', fontWeight: 700 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card style={{ backgroundColor: '#fcffe6', borderColor: '#eaff8f' }}>
                        <Statistic
                          title="Estimated Retail Value"
                          value={invSummary.total_retail_valuation || 0}
                          prefix="KES "
                          valueStyle={{ color: '#7cb305', fontWeight: 700 }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Table
                    dataSource={inv}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    size="small"
                    columns={[
                      { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (s) => <Tag>{s}</Tag> },
                      { title: 'Name', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
                      { title: 'Category', dataIndex: 'category_name', key: 'category_name' },
                      { title: 'Store', dataIndex: 'warehouse_name', key: 'warehouse_name' },
                      { title: 'Qty on Hand', dataIndex: 'qty_on_hand', key: 'qty_on_hand', render: (q, r) => `${q} ${r.unit}` },
                      { title: 'Unit Cost', dataIndex: 'cost_price', key: 'cost_price', render: (c) => `KES ${Number(c).toLocaleString()}` },
                      { title: 'Cost Valuation', dataIndex: 'valuation_cost', key: 'valuation_cost', render: (v) => <Text strong>KES ${Number(v || 0).toLocaleString()}</Text> },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'debtors',
              label: 'Aged Debtors & Receivables',
              children: (
                <div>
                  <Card style={{ marginBottom: 20, backgroundColor: '#fff1f0', borderColor: '#ffa39e' }}>
                    <Statistic
                      title="Total Outstanding Receivables (Debtors)"
                      value={agedDebtors?.total_receivable || 0}
                      prefix="KES "
                      valueStyle={{ color: '#cf1322', fontWeight: 700 }}
                    />
                  </Card>

                  <Table
                    dataSource={debtors}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    size="middle"
                    columns={[
                      { title: 'Code', dataIndex: 'code', key: 'code', render: (c) => <Tag color="blue">{c}</Tag> },
                      { title: 'Customer Name', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
                      { title: 'Phone', dataIndex: 'phone', key: 'phone' },
                      { title: 'Credit Limit', dataIndex: 'credit_limit', key: 'credit_limit', render: (cl) => `KES ${Number(cl || 0).toLocaleString()}` },
                      { title: 'Unpaid Invoices', dataIndex: 'unpaid_invoices', key: 'unpaid_invoices' },
                      { title: 'Oldest Unpaid Invoice', dataIndex: 'oldest_unpaid_date', key: 'oldest_unpaid_date', render: (d) => d || '—' },
                      { title: 'Outstanding Balance', dataIndex: 'balance', key: 'balance', align: 'right', render: (b) => <Text strong style={{ color: '#cf1322' }}>KES {Number(b).toLocaleString()}</Text> },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'pnl',
              label: 'Profit & Loss Statement (Operating Summary)',
              children: (
                <div style={{ maxWidth: 700 }}>
                  <Card title="Operating Income & Expense Summary" bordered={false} style={{ background: '#fafafa' }}>
                    <div style={{ marginBottom: 16 }}>
                      <Title level={5} style={{ color: '#389e0d' }}>Revenue</Title>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>Gross Invoiced Sales:</span>
                        <Text strong>KES {Number(pnlData.revenue?.gross_sales || 0).toLocaleString()}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>Net Sales (Excl. VAT):</span>
                        <Text strong>KES {Number(pnlData.revenue?.net_sales || 0).toLocaleString()}</Text>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <Title level={5} style={{ color: '#cf1322' }}>Operating Costs & Expenses</Title>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>Procurement & Supplier Invoices:</span>
                        <span>KES {Number(pnlData.expenses?.procurement || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>Machinery Fuel Expenses:</span>
                        <span>KES {Number(pnlData.expenses?.fuel || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>Repairs & Maintenance Costs:</span>
                        <span>KES {Number(pnlData.expenses?.maintenance || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #ccc', fontWeight: 600 }}>
                        <span>Total Operational Expenses:</span>
                        <span>KES {Number(pnlData.expenses?.total || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      background: (pnlData.net_profit || 0) >= 0 ? '#f6ffed' : '#fff1f0',
                      borderRadius: 8,
                      border: `1px solid ${(pnlData.net_profit || 0) >= 0 ? '#b7eb8f' : '#ffa39e'}`,
                    }}>
                      <Title level={4} style={{ margin: 0 }}>Estimated Operating Profit / (Loss)</Title>
                      <Title level={3} style={{ margin: 0, color: (pnlData.net_profit || 0) >= 0 ? '#389e0d' : '#cf1322' }}>
                        KES {Number(pnlData.net_profit || 0).toLocaleString()}
                      </Title>
                    </div>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
