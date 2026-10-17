import React, { useState, useMemo } from 'react';
import {
  Table, Button, Input, Select, Space, Tag, Modal, Form, Rate, Typography, message, Card, Row, Col,
  Statistic, Tabs, Drawer, Timeline, Descriptions, Empty, DatePicker,
} from 'antd';
import { PlusOutlined, FilePdfOutlined, SearchOutlined, MessageOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import api from '../api/client.js';
import { generateTicketPDF, generateExecutivePDF, parseDbDate } from '../utils/feedbackPdf.js';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PRIORITY_COLOR = { Urgent: 'red', High: 'orange', Medium: 'blue', Low: 'default' };
const STATUS_COLOR = { Open: 'red', 'In Progress': 'gold', Resolved: 'green', Closed: 'default' };
const dt = (v) => { const d = parseDbDate(v); return d ? d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'; };

export default function Feedback() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [createForm] = Form.useForm();
  const [updateForm] = Form.useForm();
  const [noteText, setNoteText] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const clean = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== null)), [filters]);

  const { data: meta } = useQuery({ queryKey: ['feedbackMeta'], queryFn: () => api.get('/feedback/meta') });
  const { data: summaryRes } = useQuery({ queryKey: ['feedbackSummary'], queryFn: () => api.get('/feedback/summary') });
  const { data: listRes, isLoading } = useQuery({ queryKey: ['feedbackList', clean], queryFn: () => api.get('/feedback', { params: clean }) });
  const { data: customersRes } = useQuery({
    queryKey: ['feedbackCustomers', customerSearch],
    queryFn: () => api.get('/customers', { params: { search: customerSearch, limit: 20 } }),
    enabled: createOpen,
  });
  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['feedbackTicket', selectedId],
    queryFn: () => api.get(`/feedback/${selectedId}`),
    enabled: !!selectedId,
  });

  const options = meta?.data || { categories: [], statuses: [], priorities: [], departments: [] };
  const summary = summaryRes?.data;
  const tickets = listRes?.data || [];
  const ticket = detailRes?.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['feedbackList'] });
    qc.invalidateQueries({ queryKey: ['feedbackSummary'] });
    qc.invalidateQueries({ queryKey: ['feedbackTicket'] });
  };

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/feedback', {
      ...values,
      incident_date: values.incident_date ? values.incident_date.format('YYYY-MM-DD') : undefined,
    }),
    onSuccess: (res) => {
      message.success(`Ticket ${res.data.ticket_no} logged`);
      setCreateOpen(false);
      createForm.resetFields();
      refresh();
    },
    onError: (e) => message.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (values) => api.patch(`/feedback/${selectedId}`, values),
    onSuccess: () => { message.success('Ticket updated'); refresh(); },
    onError: (e) => message.error(e.message),
  });

  const noteMutation = useMutation({
    mutationFn: (note) => api.post(`/feedback/${selectedId}/notes`, { note }),
    onSuccess: () => { setNoteText(''); refresh(); },
    onError: (e) => message.error(e.message),
  });

  const openTicket = (row) => {
    setSelectedId(row.id);
    updateForm.setFieldsValue({
      status: row.status, priority: row.priority, assigned_dept: row.assigned_dept || undefined,
      assigned_to: row.assigned_to || '', resolution_notes: row.resolution_notes || '',
    });
  };

  const columns = [
    { title: 'Ticket', dataIndex: 'ticket_no', width: 130, render: (v, r) => <a onClick={() => openTicket(r)}>{v}</a> },
    { title: 'Customer', dataIndex: 'customer_name' },
    { title: 'Subject', dataIndex: 'title', ellipsis: true },
    { title: 'Category', dataIndex: 'category', responsive: ['lg'] },
    { title: 'CSAT', dataIndex: 'rating', width: 140, render: (v) => <Rate disabled value={v} style={{ fontSize: 14 }} /> },
    { title: 'Priority', dataIndex: 'priority', width: 90, render: (v) => <Tag color={PRIORITY_COLOR[v]}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
    { title: 'Dept', dataIndex: 'assigned_dept', responsive: ['xl'], render: (v) => v || <Text type="secondary">Unassigned</Text> },
    { title: 'Logged', dataIndex: 'created_at', width: 120, responsive: ['md'], render: (v) => parseDbDate(v)?.toLocaleDateString() || '-' },
  ];

  const filtersLabel = Object.keys(clean).length ? `Filtered: ${Object.entries(clean).map(([k, v]) => `${k}=${v}`).join(', ')}` : 'All tickets';

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>Customer Feedback &amp; CSAT</Title>
          <Text type="secondary">Log complaints and feedback, assign them, track resolution and measure satisfaction.</Text>
        </div>
        <Space wrap>
          <Button icon={<FilePdfOutlined />} disabled={!summary || !summary.total} onClick={() => generateExecutivePDF(summary, tickets, filtersLabel)}>
            CSAT report (PDF)
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); createForm.setFieldsValue({ priority: 'Medium', rating: 3 }); setCreateOpen(true); }}>
            New ticket
          </Button>
        </Space>
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Total tickets" value={summary?.total || 0} /></Card></Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Open / in progress" value={(summary?.open || 0) + (summary?.in_progress || 0)} /></Card></Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Urgent unresolved" value={summary?.urgent_open || 0} valueStyle={{ color: summary?.urgent_open ? '#cf1322' : undefined }} /></Card></Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Average CSAT" value={summary?.avg_rating || 0} precision={1} suffix="/ 5" /></Card></Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Resolution rate" value={summary?.resolution_rate || 0} suffix="%" /></Card></Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Avg resolution" value={summary?.avg_resolution_hours ?? '-'} suffix={summary?.avg_resolution_hours != null ? 'hrs' : ''} /></Card></Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'tickets',
            label: 'Tickets',
            children: (
              <>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Input allowClear prefix={<SearchOutlined />} placeholder="Search ticket, customer, subject" style={{ width: 260 }}
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
                  <Select allowClear placeholder="Status" style={{ width: 130 }} options={options.statuses.map((v) => ({ value: v, label: v }))} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                  <Select allowClear placeholder="Priority" style={{ width: 120 }} options={options.priorities.map((v) => ({ value: v, label: v }))} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} />
                  <Select allowClear placeholder="Category" style={{ width: 180 }} options={options.categories.map((v) => ({ value: v, label: v }))} onChange={(v) => setFilters((f) => ({ ...f, category: v }))} />
                  <Select allowClear placeholder="Department" style={{ width: 200 }} options={options.departments.map((v) => ({ value: v, label: v }))} onChange={(v) => setFilters((f) => ({ ...f, dept: v }))} />
                  <Select allowClear placeholder="Rating" style={{ width: 100 }} options={[5, 4, 3, 2, 1].map((v) => ({ value: v, label: `${v} star` }))} onChange={(v) => setFilters((f) => ({ ...f, rating: v }))} />
                </Space>
                <Table rowKey="id" size="middle" loading={isLoading} columns={columns} dataSource={tickets} scroll={{ x: 800 }} pagination={{ pageSize: 15, showSizeChanger: false }} />
              </>
            ),
          },
          {
            key: 'dashboard',
            label: 'CSAT dashboard',
            children: !summary || !summary.total ? <Empty description="Log some tickets to see CSAT figures." /> : (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card size="small" title="Rating distribution">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={summary.distribution.map((d) => ({ ...d, label: `${d.rating} star` }))}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip />
                        <Bar dataKey="count" name="Tickets" fill="#3a7d44" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card size="small" title="Average CSAT by category">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={summary.by_category} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 5]} /><YAxis type="category" dataKey="category" width={130} /><Tooltip />
                        <Bar dataKey="avg_rating" name="Avg rating" fill="#153d2d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card size="small" title="Monthly volume and CSAT">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={summary.trend}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis yAxisId="l" allowDecimals={false} /><YAxis yAxisId="r" orientation="right" domain={[0, 5]} /><Tooltip /><Legend />
                        <Line yAxisId="l" type="monotone" dataKey="total" name="Tickets" stroke="#3a7d44" />
                        <Line yAxisId="r" type="monotone" dataKey="avg_rating" name="Avg CSAT" stroke="#d48806" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card size="small" title="By department">
                    <Table size="small" rowKey="department" pagination={false} dataSource={summary.by_department}
                      columns={[
                        { title: 'Department', dataIndex: 'department' },
                        { title: 'Tickets', dataIndex: 'total', width: 80 },
                        { title: 'Resolved', dataIndex: 'resolved', width: 90 },
                      ]} />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal title="Log feedback / complaint" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending} okText="Log ticket" width={640} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="customer_id" label="Existing customer (optional)">
            <Select showSearch allowClear filterOption={false} placeholder="Search customer directory" onSearch={setCustomerSearch}
              options={(customersRes?.data || []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}`, c }))}
              onChange={(_, opt) => { if (opt?.c) createForm.setFieldsValue({ customer_name: opt.c.name, email: opt.c.email || '', phone: opt.c.phone || '' }); }} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="customer_name" label="Customer name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="incident_date" label="Incident date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={options.categories.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="rating" label="CSAT rating" rules={[{ required: true }]}><Rate /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="priority" label="Priority"><Select options={options.priorities.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="assigned_dept" label="Department"><Select allowClear options={options.departments.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="assigned_to" label="Assigned to"><Input /></Form.Item></Col>
            <Col xs={24}><Form.Item name="title" label="Subject" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24}><Form.Item name="description" label="Details"><TextArea rows={4} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Drawer title={ticket ? `${ticket.ticket_no} - ${ticket.title}` : 'Ticket'} open={!!selectedId} onClose={() => setSelectedId(null)} width={560} loading={detailLoading}
        extra={ticket && <Button icon={<FilePdfOutlined />} onClick={() => generateTicketPDF(ticket)}>PDF</Button>}>
        {ticket && (
          <>
            <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Customer">{ticket.customer_name}{ticket.email ? ` · ${ticket.email}` : ''}{ticket.phone ? ` · ${ticket.phone}` : ''}</Descriptions.Item>
              <Descriptions.Item label="Category">{ticket.category}</Descriptions.Item>
              <Descriptions.Item label="CSAT"><Rate disabled value={ticket.rating} /></Descriptions.Item>
              <Descriptions.Item label="Logged">{dt(ticket.created_at)}</Descriptions.Item>
              {ticket.resolution_date && <Descriptions.Item label="Resolved">{dt(ticket.resolution_date)}</Descriptions.Item>}
              <Descriptions.Item label="Details">{ticket.description || <Text type="secondary">None</Text>}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>Update ticket</Title>
            <Form form={updateForm} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="status" label="Status"><Select options={options.statuses.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
                <Col span={12}><Form.Item name="priority" label="Priority"><Select options={options.priorities.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
                <Col span={12}><Form.Item name="assigned_dept" label="Department"><Select allowClear options={options.departments.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
                <Col span={12}><Form.Item name="assigned_to" label="Assigned to"><Input /></Form.Item></Col>
              </Row>
              <Form.Item name="resolution_notes" label="Resolution notes (required to resolve or close)"><TextArea rows={3} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>Save changes</Button>
            </Form>

            <Title level={5} style={{ marginTop: 24 }}>Notes and history</Title>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add an investigation note" onPressEnter={() => noteText.trim() && noteMutation.mutate(noteText)} />
              <Button icon={<MessageOutlined />} loading={noteMutation.isPending} onClick={() => noteText.trim() && noteMutation.mutate(noteText)}>Add</Button>
            </Space.Compact>
            <Timeline items={[...(ticket.notes || [])].reverse().map((n) => ({
              children: <div><Text strong>{n.author}</Text> <Text type="secondary" style={{ fontSize: 12 }}>{dt(n.created_at)}</Text><div>{n.note}</div></div>,
            }))} />
          </>
        )}
      </Drawer>
    </div>
  );
}
