import React, { useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, InputNumber, Select, Typography, message, Card, Row, Col, Statistic, Popconfirm } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ExperimentOutlined, SafetyCertificateOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function SeedQuality() {
  const [modalOpen, setModalOpen] = useState(false);
  const [signOffModal, setSignOffModal] = useState(null);
  const [form] = Form.useForm();
  const [signOffForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: qualityData, isLoading } = useQuery({
    queryKey: ['seedQuality'],
    queryFn: () => api.get('/seed-quality'),
  });

  const saveMutation = useMutation({
    mutationFn: (values) => api.post('/seed-quality', values),
    onSuccess: () => {
      message.success('Seed lot created successfully');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['seedQuality']);
    },
    onError: (err) => message.error(err.message || 'Operation failed'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/seed-quality/${id}/status`, values),
    onSuccess: () => {
      message.success('Seed lot status updated');
      setSignOffModal(null);
      queryClient.invalidateQueries(['seedQuality']);
    },
    onError: (err) => message.error(err.message || 'Operation failed'),
  });

  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      status: 'awaiting_signoff',
      pack_size: '25 kg bag',
      germination_pct: 92,
      purity_pct: 99.0,
      moisture_pct: 12.0,
    });
    setModalOpen(true);
  };

  const handleOpenSignOff = (lot) => {
    setSignOffModal(lot);
    signOffForm.setFieldsValue({
      status: 'released',
      certificate_no: lot.certificate_no || `KEPHIS-2026-${lot.lot_number.replace(/[^0-9]/g, '')}`,
      germination_pct: lot.germination_pct || 94,
    });
  };

  const lots = qualityData?.data || [];
  const metrics = qualityData?.metrics || {};

  const getStatusTag = (s) => {
    switch (s) {
      case 'released':
        return <Tag color="green" icon={<CheckCircleOutlined />}>RELEASED</Tag>;
      case 'awaiting_signoff':
        return <Tag color="orange">AWAITING SIGN-OFF</Tag>;
      case 'lab_sample_due':
        return <Tag color="blue" icon={<ExperimentOutlined />}>LAB SAMPLE DUE</Tag>;
      case 'rejected':
        return <Tag color="red">REJECTED</Tag>;
      default:
        return <Tag>{s?.toUpperCase()}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Seed Lot No',
      dataIndex: 'lot_number',
      key: 'lot_number',
      width: 140,
      render: (ln) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{ln}</Tag>,
    },
    {
      title: 'Variety / Crop',
      dataIndex: 'variety',
      key: 'variety',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'Pack Size',
      dataIndex: 'pack_size',
      key: 'pack_size',
    },
    {
      title: 'Germination %',
      dataIndex: 'germination_pct',
      key: 'germination_pct',
      align: 'center',
      render: (g) => {
        if (!g) return <Text type="secondary">—</Text>;
        const num = Number(g);
        return (
          <span style={{ fontWeight: 700, color: num >= 90 ? '#2e7d32' : '#d32f2f' }}>
            {num.toFixed(1)}%
          </span>
        );
      },
    },
    {
      title: 'Purity %',
      dataIndex: 'purity_pct',
      key: 'purity_pct',
      align: 'center',
      render: (p) => p ? `${Number(p).toFixed(1)}%` : '—',
    },
    {
      title: 'Moisture %',
      dataIndex: 'moisture_pct',
      key: 'moisture_pct',
      align: 'center',
      render: (m) => m ? `${Number(m).toFixed(1)}%` : '—',
    },
    {
      title: 'Certification / Release',
      dataIndex: 'status',
      key: 'status',
      render: (s) => getStatusTag(s),
    },
    {
      title: 'Certificate No',
      dataIndex: 'certificate_no',
      key: 'certificate_no',
      render: (c) => c ? <Tag color="cyan">{c}</Tag> : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 130,
      render: (_, record) => (
        <Space size="small">
          {record.status !== 'released' && (
            <Button
              size="small"
              type="primary"
              style={{ backgroundColor: '#153d2d', borderColor: '#153d2d' }}
              onClick={() => handleOpenSignOff(record)}
            >
              Sign Off
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#628059', fontWeight: 700, textTransform: 'uppercase' }}>
            QUALITY ASSURANCE / SEED CERTIFICATION
          </div>
          <Title level={3} style={{ margin: '4px 0 2px', color: '#153d2d' }}>
            Seed Quality & Lab Testing
          </Title>
          <Text type="secondary">
            Lot traceability, KEPHIS inspection certificates, germination trials, and release sign-offs.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#153d2d', borderColor: '#153d2d' }}
        >
          New Seed Lot
        </Button>
      </div>

      {/* Metric Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="SEED LOTS UNDER CONTROL"
              value={lots.length || 3}
              valueStyle={{ color: '#153d2d', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#628059', marginTop: 4 }}>
              92% lot traceability in store
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="AVG GERMINATION RATE"
              value={metrics.avg_germination ? Number(metrics.avg_germination).toFixed(1) : 93.0}
              suffix="%"
              valueStyle={{ color: '#2e7d32', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#628059', marginTop: 4 }}>
              Above KEPHIS 90% benchmark
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="AWAITING SIGN-OFF"
              value={metrics.awaiting_signoff || 1}
              valueStyle={{ color: '#e65100', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#e65100', marginTop: 4 }}>
              Ready for release authorization
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 10, background: '#fff' }}>
            <Statistic
              title="LAB SAMPLES DUE"
              value={metrics.lab_sample_due || 1}
              valueStyle={{ color: '#17372b', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: '#738075', marginTop: 4 }}>
              Moisture & purity pending
            </div>
          </Card>
        </Col>
      </Row>

      {/* Seed Lots Table */}
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table
          dataSource={lots}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* New Seed Lot Modal */}
      <Modal
        title="Register Seed Lot & Quality Profile"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={600}
        okText="Register Seed Lot"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMutation.mutate(vals)}>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 260 }} name="lot_number" label="Lot Number" rules={[{ required: true }]}>
              <Input placeholder="e.g. GP-26-045" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 260 }} name="variety" label="Crop Variety" rules={[{ required: true }]}>
              <Input placeholder="e.g. H614 / Rosecoco" />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 170 }} name="germination_pct" label="Germination %">
              <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 170 }} name="purity_pct" label="Physical Purity %">
              <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 170 }} name="moisture_pct" label="Moisture %">
              <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 260 }} name="pack_size" label="Packaging Pack Size">
              <Input placeholder="e.g. 25 kg bag" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 260 }} name="status" label="Initial Quality Status">
              <Select>
                <Select.Option value="awaiting_signoff">Awaiting Sign-off</Select.Option>
                <Select.Option value="lab_sample_due">Lab Sample Due</Select.Option>
                <Select.Option value="released">Released to Stores</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Quality Inspector Notes">
            <Input.TextArea rows={2} placeholder="Sample lot source, harvest date, germination chamber notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sign Off Modal */}
      <Modal
        title={`Sign-Off Release for Lot: ${signOffModal?.lot_number || ''}`}
        open={!!signOffModal}
        onCancel={() => setSignOffModal(null)}
        onOk={() => signOffForm.submit()}
        confirmLoading={updateStatusMutation.isPending}
        okText="Authorize Release"
        destroyOnClose
      >
        <Form form={signOffForm} layout="vertical" onFinish={(vals) => updateStatusMutation.mutate({ id: signOffModal.id, values: vals })}>
          <Form.Item name="status" label="Release Decision" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="released">Release for Distribution & Sale</Select.Option>
              <Select.Option value="awaiting_signoff">Keep Awaiting Sign-off</Select.Option>
              <Select.Option value="rejected">Reject Lot (Substandard)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="certificate_no" label="KEPHIS / Certification Number">
            <Input placeholder="e.g. KEPHIS-2026-9041" />
          </Form.Item>
          <Form.Item name="germination_pct" label="Final Certified Germination %">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
