import React, { useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { PlusOutlined, ToolOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;
const day = () => new Date().toISOString().slice(0,10);
const money = n => `KES ${Number(n||0).toLocaleString()}`;

export default function MachineryWork() {
  const [open,setOpen]=useState(false); const [form]=Form.useForm(); const qc=useQueryClient();
  const work=useQuery({queryKey:['machineryWork'],queryFn:()=>api.get('/assets/work-logs')});
  const assets=useQuery({queryKey:['assets'],queryFn:()=>api.get('/assets')});
  const staff=useQuery({queryKey:['staffEmployees'],queryFn:()=>api.get('/staff/employees')});
  const farms=useQuery({queryKey:['farms'],queryFn:()=>api.get('/fields/farms')});
  const fields=useQuery({queryKey:['fields'],queryFn:()=>api.get('/fields')});
  const growers=useQuery({queryKey:['growers'],queryFn:()=>api.get('/growers')});
  const refresh=()=>qc.invalidateQueries({queryKey:['machineryWork']});
  const save=useMutation({mutationFn:values=>api.post('/assets/work-logs',values),onSuccess:()=>{message.success('Machinery work sheet created');setOpen(false);form.resetFields();refresh();},onError:e=>message.error(e.message)});
  const change=useMutation({mutationFn:({id,status})=>api.patch(`/assets/work-logs/${id}/status`,{status}),onSuccess:refresh,onError:e=>message.error(e.message)});
  const rows=work.data?.data||[];
  const next={planned:'in_progress',in_progress:'completed',completed:'billed'};
  const columns=[
    {title:'Reference',dataIndex:'ref_no',render:v=><Tag color="blue">{v}</Tag>},
    {title:'Date',dataIndex:'work_date'},
    {title:'Machine',dataIndex:'asset_name',render:(v,r)=><div><Text strong>{v}</Text><div><Text type="secondary">{r.asset_code}</Text></div></div>},
    {title:'Service',dataIndex:'service_type'},
    {title:'Operator',dataIndex:'operator_name',render:v=>v||'—'},
    {title:'Farm / Field',dataIndex:'farm_name',render:(v,r)=>`${v||'—'}${r.field_code?` · ${r.field_code}`:''}`},
    {title:'Grower',dataIndex:'grower_name',render:v=>v||'Internal'},
    {title:'Hours / Fuel',dataIndex:'hours',render:(v,r)=>`${v||0} h · ${r.fuel_litres||0} L`},
    {title:'Area',dataIndex:'acreage',render:v=>`${Number(v||0)} acres`},
    {title:'Billable',dataIndex:'amount_billed',render:money},
    {title:'Status',dataIndex:'status',render:v=><Tag color={v==='billed'?'green':v==='completed'?'blue':'orange'}>{v}</Tag>},
    {title:'Next step',key:'next',render:(_,r)=>next[r.status]?<Button size="small" onClick={()=>change.mutate({id:r.id,status:next[r.status]})}>{next[r.status]==='in_progress'?'Start':next[r.status]==='completed'?'Complete':'Mark billed'}</Button>:r.bill_ref||'—'},
  ];
  const assetsOptions=(assets.data?.data||[]).map(a=>({value:a.id,label:`${a.code} · ${a.name}`}));
  const staffOptions=(staff.data?.data||[]).filter(e=>e.status==='active').map(e=>({value:e.id,label:e.name}));
  const farmOptions=(farms.data?.data||[]).map(f=>({value:f.id,label:f.name}));
  const fieldOptions=(fields.data?.data||[]).map(f=>({value:f.id,label:`${f.code} · ${f.name}`}));
  const growerOptions=(growers.data?.data||[]).map(g=>({value:g.id,label:`${g.code} · ${g.name}`}));
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}><div><Title level={4} style={{margin:0}}>Machinery Work Sheets</Title><Text type="secondary">Record machinery hours, fuel, field work and contracted mechanisation services</Text></div><Button type="primary" icon={<PlusOutlined/>} onClick={()=>{form.resetFields();form.setFieldsValue({work_date:day(),status:'planned'});setOpen(true);}} style={{background:'#2e7d32'}}>New work sheet</Button></div>
    <Space wrap style={{marginBottom:16}}><Card><Statistic title="Work sheets" value={rows.length} prefix={<ToolOutlined/>}/></Card><Card><Statistic title="In progress" value={rows.filter(r=>r.status==='in_progress').length}/></Card><Card><Statistic title="Completed, unbilled" value={rows.filter(r=>r.status==='completed').length}/></Card><Card><Statistic title="Billable value" value={money(rows.filter(r=>r.status!=='billed').reduce((s,r)=>s+Number(r.amount_billed||0),0))}/></Card></Space>
    <Card bordered={false}><Table rowKey="id" loading={work.isLoading} dataSource={rows} columns={columns} scroll={{x:1500}} pagination={{pageSize:12}} /></Card>
    <Modal title="Create machinery work sheet" open={open} onCancel={()=>setOpen(false)} onOk={()=>form.submit()} confirmLoading={save.isPending} width={760} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={values=>save.mutate(values)}>
        <Space style={{display:'flex'}}><Form.Item name="asset_id" label="Machine / asset" rules={[{required:true}]}><Select showSearch optionFilterProp="label" style={{width:300}} options={assetsOptions}/></Form.Item><Form.Item name="operator_id" label="Operator"><Select allowClear showSearch optionFilterProp="label" style={{width:260}} options={staffOptions}/></Form.Item></Space>
        <Space style={{display:'flex'}}><Form.Item name="work_date" label="Work date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="service_type" label="Task / service" rules={[{required:true}]}><Input placeholder="Planting, ploughing, spraying…" style={{width:300}}/></Form.Item></Space>
        <Space style={{display:'flex'}}><Form.Item name="farm_id" label="Farm"><Select allowClear style={{width:260}} options={farmOptions}/></Form.Item><Form.Item name="field_id" label="Field"><Select allowClear showSearch optionFilterProp="label" style={{width:300}} options={fieldOptions}/></Form.Item><Form.Item name="grower_id" label="Contract farmer (service work)"><Select allowClear showSearch optionFilterProp="label" style={{width:280}} options={growerOptions}/></Form.Item></Space>
        <Space style={{display:'flex'}}><Form.Item name="meter_start" label="Meter start"><InputNumber min={0}/></Form.Item><Form.Item name="meter_end" label="Meter end"><InputNumber min={0}/></Form.Item><Form.Item name="hours" label="Hours worked"><InputNumber min={0}/></Form.Item><Form.Item name="fuel_litres" label="Fuel used (L)"><InputNumber min={0}/></Form.Item></Space>
        <Space style={{display:'flex'}}><Form.Item name="acreage" label="Acres serviced"><InputNumber min={0}/></Form.Item><Form.Item name="rate_per_acre" label="Rate / acre (KES)"><InputNumber min={0}/></Form.Item><Form.Item name="bill_ref" label="Invoice / bill ref"><Input/></Form.Item><Form.Item name="status" label="Initial status"><Select options={['planned','in_progress','completed'].map(value=>({value,label:value}))}/></Form.Item></Space>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={2}/></Form.Item>
      </Form>
    </Modal>
  </div>;
}
