import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Typography, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Fields() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: fields, isLoading } = useQuery({
    queryKey: ['fields'],
    queryFn: () => api.get('/fields'),
  });

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (editingField) {
        return api.put(`/fields/${editingField.id}`, values);
      }
      return api.post('/fields', values);
    },
    onSuccess: () => {
      message.success(`Field ${editingField ? 'updated' : 'created'} successfully`);
      setModalOpen(false);
      form.resetFields();
      setEditingField(null);
      queryClient.invalidateQueries(['fields']);
    },
    onError: (err) => message.error(err.message || 'Operation failed'),
  });

  const handleOpenCreate = () => {
    setEditingField(null);
    form.resetFields();
    form.setFieldsValue({ area_ha: 5, soil_type: 'Loam' });
    setModalOpen(true);
  };

  const handleOpenEdit = (f) => {
    setEditingField(f);
    form.setFieldsValue(f);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Field Code',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      render: (c) => <Tag color="green">{c}</Tag>,
    },
    {
      title: 'Field / Block Name',
      dataIndex: 'name',
      key: 'name',
      render: (n) => <Text strong>{n}</Text>,
    },
    {
      title: 'Area (Hectares)',
      dataIndex: 'area_ha',
      key: 'area_ha',
      align: 'right',
      render: (a) => `${a} Ha`,
    },
    {
      title: 'Location / Sector',
      dataIndex: 'location',
      key: 'location',
      render: (l) => l || '—',
    },
    {
      title: 'Soil Type',
      dataIndex: 'soil_type',
      key: 'soil_type',
      render: (s) => s ? <Tag>{s}</Tag> : '—',
    },
    {
      title: 'GPS Coordinates',
      key: 'gps',
      render: (_, r) => (r.gps_lat && r.gps_lng) ? `${r.gps_lat}, ${r.gps_lng}` : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleOpenEdit(record)}
          title="Edit Field"
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Farm Fields & Production Blocks</Title>
          <Text type="secondary">Manage cultivation blocks, land area acreage, and soil classifications</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#2e7d32' }}
        >
          Add Field Block
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={fields?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Field Modal */}
      <Modal
        title={editingField ? `Edit Field (${editingField.code})` : 'Register Farm Field / Block'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="Save Field"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="code" label="Field Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. FLD-01" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="name" label="Field Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. North Ridge Plot A" />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="area_ha" label="Area (Hectares)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0.1} step={0.5} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="soil_type" label="Soil Classification">
              <Input placeholder="e.g. Red Volcanic Loam / Clay" />
            </Form.Item>
          </Space>

          <Form.Item name="location" label="Location / Zone Description">
            <Input placeholder="e.g. Upper Farm section, adjacent to reservoir" />
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="gps_lat" label="GPS Latitude">
              <Input placeholder="-0.123456" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="gps_lng" label="GPS Longitude">
              <Input placeholder="36.123456" />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Notes / Irrigation Setup">
            <Input.TextArea rows={2} placeholder="Drip irrigation lines installed, slope notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
