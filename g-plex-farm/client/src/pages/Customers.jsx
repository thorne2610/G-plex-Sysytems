import React, { useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, InputNumber, Drawer, Typography, message, Card } from 'antd';
import { PlusOutlined, SearchOutlined, UserOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Customers() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch customers
  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  // Fetch customer detail for ledger
  const { data: customerDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['customerDetail', ledgerCustomer?.id],
    queryFn: () => api.get(`/customers/${ledgerCustomer.id}`),
    enabled: !!ledgerCustomer,
  });

  // Create or Update mutation
  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (editingCustomer) {
        return api.put(`/customers/${editingCustomer.id}`, values);
      }
      return api.post('/customers', values);
    },
    onSuccess: () => {
      message.success(`Customer ${editingCustomer ? 'updated' : 'created'} successfully`);
      setModalOpen(false);
      form.resetFields();
      setEditingCustomer(null);
      queryClient.invalidateQueries(['customers']);
    },
    onError: (err) => {
      message.error(err.message || 'Failed to save customer');
    },
  });

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    form.resetFields();
    form.setFieldsValue({ credit_limit: 0, payment_terms: 30 });
    setModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue(customer);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Customer Name',
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
      title: 'Credit Limit',
      dataIndex: 'credit_limit',
      key: 'credit_limit',
      align: 'right',
      render: (val) => `KES ${Number(val || 0).toLocaleString()}`,
    },
    {
      title: 'Outstanding Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (val) => {
        const num = Number(val || 0);
        return (
          <Text strong style={{ color: num > 0 ? '#d32f2f' : '#2e7d32' }}>
            KES {num.toLocaleString()}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setLedgerCustomer(record)}
            title="View Ledger"
          >
            Ledger
          </Button>
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

  const ledgerInvoices = customerDetail?.data?.invoices || [];
  const ledgerReceipts = customerDetail?.data?.receipts || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Customer Directory & Accounts</Title>
          <Text type="secondary">Manage customer accounts, credit limits, and balances</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          New Customer
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <div style={{ marginBottom: 16, maxWidth: 320 }}>
          <Input
            placeholder="Search customer name or code..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </div>

        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingCustomer ? `Edit Customer (${editingCustomer.code})` : 'Register New Customer'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="Save Customer"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Form.Item name="name" label="Customer / Business Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Fresh Produce Distributors Ltd" />
          </Form.Item>
          <Form.Item name="contact_person" label="Contact Person">
            <Input placeholder="e.g. John Kamau" />
          </Form.Item>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="phone" label="Phone Number">
              <Input placeholder="+254 700 000 000" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="email" label="Email Address">
              <Input placeholder="buyer@example.com" />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="Physical / Delivery Address">
            <Input.TextArea rows={2} placeholder="e.g. Nairobi Wholesale Market, Stall 42" />
          </Form.Item>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="credit_limit" label="Credit Limit (KES)">
              <InputNumber style={{ width: '100%' }} min={0} step={1000} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="payment_terms" label="Payment Terms (Days)">
              <InputNumber style={{ width: '100%' }} min={0} max={180} />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional notes or preferences..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Customer Ledger Drawer */}
      <Drawer
        title={`Customer Statement & Ledger: ${ledgerCustomer?.name || ''}`}
        placement="right"
        width={680}
        onClose={() => setLedgerCustomer(null)}
        open={!!ledgerCustomer}
      >
        {ledgerCustomer && (
          <div>
            <Card style={{ marginBottom: 20, backgroundColor: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>{ledgerCustomer.name}</Title>
                  <Text type="secondary">Code: {ledgerCustomer.code} | Tel: {ledgerCustomer.phone || 'N/A'}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary">Outstanding Balance</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: ledgerCustomer.balance > 0 ? '#d32f2f' : '#2e7d32' }}>
                    KES {Number(ledgerCustomer.balance || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>

            <Title level={5}>Invoices Issued</Title>
            <Table
              dataSource={ledgerInvoices}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Ref No', dataIndex: 'ref_no', key: 'ref_no' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Total', dataIndex: 'total', key: 'total', render: (t) => `KES ${Number(t).toLocaleString()}` },
                { title: 'Paid', dataIndex: 'amount_paid', key: 'amount_paid', render: (p) => `KES ${Number(p).toLocaleString()}` },
                { title: 'Balance', dataIndex: 'balance_due', key: 'balance_due', render: (b) => <Text strong style={{ color: b > 0 ? '#d32f2f' : '#2e7d32' }}>KES {Number(b).toLocaleString()}</Text> },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'paid' ? 'green' : s === 'partial' ? 'orange' : 'red'}>{s?.toUpperCase()}</Tag> },
              ]}
              locale={{ emptyText: 'No invoices recorded for this customer' }}
              style={{ marginBottom: 24 }}
            />

            <Title level={5}>Payments / Receipts Received</Title>
            <Table
              dataSource={ledgerReceipts}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Receipt No', dataIndex: 'ref_no', key: 'ref_no' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Mode', dataIndex: 'mode', key: 'mode', render: (m) => <Tag>{m?.toUpperCase()}</Tag> },
                { title: 'Reference', dataIndex: 'reference', key: 'reference', render: (r) => r || '—' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (a) => <Text strong style={{ color: '#2e7d32' }}>KES {Number(a).toLocaleString()}</Text> },
              ]}
              locale={{ emptyText: 'No payment receipts recorded for this customer' }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
