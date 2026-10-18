import React, { useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, TeamOutlined, ClockCircleOutlined, DollarOutlined, SafetyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const { Title, Text } = Typography;
const today = () => dayjs().format('YYYY-MM-DD');
const money = value => `KES ${Number(value || 0).toLocaleString()}`;

export default function Staff() {
  const [dialog, setDialog] = useState('');
  const [payroll, setPayroll] = useState(null);
  const { user, permissions } = useAuthStore();
  const canSeePayroll = !!permissions && permissions.payroll !== 'none';
  const canEditPayroll = permissions?.payroll === 'edit';
  const canApprovePayroll = ['admin','managing_director','accountant'].includes(user?.role);
  const canManageTeam = permissions?.staff === 'edit';
  const [form] = Form.useForm(); const query = useQueryClient();
  const employees = useQuery({ queryKey: ['staffEmployees'], queryFn: () => api.get('/staff/employees') });
  const attendance = useQuery({ queryKey: ['staffAttendance'], queryFn: () => api.get('/staff/attendance') });
  const work = useQuery({ queryKey: ['staffWorkLogs'], queryFn: () => api.get('/staff/work-logs') });
  const leave = useQuery({ queryKey: ['staffLeave'], queryFn: () => api.get('/staff/leave') });
  const safety = useQuery({ queryKey: ['staffSafety'], queryFn: () => api.get('/staff/safety') });
  const runs = useQuery({ queryKey: ['payrollRuns'], queryFn: () => api.get('/staff/payroll-runs'), enabled: canSeePayroll });
  const farms = useQuery({ queryKey: ['staffFarms'], queryFn: () => api.get('/fields/farms') });
  const fields = useQuery({ queryKey: ['staffFields'], queryFn: () => api.get('/fields') });
  const people = employees.data?.data || [];
  const refresh = () => { for (const key of [['staffEmployees'],['staffAttendance'],['staffWorkLogs'],['staffLeave'],['staffSafety'],['payrollRuns']]) query.invalidateQueries({ queryKey: key }); };
  const mutation = useMutation({
    mutationFn: ({ endpoint, values, method = 'post' }) => api[method](endpoint, values),
    onSuccess: () => { message.success('Record saved'); setDialog(''); form.resetFields(); refresh(); },
    onError: error => message.error(error.message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ endpoint, status }) => api.patch(endpoint, { status }),
    onSuccess: refresh,
    onError: error => message.error(error.message),
  });
  const open = (name, defaults = {}) => { form.resetFields(); form.setFieldsValue(defaults); setDialog(name); };
  const submit = (endpoint, values, method = 'post') => mutation.mutate({ endpoint, values, method });
  const employeeSelect = <Select showSearch optionFilterProp="label" placeholder="Select worker" options={people.map(p => ({ value: p.id, label: `${p.employee_no} · ${p.name}` }))} />;
  const farmSelect = <Select allowClear placeholder="Farm" options={(farms.data?.data || []).map(f => ({ value: f.id, label: f.name }))} />;
  const fieldSelect = <Select allowClear placeholder="Field" options={(fields.data?.data || []).map(f => ({ value: f.id, label: `${f.code} · ${f.name}` }))} />;
  const col = (title,dataIndex,render) => ({ title,dataIndex,key:dataIndex,render:render || (v => v || '—') });
  const reviewColumn = (record, endpoint, statuses) => <Space>{statuses.map(status => <Button key={status} size="small" type={status === 'approved' ? 'primary' : 'default'} danger={status === 'rejected'} onClick={() => statusMutation.mutate({ endpoint, status })}>{status}</Button>)}</Space>;

  const team = [
    col('Staff No.','employee_no',v => <Tag color="green">{v}</Tag>), col('Name','name'), col('Role','job_title'), col('Department','department'), col('Worker type','worker_type',v => <Tag>{v}</Tag>),
    col('Pay basis','pay_type',v => v?.replace('_',' ')), ...(canSeePayroll ? [col('Rate','base_rate',money)] : []), col('30-day attendance','attendance_days'), col('Approved field tasks','approved_tasks'),
    { title:'Status',dataIndex:'status',render:v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
  ];
  const attendanceCols = [col('Date','work_date'),col('Worker','employee_name'),col('Farm','farm_name'),col('Clock in','clock_in'),col('Clock out','clock_out'),col('Hours','hours'),{title:'Approval',dataIndex:'approved_at',render:(v,r)=>v?<Tag color="green">Approved</Tag>:<Button size="small" onClick={()=>statusMutation.mutate({endpoint:`/staff/attendance/${r.id}/approve`,status:'approve'})}>Approve</Button>}];
  const workCols = [col('Date','work_date'),col('Worker','employee_name'),col('Farm','farm_name'),col('Field','field_code'),col('Task','task'),col('Workers','worker_count'),col('Hours','hours'),col('Area (ac)','acreage'),col('Completed','quantity', (v,r)=>`${v || 0} ${r.quantity_unit || ''}`),col('Pay','amount',money),{title:'Review',dataIndex:'status',render:(v,r)=>v==='submitted'?reviewColumn(r,`/staff/work-logs/${r.id}/review`,['approved','rejected']):<Tag color={v==='approved'?'green':'default'}>{v}</Tag>}];
  const leaveCols = [col('Worker','employee_name'),col('Type','leave_type'),col('Dates','start_date',(v,r)=>`${v} – ${r.end_date}`),col('Days','days'),col('Reason','reason'),{title:'Status',dataIndex:'status',render:(v,r)=>v==='pending'?reviewColumn(r,`/staff/leave/${r.id}/review`,['approved','rejected']):<Tag>{v}</Tag>}];
  const safetyCols = [col('Date','event_date'),col('Worker','employee_name'),col('Record','record_type',v=><Tag color={v==='incident'?'red':'blue'}>{v}</Tag>),col('Description','description'),col('Severity','severity'),col('Follow-up / expiry','action_taken',(v,r)=>`${v || '—'}${r.expiry_date ? ` · due ${r.expiry_date}` : ''}`)];
  const runCols = [col('Run','ref_no'),col('Period','period_start',(v,r)=>`${v} – ${r.period_end}`),col('Gross','gross_total',money),col('Deductions','deduction_total',money),col('Net pay','net_total',v=><Text strong>{money(v)}</Text>),{title:'Workflow',dataIndex:'status',render:(v,r)=><Space><Tag color={v==='paid'?'green':v==='approved'?'blue':'orange'}>{v}</Tag>{v==='draft'&&canApprovePayroll&&<Button size="small" onClick={()=>statusMutation.mutate({endpoint:`/staff/payroll-runs/${r.id}/status`,status:'approved'})}>Approve</Button>}{v==='approved'&&canApprovePayroll&&<Button size="small" onClick={()=>statusMutation.mutate({endpoint:`/staff/payroll-runs/${r.id}/status`,status:'paid'})}>Mark paid</Button>}<Button size="small" onClick={async()=>{const res=await api.get(`/staff/payroll-runs/${r.id}`);setPayroll(res.data);}}>Lines</Button></Space>}];

  const employeeForm = <><Form.Item name="employee_no" label="Staff number" rules={[{required:true}]}><Input placeholder="GP-EMP-001" /></Form.Item><Form.Item name="name" label="Full name" rules={[{required:true}]}><Input /></Form.Item><Space style={{display:'flex'}}><Form.Item name="worker_type" label="Worker type" rules={[{required:true}]}><Select style={{width:190}} options={['permanent','seasonal','casual','operator','agronomist','contractor'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="job_title" label="Job title"><Input /></Form.Item></Space><Space style={{display:'flex'}}><Form.Item name="department" label="Department"><Input /></Form.Item><Form.Item name="contract_ref" label="Contract reference"><Input /></Form.Item></Space><Space style={{display:'flex'}}><Form.Item name="pay_type" label="Pay basis" rules={[{required:true}]}><Select style={{width:190}} options={['monthly','daily','hourly','piece_rate'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="base_rate" label="Base rate (KES)" rules={[{required:true}]}><InputNumber min={0} style={{width:190}} /></Form.Item></Space><Space style={{display:'flex'}}><Form.Item name="phone" label="Phone"><Input /></Form.Item><Form.Item name="email" label="Email"><Input /></Form.Item></Space><Space style={{display:'flex'}}><Form.Item name="start_date" label="Start date"><Input type="date" /></Form.Item><Form.Item name="end_date" label="End date"><Input type="date" /></Form.Item></Space><Form.Item name="notes" label="Notes"><Input.TextArea /></Form.Item></>;

  const attendanceForm = <><Form.Item name="employee_id" label="Worker" rules={[{required:true}]}>{employeeSelect}</Form.Item><Form.Item name="work_date" label="Date" rules={[{required:true}]}><Input type="date" /></Form.Item><Space style={{display:'flex'}}><Form.Item name="clock_in" label="Clock in"><Input type="time" /></Form.Item><Form.Item name="clock_out" label="Clock out"><Input type="time" /></Form.Item><Form.Item name="hours" label="Hours"><InputNumber min={0} max={24} /></Form.Item></Space><Form.Item name="status" label="Attendance status" initialValue="present"><Select options={['present','absent','leave','offsite'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="farm_id" label="Farm">{farmSelect}</Form.Item><Form.Item name="notes" label="Notes"><Input /></Form.Item></>;
  const workForm = <><Form.Item name="work_date" label="Work date" rules={[{required:true}]}><Input type="date" /></Form.Item><Form.Item name="employee_id" label="Individual worker (optional)">{employeeSelect}</Form.Item><Form.Item name="farm_id" label="Farm">{farmSelect}</Form.Item><Form.Item name="field_id" label="Field">{fieldSelect}</Form.Item><Form.Item name="task" label="Task" rules={[{required:true}]}><Input placeholder="Planting, weeding, grading…" /></Form.Item><Space style={{display:'flex'}}><Form.Item name="worker_count" label="Worker count" initialValue={1}><InputNumber min={1} /></Form.Item><Form.Item name="hours" label="Hours"><InputNumber min={0} /></Form.Item><Form.Item name="acreage" label="Acres completed"><InputNumber min={0} /></Form.Item></Space><Space style={{display:'flex'}}><Form.Item name="pay_type" label="Pay method" initialValue="hourly"><Select options={['hourly','daily','piece_rate','unpaid'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="quantity" label="Completed quantity"><InputNumber min={0} /></Form.Item><Form.Item name="quantity_unit" label="Unit"><Input placeholder="kg, rows, acres" /></Form.Item></Space><Space style={{display:'flex'}}><Form.Item name="agreed_rate" label="Agreed rate (KES/unit)"><InputNumber min={0} /></Form.Item><Form.Item name="amount" label="Total amount (optional)"><InputNumber min={0} /></Form.Item></Space><Form.Item name="notes" label="Supervisor notes"><Input.TextArea /></Form.Item></>;

  const dialogConfig = {
    employee:{title:'Add staff or worker',endpoint:'/staff/employees',children:employeeForm},
    attendance:{title:'Record attendance',endpoint:'/staff/attendance',children:attendanceForm,defaults:{work_date:today(),status:'present'}},
    work:{title:'Submit field work sheet',endpoint:'/staff/work-logs',children:workForm,defaults:{work_date:today(),worker_count:1,pay_type:'hourly'}},
    leave:{title:'Request leave',endpoint:'/staff/leave',children:<><Form.Item name="employee_id" label="Worker" rules={[{required:true}]}>{employeeSelect}</Form.Item><Form.Item name="leave_type" label="Leave type" rules={[{required:true}]}><Select options={['annual','sick','compassionate','unpaid','other'].map(value=>({value,label:value}))}/></Form.Item><Space style={{display:'flex'}}><Form.Item name="start_date" label="Start date" rules={[{required:true}]}><Input type="date" /></Form.Item><Form.Item name="end_date" label="End date" rules={[{required:true}]}><Input type="date" /></Form.Item><Form.Item name="days" label="Days" rules={[{required:true}]}><InputNumber min={0.5} step={0.5}/></Form.Item></Space><Form.Item name="reason" label="Reason"><Input.TextArea /></Form.Item></>},
    safety:{title:'Add safety record',endpoint:'/staff/safety',children:<><Form.Item name="employee_id" label="Worker (optional)">{employeeSelect}</Form.Item><Space style={{display:'flex'}}><Form.Item name="record_type" label="Record type" rules={[{required:true}]}><Select options={['training','incident','ppe'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="event_date" label="Date" rules={[{required:true}]}><Input type="date" /></Form.Item></Space><Form.Item name="description" label="Description" rules={[{required:true}]}><Input.TextArea /></Form.Item><Space style={{display:'flex'}}><Form.Item name="severity" label="Severity"><Select allowClear options={['low','medium','high','critical'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="expiry_date" label="Certificate / PPE expiry"><Input type="date" /></Form.Item></Space><Form.Item name="action_taken" label="Action / follow-up"><Input.TextArea /></Form.Item></>},
    payroll:{title:'Create payroll draft',endpoint:'/staff/payroll-runs',children:<><Text type="secondary">Draft calculates monthly base, attendance based hourly/daily pay and approved piece-rate work. Add allowances and deductions per worker below.</Text><Space style={{display:'flex',marginTop:16}}><Form.Item name="period_start" label="Period start" rules={[{required:true}]}><Input type="date" /></Form.Item><Form.Item name="period_end" label="Period end" rules={[{required:true}]}><Input type="date" /></Form.Item></Space><Form.List name="adjustments">{(fieldsList,{add,remove})=><><Button onClick={()=>add()}>Add worker adjustment</Button>{fieldsList.map(({key,name,...rest})=><Space key={key} align="baseline" style={{display:'flex',marginTop:10}}><Form.Item {...rest} name={[name,'employee_id']} rules={[{required:true}]}>{employeeSelect}</Form.Item><Form.Item {...rest} name={[name,'allowances']}><InputNumber min={0} placeholder="Allowance KES" /></Form.Item><Form.Item {...rest} name={[name,'deductions']}><InputNumber min={0} placeholder="Deduction KES" /></Form.Item><Button danger onClick={()=>remove(name)}>Remove</Button></Space>)}</>}</Form.List><Form.Item name="notes" label="Notes"><Input /></Form.Item></>},
  };

  const config = dialogConfig[dialog];
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}><div><Title level={4} style={{margin:0}}>People & Workforce</Title><Text type="secondary">Staff records, attendance, field work approvals, payroll drafts, leave and safety</Text></div>{canManageTeam&&<Button type="primary" icon={<PlusOutlined />} onClick={()=>open('employee')} style={{background:'#2e7d32'}}>Add staff</Button>}</div>
    <Space wrap style={{marginBottom:16}}><Card><Statistic title="Active team" value={people.filter(p=>p.status==='active').length} prefix={<TeamOutlined/>}/></Card><Card><Statistic title="Attendance entries" value={(attendance.data?.data||[]).length} prefix={<ClockCircleOutlined/>}/></Card><Card><Statistic title="Pending work approvals" value={(work.data?.data||[]).filter(x=>x.status==='submitted').length}/></Card><Card><Statistic title="Payroll runs" value={(runs.data?.data||[]).length} prefix={<DollarOutlined/>}/></Card></Space>
    <Card bordered={false}>
      <Tabs items={[
        {key:'team',label:'Team',children:<>{canManageTeam&&<div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Button icon={<PlusOutlined/>} onClick={()=>open('employee')}>Add staff</Button></div>}<Table rowKey="id" loading={employees.isLoading} dataSource={people} columns={team} scroll={{x:1000}} pagination={{pageSize:12}}/></>},
        {key:'attendance',label:'Attendance',children:<><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Button icon={<PlusOutlined/>} onClick={()=>open('attendance',{work_date:today(),status:'present'})}>Record attendance</Button></div><Table rowKey="id" loading={attendance.isLoading} dataSource={attendance.data?.data||[]} columns={attendanceCols} pagination={{pageSize:12}}/></>},
        {key:'work',label:'Field work & piece rates',children:<><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Button icon={<PlusOutlined/>} onClick={()=>open('work',{work_date:today(),worker_count:1,pay_type:'hourly'})}>Submit work sheet</Button></div><Table rowKey="id" loading={work.isLoading} dataSource={work.data?.data||[]} columns={workCols} scroll={{x:1300}} pagination={{pageSize:12}}/></>},
        ...(canSeePayroll ? [{key:'payroll',label:'Payroll',children:<>{canEditPayroll&&<div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Button icon={<PlusOutlined/>} onClick={()=>open('payroll')}>Create payroll draft</Button></div>}<Table rowKey="id" loading={runs.isLoading} dataSource={runs.data?.data||[]} columns={runCols} pagination={{pageSize:10}}/></>}] : []),
        {key:'leave',label:'Leave',children:<><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Button icon={<PlusOutlined/>} onClick={()=>open('leave')}>Record leave request</Button></div><Table rowKey="id" loading={leave.isLoading} dataSource={leave.data?.data||[]} columns={leaveCols} pagination={{pageSize:10}}/></>},
        {key:'safety',label:<span><SafetyOutlined/> Safety</span>,children:<><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Button icon={<PlusOutlined/>} onClick={()=>open('safety',{event_date:today()})}>Add safety record</Button></div><Table rowKey="id" loading={safety.isLoading} dataSource={safety.data?.data||[]} columns={safetyCols} pagination={{pageSize:10}}/></>},
      ]}/>
    </Card>
    <Modal title={config?.title} open={!!config} onCancel={()=>setDialog('')} onOk={()=>form.submit()} confirmLoading={mutation.isPending} width={720} destroyOnClose>
      {config&&<Form form={form} layout="vertical" initialValues={config.defaults} onFinish={values=>submit(config.endpoint,values)}>{config.children}</Form>}
    </Modal>
    <Modal title={`Payroll details · ${payroll?.ref_no||''}`} open={!!payroll} onCancel={()=>setPayroll(null)} footer={null} width={760}><Table rowKey="id" dataSource={payroll?.lines||[]} pagination={false} columns={[col('Worker','employee_name'),col('Earnings','earnings',money),col('Allowances','allowances',money),col('Deductions','deductions',money),col('Net pay','net_pay',money)]}/></Modal>
  </div>;
}
