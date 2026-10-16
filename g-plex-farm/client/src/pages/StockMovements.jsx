import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Tabs, Typography, message, Card, Checkbox } from 'antd';
import { PlusOutlined, SwapOutlined, ArrowDownOutlined, ArrowUpOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function StockMovements() {
  const [activeTab, setActiveTab] = useState('balances');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals state
  const [modalType, setModalType] = useState(null); // 'receive' | 'issue' | 'transfer' | 'adjust'
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: balances, isLoading: loadingBalances } = useQuery({
    queryKey: ['stockBalances', warehouseFilter, lowStockOnly],
    queryFn: () => {
      let url = '/stock/balances?';
      if (warehouseFilter) url += `warehouse_id=${warehouseFilter}&`;
      if (lowStockOnly) url += `low_stock=true&`;
      return api.get(url);
    },
  });

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => api.get('/stock/movements'),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses'),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const movementMutation = useMutation({
    mutationFn: ({ type, values }) => api.post(`/stock/${type}`, values),
    onSuccess: () => {
      message.success('Stock movement recorded successfully');
      setModalType(null);
      form.resetFields();
      queryClient.invalidateQueries(['stockBalances']);
      queryClient.invalidateQueries(['stockMovements']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboardSummary']);
    },
    onError: (err) => message.error(err.message || 'Operation failed'),
  });

  const handleOpenModal = (type) => {
    form.resetFields();
    setModalType(type);
  };

  const getMovementTag = (type) => {
    switch (type) {
      case 'receipt': return <Tag color="green">RECEIPT (+)</Tag>;
      case 'issue': return <Tag color="red">ISSUE (-)</Tag>;
      case 'transfer_in': return <Tag color="cyan">TRANSFER IN (+)</Tag>;
      case 'transfer_out': return <Tag color="orange">TRANSFER OUT (-)</Tag>;
      case 'adjustment': return <Tag color="purple">ADJUSTMENT</Tag>;
      default: return <Tag>{type?.toUpperCase()}</Tag>;
    }
  };

  const balanceColumns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (sku) => <Tag color="blue">{sku}</Tag>,
    },
    {
      title: 'Product / Item Name',
      dataIndex: 'name',
      key: 'name',
      render: (n) => <Text strong>{n}</Text>,
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      render: (w) => w || <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'Qty on Hand',
      dataIndex: 'qty_on_hand',
      key: 'qty_on_hand',
      align: 'right',
      render: (qty, r) => {
        const isLow = Number(qty || 0) <= Number(r.reorder_level || 0);
        return (
          <Space>
            <Text strong style={{ color: isLow ? '#d32f2f' : '#2e7d32' }}>
              {qty || 0} {r.unit}
            </Text>
            {isLow && <WarningOutlined style={{ color: '#d32f2f' }} title="Low stock warning" />}
          </Space>
        );
      },
    },
    {
      title: 'Unit Cost',
      dataIndex: 'cost_price',
      key: 'cost_price',
      align: 'right',
      render: (cp) => `KES ${Number(cp || 0).toLocaleString()}`,
    },
    {
      title: 'Valuation (KES)',
      dataIndex: 'stock_value',
      key: 'stock_value',
      align: 'right',
      render: (val) => (
        <Text strong>KES {Number(val || 0).toLocaleString()}</Text>
      ),
    },
  ];

  const movementColumns = [
    {
      title: 'Ref No',
      dataIndex: 'ref_no',
      key: 'ref_no',
      width: 140,
      render: (r) => <Text strong>{r}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (t) => getMovementTag(t),
    },
    {
      title: 'Product',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right',
      render: (q, r) => `${q} ${r.unit || ''}`,
    },
    {
      title: 'Total Cost',
      dataIndex: 'total_cost',
      key: 'total_cost',
      align: 'right',
      render: (tc) => `KES ${Number(tc || 0).toLocaleString()}`,
    },
    {
      title: 'User',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (u) => u || 'System',
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d) => d?.substring(0, 16),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Inventory & Stores Control</Title>
          <Text type="secondary">Real-time store balances, goods receipts, internal issues and transfers</Text>
        </div>
        <Space wrap>
          <Button icon={<ArrowDownOutlined />} onClick={() => handleOpenModal('receive')} type="primary" style={{ backgroundColor: '#2e7d32' }}>
            Receive Stock
          </Button>
          <Button icon={<ArrowUpOutlined />} onClick={() => handleOpenModal('issue')}>
            Issue Stock
          </Button>
          <Button icon={<SwapOutlined />} onClick={() => handleOpenModal('transfer')}>
            Store Transfer
          </Button>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal('adjust')}>
            Stock Adjustment
          </Button>
        </Space>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'balances',
              label: 'Stock Balances & Valuation',
              children: (
                <div>
                  <Space style={{ marginBottom: 16 }} wrap>
                    <Select
                      placeholder="Filter by Warehouse"
                      value={warehouseFilter || undefined}
                      onChange={setWarehouseFilter}
                      style={{ width: 220 }}
                      allowClear
                    >
                      {(warehouses?.data || []).map(w => (
                        <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                      ))}
                    </Select>
                    <Checkbox
                      checked={lowStockOnly}
                      onChange={(e) => setLowStockOnly(e.target.checked)}
                    >
                      Show Low Stock Items Only
                    </Checkbox>
                  </Space>
                  <Table
                    dataSource={balances?.data || []}
                    columns={balanceColumns}
                    rowKey={(r) => `${r.id}-${r.warehouse_id}`}
                    loading={loadingBalances}
                    pagination={{ pageSize: 15 }}
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: 'movements',
              label: 'Movement Audit History',
              children: (
                <Table
                  dataSource={movements?.data || []}
                  columns={movementColumns}
                  rowKey="id"
                  loading={loadingMovements}
                  pagination={{ pageSize: 15 }}
                  size="middle"
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Movement Modal (Receive / Issue / Transfer / Adjust) */}
      <Modal
        title={
          modalType === 'receive' ? 'Receive Goods / Produce into Store' :
          modalType === 'issue' ? 'Issue Goods / Farm Inputs from Store' :
          modalType === 'transfer' ? 'Internal Transfer Between Warehouses' :
          'Adjust Physical Inventory Count'
        }
        open={!!modalType}
        onCancel={() => setModalType(null)}
        onOk={() => form.submit()}
        confirmLoading={movementMutation.isPending}
        okText="Confirm Movement"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => movementMutation.mutate({ type: modalType, values })}>
          <Form.Item name="product_id" label="Product / Produce" rules={[{ required: true, message: 'Please select item' }]}>
            <Select
              placeholder="Select item"
              showSearch
              filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
            >
              {(products?.data || []).map(p => (
                <Select.Option key={p.id} value={p.id}>{p.name} ({p.sku})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {modalType !== 'transfer' ? (
            <Form.Item name="warehouse_id" label="Warehouse / Store" rules={[{ required: true, message: 'Please select store' }]}>
              <Select placeholder="Select store">
                {(warehouses?.data || []).map(w => (
                  <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
              <Form.Item orientation="vertical" style={{ width: 220 }} name="from_warehouse_id" label="From Warehouse" rules={[{ required: true }]}>
                <Select placeholder="Source store">
                  {(warehouses?.data || []).map(w => (
                    <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item orientation="vertical" style={{ width: 220 }} name="to_warehouse_id" label="To Warehouse" rules={[{ required: true }]}>
                <Select placeholder="Target store">
                  {(warehouses?.data || []).map(w => (
                    <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Space>
          )}

          {modalType !== 'adjust' ? (
            <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
              <Form.Item orientation="vertical" style={{ width: 220 }} name="qty" label="Quantity" rules={[{ required: true, message: 'Quantity required' }]}>
                <InputNumber min={0.01} style={{ width: '100%' }} />
              </Form.Item>
              {modalType === 'receive' && (
                <Form.Item orientation="vertical" style={{ width: 220 }} name="unit_cost" label="Unit Cost (KES)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              )}
            </Space>
          ) : (
            <Form.Item name="new_qty" label="New Physical Count (Quantity)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Form.Item name="notes" label="Notes / Reason / Reference Doc">
            <Input.TextArea rows={2} placeholder="Purpose of issue, batch number, or reason for adjustment..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
