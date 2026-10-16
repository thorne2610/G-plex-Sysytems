import React, { useState } from 'react';
import { Table, Button, Space, Tag, Typography, message, Card, Popconfirm, Drawer, Descriptions } from 'antd';
import { ShoppingOutlined, DollarOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function SalesOrders() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: () => api.get('/sales-orders'),
  });

  const { data: orderDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['salesOrderDetail', selectedOrder?.id],
    queryFn: () => api.get(`/sales-orders/${selectedOrder.id}`),
    enabled: !!selectedOrder,
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: (id) => api.post(`/sales-orders/${id}/generate-invoice`),
    onSuccess: (res) => {
      message.success(`Invoice generated successfully: ${res.data.invoice_ref}`);
      queryClient.invalidateQueries(['salesOrders']);
      queryClient.invalidateQueries(['invoices']);
    },
    onError: (err) => message.error(err.message || 'Invoice generation failed'),
  });

  const getStatusColor = (s) => {
    switch (s) {
      case 'invoiced': return 'green';
      case 'confirmed': return 'blue';
      case 'dispatched': return 'cyan';
      case 'cancelled': return 'red';
      default: return 'orange';
    }
  };

  const columns = [
    {
      title: 'Order Ref',
      dataIndex: 'ref_no',
      key: 'ref_no',
      render: (r) => <Text strong>{r}</Text>,
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Total (KES)',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (t) => <Text strong>KES {Number(t || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={getStatusColor(s)}>{s?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedOrder(record)}
          >
            Details
          </Button>
          {record.status !== 'invoiced' && (
            <Popconfirm
              title="Generate Invoice for this Sales Order?"
              description="This will create a customer invoice and update debtor balance."
              onConfirm={() => generateInvoiceMutation.mutate(record.id)}
              okText="Generate Invoice"
              cancelText="Cancel"
            >
              <Button size="small" type="primary" icon={<DollarOutlined />} style={{ backgroundColor: '#2e7d32' }}>
                Invoice
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const detail = orderDetail?.data;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Customer Sales Orders</Title>
        <Text type="secondary">Manage customer orders and dispatch-to-invoice workflows</Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table
          dataSource={orders?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      {/* Sales Order Detail Drawer */}
      <Drawer
        title={`Sales Order: ${detail?.ref_no || ''}`}
        placement="right"
        width={650}
        onClose={() => setSelectedOrder(null)}
        open={!!selectedOrder}
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Customer">{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Date">{detail.date}</Descriptions.Item>
              <Descriptions.Item label="Delivery Date">{detail.delivery_date || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(detail.status)}>{detail.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Subtotal">KES {Number(detail.subtotal || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="16% VAT">KES {Number(detail.vat_amount || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Grand Total" span={2}>
                <Text strong style={{ fontSize: 16, color: '#2e7d32' }}>
                  KES {Number(detail.total || 0).toLocaleString()}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Ordered Produce & Items</Title>
            <Table
              dataSource={detail.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (q, r) => `${q} ${r.unit || ''}` },
                { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', render: (p) => `KES ${Number(p).toLocaleString()}` },
                { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', render: (lt) => <Text strong>KES {Number(lt).toLocaleString()}</Text> },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
