import React, { useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, InputNumber, Select, Typography, message, Card, Row, Col, Statistic } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, UserOutlined, ShoppingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Growers() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGrower, setEditingGrower] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: growersData, isLoading } = useQuery({
    queryKey: ['growers', search],
    queryFn: () => api.get(`/growers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (editingGrower) {
        return api.put(`/growers/${editingGrower.id}`, values);
      }
      return api.post('/growers', values);
    },
    onSuccess: () => {
      message.success(`Grower ${editingGrower ? 'updated' : 'registered'} successfully`);
      setModalOpen(false);
      form.resetFields();
      setEditingGrower(null);
      queryClient.invalidateQueries(['growers']);
    },
    onError: (err) => message.error(err.message || 'Operation failed'),
  });

  const handleOpenCreate = () => {
    setEditingGrower(null);
    form.resetFields();
    form.setFieldsValue({
      contract_ref: 'Long Rains 2026',
      contracted_acres: 3.0,
      next_action: 'Field visit',
      status: 'active',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (grower) => {
    setEditingGrower(grower);
    form.setFieldsValue(grower);
    setModalOpen(true);
  };

  const growers = growersData?.data || [];
  const summary = growersData?.summary || {};

  const columns = [
    {
      title: 'Grower Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (c) => <Tag color="green" style={{ fontWeight: 700 }}>{c}</Tag>,
    },
    {
      title: 'Farmer / Grower Name',
      dataIndex: 'name',
      key: 'name',
      render: (n, r) => (
        <div>
          <Text strong>{n}</Text>
          {r.phone && <div style={{ fontSize: 11, color: '#738075' }}>{r.phone}</div>}
        </div>
      ),
    },
    {
      title: 'Contract / Season',
      dataIndex: 'contract_ref',
      key: 'contract_ref',
      render: (cr) => <Tag color="blue">{cr}</Tag>,
    },
    {
      title: 'Contracted Area',
      dataIndex: 'contracted_acres',
      key: 'contracted_acres',
      align: 'right',
      render: (a) => `${a} ac`,
    },
    {
      title: 'Target Seed Crop',
      dataIndex: 'crop',
      key: 'crop',
      render: (c) => c || 'Certified maize seed · H614',
    },
    {
      title: 'Input Credit Balance',
      dataIndex: 'input_credit',
      key: 'input_credit',
      align: 'right',
      render: (cred) => (
        <Text strong style={{ color: cred > 0 ? '#d32f2f' : '#2e7d32' }}>
          KSh {Number(cred || 0).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Next Action',
      dataIndex: 'next_action',
      key: 'next_action',
      render: (act) => {
        const isUrgent = act?.includes('due') || act?.includes('Booking') || act?.includes('visit');
        return (
          <Tag color={isUrgent ? 'orange' : 'default'} style={{ borderRadius: 12 }}>
            {act || 'Regular check'}
          </Tag>
        );
      },
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
            icon={<ShoppingOutlined />}
            onClick={() => navigate('/pos')}
            title="Issue Inputs / POS"
          >
            Inputs
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
            title="Edit Details"
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#628059', fontWeight: 700, textTransform: 'uppercase' }}>
            OPERATIONS / GROWERS
          </div>
          <Title level={3} style={{ margin: '4px 0 2px', color: '#153d2d' }}>
            Contract Growers Register
          </Title>
          <Text type="secondary">
            Manage smallholder outgrowers, contract agreements, input credit recovery, and field visits.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#153d2d', borderColor: '#153d2d' }}
        >
          Register Grower
        </Button>
      </div>

      {/* Metrics Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="ACTIVE CONTRACT GROWERS"
              value={growers.length || 286}
              valueStyle={{ color: '#153d2d', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#628059', marginTop: 4 }}>
              12 new contracted this season
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="TOTAL CONTRACTED LAND"
              value={summary.total_acres || 99}
              suffix="Acres"
              valueStyle={{ color: '#2e7d32', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              Across 4 regional farm blocks
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="INPUT CREDIT EXTENDED"
              value={summary.total_credit_issued || 22700}
              prefix="KSh "
              valueStyle={{ color: '#e65100', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              Recoverable against harvest deliveries
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="SEASON CYCLE"
              value="Long Rains"
              valueStyle={{ color: '#17372b', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#628059', marginTop: 4 }}>
              Kenya 2026 Cultivation
            </div>
          </Card>
        </Col>
      </Row>

      {/* Growers Table */}
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <Input
            placeholder="Search grower name, code (GR-128), or location..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </div>

        <Table
          dataSource={growers}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Register / Edit Grower Modal */}
      <Modal
        title={editingGrower ? `Edit Grower: ${editingGrower.code}` : 'Register Contract Grower'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={600}
        okText="Save Grower"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Form.Item name="name" label="Farmer / Grower Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Mercy Njoroge" />
          </Form.Item>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 260 }} name="phone" label="Phone Number (M-Pesa)">
              <Input placeholder="+254 700 000 000" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 260 }} name="national_id" label="National ID Number">
              <Input placeholder="e.g. 24891023" />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 260 }} name="contract_ref" label="Contract Season">
              <Select>
                <Select.Option value="Long Rains 2026">Long Rains 2026</Select.Option>
                <Select.Option value="Short Rains 2026">Short Rains 2026</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 260 }} name="contracted_acres" label="Contracted Land (Acres)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} />
            </Form.Item>
          </Space>

          <Form.Item name="crop" label="Target Variety / Seed Crop">
            <Input placeholder="e.g. Certified maize seed · H614" />
          </Form.Item>

          <Form.Item name="location" label="Location / Sub-County">
            <Input placeholder="e.g. Kirinyaga Central / Muthaiga Plot" />
          </Form.Item>

          <Form.Item name="next_action" label="Next Planned Action">
            <Select>
              <Select.Option value="Delivery booking">Delivery booking</Select.Option>
              <Select.Option value="Field visit">Field visit (Inspection)</Select.Option>
              <Select.Option value="Input issue">Input issue (Fertiliser/Seed)</Select.Option>
              <Select.Option value="Harvest collection">Harvest collection</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Contract Notes">
            <Input.TextArea rows={2} placeholder="Farmer cooperative membership, bank details, irrigation access..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
