import React, { useState, useMemo } from 'react';
import {
  Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Typography, message, Card, Row, Col,
  Statistic, Drawer, Descriptions, Tabs, Steps, Progress, Alert, DatePicker, Empty, Collapse,
} from 'antd';
import { PlusOutlined, FilePdfOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { generateContractReportPDF } from '../utils/contractPdf.js';
import { parseDbDate } from '../utils/feedbackPdf.js';

const { Title, Text } = Typography;
const { TextArea } = Input;
const kes = (n) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const kgFmt = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
const STATUS_COLOR = { draft: 'default', active: 'blue', harvesting: 'gold', settled: 'purple', closed: 'green', cancelled: 'red' };
const STEP_INDEX = { draft: 0, active: 2, harvesting: 4, settled: 5, closed: 6, cancelled: 0 };
const ymd = (d) => (d ? d.format('YYYY-MM-DD') : undefined);

export default function ContractFarming() {
  const qc = useQueryClient();
  const { user, permissions } = useAuthStore();
  const role = user?.role;
  const canEdit = permissions?.contracts === 'edit';
  const canApprove = ['admin', 'managing_director', 'farm_manager'].includes(role);
  const canSettle = ['admin', 'managing_director', 'accountant'].includes(role);
  const canPay = ['admin', 'accountant'].includes(role);
  const canClose = ['admin', 'managing_director', 'farm_manager', 'accountant'].includes(role);

  const [filters, setFilters] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState('');
  const [createForm] = Form.useForm();
  const [dialogForm] = Form.useForm();
  const clean = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), [filters]);

  const { data: listRes, isLoading } = useQuery({ queryKey: ['contracts', clean], queryFn: () => api.get('/contracts', { params: clean }) });
  const { data: alertRes } = useQuery({ queryKey: ['contractAlerts'], queryFn: () => api.get('/contracts/alerts') });
  const { data: metaRes } = useQuery({ queryKey: ['contractMeta'], queryFn: () => api.get('/contracts/meta') });
  const { data: growersRes } = useQuery({ queryKey: ['contractGrowers'], queryFn: () => api.get('/growers', { params: { status: 'active' } }), enabled: createOpen });
  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['contract', selectedId], queryFn: () => api.get(`/contracts/${selectedId}`), enabled: !!selectedId,
  });

  const contracts = listRes?.data || [];
  const kpi = listRes?.kpi || {};
  const alerts = alertRes?.data;
  const meta = metaRes?.data || { grades: [], methods: [] };
  const c = detailRes?.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['contracts'] });
    qc.invalidateQueries({ queryKey: ['contractAlerts'] });
    qc.invalidateQueries({ queryKey: ['contract'] });
  };

  const run = useMutation({
    mutationFn: ({ method = 'post', path, body }) => api[method](path, body || {}),
    onSuccess: (res, vars) => { message.success(vars.ok || res.message || 'Saved'); setDialog(''); dialogForm.resetFields(); refresh(); },
    onError: (e) => message.error(e.message),
  });
  const create = useMutation({
    mutationFn: (v) => api.post('/contracts', { ...v, planting_date: ymd(v.planting_date), expected_harvest_date: ymd(v.expected_harvest_date) }),
    onSuccess: (res) => { message.success(`Contract ${res.data.contract_no} created. Record an inspection, then approve it.`); setCreateOpen(false); createForm.resetFields(); refresh(); setSelectedId(res.data.id); },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Contract', dataIndex: 'contract_no', width: 130, render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Farmer', dataIndex: 'grower_name', render: (v, r) => <div>{v}<br /><Text type="secondary" style={{ fontSize: 12 }}>{r.grower_code}</Text></div> },
    { title: 'Crop', dataIndex: 'crop', render: (v, r) => `${v}${r.variety ? ` · ${r.variety}` : ''}`, responsive: ['md'] },
    { title: 'Acres', dataIndex: 'contracted_acres', width: 80, responsive: ['lg'], render: (v, r) => r.verified_acres || v },
    { title: 'Delivered', dataIndex: 'accepted_kg', width: 110, responsive: ['lg'], render: kgFmt },
    { title: 'Harvest due', dataIndex: 'expected_harvest_date', width: 110, responsive: ['xl'], render: (v) => v || '-' },
    { title: 'Owed', dataIndex: 'balance_due', width: 110, responsive: ['xl'], render: (v) => (v == null ? '-' : kes(v)) },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
  ];

  const alertGroups = alerts ? [
    { key: 'h', label: 'Approaching harvest', items: alerts.approaching_harvest },
    { key: 'v', label: 'Overdue farmer visits', items: alerts.overdue_visits },
    { key: 'i', label: 'Input over-issuance', items: alerts.over_issuance },
    { key: 'u', label: 'Unpaid farmer balances', items: alerts.unpaid_balances },
  ].filter((g) => g.items.length) : [];

  const openDialog = (name, initial = {}) => { dialogForm.resetFields(); dialogForm.setFieldsValue(initial); setDialog(name); };
  const submitDialog = (v) => {
    const id = c.id;
    const dates = { visit_date: ymd(v.visit_date), next_visit_date: ymd(v.next_visit_date), delivery_date: ymd(v.delivery_date), payment_date: ymd(v.payment_date) };
    const body = { ...v, ...Object.fromEntries(Object.entries(dates).filter(([, d]) => d)) };
    const map = {
      visit: { path: `/contracts/${id}/visits`, ok: 'Visit recorded' },
      delivery: { path: `/contracts/${id}/deliveries`, ok: 'Delivery recorded' },
      settle: { path: `/contracts/${id}/settle`, ok: 'Contract settled' },
      payment: { path: `/contracts/${id}/payments`, ok: 'Payment recorded' },
      cancel: { path: `/contracts/${id}/cancel`, ok: 'Contract cancelled' },
    }[dialog];
    run.mutate({ ...map, body });
  };

  const gross = c?.gross_value || 0;
  const outstanding = Number(c?.grower_credit_balance || 0);
  const suggestedRecovery = Math.min(gross, outstanding);

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>Contract Farming</Title>
          <Text type="secondary">Contract each farmer, inspect, approve, monitor, record deliveries, settle and close the season.</Text>
        </div>
        {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>New contract</Button>}
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Live contracts" value={kpi.active || 0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Contracted acres (live)" value={kpi.acres || 0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Expected yield (live)" value={kpi.expected_kg || 0} suffix="kg" /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Owed to farmers" value={kpi.owed_to_farmers || 0} prefix="KES" valueStyle={{ color: kpi.owed_to_farmers ? '#cf1322' : undefined }} /></Card></Col>
      </Row>

      {alerts && alerts.total > 0 && (
        <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }}
          message={`${alerts.total} item(s) need attention`}
          description={<Collapse ghost size="small" items={alertGroups.map((g) => ({
            key: g.key, label: `${g.label} (${g.items.length})`,
            children: g.items.map((a, i) => <div key={i}><a onClick={() => setSelectedId(a.id)}>{a.contract_no}</a> · {a.grower_name} — {a.message}</div>),
          }))} />} />
      )}

      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search contract, farmer, crop" style={{ width: 260 }} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <Select allowClear placeholder="Status" style={{ width: 150 }} options={Object.keys(STATUS_COLOR).map((v) => ({ value: v, label: v }))} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
      </Space>
      <Table rowKey="id" loading={isLoading} columns={columns} dataSource={contracts} scroll={{ x: 700 }} pagination={{ pageSize: 15, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="No contracts yet. Register the farmer under Contract Growers first, then create a contract." /> }} />

      <Modal title="New farmer contract" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={create.isPending} okText="Create draft" width={680} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item name="grower_id" label="Farmer (must be registered and active)" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Search farmer" options={(growersRes?.data || []).map((g) => ({ value: g.id, label: `${g.code} - ${g.name}` }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={8}><Form.Item name="crop" label="Crop" rules={[{ required: true }]}><Input placeholder="e.g. Potato" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="variety" label="Variety"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="season" label="Season"><Input placeholder="e.g. Long Rains 2026" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="contracted_acres" label="Contracted acres" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="planting_date" label="Planting date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="expected_harvest_date" label="Expected harvest"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="expected_yield_kg" label="Expected yield (kg)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="agreed_price_per_kg" label="Agreed price per kg (KES)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="input_budget" label="Input budget (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="production_budget" label="Production budget (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="terms" label="Production requirements / terms"><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={c ? `${c.contract_no} · ${c.grower_name}` : 'Contract'} open={!!selectedId} onClose={() => setSelectedId(null)} width={760} loading={detailLoading}
        extra={c && <Button icon={<FilePdfOutlined />} onClick={() => generateContractReportPDF(c)}>Season report</Button>}>
        {c && (
          <>
            <Steps size="small" current={STEP_INDEX[c.status]} status={c.status === 'cancelled' ? 'error' : undefined} style={{ marginBottom: 16 }}
              items={[{ title: 'Drafted' }, { title: 'Inspected' }, { title: 'Approved' }, { title: 'Monitoring' }, { title: 'Harvest' }, { title: 'Settled' }, { title: 'Closed' }]} />
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag color={STATUS_COLOR[c.status]}>{c.status}</Tag>
              {c.status === 'draft' && canApprove && <Button type="primary" loading={run.isPending} onClick={() => run.mutate({ path: `/contracts/${c.id}/approve`, ok: 'Contract approved' })}>Approve contract</Button>}
              {['draft', 'active'].includes(c.status) && canApprove && <Button danger onClick={() => openDialog('cancel')}>Cancel</Button>}
              {c.status === 'settled' && canClose && <Button type="primary" onClick={() => run.mutate({ path: `/contracts/${c.id}/close`, ok: 'Contract closed' })}>Close contract</Button>}
            </Space>
            <Tabs items={[
              {
                key: 'overview', label: 'Overview',
                children: (
                  <>
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="Farmer">{c.grower_name} ({c.grower_code})</Descriptions.Item>
                      <Descriptions.Item label="Phone / ID">{c.grower_phone || '-'} / {c.grower_national_id || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Crop">{c.crop}{c.variety ? ` · ${c.variety}` : ''}</Descriptions.Item>
                      <Descriptions.Item label="Season">{c.season || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Acres">{c.contracted_acres} contracted{c.verified_acres ? ` · ${c.verified_acres} verified` : ''}</Descriptions.Item>
                      <Descriptions.Item label="Price">{kes(c.agreed_price_per_kg)} / kg</Descriptions.Item>
                      <Descriptions.Item label="Planting">{c.planting_date || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Expected harvest">{c.expected_harvest_date || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Production budget">{kes(c.production_budget)}</Descriptions.Item>
                      <Descriptions.Item label="Input budget">{kes(c.input_budget)}</Descriptions.Item>
                      <Descriptions.Item label="Terms" span={2}>{c.terms || '-'}</Descriptions.Item>
                      {c.cancel_reason && <Descriptions.Item label="Cancelled because" span={2}>{c.cancel_reason}</Descriptions.Item>}
                    </Descriptions>
                    <div style={{ marginTop: 16 }}>
                      <Text strong>Produce delivered vs expected</Text>
                      <Progress percent={c.expected_yield_kg > 0 ? Math.min(100, Math.round((c.accepted_kg / c.expected_yield_kg) * 100)) : 0} />
                      <Text type="secondary">{kgFmt(c.accepted_kg)} accepted of {kgFmt(c.expected_yield_kg)} expected{c.yield_per_acre_kg ? ` · ${kgFmt(c.yield_per_acre_kg)} per acre` : ''}</Text>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <Text strong>Inputs issued vs approved budget</Text>
                      <Progress status={c.inputs_over_budget ? 'exception' : 'normal'} percent={c.input_budget > 0 ? Math.min(100, Math.round((c.inputs_value / c.input_budget) * 100)) : 0} />
                      <Text type={c.inputs_over_budget ? 'danger' : 'secondary'}>{kes(c.inputs_value)} issued of {kes(c.input_budget)} budget{c.inputs_over_budget ? ' — OVER BUDGET' : ''}</Text>
                    </div>
                  </>
                ),
              },
              {
                key: 'visits', label: `Visits (${c.visits.length})`,
                children: (
                  <>
                    {canEdit && !['settled', 'closed', 'cancelled'].includes(c.status) && <Button icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openDialog('visit', { visit_type: c.status === 'draft' ? 'inspection' : 'field_visit' })}>Record inspection / visit</Button>}
                    <Table size="small" rowKey="id" pagination={false} dataSource={c.visits} columns={[
                      { title: 'Date', dataIndex: 'visit_date', width: 100 },
                      { title: 'Type', dataIndex: 'visit_type', width: 110, render: (v) => String(v).replace('_', ' ') },
                      { title: 'Officer', dataIndex: 'officer', width: 110 },
                      { title: 'Acres', dataIndex: 'acres_verified', width: 70, render: (v) => v ?? '-' },
                      { title: 'Stage / findings', render: (_, r) => <div>{r.crop_stage}<br /><Text type="secondary">{r.findings}</Text></div> },
                    ]} />
                  </>
                ),
              },
              {
                key: 'inputs', label: `Inputs (${c.inputs.length})`,
                children: (
                  <>
                    <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Inputs are issued on farmer credit through Point of Sale. They appear here automatically after the contract is approved and are compared with the input budget." />
                    <Table size="small" rowKey="id" pagination={false} dataSource={c.inputs} columns={[
                      { title: 'Reference', dataIndex: 'ref_no' },
                      { title: 'Date', dataIndex: 'created_at', render: (v) => parseDbDate(v)?.toLocaleDateString() },
                      { title: 'Value', dataIndex: 'total', render: kes },
                      { title: 'Due', dataIndex: 'due_date', render: (v) => v || '-' },
                    ]} />
                  </>
                ),
              },
              {
                key: 'deliveries', label: `Deliveries (${c.deliveries.length})`,
                children: (
                  <>
                    {canEdit && ['active', 'harvesting'].includes(c.status) && <Button icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openDialog('delivery', { price_per_kg: c.agreed_price_per_kg, rejected_kg: 0 })}>Record delivery</Button>}
                    <Table size="small" rowKey="id" pagination={false} dataSource={c.deliveries} columns={[
                      { title: 'Date', dataIndex: 'delivery_date', width: 100 },
                      { title: 'Delivered', dataIndex: 'quantity_kg', render: kgFmt },
                      { title: 'Rejected', dataIndex: 'rejected_kg', render: kgFmt },
                      { title: 'Grade', dataIndex: 'grade', width: 70, render: (v) => v || '-' },
                      { title: 'Price/kg', dataIndex: 'price_per_kg', render: kes },
                      { title: 'Value', dataIndex: 'gross_value', render: kes },
                    ]} />
                  </>
                ),
              },
              {
                key: 'settlement', label: 'Settlement',
                children: c.settlement ? (
                  <>
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="Value of produce accepted">{kes(c.settlement.gross_value)}</Descriptions.Item>
                      <Descriptions.Item label="Less: input credit recovered">{kes(c.settlement.input_recovery)}{c.settlement.credit_payment_ref ? ` (${c.settlement.credit_payment_ref})` : ''}</Descriptions.Item>
                      <Descriptions.Item label="Less: other deductions">{kes(c.settlement.other_deductions)}{c.settlement.other_deductions_note ? ` — ${c.settlement.other_deductions_note}` : ''}</Descriptions.Item>
                      <Descriptions.Item label="Net payable to farmer"><Text strong>{kes(c.settlement.net_payable)}</Text></Descriptions.Item>
                      <Descriptions.Item label="Paid so far">{kes(c.paid)}</Descriptions.Item>
                      <Descriptions.Item label="Balance due"><Text strong type={c.balance_due > 0 ? 'danger' : 'success'}>{kes(c.balance_due)}</Text></Descriptions.Item>
                    </Descriptions>
                    {c.status === 'settled' && canPay && c.balance_due > 0 && <Button type="primary" style={{ margin: '12px 0' }} onClick={() => openDialog('payment', { amount: c.balance_due, method: 'mpesa' })}>Record payment to farmer</Button>}
                    <Table size="small" rowKey="id" pagination={false} style={{ marginTop: 8 }} dataSource={c.payments} columns={[
                      { title: 'Ref', dataIndex: 'ref_no' }, { title: 'Date', dataIndex: 'payment_date' }, { title: 'Method', dataIndex: 'method' },
                      { title: 'Amount', dataIndex: 'amount', render: kes }, { title: 'Reference', dataIndex: 'reference', render: (v) => v || '-' },
                    ]} />
                  </>
                ) : (
                  <>
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="Value of produce accepted so far">{kes(gross)}</Descriptions.Item>
                      <Descriptions.Item label="Farmer's outstanding input credit">{kes(outstanding)}</Descriptions.Item>
                      <Descriptions.Item label="Suggested recovery from this harvest">{kes(suggestedRecovery)}</Descriptions.Item>
                    </Descriptions>
                    {['active', 'harvesting'].includes(c.status) && canSettle
                      ? <Button type="primary" style={{ marginTop: 12 }} disabled={!(c.accepted_kg > 0)} onClick={() => openDialog('settle', { input_recovery: suggestedRecovery, other_deductions: 0 })}>Calculate and settle</Button>
                      : <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>Settlement is done by the accountant, managing director or administrator after deliveries are recorded.</Text>}
                  </>
                ),
              },
            ]} />
          </>
        )}
      </Drawer>

      <Modal open={!!dialog} onCancel={() => setDialog('')} onOk={() => dialogForm.submit()} confirmLoading={run.isPending} destroyOnClose width={560}
        title={{ visit: 'Record inspection / field visit', delivery: 'Record delivery', settle: 'Settle contract', payment: 'Record payment to farmer', cancel: 'Cancel contract' }[dialog]}>
        <Form form={dialogForm} layout="vertical" onFinish={submitDialog}>
          {dialog === 'visit' && (<>
            <Row gutter={12}>
              <Col span={12}><Form.Item name="visit_type" label="Type"><Select options={[{ value: 'inspection', label: 'Farm inspection (verifies acreage)' }, { value: 'field_visit', label: 'Field visit' }, { value: 'pre_harvest', label: 'Pre-harvest check' }]} /></Form.Item></Col>
              <Col span={12}><Form.Item name="visit_date" label="Date (blank = today)"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="acres_verified" label="Verified acres (required for inspection)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="estimated_yield_kg" label="Estimated yield (kg)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="crop_stage" label="Crop stage"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="next_visit_date" label="Next visit"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Form.Item name="findings" label="Findings"><TextArea rows={3} /></Form.Item>
          </>)}
          {dialog === 'delivery' && (<Row gutter={12}>
            <Col span={12}><Form.Item name="delivery_date" label="Date (blank = today)"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="grade" label="Grade"><Select allowClear options={meta.grades.map((g) => ({ value: g, label: g }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="quantity_kg" label="Quantity delivered (kg)" rules={[{ required: true }]}><InputNumber min={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="rejected_kg" label="Rejected (kg)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="price_per_kg" label="Price per kg (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes"><Input /></Form.Item></Col>
          </Row>)}
          {dialog === 'settle' && (<>
            <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`Produce value ${kes(gross)} · outstanding input credit ${kes(outstanding)}`} />
            <Form.Item name="input_recovery" label="Recover input credit from this harvest (KES)" extra="Recorded in the farmer credit ledger as a harvest recovery."><InputNumber min={0} max={outstanding} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="other_deductions" label="Other deductions (KES)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="other_deductions_note" label="Reason for other deductions"><Input /></Form.Item>
            <Form.Item name="notes" label="Notes"><Input /></Form.Item>
          </>)}
          {dialog === 'payment' && (<Row gutter={12}>
            <Col span={12}><Form.Item name="amount" label="Amount (KES)" rules={[{ required: true }]}><InputNumber min={0.01} max={c?.balance_due} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="method" label="Method"><Select options={meta.methods.map((m) => ({ value: m, label: m }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="payment_date" label="Date (blank = today)"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="reference" label="Reference (e.g. M-Pesa code)"><Input /></Form.Item></Col>
          </Row>)}
          {dialog === 'cancel' && <Form.Item name="reason" label="Reason for cancelling" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>}
        </Form>
      </Modal>
    </div>
  );
}
