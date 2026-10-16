import React, { useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, InputNumber, Drawer, Typography, message, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, ShopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => api.get(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  const { data: supplierDetail } = useQuery({
    queryKey: ['supplierDetail', viewingSupplier?.id],
    queryFn: () => api.get(`/suppliers/${viewingSupplier.id}`),
    enabled: !!viewingSupplier,
  });

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (editingSupplier) {
        return api.put(`/suppliers/${editingSupplier.id}`, values);
      }
      return api.post('/suppliers', values);
    },
    onSuccess: () => {
      message.success(`Supplier ${editingSupplier ? 'updated' : 'registered'} successfully`);
      setModalOpen(false);
      form.resetFields();
      setEditingSupplier(null);
      queryClient.invalidateQueries(['suppliers']);
    },
    onError: (err) => message.error(err.message || 'Failed to save supplier'),
  });

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    form.resetFields();
    form.setFieldsValue({ payment_terms: 30 });
    setModalOpen(true);
  };

  const handleOpenEdit = (sup) => {
    setEditingSupplier(sup);
    form.setFieldsValue(sup);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code) => <Tag color="cyan">{code}</Tag>,
    },
    {
      title: 'Supplier Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.contact_person && (
            <div style={{ fontSize: 12, color: '#666' }}>Attn: {record.contact_person}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (p) => p || '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (e) => e || '—',
    },
    {
      title: 'Payment Terms',
      dataIndex: 'payment_terms',
      key: 'payment_terms',
      render: (pt) => `${pt || 30} Days`,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewingSupplier(record)}
            title="View Details"
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
            title="Edit"
          />
        </Space>
      ),
    },
  ];

  const detail = supplierDetail?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Suppliers Directory</Title>
          <Text type="secondary">Manage vendors for seeds, fertilisers, chemicals, machinery, and equipment</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          New Supplier
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <div style={{ marginBottom: 16, maxWidth: 320 }}>
          <Input
            placeholder="Search supplier name or code..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </div>

        <Table
          dataSource={suppliers?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Supplier Modal */}
      <Modal
        title={editingSupplier ? `Edit Supplier (${editingSupplier.code})` : 'Register New Supplier'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="Save Supplier"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Form.Item name="name" label="Supplier / Company Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Kenya Seed Company Ltd / Yara East Africa" />
          </Form.Item>
          <Form.Item name="contact_person" label="Contact Person / Sales Agent">
            <Input placeholder="e.g. Grace Wambui" />
          </Form.Item>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="phone" label="Phone">
              <Input placeholder="+254 700 000 000" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="email" label="Email">
              <Input placeholder="orders@vendor.co.ke" />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="Physical / Warehouse Location">
            <Input.TextArea rows={2} placeholder="e.g. Industrial Area, Enterprise Road" />
          </Form.Item>
          <Form.Item name="payment_terms" label="Credit Payment Terms (Days)">
            <InputNumber style={{ width: '100%' }} min={0} max={180} />
          </Form.Item>
          <Form.Item name="notes" label="Notes / Bank Account Details">
            <Input.TextArea rows={2} placeholder="Account details, contact notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Supplier Invoices Drawer */}
      <Drawer
        title={`Supplier History: ${detail?.name || ''}`}
        placement="right"
        width={650}
        onClose={() => setViewingSupplier(null)}
        open={!!viewingSupplier}
      >
        {detail && (
          <div>
            <Card style={{ marginBottom: 20, backgroundColor: '#f9fafb' }}>
              <div><strong>Code:</strong> {detail.code}</div>
              <div><strong>Phone:</strong> {detail.phone || 'N/A'}</div>
              <div><strong>Email:</strong> {detail.email || 'N/A'}</div>
              <div><strong>Address:</strong> {detail.address || 'N/A'}</div>
            </Card>

            <Title level={5}>Supplier Invoices & Bills</Title>
            <Table
              dataSource={detail.invoices || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Bill Ref', dataIndex: 'ref_no', key: 'ref_no' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Total', dataIndex: 'total', key: 'total', render: (t) => `KES ${Number(t).toLocaleString()}` },
                { title: 'Paid', dataIndex: 'amount_paid', key: 'amount_paid', render: (p) => `KES ${Number(p).toLocaleString()}` },
                { title: 'Balance', dataIndex: 'balance_due', key: 'balance_due', render: (b) => <Text strong style={{ color: b > 0 ? '#d32f2f' : '#2e7d32' }}>KES ${Number(b).toLocaleString()}</Text> },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag>{s?.toUpperCase()}</Tag> },
              ]}
              locale={{ emptyText: 'No supplier invoices recorded' }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
