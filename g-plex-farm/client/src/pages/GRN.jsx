import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Typography, message, Card, Popconfirm, Drawer, Descriptions } from 'antd';
import { PlusOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function GRN() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: grns, isLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: () => api.get('/grn'),
  });

  const { data: pos } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => api.get('/purchase-orders'),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses'),
  });

  const { data: grnDetail } = useQuery({
    queryKey: ['grnDetail', selectedGRN?.id],
    queryFn: () => api.get(`/grn/${selectedGRN.id}`),
    enabled: !!selectedGRN,
  });

  const createGRNMutation = useMutation({
    mutationFn: (values) => api.post('/grn', values),
    onSuccess: () => {
      message.success('Goods Received Note created');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['grns']);
    },
    onError: (err) => message.error(err.message || 'Creation failed'),
  });

  const postGRNMutation = useMutation({
    mutationFn: (id) => api.post(`/grn/${id}/post`),
    onSuccess: () => {
      message.success('GRN posted! Inventory stock balances have been updated.');
      queryClient.invalidateQueries(['grns']);
      queryClient.invalidateQueries(['stockBalances']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboardSummary']);
    },
    onError: (err) => message.error(err.message || 'Posting failed'),
  });

  const handlePOSelect = async (poId) => {
    try {
      const res = await api.get(`/purchase-orders/${poId}`);
      if (res.data?.items) {
        const items = res.data.items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          unit: it.unit,
          qty_ordered: it.qty,
          qty_received: it.qty,
          unit_price: it.unit_price,
          batch_number: '',
          expiry_date: '',
        }));
        form.setFieldsValue({ items });
      }
    } catch (err) {
      console.error('Error fetching PO items:', err);
    }
  };

  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      date: new Date().toISOString().split('T')[0],
      items: [],
    });
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'GRN Ref',
      dataIndex: 'ref_no',
      key: 'ref_no',
      render: (r) => <Text strong>{r}</Text>,
    },
    {
      title: 'PO Reference',
      dataIndex: 'po_ref_no',
      key: 'po_ref_no',
      render: (p) => <Tag color="blue">{p}</Tag>,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
    },
    {
      title: 'Receiving Store',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => (
        <Tag color={s === 'posted' ? 'green' : 'orange'}>
          {s?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedGRN(record)}
          />
          {record.status === 'draft' && (
            <Popconfirm
              title="Post this GRN into Inventory?"
              description="This will increase stock quantities in the warehouse."
              onConfirm={() => postGRNMutation.mutate(record.id)}
              okText="Post to Stock"
              cancelText="Cancel"
            >
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ backgroundColor: '#2e7d32' }}>
                Post Stock
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const detail = grnDetail?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Goods Received Notes (GRN)</Title>
          <Text type="secondary">Receive physical deliveries from suppliers and automatically update store stock</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          New Goods Received Note
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={grns?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* New GRN Modal */}
      <Modal
        title="Receive Goods from Purchase Order"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createGRNMutation.isPending}
        width={720}
        okText="Create GRN"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createGRNMutation.mutate(vals)}>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 330 }} name="po_id" label="Purchase Order" rules={[{ required: true, message: 'Select PO' }]}>
              <Select placeholder="Select PO to receive" onChange={handlePOSelect}>
                {(pos?.data || []).filter(p => p.status !== 'received').map(p => (
                  <Select.Option key={p.id} value={p.id}>{p.ref_no} — {p.supplier_name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 330 }} name="warehouse_id" label="Receiving Store / Warehouse" rules={[{ required: true, message: 'Select store' }]}>
              <Select placeholder="Select store">
                {(warehouses?.data || []).map(w => (
                  <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="date" label="Delivery Received Date" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>

          <Title level={5} style={{ marginTop: 12 }}>Items Received Verification</Title>
          <Form.List name="items">
            {(fields) => (
              <div style={{ maxHeight: 240, overflow: 'auto', marginBottom: 16 }}>
                {fields.map(({ key, name, ...restField }) => {
                  const it = form.getFieldValue(['items', name]);
                  return (
                    <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) repeat(3,minmax(120px,150px))', gap: 12, alignItems: 'end' }}>
                        <div>
                          <strong>{it?.product_name || `Item #${name + 1}`}</strong>
                          <div style={{ fontSize: 12, color: '#666' }}>Ordered: {it?.qty_ordered} {it?.unit} @ KES {it?.unit_price}</div>
                        </div>
                        <Form.Item {...restField} name={[name, 'batch_number']} label="Supplier / Seed Lot" rules={[{ required: true, whitespace: true, message: 'Enter a batch / lot number before posting stock' }]} style={{ margin: 0 }}>
                          <Input placeholder="Lot number" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'expiry_date']} label="Expiry Date" style={{ margin: 0 }}>
                          <Input type="date" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'qty_received']}
                          label="Qty Received"
                          rules={[{ required: true }]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber min={0} max={it?.qty_ordered} style={{ width: 140 }} />
                        </Form.Item>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Form.List>

          <Form.Item name="notes" label="Delivery Note / Inspection Notes">
            <Input.TextArea rows={2} placeholder="Supplier delivery note #, condition of goods..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* GRN Detail Drawer */}
      <Drawer
        title={`GRN: ${detail?.ref_no || ''}`}
        placement="right"
        width={650}
        onClose={() => setSelectedGRN(null)}
        open={!!selectedGRN}
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="PO Ref">{detail.po_ref_no}</Descriptions.Item>
              <Descriptions.Item label="Supplier">{detail.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="Store">{detail.warehouse_name}</Descriptions.Item>
              <Descriptions.Item label="Date">{detail.date}</Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Tag color={detail.status === 'posted' ? 'green' : 'orange'}>{detail.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Received Items</Title>
            <Table
              dataSource={detail.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Item', dataIndex: 'product_name', key: 'product_name' },
                { title: 'Ordered', dataIndex: 'qty_ordered', key: 'qty_ordered', render: (q, r) => `${q} ${r.unit || ''}` },
                { title: 'Received', dataIndex: 'qty_received', key: 'qty_received', render: (q, r) => <Text strong style={{ color: '#2e7d32' }}>{q} {r.unit || ''}</Text> },
                { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', render: (p) => `KES ${Number(p).toLocaleString()}` },
                { title: 'Total', dataIndex: 'line_total', key: 'line_total', render: (lt) => `KES ${Number(lt).toLocaleString()}` },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
