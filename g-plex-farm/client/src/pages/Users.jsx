import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, Typography, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, KeyOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Users() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const [form] = Form.useForm();
  const [pwForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (editingUser) {
        return api.put(`/users/${editingUser.id}`, values);
      }
      return api.post('/users', values);
    },
    onSuccess: () => {
      message.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
      setModalOpen(false);
      form.resetFields();
      setEditingUser(null);
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => message.error(err.message || 'Operation failed'),
  });

  const pwMutation = useMutation({
    mutationFn: ({ userId, values }) => api.put(`/users/${userId}/password`, values),
    onSuccess: () => {
      message.success('Password updated successfully');
      setPwModalOpen(false);
      pwForm.resetFields();
      setPwUser(null);
    },
    onError: (err) => message.error(err.message || 'Failed to update password'),
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'store_keeper' });
    setModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setModalOpen(true);
  };

  const handleOpenPassword = (user) => {
    setPwUser(user);
    pwForm.resetFields();
    setPwModalOpen(true);
  };

  const getRoleTag = (role) => {
    const map = {
      admin: { color: 'red', label: 'Admin' },
      farm_manager: { color: 'green', label: 'Farm Manager' },
      accountant: { color: 'blue', label: 'Accountant' },
      store_keeper: { color: 'orange', label: 'Store Keeper' },
      sales_officer: { color: 'purple', label: 'Sales Officer' },
      procurement_officer: { color: 'cyan', label: 'Procurement Officer' },
    };
    const c = map[role] || { color: 'default', label: role };
    return <Tag color={c.color}>{c.label}</Tag>;
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (n) => <Text strong>{n}</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (r) => getRoleTag(r),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (d) => d || '—',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (p) => p || '—',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (a) => (
        <Tag color={a ? 'green' : 'default'}>{a ? 'ACTIVE' : 'INACTIVE'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
            title="Edit Details"
          />
          <Button
            size="small"
            icon={<KeyOutlined />}
            onClick={() => handleOpenPassword(record)}
            title="Reset Password"
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>User Management & Role Permissions</Title>
          <Text type="secondary">Control department access for Admin, Farm Managers, Accountants, and Staff</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          Add System User
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={users?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* User Modal */}
      <Modal
        title={editingUser ? `Edit User: ${editingUser.name}` : 'Create New System User'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={560}
        okText="Save User"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Samuel Kimani" />
          </Form.Item>

          {!editingUser && (
            <>
              <Form.Item name="email" label="Email Address" rules={[{ required: true }, { type: 'email' }]}>
                <Input placeholder="user@gplex.farm" />
              </Form.Item>
              <Form.Item name="password" label="Temporary Password" rules={[{ required: true, min: 6 }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
            </>
          )}

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 240 }} name="role" label="Role Assignment" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="admin">System Administrator</Select.Option>
                <Select.Option value="farm_manager">Farm Manager</Select.Option>
                <Select.Option value="accountant">Accountant / Finance</Select.Option>
                <Select.Option value="store_keeper">Store Keeper / Stores</Select.Option>
                <Select.Option value="sales_officer">Sales Officer</Select.Option>
                <Select.Option value="procurement_officer">Procurement Officer</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 240 }} name="department" label="Department">
              <Input placeholder="e.g. Sales / Operations / Finance" />
            </Form.Item>
          </Space>

          <Form.Item name="phone" label="Phone Number">
            <Input placeholder="+254 700 000 000" />
          </Form.Item>

          {editingUser && (
            <Form.Item name="is_active" label="Status">
              <Select>
                <Select.Option value={1}>Active</Select.Option>
                <Select.Option value={0}>Inactive / Suspended</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        title={`Reset Password for ${pwUser?.name || ''}`}
        open={pwModalOpen}
        onCancel={() => setPwModalOpen(false)}
        onOk={() => pwForm.submit()}
        confirmLoading={pwMutation.isPending}
        okText="Update Password"
        destroyOnClose
      >
        <Form form={pwForm} layout="vertical" onFinish={(vals) => pwMutation.mutate({ userId: pwUser?.id, values: vals })}>
          <Form.Item name="new_password" label="New Password" rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}>
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
