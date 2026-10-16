import React, { useState } from 'react';
import { Table, Tag, Typography, Card, Input, Space, Select } from 'antd';
import { SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Receipts() {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => api.get('/receipts'),
  });

  const getModeTag = (mode) => {
    switch (mode) {
      case 'mpesa': return <Tag color="green">M-PESA</Tag>;
      case 'bank': return <Tag color="blue">BANK TRANSFER</Tag>;
      case 'cash': return <Tag color="gold">CASH</Tag>;
      case 'cheque': return <Tag color="purple">CHEQUE</Tag>;
      default: return <Tag>{mode?.toUpperCase()}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Receipt No',
      dataIndex: 'ref_no',
      key: 'ref_no',
      render: (r) => <Text strong>{r}</Text>,
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Invoice Ref',
      dataIndex: 'invoice_ref',
      key: 'invoice_ref',
      render: (ir) => <Tag color="cyan">{ir}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Payment Mode',
      dataIndex: 'mode',
      key: 'mode',
      render: (m) => getModeTag(m),
    },
    {
      title: 'Ref / Cheque No',
      dataIndex: 'reference',
      key: 'reference',
      render: (r) => r || '—',
    },
    {
      title: 'Amount Received',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (a) => (
        <Text strong style={{ color: '#2e7d32' }}>
          KES {Number(a || 0).toLocaleString()}
        </Text>
      ),
    },
  ];

  let list = receipts?.data || [];
  if (search) {
    list = list.filter(r =>
      r.ref_no?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reference?.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (modeFilter) {
    list = list.filter(r => r.mode === modeFilter);
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Receipts & Payment History</Title>
        <Text type="secondary">Audit trail of all incoming payments from customers and sales channels</Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search receipt, customer, ref..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filter by Mode"
            value={modeFilter || undefined}
            onChange={setModeFilter}
            style={{ width: 180 }}
            allowClear
          >
            <Select.Option value="mpesa">M-Pesa</Select.Option>
            <Select.Option value="bank">Bank Transfer</Select.Option>
            <Select.Option value="cash">Cash</Select.Option>
            <Select.Option value="cheque">Cheque</Select.Option>
          </Select>
        </Space>

        <Table
          dataSource={list}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
