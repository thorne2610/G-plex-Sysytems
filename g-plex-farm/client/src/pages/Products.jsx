import React, { useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, InputNumber, Select, Drawer, Typography, message, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Products() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', search, categoryFilter],
    queryFn: () => {
      let url = '/products?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (categoryFilter) url += `category_id=${categoryFilter}&`;
      return api.get(url);
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => api.get('/products/categories'),
  });

  const { data: productDetail } = useQuery({
    queryKey: ['productDetail', viewingProduct?.id],
    queryFn: () => api.get(`/products/${viewingProduct.id}`),
    enabled: !!viewingProduct,
  });

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (editingProduct) {
        return api.put(`/products/${editingProduct.id}`, values);
      }
      return api.post('/products', values);
    },
    onSuccess: () => {
      message.success(`Product ${editingProduct ? 'updated' : 'added'} successfully`);
      setModalOpen(false);
      form.resetFields();
      setEditingProduct(null);
      queryClient.invalidateQueries(['products']);
    },
    onError: (err) => message.error(err.message || 'Failed to save product'),
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue({ unit: 'kg', cost_price: 0, selling_price: 0, reorder_level: 10, vat_pct: 16 });
    setModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    form.setFieldsValue(prod);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (sku) => <Tag color="geekblue">{sku}</Tag>,
    },
    {
      title: 'Product / Item Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.category_name && (
            <div style={{ fontSize: 12, color: '#666' }}>{record.category_name}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: 'Cost Price',
      dataIndex: 'cost_price',
      key: 'cost_price',
      align: 'right',
      render: (cp) => `KES ${Number(cp || 0).toLocaleString()}`,
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      align: 'right',
      render: (sp) => `KES ${Number(sp || 0).toLocaleString()}`,
    },
    {
      title: 'Stock on Hand',
      dataIndex: 'total_stock',
      key: 'total_stock',
      align: 'right',
      render: (stock, record) => {
        const isLow = Number(stock || 0) <= Number(record.reorder_level || 0);
        return (
          <Space>
            <Text strong style={{ color: isLow ? '#d32f2f' : '#2e7d32' }}>
              {stock || 0} {record.unit}
            </Text>
            {isLow && <WarningOutlined style={{ color: '#d32f2f' }} title="Below Reorder Level" />}
          </Space>
        );
      },
    },
    {
      title: 'Reorder Level',
      dataIndex: 'reorder_level',
      key: 'reorder_level',
      align: 'right',
      render: (rl, r) => `${rl || 0} ${r.unit}`,
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
            onClick={() => setViewingProduct(record)}
            title="Stock Breakdown"
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

  const detail = productDetail?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Products & Inventory Catalogue</Title>
          <Text type="secondary">Manage crop produce, seeds, fertilisers, chemicals, and supplies</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          Add Product / Item
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search by name or SKU..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Filter by Category"
            value={categoryFilter || undefined}
            onChange={setCategoryFilter}
            style={{ width: 220 }}
            allowClear
          >
            {(categories?.data || []).map(c => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          dataSource={productsData?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Add / Edit Product Modal */}
      <Modal
        title={editingProduct ? `Edit Product (${editingProduct.sku})` : 'Add New Inventory Item'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={600}
        okText="Save Product"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 260 }} name="sku" label="SKU / Item Code" rules={[{ required: true, message: 'SKU is required' }]}>
              <Input placeholder="e.g. SEED-MAZ-01" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 260 }} name="category_id" label="Category">
              <Select placeholder="Select category">
                {(categories?.data || []).map(c => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Hybrid Maize Seed (H614D) 25kg" />
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 170 }} name="unit" label="Unit of Measure" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="kg">kg</Select.Option>
                <Select.Option value="bag">bag</Select.Option>
                <Select.Option value="litre">litre</Select.Option>
                <Select.Option value="crate">crate</Select.Option>
                <Select.Option value="tonne">tonne</Select.Option>
                <Select.Option value="pcs">pcs</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 170 }} name="cost_price" label="Cost Price (KES)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 170 }} name="selling_price" label="Selling Price (KES)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 260 }} name="reorder_level" label="Reorder Alert Level">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 260 }} name="vat_pct" label="VAT %">
              <InputNumber style={{ width: '100%' }} min={0} max={100} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="Description / Specifications">
            <Input.TextArea rows={2} placeholder="Crop variety, storage recommendations, packaging notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Product Stock Breakdown Drawer */}
      <Drawer
        title={`Stock Breakdown: ${detail?.name || ''}`}
        placement="right"
        width={650}
        onClose={() => setViewingProduct(null)}
        open={!!viewingProduct}
      >
        {detail && (
          <div>
            <Card style={{ marginBottom: 20, backgroundColor: '#f9fafb' }}>
              <Space direction="vertical">
                <div><strong>SKU:</strong> {detail.sku}</div>
                <div><strong>Category:</strong> {detail.category_name || 'N/A'}</div>
                <div><strong>Valuation Unit Cost:</strong> KES {Number(detail.cost_price || 0).toLocaleString()}</div>
              </Space>
            </Card>

            <Title level={5}>Stock on Hand by Warehouse</Title>
            <Table
              dataSource={detail.balances || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Warehouse / Store', dataIndex: 'warehouse_name', key: 'warehouse_name' },
                { title: 'Quantity on Hand', dataIndex: 'qty_on_hand', key: 'qty_on_hand', render: (q) => <Text strong>{q} {detail.unit}</Text> },
                { title: 'Stock Value', key: 'val', render: (_, r) => `KES ${(Number(r.qty_on_hand || 0) * Number(detail.cost_price || 0)).toLocaleString()}` },
              ]}
              locale={{ emptyText: 'No stock recorded in any warehouse yet' }}
              style={{ marginBottom: 24 }}
            />

            <Title level={5}>Recent Stock Movements</Title>
            <Table
              dataSource={detail.movements || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Ref No', dataIndex: 'ref_no', key: 'ref_no' },
                { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag color={t === 'receipt' ? 'green' : t === 'issue' ? 'red' : 'blue'}>{t?.toUpperCase()}</Tag> },
                { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (q) => `${q} ${detail.unit}` },
                { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (d) => d?.substring(0, 10) },
              ]}
              locale={{ emptyText: 'No movements recorded for this item' }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
