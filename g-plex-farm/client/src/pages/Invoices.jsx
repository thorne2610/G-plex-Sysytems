import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Typography, message, Card, Drawer, Descriptions } from 'antd';
import { PlusOutlined, DollarOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Invoices() {
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [form] = Form.useForm();
  const [receiptForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices'),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers'),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const { data: invoiceDetail } = useQuery({
    queryKey: ['invoiceDetail', selectedInvoice?.id],
    queryFn: () => api.get(`/invoices/${selectedInvoice.id}`),
    enabled: !!selectedInvoice,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (values) => api.post('/invoices', values),
    onSuccess: () => {
      message.success('Invoice issued successfully');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['invoices']);
      queryClient.invalidateQueries(['customers']);
    },
    onError: (err) => message.error(err.message || 'Failed to issue invoice'),
  });

  const recordReceiptMutation = useMutation({
    mutationFn: (values) => api.post('/receipts', values),
    onSuccess: () => {
      message.success('Payment recorded successfully');
      setReceiptModalOpen(false);
      receiptForm.resetFields();
      setPayingInvoice(null);
      queryClient.invalidateQueries(['invoices']);
      queryClient.invalidateQueries(['customers']);
      queryClient.invalidateQueries(['receipts']);
      queryClient.invalidateQueries(['dashboardSummary']);
    },
    onError: (err) => message.error(err.message || 'Payment recording failed'),
  });

  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      items: [{ product_id: null, qty: 1, unit_price: 0 }],
    });
    setModalOpen(true);
  };

  const handleOpenReceipt = (invoice) => {
    setPayingInvoice(invoice);
    receiptForm.resetFields();
    receiptForm.setFieldsValue({
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      amount: invoice.balance_due,
      date: new Date().toISOString().split('T')[0],
      mode: 'mpesa',
    });
    setReceiptModalOpen(true);
  };

  const handleProductChange = (productId, index) => {
    const prodList = products?.data || [];
    const prod = prodList.find(p => p.id === productId);
    if (prod) {
      const items = form.getFieldValue('items') || [];
      items[index] = { ...items[index], product_id: productId, unit_price: prod.selling_price || 0 };
      form.setFieldsValue({ items: [...items] });
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'paid': return 'green';
      case 'partial': return 'orange';
      case 'overdue': return 'red';
      default: return 'blue';
    }
  };

  const columns = [
    {
      title: 'Invoice No',
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
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Total (KES)',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (t) => `KES ${Number(t || 0).toLocaleString()}`,
    },
    {
      title: 'Paid (KES)',
      dataIndex: 'amount_paid',
      key: 'amount_paid',
      align: 'right',
      render: (p) => <Text style={{ color: '#2e7d32' }}>KES {Number(p || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance_due',
      key: 'balance_due',
      align: 'right',
      render: (b) => {
        const num = Number(b || 0);
        return (
          <Text strong style={{ color: num > 0 ? '#d32f2f' : '#2e7d32' }}>
            KES {num.toLocaleString()}
          </Text>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={getStatusColor(s)}>{s?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedInvoice(record)}
          />
          {record.balance_due > 0 && (
            <Button
              size="small"
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => handleOpenReceipt(record)}
              style={{ backgroundColor: '#2e7d32' }}
            >
              Pay
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const detail = invoiceDetail?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Customer Invoices & Billing</Title>
          <Text type="secondary">Issue invoices, track payments, and manage outstanding balances</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          Issue New Invoice
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={invoices?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* New Invoice Modal */}
      <Modal
        title="Issue New Customer Invoice"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createInvoiceMutation.isPending}
        width={720}
        okText="Issue Invoice"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createInvoiceMutation.mutate(vals)}>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true, message: 'Please select customer' }]}>
            <Select
              placeholder="Select customer"
              showSearch
              filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
            >
              {(customers?.data || []).map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name} ({c.code}) — Balance: KES {Number(c.balance).toLocaleString()}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 330 }} name="date" label="Invoice Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 330 }} name="due_date" label="Due Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
          </Space>

          <Title level={5} style={{ marginTop: 12 }}>Invoice Line Items</Title>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, idx) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'product_id']}
                      rules={[{ required: true, message: 'Select product' }]}
                      style={{ width: 280 }}
                    >
                      <Select
                        placeholder="Select Produce / Product"
                        onChange={(val) => handleProductChange(val, idx)}
                        showSearch
                        filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
                      >
                        {(products?.data || []).map(p => (
                          <Select.Option key={p.id} value={p.id}>{p.name} ({p.unit})</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, 'qty']}
                      rules={[{ required: true, message: 'Qty required' }]}
                      style={{ width: 120 }}
                    >
                      <InputNumber min={0.1} placeholder="Qty" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, 'unit_price']}
                      rules={[{ required: true, message: 'Price required' }]}
                      style={{ width: 150 }}
                    >
                      <InputNumber min={0} placeholder="Price (KES)" style={{ width: '100%' }} />
                    </Form.Item>

                    {fields.length > 1 && (
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    )}
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item name="notes" label="Invoice Notes">
            <Input.TextArea rows={2} placeholder="Delivery note reference, payment instructions..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Record Payment Receipt Modal */}
      <Modal
        title={`Record Payment for ${payingInvoice?.ref_no || ''}`}
        open={receiptModalOpen}
        onCancel={() => setReceiptModalOpen(false)}
        onOk={() => receiptForm.submit()}
        confirmLoading={recordReceiptMutation.isPending}
        okText="Record Receipt"
        destroyOnClose
      >
        <Form form={receiptForm} layout="vertical" onFinish={(vals) => recordReceiptMutation.mutate(vals)}>
          <Form.Item name="customer_id" hidden><Input /></Form.Item>
          <Form.Item name="invoice_id" hidden><Input /></Form.Item>

          <Card style={{ marginBottom: 16, backgroundColor: '#f9fafb' }}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Customer">{payingInvoice?.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Invoice Total">KES {Number(payingInvoice?.total || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Current Balance Due">
                <Text strong style={{ color: '#d32f2f' }}>KES {Number(payingInvoice?.balance_due || 0).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Form.Item
            name="amount"
            label="Payment Amount (KES)"
            rules={[
              { required: true, message: 'Amount required' },
              () => ({
                validator(_, value) {
                  if (value > (payingInvoice?.balance_due || 0) + 0.01) {
                    return Promise.reject(new Error('Amount cannot exceed outstanding balance'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} step={100} />
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="date" label="Payment Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="mode" label="Payment Method" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="mpesa">M-Pesa</Select.Option>
                <Select.Option value="bank">Bank Transfer</Select.Option>
                <Select.Option value="cash">Cash</Select.Option>
                <Select.Option value="cheque">Cheque</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="reference" label="Transaction / Reference No">
            <Input placeholder="e.g. QKH789XYZ / Cheque #0045" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional receipt notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Invoice Detail Drawer */}
      <Drawer
        title={`Invoice: ${detail?.ref_no || ''}`}
        placement="right"
        width={650}
        onClose={() => setSelectedInvoice(null)}
        open={!!selectedInvoice}
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Customer">{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(detail.status)}>{detail.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Date">{detail.date}</Descriptions.Item>
              <Descriptions.Item label="Due Date">{detail.due_date}</Descriptions.Item>
              <Descriptions.Item label="Subtotal">KES {Number(detail.subtotal || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="16% VAT">KES {Number(detail.vat_amount || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">KES {Number(detail.total || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Amount Paid">
                <Text style={{ color: '#2e7d32' }}>KES {Number(detail.amount_paid || 0).toLocaleString()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Balance Due" span={2}>
                <Text strong style={{ fontSize: 16, color: detail.balance_due > 0 ? '#d32f2f' : '#2e7d32' }}>
                  KES {Number(detail.balance_due || 0).toLocaleString()}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Invoiced Items</Title>
            <Table
              dataSource={detail.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Item', dataIndex: 'product_name', key: 'product_name' },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (q, r) => `${q} ${r.unit || ''}` },
                { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', render: (p) => `KES ${Number(p).toLocaleString()}` },
                { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', render: (lt) => <Text strong>KES {Number(lt).toLocaleString()}</Text> },
              ]}
              style={{ marginBottom: 20 }}
            />

            <Title level={5}>Payment Receipts</Title>
            <Table
              dataSource={detail.receipts || []}
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
              locale={{ emptyText: 'No payments recorded for this invoice' }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
