import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Drawer, Typography, message, Card, Descriptions } from 'antd';
import { PlusOutlined, ToolOutlined, EyeOutlined, FireOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function Assets() {
  const [modalOpen, setModalOpen] = useState(false);
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [actionAsset, setActionAsset] = useState(null);

  const [form] = Form.useForm();
  const [fuelForm] = Form.useForm();
  const [maintForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets'),
  });
  const { data: staff } = useQuery({ queryKey: ['staffEmployees'], queryFn: () => api.get('/staff/employees') });

  const { data: assetDetail } = useQuery({
    queryKey: ['assetDetail', selectedAsset?.id],
    queryFn: () => api.get(`/assets/${selectedAsset.id}`),
    enabled: !!selectedAsset,
  });

  const createAssetMutation = useMutation({
    mutationFn: (values) => api.post('/assets', values),
    onSuccess: () => {
      message.success('Asset registered successfully');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['assets']);
      queryClient.invalidateQueries(['dashboardSummary']);
    },
    onError: (err) => message.error(err.message || 'Registration failed'),
  });

  const fuelMutation = useMutation({
    mutationFn: ({ assetId, values }) => api.post(`/assets/${assetId}/fuel`, values),
    onSuccess: () => {
      message.success('Fuel log recorded');
      setFuelModalOpen(false);
      fuelForm.resetFields();
      queryClient.invalidateQueries(['assetDetail']);
      queryClient.invalidateQueries(['reports']);
    },
    onError: (err) => message.error(err.message || 'Failed to record fuel'),
  });

  const maintMutation = useMutation({
    mutationFn: ({ assetId, values }) => api.post(`/assets/${assetId}/maintenance`, values),
    onSuccess: () => {
      message.success('Maintenance record logged');
      setMaintModalOpen(false);
      maintForm.resetFields();
      queryClient.invalidateQueries(['assetDetail']);
      queryClient.invalidateQueries(['reports']);
    },
    onError: (err) => message.error(err.message || 'Failed to log maintenance'),
  });

  const handleOpenFuel = (asset) => {
    setActionAsset(asset);
    fuelForm.resetFields();
    fuelForm.setFieldsValue({
      date: new Date().toISOString().split('T')[0],
      cost_per_ltr: 180,
    });
    setFuelModalOpen(true);
  };

  const handleOpenMaint = (asset) => {
    setActionAsset(asset);
    maintForm.resetFields();
    maintForm.setFieldsValue({
      date: new Date().toISOString().split('T')[0],
    });
    setMaintModalOpen(true);
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'active': return 'green';
      case 'maintenance': return 'orange';
      case 'disposed': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (c) => <Tag color="blue">{c}</Tag>,
    },
    {
      title: 'Equipment / Asset Name',
      dataIndex: 'name',
      key: 'name',
      render: (n, r) => (
        <div>
          <Text strong>{n}</Text>
          {(r.make || r.model) && (
            <div style={{ fontSize: 12, color: '#666' }}>{r.make} {r.model}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t) => <Tag>{t?.toUpperCase()}</Tag>,
    },
    {
      title: 'Purchase Cost',
      dataIndex: 'purchase_cost',
      key: 'purchase_cost',
      align: 'right',
      render: (c) => `KES ${Number(c || 0).toLocaleString()}`,
    },
    {
      title: 'Book Value',
      dataIndex: 'current_value',
      key: 'current_value',
      align: 'right',
      render: (v) => <Text strong>KES {Number(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={getStatusColor(s)}>{s?.toUpperCase()}</Tag>,
    },
    { title: 'Assigned Operator', dataIndex: 'operator_name', key: 'operator_name', render: (v) => v || '—' },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedAsset(record)}
            title="Service & Fuel Logs"
          />
          <Button
            size="small"
            icon={<FireOutlined />}
            onClick={() => handleOpenFuel(record)}
            title="Log Fuel Consumption"
          >
            Fuel
          </Button>
          <Button
            size="small"
            icon={<ToolOutlined />}
            onClick={() => handleOpenMaint(record)}
            title="Log Maintenance"
          >
            Service
          </Button>
        </Space>
      ),
    },
  ];

  const detail = assetDetail?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Assets, Machinery & Equipment</Title>
          <Text type="secondary">Manage tractors, farm implements, fuel consumption logs, and maintenance</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setModalOpen(true); }}
          style={{ backgroundColor: '#2e7d32' }}
        >
          Register Asset
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={assets?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Register Asset Modal */}
      <Modal
        title="Register Farm Asset / Machine"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createAssetMutation.isPending}
        width={650}
        okText="Register Asset"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createAssetMutation.mutate(vals)}>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 200 }} name="code" label="Asset Tag / Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. TRC-01" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 380 }} name="name" label="Asset Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Massey Ferguson 375 Tractor" />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 190 }} name="type" label="Asset Category" rules={[{ required: true }]}>
              <Select placeholder="Category">
                <Select.Option value="tractor">Tractor</Select.Option>
                <Select.Option value="vehicle">Vehicle / Pickup</Select.Option>
                <Select.Option value="implement">Implement / Plough / Harrow</Select.Option>
                <Select.Option value="equipment">Irrigation Pump / Equipment</Select.Option>
                <Select.Option value="equipment">Generator</Select.Option>
                <Select.Option value="other">Workshop Tool</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 190 }} name="make" label="Make / Brand">
              <Input placeholder="e.g. Massey Ferguson" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 190 }} name="model" label="Model">
              <Input placeholder="e.g. MF-375 4WD" />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 190 }} name="serial_no" label="Serial / Reg No">
              <Input placeholder="e.g. KDD 123A" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 190 }} name="purchase_date" label="Purchase Date">
              <Input type="date" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 190 }} name="purchase_cost" label="Cost (KES)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item name="assigned_operator_id" label="Assigned Operator" style={{ width: 280 }}>
              <Select allowClear showSearch optionFilterProp="label" placeholder="Select staff operator" options={(staff?.data || []).filter(person => person.status === 'active').map(person => ({ value: person.id, label: `${person.employee_no} · ${person.name}` }))} />
            </Form.Item>
            <Form.Item name="hour_meter" label="Current Hour Meter" style={{ width: 180 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="odometer_reading" label="Odometer" style={{ width: 180 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </Space>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item name="insurance_expiry" label="Insurance Expiry" style={{ width: 190 }}><Input type="date" /></Form.Item>
            <Form.Item name="inspection_due" label="Inspection Due" style={{ width: 190 }}><Input type="date" /></Form.Item>
            <Form.Item name="licence_expiry" label="Licence Expiry" style={{ width: 190 }}><Input type="date" /></Form.Item>
          </Space>

          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 280 }} name="useful_life_yrs" label="Useful Life (Years)">
              <InputNumber style={{ width: '100%' }} min={1} max={50} defaultValue={5} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 280 }} name="salvage_value" label="Salvage / Scrap Value (KES)">
              <InputNumber style={{ width: '100%' }} min={0} defaultValue={0} />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Engine capacity, warranty, attachments..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Fuel Log Modal */}
      <Modal
        title={`Log Fuel Refill: ${actionAsset?.name || ''}`}
        open={fuelModalOpen}
        onCancel={() => setFuelModalOpen(false)}
        onOk={() => fuelForm.submit()}
        confirmLoading={fuelMutation.isPending}
        okText="Save Fuel Log"
        destroyOnClose
      >
        <Form form={fuelForm} layout="vertical" onFinish={(vals) => fuelMutation.mutate({ assetId: actionAsset?.id, values: vals })}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="litres" label="Litres Dispensed" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="cost_per_ltr" label="Cost per Litre (KES)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </Space>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="odometer" label="Odometer / Engine Hours">
              <Input placeholder="e.g. 1420 hrs / 45,000 km" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="operator" label="Driver / Operator">
              <Input placeholder="e.g. Peter Mwangi" />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="Activity / Field Worked">
            <Input.TextArea rows={2} placeholder="e.g. Ploughed Field Block A" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Maintenance Modal */}
      <Modal
        title={`Log Service / Maintenance: ${actionAsset?.name || ''}`}
        open={maintModalOpen}
        onCancel={() => setMaintModalOpen(false)}
        onOk={() => maintForm.submit()}
        confirmLoading={maintMutation.isPending}
        okText="Log Maintenance"
        destroyOnClose
      >
        <Form form={maintForm} layout="vertical" onFinish={(vals) => maintMutation.mutate({ assetId: actionAsset?.id, values: vals })}>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="date" label="Service Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="cost" label="Total Repair Cost (KES)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Service Work Carried Out" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="e.g. Oil filter replaced, hydraulic hose repaired, hydraulic fluid top-up" />
          </Form.Item>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item orientation="vertical" style={{ width: 220 }} name="done_by" label="Mechanic / Service Provider">
              <Input placeholder="e.g. Farm Mechanic / Dealer Workshop" />
            </Form.Item>
            <Form.Item orientation="vertical" style={{ width: 220 }} name="next_service_date" label="Next Service Due Date">
              <Input type="date" />
            </Form.Item>
          </Space>
          <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
            <Form.Item name="spare_parts_cost" label="Spare parts cost (KES)" style={{ width: 220 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="downtime_hours" label="Downtime (hours)" style={{ width: 220 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={`Asset Log: ${detail?.name || ''}`}
        placement="right"
        width={700}
        onClose={() => setSelectedAsset(null)}
        open={!!selectedAsset}
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Tag">{detail.code}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(detail.status)}>{detail.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Make & Model">{detail.make} {detail.model}</Descriptions.Item>
              <Descriptions.Item label="Serial / Reg">{detail.serial_no || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Assigned operator">{detail.operator_name || 'Unassigned'}</Descriptions.Item>
              <Descriptions.Item label="Meter / odometer">{detail.hour_meter || 0} h / {detail.odometer_reading || 0}</Descriptions.Item>
              <Descriptions.Item label="Insurance / inspection">{detail.insurance_expiry || '—'} / {detail.inspection_due || '—'}</Descriptions.Item>
              <Descriptions.Item label="Purchase Cost">KES {Number(detail.purchase_cost || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Book Value">
                <Text strong style={{ color: '#2e7d32' }}>KES {Number(detail.current_value || 0).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Fuel Consumption History</Title>
            <Table
              dataSource={detail.fuel_logs || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Litres', dataIndex: 'litres', key: 'litres', render: (l) => `${l} L` },
                { title: 'Total Cost', dataIndex: 'total_cost', key: 'total_cost', render: (c) => `KES ${Number(c).toLocaleString()}` },
                { title: 'Operator', dataIndex: 'operator', key: 'operator', render: (o) => o || '—' },
                { title: 'Notes', dataIndex: 'notes', key: 'notes' },
              ]}
              locale={{ emptyText: 'No fuel entries logged' }}
              style={{ marginBottom: 24 }}
            />

            <Title level={5}>Maintenance & Service Records</Title>
            <Table
              dataSource={detail.maintenance_records || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Description', dataIndex: 'description', key: 'description' },
                { title: 'Cost', dataIndex: 'cost', key: 'cost', render: (c) => <Text strong>KES {Number(c).toLocaleString()}</Text> },
                { title: 'Mechanic', dataIndex: 'done_by', key: 'done_by', render: (d) => d || '—' },
                { title: 'Parts (KES)', dataIndex: 'spare_parts_cost', key: 'spare_parts_cost', render: money => `KES ${Number(money || 0).toLocaleString()}` },
                { title: 'Downtime', dataIndex: 'downtime_hours', key: 'downtime_hours', render: hours => `${Number(hours || 0)} h` },
              ]}
              locale={{ emptyText: 'No maintenance records' }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
