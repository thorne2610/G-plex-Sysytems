import React, { useMemo, useState } from 'react';
import {
  App as AntApp, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber,
  Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography,
} from 'antd';
import {
  AreaChartOutlined, CloudOutlined, EnvironmentOutlined, ExperimentOutlined, FieldTimeOutlined,
  GoldOutlined, PlusOutlined, RocketOutlined, ShopOutlined, SyncOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;
const today = () => new Date().toISOString().slice(0, 10);
const money = value => `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
const hectares = value => `${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })} ha`;
const tagStatus = status => <Tag color={{ planned: 'gold', active: 'green', harvested: 'blue', closed: 'default' }[status] || 'default'}>{String(status || 'unknown').replace('_', ' ').toUpperCase()}</Tag>;
const parseBoundary = value => {
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return value; }
};

function MetricCard({ title, value, suffix, prefix, icon, tint = '#eef5e8', color = '#315e3d' }) {
  return <Card bordered={false} style={{ height: '100%', borderRadius: 18, background: tint, boxShadow: '0 8px 28px rgba(25,55,39,.05)' }}>
    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
      <Statistic title={<span style={{ color: '#65756b', fontSize: 12 }}>{title}</span>} value={value} suffix={suffix} prefix={prefix} valueStyle={{ color, fontWeight: 750, fontSize: 25 }} />
      <span style={{ width: 39, height: 39, borderRadius: 13, display: 'grid', placeItems: 'center', background: '#ffffffa8', color, fontSize: 17 }}>{icon}</span>
    </Space>
  </Card>;
}

export default function Fields() {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [farmModal, setFarmModal] = useState(false);
  const [blockModal, setBlockModal] = useState(null);
  const [fieldModal, setFieldModal] = useState(null);
  const [cycleModal, setCycleModal] = useState(false);
  const [activityModal, setActivityModal] = useState(null);
  const [harvestModal, setHarvestModal] = useState(null);
  const [saleModal, setSaleModal] = useState(null);
  const [recordDrawer, setRecordDrawer] = useState(null);
  const [farmFilter, setFarmFilter] = useState();
  const [seasonFilter, setSeasonFilter] = useState();
  const [cropFilter, setCropFilter] = useState();
  const [farmForm] = Form.useForm();
  const [blockForm] = Form.useForm();
  const [fieldForm] = Form.useForm();
  const [cycleForm] = Form.useForm();
  const [activityForm] = Form.useForm();
  const [harvestForm] = Form.useForm();
  const [saleForm] = Form.useForm();
  const activeActivityType = Form.useWatch('activity_type', activityForm);

  const invalidateFarm = () => {
    queryClient.invalidateQueries({ queryKey: ['farmList'] });
    queryClient.invalidateQueries({ queryKey: ['farmBlocks'] });
    queryClient.invalidateQueries({ queryKey: ['fieldList'] });
    queryClient.invalidateQueries({ queryKey: ['cycleList'] });
    queryClient.invalidateQueries({ queryKey: ['fieldComparisons'] });
    queryClient.invalidateQueries({ queryKey: ['cycleDetail'] });
  };
  const farmsQ = useQuery({ queryKey: ['farmList'], queryFn: () => api.get('/fields/farms') });
  const farms = farmsQ.data?.data || [];
  const fieldsQ = useQuery({ queryKey: ['fieldList'], queryFn: () => api.get('/fields') });
  const fields = fieldsQ.data?.data || [];
  const seasonsQ = useQuery({ queryKey: ['farmSeasons'], queryFn: () => api.get('/seasons') });
  const seasons = seasonsQ.data?.data || [];
  const cyclesQ = useQuery({ queryKey: ['cycleList'], queryFn: () => api.get('/fields/cycles') });
  const cycles = cyclesQ.data?.data || [];
  const filteredCycles = useMemo(() => cycles.filter(c => (!farmFilter || farms.find(f => f.id === farmFilter)?.name === c.farm_name)
    && (!seasonFilter || Number(c.season_id) === Number(seasonFilter))
    && (!cropFilter || c.crop?.toLowerCase() === cropFilter.toLowerCase())), [cycles, farms, farmFilter, seasonFilter, cropFilter]);
  const detailQ = useQuery({ queryKey: ['cycleDetail', recordDrawer?.id], queryFn: () => api.get(`/fields/cycles/${recordDrawer.id}`), enabled: !!recordDrawer?.id });
  const detail = detailQ.data?.data;
  const detailFarmId = Form.useWatch('farm_id', fieldForm);
  const blocksQ = useQuery({ queryKey: ['farmBlocks', detailFarmId], queryFn: () => api.get(`/fields/farms/${detailFarmId}/blocks`), enabled: !!detailFarmId });
  const blocks = blocksQ.data?.data || [];
  const productsQ = useQuery({ queryKey: ['fieldProducts'], queryFn: () => api.get('/products') });
  const products = productsQ.data?.data || [];
  const assetsQ = useQuery({ queryKey: ['fieldAssets'], queryFn: () => api.get('/assets') });
  const assets = assetsQ.data?.data || [];
  const warehousesQ = useQuery({ queryKey: ['fieldWarehouses'], queryFn: () => api.get('/warehouses') });
  const warehouses = warehousesQ.data?.data || [];
  const comparisonsQ = useQuery({
    queryKey: ['fieldComparisons', farmFilter, seasonFilter, cropFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (farmFilter) params.set('farm_id', farmFilter);
      if (seasonFilter) params.set('season_id', seasonFilter);
      if (cropFilter) params.set('crop', cropFilter);
      return api.get(`/fields/comparisons?${params.toString()}`);
    },
  });
  const comparisons = comparisonsQ.data?.data || [];

  const saveFarm = useMutation({ mutationFn: values => {
    const payload = { ...values, gps_boundary: parseBoundary(values.gps_boundary) };
    return farmModal?.id ? api.put(`/fields/farms/${farmModal.id}`, payload) : api.post('/fields/farms', payload);
  }, onSuccess: () => { message.success(farmModal?.id ? 'Farm updated' : 'Farm registered'); setFarmModal(false); farmForm.resetFields(); invalidateFarm(); }, onError: e => message.error(e.message) });
  const saveBlock = useMutation({ mutationFn: ({ farmId, values }) => api.post(`/fields/farms/${farmId}/blocks`, values), onSuccess: () => { message.success('Block added to farm'); setBlockModal(null); blockForm.resetFields(); invalidateFarm(); }, onError: e => message.error(e.message) });
  const saveField = useMutation({ mutationFn: values => {
    const payload = { ...values, gps_boundary: parseBoundary(values.gps_boundary) };
    return fieldModal?.id ? api.put(`/fields/${fieldModal.id}`, payload) : api.post('/fields', payload);
  }, onSuccess: () => { message.success(fieldModal?.id ? 'Field updated' : 'Field registered'); setFieldModal(null); fieldForm.resetFields(); invalidateFarm(); }, onError: e => message.error(e.message) });
  const saveCycle = useMutation({ mutationFn: values => api.post('/fields/cycles', values), onSuccess: () => { message.success('Crop cycle opened'); setCycleModal(false); cycleForm.resetFields(); invalidateFarm(); setActiveTab('cycles'); }, onError: e => message.error(e.message) });
  const saveActivity = useMutation({ mutationFn: ({ cycleId, values }) => api.post(`/fields/cycles/${cycleId}/activities`, values), onSuccess: () => { message.success('Field record added'); setActivityModal(null); activityForm.resetFields(); invalidateFarm(); }, onError: e => message.error(e.message) });
  const saveHarvest = useMutation({ mutationFn: ({ cycleId, values }) => api.post(`/fields/cycles/${cycleId}/harvests`, values), onSuccess: () => { message.success('Harvest and grading recorded'); setHarvestModal(null); harvestForm.resetFields(); invalidateFarm(); }, onError: e => message.error(e.message) });
  const saveSale = useMutation({ mutationFn: ({ harvestId, values }) => api.post(`/fields/harvests/${harvestId}/sales`, values), onSuccess: () => { message.success('Harvest sale recorded'); setSaleModal(null); saleForm.resetFields(); invalidateFarm(); }, onError: e => message.error(e.message) });

  const openFarm = farm => {
    farmForm.resetFields();
    if (farm) farmForm.setFieldsValue({ ...farm, gps_boundary: farm.gps_boundary ? JSON.stringify(parseBoundary(farm.gps_boundary), null, 2) : '' });
    else farmForm.setFieldsValue({ area_ha: 0 });
    setFarmModal(farm || {});
  };
  const openField = field => {
    setFieldModal(field || {});
    fieldForm.resetFields();
    if (field) fieldForm.setFieldsValue({ ...field, gps_boundary: field.gps_boundary ? JSON.stringify(parseBoundary(field.gps_boundary), null, 2) : '' });
    else fieldForm.setFieldsValue({ area_ha: 1 });
  };
  const openCycle = () => { cycleForm.resetFields(); cycleForm.setFieldsValue({ planting_date: today(), yield_unit: 'kg', status: 'active' }); setCycleModal(true); };
  const openActivity = cycle => { activityForm.resetFields(); activityForm.setFieldsValue({ date: today(), activity_type: 'scouting', quantity: 0, workers: 0, labour_hours: 0, machinery_hours: 0, input_cost: 0, labour_cost: 0, machinery_cost: 0, other_cost: 0 }); setActivityModal(cycle); };
  const openHarvest = cycle => { harvestForm.resetFields(); harvestForm.setFieldsValue({ harvest_date: today(), unit: cycle.yield_unit || 'kg' }); setHarvestModal(cycle); };

  const farmColumns = [
    { title: 'Farm', dataIndex: 'name', render: (name, row) => <Space direction="vertical" size={1}><Text strong>{name}</Text><Text type="secondary">{row.code}</Text></Space> },
    { title: 'Location', dataIndex: 'location', render: v => v || '—' },
    { title: 'Registered area', dataIndex: 'area_ha', align: 'right', render: hectares },
    { title: 'Blocks', dataIndex: 'block_count', align: 'center' },
    { title: 'Block names', dataIndex: 'block_names', render: value => value || 'Create the first block' },
    { title: 'Fields', dataIndex: 'field_count', align: 'center' },
    { title: 'Mapped fields', dataIndex: 'field_area_ha', align: 'right', render: hectares },
    { title: 'Boundary', dataIndex: 'gps_boundary', render: v => v ? <Tag color="green">GEOJSON SAVED</Tag> : <Tag>NOT MAPPED</Tag> },
    { title: 'Actions', key: 'actions', render: (_, row) => <Space><Button size="small" onClick={() => openFarm(row)}>Edit</Button><Button size="small" icon={<PlusOutlined />} onClick={() => { blockForm.resetFields(); setBlockModal(row); }}>Add block</Button></Space> },
  ];
  const fieldColumns = [
    { title: 'Field ID', dataIndex: 'code', render: code => <Tag color="green">{code}</Tag> },
    { title: 'Field', dataIndex: 'name', render: (name, row) => <Space direction="vertical" size={1}><Text strong>{name}</Text><Text type="secondary">{row.farm_name || 'No farm'} · {row.block_name || 'Unassigned block'}</Text></Space> },
    { title: 'Area', dataIndex: 'area_ha', align: 'right', render: hectares },
    { title: 'Crop / variety', key: 'crop', render: (_, row) => row.current_crop ? <>{row.current_crop} <Text type="secondary">· {row.current_variety}</Text></> : <Text type="secondary">No current crop cycle</Text> },
    { title: 'Soil', dataIndex: 'soil_type', render: value => value || '—' },
    { title: 'GPS location', key: 'gps', render: (_, row) => row.gps_boundary ? <Tag color="green">BOUNDARY MAPPED</Tag> : row.gps_lat != null && row.gps_lng != null ? <Tag color="blue">{Number(row.gps_lat).toFixed(4)}, {Number(row.gps_lng).toFixed(4)}</Tag> : <Tag>NOT MAPPED</Tag> },
    { title: 'Actions', key: 'actions', render: (_, row) => <Button size="small" onClick={() => openField(row)}>Edit field</Button> },
  ];
  const cycleColumns = [
    { title: 'Cycle', dataIndex: 'ref_no', render: value => <Tag color="geekblue">{value}</Tag> },
    { title: 'Crop & variety', key: 'crop', render: (_, row) => <Space direction="vertical" size={0}><Text strong>{row.crop} · {row.variety}</Text><Text type="secondary">Seed {row.seed_batch_no || 'batch not recorded'}</Text></Space> },
    { title: 'Field / Farm', key: 'field', render: (_, row) => <Space direction="vertical" size={0}><Text>{row.field_code} · {row.field_name}</Text><Text type="secondary">{row.farm_name || '—'} · {row.season_name || 'No season'}</Text></Space> },
    { title: 'Planted', dataIndex: 'planting_date' },
    { title: 'Expected harvest', dataIndex: 'expected_harvest_date', render: value => value || '—' },
    { title: 'Harvested', dataIndex: 'harvested_qty', align: 'right', render: (v, row) => `${Number(v || 0).toLocaleString()} ${row.yield_unit}` },
    { title: 'Cost', dataIndex: 'actual_cost', align: 'right', render: money },
    { title: 'Status', dataIndex: 'status', render: tagStatus },
    { title: 'History', key: 'history', render: (_, row) => <Button size="small" type="primary" ghost onClick={() => setRecordDrawer(row)}>Open field record</Button> },
  ];
  const activityColumns = [
    { title: 'Date', dataIndex: 'date' },
    { title: 'Activity', dataIndex: 'activity_type', render: value => <Tag color={value === 'chemical' ? 'volcano' : value === 'fertiliser' ? 'green' : 'blue'}>{String(value).replaceAll('_', ' ').toUpperCase()}</Tag> },
    { title: 'Details', dataIndex: 'description', render: (value, row) => <Space direction="vertical" size={0}><Text>{value || row.observation || row.action_taken || 'Record logged'}</Text><Text type="secondary">{row.product_name || (row.rainfall_mm != null ? `${row.rainfall_mm} mm rainfall` : '')} {row.input_batch_no ? `· batch ${row.input_batch_no}` : ''} {row.warehouse_name ? `· ${row.warehouse_name}` : ''}</Text>{row.activity_type === 'chemical' && <Text type="secondary">Approved: {row.authorised_by_name} · {row.authorised_by_qualification} · rate {row.application_rate} {row.application_rate_unit} · ref {row.recommendation_ref}</Text>}</Space> },
    { title: 'People / machinery', key: 'resources', render: (_, row) => <Text>{row.workers || 0} workers · {row.labour_hours || 0}h labour · {row.machinery_hours || 0}h machinery</Text> },
    { title: 'Store', dataIndex: 'warehouse_name', render: v => v || '—' },
    { title: 'Total cost', dataIndex: 'total_cost', align: 'right', render: money },
  ];
  const harvestColumns = [
    { title: 'Ref', dataIndex: 'ref_no', render: value => <Tag color="gold">{value}</Tag> },
    { title: 'Harvest date', dataIndex: 'harvest_date' },
    { title: 'Gross', key: 'gross', render: (_, row) => `${Number(row.gross_qty).toLocaleString()} ${row.unit}` },
    { title: 'Grade A / B / C', key: 'grades', render: (_, row) => `${row.grade_a_qty} / ${row.grade_b_qty} / ${row.grade_c_qty} ${row.unit}` },
    { title: 'Loss / reject', key: 'loss', render: (_, row) => `${Number(row.loss_qty || 0) + Number(row.reject_qty || 0)} ${row.unit}` },
    { title: 'Saleable left', key: 'left', render: (_, row) => {
      const graded = Number(row.grade_a_qty || 0) + Number(row.grade_b_qty || 0) + Number(row.grade_c_qty || 0);
      const remaining = Math.max(0, (graded || Number(row.gross_qty) - Number(row.loss_qty || 0) - Number(row.reject_qty || 0)) - Number(row.sold_qty || 0));
      return `${remaining.toLocaleString()} ${row.unit}`;
    } },
    { title: 'Stored at', dataIndex: 'storage_location', render: value => value || '—' },
    { title: 'Sales', key: 'sales', render: (_, row) => <Button size="small" icon={<ShopOutlined />} onClick={() => { saleForm.resetFields(); saleForm.setFieldsValue({ sale_date: today(), unit: row.unit, unit_price: 0 }); setSaleModal(row); }}>Record sale</Button> },
  ];
  const comparisonColumns = [
    { title: 'Season', dataIndex: 'season_name', render: value => value || 'Unassigned' },
    { title: 'Crop', dataIndex: 'crop' },
    { title: 'Variety', dataIndex: 'variety', render: value => <Text strong>{value}</Text> },
    { title: 'Farm / field', key: 'location', render: (_, row) => `${row.farm_name || '—'} · ${row.field_code}` },
    { title: 'Area', dataIndex: 'area_ha', align: 'right', render: hectares },
    { title: 'Yield', dataIndex: 'yield', align: 'right', render: (value, row) => `${Number(value || 0).toLocaleString()} ${row.yield_unit || 'kg'}` },
    { title: 'Yield / ha', dataIndex: 'yield_per_ha', align: 'right', render: (value, row) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${row.yield_unit || 'kg'}/ha` },
    { title: 'Actual cost', dataIndex: 'actual_cost', align: 'right', render: money },
    { title: 'Cost / ha', dataIndex: 'cost_per_ha', align: 'right', render: money },
    { title: 'Sales revenue', dataIndex: 'revenue', align: 'right', render: money },
  ];

  const completedArea = fields.reduce((sum, field) => sum + Number(field.area_ha || 0), 0);
  const activeCycles = cycles.filter(cycle => cycle.status === 'active').length;
  const totalHarvest = cycles.reduce((sum, cycle) => sum + Number(cycle.harvested_qty || 0), 0);
  const totalSpend = cycles.reduce((sum, cycle) => sum + Number(cycle.actual_cost || 0), 0);
  const uniqueCrops = new Set(cycles.map(cycle => cycle.crop?.toLowerCase()).filter(Boolean)).size;

  return <div style={{ maxWidth: 1500, margin: '0 auto' }}>
    <div style={{ borderRadius: 24, padding: '28px 30px', marginBottom: 18, color: '#f6f4e7', background: 'radial-gradient(circle at 88% 20%, #76a85f 0, transparent 24%), linear-gradient(118deg,#173c2c 0%,#285b3c 58%,#3c7545 100%)', boxShadow: '0 18px 40px #23483326' }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col xs={24} md={15}>
          <Space style={{ color: '#d2edaa', fontSize: 12, letterSpacing: 1.3, fontWeight: 700 }}><EnvironmentOutlined /> G-PLEX · FIELD OPERATIONS</Space>
          <Title level={2} style={{ color: '#fff', margin: '10px 0 5px', fontSize: 29 }}>Farms, fields & crop cycles</Title>
          <Text style={{ color: '#d2e2d2', fontSize: 13 }}>One traceable record from land preparation and planting through field care, harvest, grading, storage and sale. Built for any crop and every farm.</Text>
        </Col>
        <Col><Space wrap>
          <Button size="large" ghost icon={<EnvironmentOutlined />} onClick={() => openFarm()}>Register farm</Button>
          <Button size="large" style={{ background: '#d5f28b', borderColor: '#d5f28b', color: '#1d3c2a', fontWeight: 700 }} icon={<SyncOutlined />} onClick={openCycle}>Open crop cycle</Button>
        </Space></Col>
      </Row>
      <div style={{ marginTop: 23, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {['Multi-farm hierarchy', 'Geo boundary ready', 'Crop agnostic', 'Season & variety comparison'].map(item => <span key={item} style={{ border: '1px solid #ffffff32', background: '#ffffff12', borderRadius: 30, padding: '6px 11px', fontSize: 11 }}>{item}</span>)}
      </div>
    </div>

    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}><MetricCard title="Farms registered" value={farms.length} icon={<EnvironmentOutlined />} /></Col>
      <Col xs={12} md={6}><MetricCard title="Fields · mapped area" value={fields.length} suffix={`/ ${hectares(completedArea)}`} icon={<AreaChartOutlined />} tint="#f3efe3" color="#7d6537" /></Col>
      <Col xs={12} md={6}><MetricCard title="Active crop cycles" value={activeCycles} icon={<SyncOutlined />} tint="#edf2f8" color="#44637c" /></Col>
      <Col xs={12} md={6}><MetricCard title="Harvest · tracked crops" value={totalHarvest} suffix="kg" icon={<GoldOutlined />} tint="#f8eee5" color="#92633c" /></Col>
    </Row>

    <Card bordered={false} style={{ borderRadius: 20, boxShadow: '0 8px 30px rgba(25,55,39,.05)' }} bodyStyle={{ padding: '8px 20px 20px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'overview', label: <span><AreaChartOutlined /> Overview</span>, children: <Row gutter={[18, 18]}>
          <Col xs={24} lg={15}><Card title="Latest crop cycles" bordered={false} style={{ background: '#f9faf7', borderRadius: 16 }} extra={<Button type="link" onClick={() => setActiveTab('cycles')}>All cycles →</Button>}>
            {cycles.length ? <Table rowKey="id" size="small" pagination={false} dataSource={cycles.slice(0, 6)} columns={cycleColumns.filter(col => ['Cycle','Crop & variety','Field / Farm','Planted','Status','History'].includes(col.title))} /> : <Empty description="Open a crop cycle to start the field history" />}
          </Card></Col>
          <Col xs={24} lg={9}><Card title="Production pulse" bordered={false} style={{ background: '#f9faf7', borderRadius: 16, height: '100%' }}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div><Text type="secondary">Actual logged field spend</Text><div style={{ fontSize: 24, fontWeight: 750, color: '#244b34' }}>{money(totalSpend)}</div></div>
              <div><Text type="secondary">Crop types tracked</Text><div style={{ fontSize: 24, fontWeight: 750, color: '#244b34' }}>{uniqueCrops}</div></div>
              <div style={{ padding: 14, borderRadius: 12, background: '#e9f0e4', color: '#49624f', fontSize: 12, lineHeight: 1.6 }}><CloudOutlined /> Weather, scouting, input use, labour, machinery and crop-health observations are recorded against an individual crop cycle.</div>
            </Space>
          </Card></Col>
        </Row> },
        { key: 'farms', label: <span><EnvironmentOutlined /> Farms & blocks</span>, children: <>
          <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}><div><Title level={5} style={{ margin: 0 }}>Farm register</Title><Text type="secondary">Capture farm area, location and its GeoJSON boundary; organise blocks under each farm.</Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => openFarm()}>Add farm</Button></Row>
          <Table rowKey="id" loading={farmsQ.isLoading} dataSource={farms} columns={farmColumns} pagination={{ pageSize: 8 }} scroll={{ x: 850 }} />
        </> },
        { key: 'fields', label: <span><FieldTimeOutlined /> Field register</span>, children: <>
          <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}><div><Title level={5} style={{ margin: 0 }}>Unique field register</Title><Text type="secondary">Each field belongs to a farm, optionally a block, and carries its own ID, acreage, soil and boundary.</Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => openField(null)}>Add field</Button></Row>
          <Table rowKey="id" loading={fieldsQ.isLoading} dataSource={fields} columns={fieldColumns} pagination={{ pageSize: 10 }} scroll={{ x: 950 }} />
        </> },
        { key: 'cycles', label: <span><SyncOutlined /> Crop cycles</span>, children: <>
          <Row gutter={[10, 10]} align="middle" style={{ marginBottom: 14 }}>
            <Col flex="auto"><Title level={5} style={{ margin: 0 }}>Crop production records</Title><Text type="secondary">Crop and variety are free text so rotations and contracted crops are supported.</Text></Col>
            <Col><Button type="primary" icon={<PlusOutlined />} onClick={openCycle}>Open crop cycle</Button></Col>
          </Row>
          <Table rowKey="id" loading={cyclesQ.isLoading} dataSource={filteredCycles} columns={cycleColumns} pagination={{ pageSize: 10 }} scroll={{ x: 1200 }} />
        </> },
        { key: 'records', label: <span><ExperimentOutlined /> Field records</span>, children: <>
          <Title level={5} style={{ margin: '3px 0' }}>Choose a crop cycle to log field work</Title><Text type="secondary">Keep applications, irrigation, rainfall, scouting, health notes, labour and machine hours on the exact field cycle.</Text>
          <Table style={{ marginTop: 14 }} rowKey="id" loading={cyclesQ.isLoading} dataSource={filteredCycles} pagination={{ pageSize: 8 }} scroll={{ x: 800 }} columns={[
            { title: 'Cycle', dataIndex: 'ref_no', render: v => <Tag color="geekblue">{v}</Tag> },
            { title: 'Crop / variety', key: 'crop', render: (_, r) => <Text strong>{r.crop} · {r.variety}</Text> },
            { title: 'Farm / field', key: 'field', render: (_, r) => `${r.farm_name} · ${r.field_code}` },
            { title: 'Status', dataIndex: 'status', render: tagStatus },
            { title: 'Action', key: 'action', render: (_, r) => <Space><Button size="small" icon={<PlusOutlined />} onClick={() => openActivity(r)}>Log activity</Button><Button size="small" onClick={() => setRecordDrawer(r)}>View history</Button></Space> },
          ]} />
        </> },
        { key: 'harvest', label: <span><GoldOutlined /> Harvest & sales</span>, children: <>
          <Title level={5} style={{ margin: '3px 0' }}>Harvests, grades, storage & sale records</Title><Text type="secondary">Open the crop cycle record to capture graded harvests and record each sale against remaining marketable quantity.</Text>
          <Table style={{ marginTop: 14 }} rowKey="id" loading={cyclesQ.isLoading} dataSource={filteredCycles} pagination={{ pageSize: 8 }} scroll={{ x: 800 }} columns={[
            { title: 'Cycle', dataIndex: 'ref_no', render: v => <Tag color="geekblue">{v}</Tag> },
            { title: 'Crop / variety', key: 'crop', render: (_, r) => <Text strong>{r.crop} · {r.variety}</Text> },
            { title: 'Field', dataIndex: 'field_code' },
            { title: 'Harvested', key: 'qty', render: (_, r) => `${Number(r.harvested_qty || 0).toLocaleString()} ${r.yield_unit}` },
            { title: 'Revenue', dataIndex: 'sales_amount', align: 'right', render: money },
            { title: 'Actions', key: 'actions', render: (_, r) => <Space><Button size="small" icon={<PlusOutlined />} onClick={() => openHarvest(r)}>Record harvest</Button><Button size="small" onClick={() => setRecordDrawer(r)}>Harvest ledger</Button></Space> },
          ]} />
        </> },
        { key: 'compare', label: <span><AreaChartOutlined /> Compare performance</span>, children: <>
          <Row gutter={[10, 10]} align="middle" style={{ marginBottom: 14 }}><Col flex="auto"><Title level={5} style={{ margin: 0 }}>Field, variety & season comparison</Title><Text type="secondary">Compare harvested yield, cost per hectare and recorded sales.</Text></Col>
            <Col><Select allowClear placeholder="All farms" value={farmFilter} onChange={setFarmFilter} style={{ width: 160 }}>{farms.map(f => <Select.Option value={f.id} key={f.id}>{f.name}</Select.Option>)}</Select></Col>
            <Col><Select allowClear placeholder="All seasons" value={seasonFilter} onChange={setSeasonFilter} style={{ width: 160 }}>{seasons.map(s => <Select.Option value={s.id} key={s.id}>{s.name}</Select.Option>)}</Select></Col>
            <Col><Input allowClear placeholder="Filter crop" value={cropFilter} onChange={e => setCropFilter(e.target.value || undefined)} style={{ width: 140 }} /></Col>
          </Row>
          <Table rowKey="id" loading={comparisonsQ.isLoading} dataSource={comparisons} columns={comparisonColumns} pagination={{ pageSize: 10 }} scroll={{ x: 1250 }} />
        </> },
      ]} />
    </Card>

    <Modal title={farmModal?.id ? `Edit farm · ${farmModal.code}` : 'Register farm'} open={!!farmModal} onCancel={() => setFarmModal(false)} onOk={() => farmForm.submit()} confirmLoading={saveFarm.isPending} okText="Save farm" destroyOnClose>
      <Form form={farmForm} layout="vertical" onFinish={values => saveFarm.mutate(values)}>
        <Row gutter={12}><Col span={8}><Form.Item name="code" label="Farm code" rules={[{ required: true }]}><Input placeholder="FARM-002" /></Form.Item></Col><Col span={16}><Form.Item name="name" label="Farm name" rules={[{ required: true }]}><Input placeholder="North Ridge Farm" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={14}><Form.Item name="location" label="Location"><Input placeholder="County · sub-county · area" /></Form.Item></Col><Col span={10}><Form.Item name="area_ha" label="Total acreage (ha)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Form.Item name="gps_boundary" label="GPS boundary · GeoJSON"><Input.TextArea rows={4} placeholder={'{"type":"Polygon","coordinates":[[[36.8,-1.2],[36.81,-1.2],[36.81,-1.21],[36.8,-1.2]]]}'} /></Form.Item>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
    <Modal title={`Add block · ${blockModal?.name || ''}`} open={!!blockModal} onCancel={() => setBlockModal(null)} onOk={() => blockForm.submit()} confirmLoading={saveBlock.isPending} okText="Add block" destroyOnClose>
      <Form form={blockForm} layout="vertical" onFinish={values => saveBlock.mutate({ farmId: blockModal.id, values })}>
        <Row gutter={12}><Col span={9}><Form.Item name="code" label="Block code" rules={[{ required: true }]}><Input placeholder="BLK-01" /></Form.Item></Col><Col span={15}><Form.Item name="name" label="Block name" rules={[{ required: true }]}><Input placeholder="Upper Valley" /></Form.Item></Col></Row>
        <Form.Item name="area_ha" label="Area (ha)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
    <Modal title={fieldModal?.id ? `Edit field · ${fieldModal.code}` : 'Register field'} open={!!fieldModal} onCancel={() => setFieldModal(null)} onOk={() => fieldForm.submit()} confirmLoading={saveField.isPending} width={720} okText="Save field" destroyOnClose>
      <Form form={fieldForm} layout="vertical" onFinish={values => saveField.mutate(values)}>
        <Row gutter={12}><Col span={12}><Form.Item name="farm_id" label="Farm" rules={[{ required: true }]}><Select placeholder="Select farm" onChange={() => fieldForm.setFieldValue('block_id', undefined)}>{farms.map(f => <Select.Option value={f.id} key={f.id}>{f.name}</Select.Option>)}</Select></Form.Item></Col><Col span={12}><Form.Item name="block_id" label="Block"><Select allowClear placeholder={detailFarmId ? 'Select block' : 'Select farm first'} disabled={!detailFarmId}>{blocks.map(b => <Select.Option value={b.id} key={b.id}>{b.code} · {b.name}</Select.Option>)}</Select></Form.Item></Col></Row>
        <Row gutter={12}><Col span={9}><Form.Item name="code" label="Unique field ID" rules={[{ required: true }]}><Input placeholder="NRF-B01-F03" /></Form.Item></Col><Col span={15}><Form.Item name="name" label="Field name" rules={[{ required: true }]}><Input placeholder="River Bench 03" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="area_ha" label="Area (ha)" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="soil_type" label="Soil type"><Input placeholder="Sandy loam" /></Form.Item></Col><Col span={8}><Form.Item name="location" label="Local description"><Input placeholder="Lower east slope" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={12}><Form.Item name="gps_lat" label="GPS latitude"><Input placeholder="-1.23456" /></Form.Item></Col><Col span={12}><Form.Item name="gps_lng" label="GPS longitude"><Input placeholder="36.12345" /></Form.Item></Col></Row>
        <Form.Item name="gps_boundary" label="Field boundary · GeoJSON"><Input.TextArea rows={3} placeholder={'{"type":"Polygon","coordinates":[...]}'} /></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
    <Modal title="Open crop cycle" open={cycleModal} onCancel={() => setCycleModal(false)} onOk={() => cycleForm.submit()} confirmLoading={saveCycle.isPending} width={720} okText="Start crop record" destroyOnClose>
      <Form form={cycleForm} layout="vertical" onFinish={values => saveCycle.mutate(values)}>
        <Row gutter={12}><Col span={12}><Form.Item name="field_id" label="Field" rules={[{ required: true }]}><Select showSearch optionFilterProp="children" placeholder="Choose field">{fields.map(f => <Select.Option value={f.id} key={f.id}>{f.code} · {f.name} · {f.farm_name}</Select.Option>)}</Select></Form.Item></Col><Col span={12}><Form.Item name="season_id" label="Season"><Select allowClear placeholder="Choose season">{seasons.map(s => <Select.Option value={s.id} key={s.id}>{s.name}</Select.Option>)}</Select></Form.Item></Col></Row>
        <Row gutter={12}><Col span={12}><Form.Item name="crop" label="Crop" rules={[{ required: true }]}><Input placeholder="Potato, maize, beans, horticulture…" /></Form.Item></Col><Col span={12}><Form.Item name="variety" label="Variety" rules={[{ required: true }]}><Input placeholder="Shangi, H614, Rosecoco…" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={12}><Form.Item name="seed_source" label="Seed source"><Input placeholder="G-Plex lot, supplier or farmer" /></Form.Item></Col><Col span={12}><Form.Item name="seed_batch_no" label="Seed batch / lot number"><Input placeholder="GP-26-041" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="land_prep_date" label="Land preparation"><Input type="date" /></Form.Item></Col><Col span={16}><Form.Item name="land_prep_machinery" label="Machinery used for preparation"><Input placeholder="Tractor TR-04 · plough" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="planting_date" label="Planting date" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col><Col span={8}><Form.Item name="spacing" label="Plant spacing"><Input placeholder="75 cm × 30 cm" /></Form.Item></Col><Col span={8}><Form.Item name="seed_rate" label="Seed rate"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="seed_rate_unit" label="Rate unit"><Input placeholder="kg/ha, bags/acre" /></Form.Item></Col><Col span={8}><Form.Item name="expected_harvest_date" label="Expected harvest"><Input type="date" /></Form.Item></Col><Col span={8}><Form.Item name="expected_yield" label="Expected yield"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="yield_unit" label="Yield unit"><Select options={['kg','tonnes','bags','crates'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="status" label="Cycle status"><Select options={[{ value: 'planned', label: 'Planned' }, { value: 'active', label: 'Active' }]} /></Form.Item></Col><Col span={8}><Form.Item name="notes" label="Notes"><Input /></Form.Item></Col></Row>
      </Form>
    </Modal>
    <Modal title={`Log field activity · ${activityModal?.ref_no || ''}`} open={!!activityModal} onCancel={() => setActivityModal(null)} onOk={() => activityForm.submit()} confirmLoading={saveActivity.isPending} width={760} okText="Save field record" destroyOnClose>
      <Form form={activityForm} layout="vertical" onFinish={values => saveActivity.mutate({ cycleId: activityModal.id, values })}>
        <Row gutter={12}><Col span={8}><Form.Item name="date" label="Activity date" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col><Col span={16}><Form.Item name="activity_type" label="Record type" rules={[{ required: true }]}><Select options={[
          ['land_preparation','Land preparation'],['fertiliser','Fertiliser application'],['chemical','Chemical application'],['irrigation','Irrigation'],['rainfall','Rainfall'],['scouting','Crop scouting'],['crop_health','Crop health observation'],['weeding','Weeding'],['planting','Planting'],['other','Other'],
        ].map(([value,label]) => ({ value,label }))} /></Form.Item></Col></Row>
        <Form.Item name="description" label="Activity / product description"><Input placeholder="Product, task or crop observation" /></Form.Item>
        {activeActivityType === 'chemical' && <Card size="small" style={{ marginBottom: 16, background: '#fff7e8', borderColor: '#f4d39c' }}>
          <Text strong style={{ color: '#8a5a18' }}>Record an authorised recommendation only</Text><br />
          <Text type="secondary">Enter the product-label rate and the qualified agronomist’s guidance reference. G-Plex does not calculate or prescribe pesticide rates.</Text>
          <Row gutter={12} style={{ marginTop: 12 }}><Col span={8}><Form.Item name="application_rate" label="Approved application rate" rules={[{ required: true }]}><InputNumber min={0.0001} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="application_rate_unit" label="Rate unit" rules={[{ required: true }]}><Input placeholder="L/ha, g/20 L" /></Form.Item></Col><Col span={8}><Form.Item name="target_pest" label="Target pest / issue"><Input placeholder="As in recommendation" /></Form.Item></Col></Row>
          <Row gutter={12}><Col span={12}><Form.Item name="recommendation_ref" label="Guidance / label reference" rules={[{ required: true }]}><Input placeholder="Recommendation or product-label reference" /></Form.Item></Col><Col span={6}><Form.Item name="authorised_by_name" label="Authoriser" rules={[{ required: true }]}><Input placeholder="Agronomist name" /></Form.Item></Col><Col span={6}><Form.Item name="authorised_by_qualification" label="Qualification" rules={[{ required: true }]}><Input placeholder="Qualification" /></Form.Item></Col></Row>
        </Card>}
        <Row gutter={12}><Col span={10}><Form.Item name="product_id" label="Input product"><Select allowClear showSearch optionFilterProp="children" placeholder="Optional inventory product">{products.map(p => <Select.Option value={p.id} key={p.id}>{p.name} · {p.sku}</Select.Option>)}</Select></Form.Item></Col><Col span={7}><Form.Item name="input_batch_no" label="Batch / lot"><Input /></Form.Item></Col><Col span={7}><Form.Item name="quantity" label="Quantity"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="warehouse_id" label="Store for field issue"><Select allowClear placeholder="Required to issue inventory">{warehouses.map(w => <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>)}</Select></Form.Item></Col><Col span={5}><Form.Item name="quantity_unit" label="Unit"><Input placeholder="kg, L, bags" /></Form.Item></Col><Col span={5}><Form.Item name="rainfall_mm" label="Rainfall (mm)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={6}><Form.Item name="input_cost" label="Input cost (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="workers" label="Worker count"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="labour_hours" label="Labour hours"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="labour_cost" label="Labour cost (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="asset_id" label="Machinery / asset"><Select allowClear placeholder="Optional machine">{assets.map(a => <Select.Option key={a.id} value={a.id}>{a.code} · {a.name}</Select.Option>)}</Select></Form.Item></Col><Col span={8}><Form.Item name="machinery_name" label="Other machine"><Input placeholder="If not registered" /></Form.Item></Col><Col span={4}><Form.Item name="machinery_hours" label="Machine hours"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={4}><Form.Item name="machinery_cost" label="Cost (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="severity" label="Observation severity"><Select allowClear options={['low','medium','high','critical'].map(value => ({ value,label: value }))} /></Form.Item></Col><Col span={16}><Form.Item name="observation" label="Scouting / crop-health observation"><Input placeholder="Pest, disease, moisture or crop condition" /></Form.Item></Col></Row>
        <Form.Item name="action_taken" label="Action taken / approved recommendation"><Input placeholder="Record agronomist-authorised response; do not infer chemical rates" /></Form.Item>
        <Row gutter={12}><Col span={12}><Form.Item name="other_cost" label="Other field cost (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="notes" label="Notes"><Input /></Form.Item></Col></Row>
      </Form>
    </Modal>
    <Modal title={`Record harvest · ${harvestModal?.crop || ''} ${harvestModal?.variety || ''}`} open={!!harvestModal} onCancel={() => setHarvestModal(null)} onOk={() => harvestForm.submit()} confirmLoading={saveHarvest.isPending} width={680} okText="Save harvest" destroyOnClose>
      <Form form={harvestForm} layout="vertical" onFinish={values => saveHarvest.mutate({ cycleId: harvestModal.id, values })}>
        <Row gutter={12}><Col span={8}><Form.Item name="harvest_date" label="Harvest date" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col><Col span={8}><Form.Item name="gross_qty" label="Gross quantity" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="unit" label="Unit"><Select options={['kg','tonnes','bags','crates'].map(value => ({ value,label: value }))} /></Form.Item></Col></Row>
        <Row gutter={12}>{[['grade_a_qty','Grade A'],['grade_b_qty','Grade B'],['grade_c_qty','Grade C'],['reject_qty','Rejected'],['loss_qty','Loss']].map(([name,label]) => <Col span={8} key={name}><Form.Item name={name} label={`${label} qty`}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>)}</Row>
        <Row gutter={12}><Col span={12}><Form.Item name="storage_location" label="Storage location"><Input placeholder="Store, bin or cold room" /></Form.Item></Col><Col span={12}><Form.Item name="warehouse_id" label="ERP warehouse"><Select allowClear placeholder="Link to store">{warehouses.map(w => <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>)}</Select></Form.Item></Col></Row>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
    <Modal title={`Record sale · ${saleModal?.ref_no || ''}`} open={!!saleModal} onCancel={() => setSaleModal(null)} onOk={() => saleForm.submit()} confirmLoading={saveSale.isPending} okText="Save sale" destroyOnClose>
      <Form form={saleForm} layout="vertical" onFinish={values => saveSale.mutate({ harvestId: saleModal.id, values })}>
        <Form.Item name="sale_date" label="Sale date" rules={[{ required: true }]}><Input type="date" /></Form.Item>
        <Form.Item name="customer_name" label="Buyer / market"><Input placeholder="Customer or market name" /></Form.Item>
        <Row gutter={12}><Col span={8}><Form.Item name="qty" label="Quantity" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="unit" label="Unit"><Input /></Form.Item></Col><Col span={8}><Form.Item name="unit_price" label="Unit price · KES"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={12}><Form.Item name="sale_ref" label="Sale / delivery reference"><Input /></Form.Item></Col><Col span={12}><Form.Item name="invoice_id" label="ERP invoice ID"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>

    <Drawer title={detail ? `${detail.ref_no} · ${detail.crop} ${detail.variety}` : 'Crop cycle history'} open={!!recordDrawer} onClose={() => setRecordDrawer(null)} width={900}>
      {detail && <>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Field">{detail.field_code} · {detail.field_name}</Descriptions.Item><Descriptions.Item label="Farm / block">{detail.farm_name} · {detail.block_name || 'No block'}</Descriptions.Item>
          <Descriptions.Item label="Crop / variety">{detail.crop} · {detail.variety}</Descriptions.Item><Descriptions.Item label="Season">{detail.season_name || 'Unassigned'}</Descriptions.Item>
          <Descriptions.Item label="Seed source / batch">{detail.seed_source || '—'} · {detail.seed_batch_no || '—'}</Descriptions.Item><Descriptions.Item label="Planting / expected harvest">{detail.planting_date} · {detail.expected_harvest_date || '—'}</Descriptions.Item>
          <Descriptions.Item label="Spacing / rate">{detail.spacing || '—'} · {detail.seed_rate || '—'} {detail.seed_rate_unit || ''}</Descriptions.Item><Descriptions.Item label="Expected yield">{detail.expected_yield || '—'} {detail.yield_unit}</Descriptions.Item>
          <Descriptions.Item label="Land prep">{detail.land_prep_date || '—'} · {detail.land_prep_machinery || '—'}</Descriptions.Item><Descriptions.Item label="Actual cost">{money(detail.actual_cost)}</Descriptions.Item>
          <Descriptions.Item label="Harvested / losses">{Number(detail.harvested_qty || 0).toLocaleString()} / {Number(detail.loss_qty || 0).toLocaleString()} {detail.yield_unit}</Descriptions.Item><Descriptions.Item label="Recorded sales">{money(detail.sales_amount)}</Descriptions.Item>
        </Descriptions>
        <Space wrap style={{ marginBottom: 18 }}><Button icon={<PlusOutlined />} onClick={() => openActivity(detail)}>Log field activity</Button><Button type="primary" icon={<GoldOutlined />} onClick={() => openHarvest(detail)}>Record harvest</Button></Space>
        <Title level={5}>Field work, inputs, weather & labour</Title>
        <Table rowKey="id" size="small" dataSource={detail.activities || []} columns={activityColumns} pagination={{ pageSize: 5 }} scroll={{ x: 950 }} locale={{ emptyText: 'No field records yet' }} />
        <Title level={5} style={{ marginTop: 24 }}>Harvests, grading, storage & sales</Title>
        <Table rowKey="id" size="small" dataSource={detail.harvests || []} columns={harvestColumns} pagination={{ pageSize: 5 }} scroll={{ x: 1050 }} locale={{ emptyText: 'No harvest entries yet' }} />
        {(detail.harvests || []).some(h => h.sales?.length) && <Timeline style={{ marginTop: 16 }}>{detail.harvests.flatMap(h => (h.sales || []).map(s => ({ ...s, harvest_ref: h.ref_no }))).map(sale => <Timeline.Item key={sale.id}><Text strong>{sale.sale_date}</Text> · {sale.qty} {sale.unit} to {sale.customer_name || 'buyer'} · {money(sale.total_amount)} <Text type="secondary">({sale.harvest_ref})</Text></Timeline.Item>)}</Timeline>}
      </>}
      {!detail && !detailQ.isLoading && <Empty description="Crop cycle record unavailable" />}
    </Drawer>
  </div>;
}
