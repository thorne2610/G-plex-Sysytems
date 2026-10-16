import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Typography, message, Card, Drawer, Descriptions } from 'antd';
import { PlusOutlined, FileDoneOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function PurchaseOrders() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: pos, isLoading } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => api.get('/purchase-orders'),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers'),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const { data: poDetail } = useQuery({
    queryKey: ['poDetail', selectedPO?.id],
    queryFn: () => api.get(`/purchase-orders/${selectedPO.id}`),
    enabled: !!selectedPO,
  });

  const createPOMutation = useMutation({
    mutationFn: (values) => api.post('/purchase-orders', values),
    onSuccess: () => {
      message.success('Purchase Order created successfully');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['purchaseOrders']);
    },
    onError: (err) => message.error(err.message || 'Failed to create PO'),
  });

  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      date: new Date().toISOString().split('T')[0],
      expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ product_id: null, qty: 1, unit_price: 0 }],
    });
    setModalOpen(true);
  };

  const handleProductChange = (productId, index) => {
    const prodList = products?.data || [];
    const prod = prodList.find(p => p.id === productId);
    if (prod) {
      const items = form.getFieldValue('items') || [];
      items[index] = { ...items[index], product_id: productId, unit_price: prod.cost_price || 0 };
      form.setFieldsValue({ items: [...items] });
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'received': return 'green';
      case 'sent': return 'blue';
      case 'cancelled': return 'red';
      default: return 'orange';
    }
  };

  const columns = [
    {
      title: 'PO Ref',
      dataIndex: 'ref_no',
      key: 'ref_no',
      render: (r) => <Text strong>{r}</Text>,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Expected By',
      dataIndex: 'expected_date',
      key: 'expected_date',
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
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setSelectedPO(record)}
        >
          View
        </Button>
      ),
    },
  ];

  const detail = poDetail?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Procurement & Purchase Orders</Title>
          <Text type="secondary">Manage requisitions and supplier purchase orders for farm inputs</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          New Purchase Order
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={pos?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* New PO Modal */}
      <Modal
        title="Create Supplier Purchase Order"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createPOMutation.isPending}
        width={720}
        okText="Create PO"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createPOMutation.mutate(vals)}>
          <Form.Item name="supplier_id" label="Supplier" rules={[{ required: true, message: 'Please select supplier' }]}>
            <Select
              placeholder="Select supplier"
              showSearch
              filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
            >
              {(suppliers?.data || []).map(s => (
                <Select.Option key={s.id} value={s.id}>{s.name} ({s.code})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 330 }} name="date" label="Order Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 330 }} name="expected_date" label="Expected Delivery Date">
              <Input type="date" />
            </Form.Item>
          </Space>

          <Title level={5} style={{ marginTop: 12 }}>Items to Order</Title>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, idx) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'product_id']}
                      rules={[{ required: true, message: 'Select item' }]}
                      style={{ width: 280 }}
                    >
                      <Select
                        placeholder="Select Farm Input"
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
                      <InputNumber min={1} placeholder="Qty" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, 'unit_price']}
                      rules={[{ required: true, message: 'Unit cost required' }]}
                      style={{ width: 150 }}
                    >
                      <InputNumber min={0} placeholder="Cost (KES)" style={{ width: '100%' }} />
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

          <Form.Item name="notes" label="Procurement Notes / Instructions">
            <Input.TextArea rows={2} placeholder="Delivery address, payment terms agreed..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={`Purchase Order: ${detail?.ref_no || ''}`}
        placement="right"
        width={650}
        onClose={() => setSelectedPO(null)}
        open={!!selectedPO}
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Supplier">{detail.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(detail.status)}>{detail.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Order Date">{detail.date}</Descriptions.Item>
              <Descriptions.Item label="Expected By">{detail.expected_date || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Subtotal">KES {Number(detail.subtotal || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="16% VAT">KES {Number(detail.vat_amount || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Total" span={2}>
                <Text strong style={{ fontSize: 16, color: '#2e7d32' }}>
                  KES {Number(detail.total || 0).toLocaleString()}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Ordered Items</Title>
            <Table
              dataSource={detail.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Item', dataIndex: 'product_name', key: 'product_name' },
                { title: 'Quantity', dataIndex: 'qty', key: 'qty', render: (q, r) => `${q} ${r.unit || ''}` },
                { title: 'Unit Cost', dataIndex: 'unit_price', key: 'unit_price', render: (p) => `KES ${Number(p).toLocaleString()}` },
                { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', render: (lt) => <Text strong>KES {Number(lt).toLocaleString()}</Text> },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
