import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Typography, message, Card, Popconfirm } from 'antd';
import { PlusOutlined, FileTextOutlined, ArrowRightOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Quotations() {
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => api.get('/quotations'),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers'),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/quotations', values),
    onSuccess: () => {
      message.success('Quotation created successfully');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['quotations']);
    },
    onError: (err) => message.error(err.message || 'Failed to create quotation'),
  });

  const convertMutation = useMutation({
    mutationFn: (id) => api.post(`/quotations/${id}/convert-to-order`),
    onSuccess: (res) => {
      message.success(`Converted to Sales Order ${res.data.sales_order_ref}`);
      queryClient.invalidateQueries(['quotations']);
    },
    onError: (err) => message.error(err.message || 'Conversion failed'),
  });

  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      date: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      items: [{ product_id: null, qty: 1, unit_price: 0 }],
    });
    setModalOpen(true);
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
      case 'accepted': return 'green';
      case 'sent': return 'blue';
      case 'converted': return 'purple';
      case 'rejected': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Quote Ref',
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
      title: 'Valid Until',
      dataIndex: 'valid_until',
      key: 'valid_until',
      render: (d) => d || '—',
    },
    {
      title: 'Total (KES)',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (t) => <Text strong>KES {Number(t || 0).toLocaleString()}</Text>,
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
          {record.status !== 'converted' && (
            <Popconfirm
              title="Convert this Quotation to a Sales Order?"
              onConfirm={() => convertMutation.mutate(record.id)}
              okText="Convert"
              cancelText="Cancel"
            >
              <Button size="small" type="primary" ghost icon={<ArrowRightOutlined />}>
                To Order
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Sales Quotations</Title>
          <Text type="secondary">Generate price estimates and convert directly to Sales Orders</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          New Quotation
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={quotes?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* New Quotation Modal */}
      <Modal
        title="Create New Sales Quotation"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        width={720}
        okText="Generate Quotation"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createMutation.mutate(vals)}>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true, message: 'Please select customer' }]}>
            <Select
              placeholder="Select customer"
              showSearch
              filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
            >
              {(customers?.data || []).map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name} ({c.code})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 330 }} name="date" label="Quote Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 330 }} name="valid_until" label="Valid Until">
              <Input type="date" />
            </Form.Item>
          </Space>

          <Title level={5} style={{ marginTop: 12 }}>Quotation Line Items</Title>
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

          <Form.Item name="notes" label="Terms & Notes">
            <Input.TextArea rows={2} placeholder="Payment upon delivery, prices inclusive of 16% VAT..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
