import React, { useMemo, useState } from 'react';
import { Table, Input, Select, Space, Tag, Typography, Card, DatePicker } from 'antd';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';
import { parseDbDate } from '../utils/feedbackPdf.js';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AuditLog() {
  const [filters, setFilters] = useState({});
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), [filters]);
  const { data: users } = useQuery({ queryKey: ['auditUsers'], queryFn: () => api.get('/users').catch(() => ({ data: [] })) });
  const { data: matrix } = useQuery({ queryKey: ['accessMatrix'], queryFn: () => api.get('/access/matrix') });
  const { data, isLoading } = useQuery({ queryKey: ['auditLog', params], queryFn: () => api.get('/audit', { params }) });

  const moduleOptions = (matrix?.data?.modules || []).map((m) => ({ value: m.key, label: m.label }));
  const userOptions = (users?.data || []).map((u) => ({ value: u.id, label: u.name }));

  const columns = [
    { title: 'When', dataIndex: 'created_at', width: 170, render: (v) => parseDbDate(v)?.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) || '-' },
    { title: 'Who', dataIndex: 'user_name', width: 180, render: (v, r) => <div><Text strong>{v || 'Unknown'}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.user_email}</Text></div> },
    { title: 'Action', dataIndex: 'action', render: (v) => <Tag color={v === 'LOGIN' ? 'blue' : v.startsWith('POST') ? 'green' : v.startsWith('DELETE') ? 'red' : 'orange'}>{v}</Tag> },
    { title: 'Area', dataIndex: 'module', width: 120, render: (v) => v },
    { title: 'Record', dataIndex: 'record_id', width: 80, render: (v) => v ?? '-' },
    {
      title: 'Details sent', dataIndex: 'new_values', ellipsis: true,
      render: (v) => (v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">-</Text>),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ margin: 0 }}>Audit Log</Title>
      <Text type="secondary">Who signed in and who changed what, with the time. Passwords are never stored here. Read-only.</Text>
      <Card size="small" style={{ margin: '16px 0' }}>
        <Space wrap>
          <Select allowClear showSearch optionFilterProp="label" placeholder="Person" style={{ width: 200 }} options={userOptions} onChange={(v) => setFilters((f) => ({ ...f, user_id: v }))} />
          <Select allowClear placeholder="Area" style={{ width: 220 }} options={moduleOptions} onChange={(v) => setFilters((f) => ({ ...f, module: v }))} />
          <Input allowClear placeholder="Action contains (e.g. users, PATCH)" style={{ width: 240 }} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} />
          <RangePicker onChange={(d) => setFilters((f) => ({ ...f, from: d?.[0]?.format('YYYY-MM-DD'), to: d?.[1]?.format('YYYY-MM-DD') }))} />
        </Space>
      </Card>
      <Table rowKey="id" size="small" loading={isLoading} columns={columns} dataSource={data?.data || []} pagination={{ pageSize: 20, showSizeChanger: false }} scroll={{ x: 900 }} />
    </div>
  );
}
