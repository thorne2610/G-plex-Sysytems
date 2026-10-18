import React from 'react';
import { Card, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const { Title, Text } = Typography;
const LEVEL = {
  edit: { color: 'green', text: 'Can change' },
  view: { color: 'blue', text: 'View only' },
  none: { color: 'default', text: '—' },
};

export default function RolesAccess() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({ queryKey: ['accessMatrix'], queryFn: () => api.get('/access/matrix') });
  const roles = data?.data?.roles || [];
  const modules = data?.data?.modules || [];
  const matrix = data?.data?.matrix || {};

  const columns = [
    { title: 'Area of the system', dataIndex: 'label', fixed: 'left', width: 220, render: (v) => <Text strong>{v}</Text> },
    ...roles.map((r) => ({
      title: <span style={{ color: r.key === user?.role ? '#2e7d32' : undefined }}>{r.label}{r.key === user?.role ? ' (you)' : ''}</span>,
      key: r.key,
      width: 130,
      align: 'center',
      render: (_, m) => {
        const level = LEVEL[matrix[r.key]?.[m.key] || 'none'];
        return <Tag color={level.color}>{level.text}</Tag>;
      },
    })),
  ];

  return (
    <div>
      <Title level={3} style={{ margin: 0 }}>Roles &amp; Access</Title>
      <Text type="secondary">
        What each job role can see and change. An administrator assigns a role to each person under User Management.
      </Text>
      <Card style={{ marginTop: 16 }} bodyStyle={{ padding: 0 }}>
        <Table rowKey="key" loading={isLoading} columns={columns} dataSource={modules} pagination={false} scroll={{ x: 220 + roles.length * 130 }} size="small" />
      </Card>
      <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
        Payroll is prepared by HR and approved by the Accountant, Managing Director or Administrator. Every change is recorded in the Audit Log.
      </Text>
    </div>
  );
}
