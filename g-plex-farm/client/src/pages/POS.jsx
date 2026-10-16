import React, { useState } from 'react';
import { Card, Row, Col, Button, Tag, Typography, Select, Input, Radio, message, Modal, Table, Divider, Alert, Space } from 'antd';
import {
  ShoppingOutlined,
  DollarOutlined,
  FileDoneOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  PlusOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const { Title, Text } = Typography;

export default function POS() {
  const [mode, setMode] = useState('sale'); // 'sale' | 'lease'
  const [cart, setCart] = useState({}); // { [productId]: qty }
  const [selectedFarmer, setSelectedFarmer] = useState('Demo Farmer 128 · GR-128');
  const [selectedContract, setSelectedContract] = useState('GR-128 · Long Rains 2026');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [recoveryPlan, setRecoveryPlan] = useState('Deduct from accepted harvest');
  const [agreementDate, setAgreementDate] = useState('GR-128 input agreement · 30 Nov 2026');
  const [cashUpModal, setCashUpModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch products with stock
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['posProducts'],
    queryFn: () => api.get('/products'),
  });

  // Fetch growers for farmer selector
  const { data: growersData } = useQuery({
    queryKey: ['growers'],
    queryFn: () => api.get('/growers'),
  });

  // Fetch daily cash-up
  const { data: cashUpData, refetch: refetchCashUp } = useQuery({
    queryKey: ['posCashUp'],
    queryFn: () => api.get('/pos/cash-up'),
    enabled: cashUpModal,
  });

  const transactMutation = useMutation({
    mutationFn: (payload) => api.post('/pos/transact', payload),
    onSuccess: (res) => {
      message.success(res.message || 'Transaction completed successfully');
      setCart({});
      queryClient.invalidateQueries(['posProducts']);
      queryClient.invalidateQueries(['stockBalances']);
      queryClient.invalidateQueries(['dashboardSummary']);
      queryClient.invalidateQueries(['growers']);
    },
    onError: (err) => {
      message.error(err.message || 'Transaction failed');
    },
  });

  const products = productsData?.data || [];
  const growers = growersData?.data || [];

  const updateQty = (id, delta) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const resetCart = () => {
    setCart({});
    message.info('New transaction started');
  };

  const cartItems = Object.entries(cart).map(([prodId, qty]) => {
    const prod = products.find((p) => p.id === parseInt(prodId));
    return {
      product: prod,
      product_id: parseInt(prodId),
      qty,
      unit_price: prod?.selling_price || 0,
      lot_number: prod?.description?.match(/Lot [A-Z0-9-]+/)?.[0] || 'GP-26-038',
      line_total: (prod?.selling_price || 0) * qty,
    };
  }).filter(it => it.product);

  const subtotal = cartItems.reduce((sum, it) => sum + it.line_total, 0);
  const total = subtotal; // Retail display inclusive

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      return message.warning('Please select at least one product before confirming');
    }

    const matchedGrower = growers.find(g => selectedFarmer.includes(g.code) || selectedFarmer.includes(g.name));

    const payload = {
      type: mode === 'sale' ? 'sale' : 'credit_issue',
      farmer_name: selectedFarmer,
      grower_id: matchedGrower?.id || null,
      contract_ref: selectedContract,
      payment_method: paymentMethod,
      recovery_plan: mode === 'lease' ? recoveryPlan : null,
      due_date: mode === 'lease' ? agreementDate : null,
      items: cartItems.map(it => ({
        product_id: it.product_id,
        lot_number: it.lot_number,
        qty: it.qty,
        unit_price: it.unit_price,
      })),
      notes: mode === 'lease' ? `Input credit issued under ${selectedContract}` : 'Counter sale',
    };

    transactMutation.mutate(payload);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#628059', fontWeight: 700, textTransform: 'uppercase' }}>
            FARMER SALES / INPUT ACCOUNTS
          </div>
          <Title level={3} style={{ margin: '4px 0 2px', color: '#153d2d' }}>
            Point of Sale (POS)
          </Title>
          <Text type="secondary">
            Sell inputs at the counter or issue seed and fertilizer on farmer credit agreements.
          </Text>
        </div>
        <Space>
          <Button onClick={() => { setCashUpModal(true); refetchCashUp(); }}>
            Daily Cash-up
          </Button>
          <Button type="primary" onClick={resetCart} style={{ backgroundColor: '#153d2d' }}>
            New Transaction
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left Column: Mode Tabs, Farmer Select, Product Grid */}
        <Col xs={24} lg={15}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 15px rgba(23, 55, 43, 0.06)' }}>
            {/* Tabs for Buy Now vs Input Credit */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <Button
                type={mode === 'sale' ? 'primary' : 'default'}
                onClick={() => setMode('sale')}
                style={{
                  backgroundColor: mode === 'sale' ? '#153d2d' : '#fff',
                  borderColor: mode === 'sale' ? '#153d2d' : '#d9d9d9',
                  borderRadius: 8,
                  height: 38,
                  fontWeight: 600,
                }}
              >
                Buy Now (Counter Sale)
              </Button>
              <Button
                type={mode === 'lease' ? 'primary' : 'default'}
                onClick={() => setMode('lease')}
                style={{
                  backgroundColor: mode === 'lease' ? '#153d2d' : '#fff',
                  borderColor: mode === 'lease' ? '#153d2d' : '#d9d9d9',
                  borderRadius: 8,
                  height: 38,
                  fontWeight: 600,
                }}
              >
                Input Credit / Lease to Account
              </Button>
            </div>

            {/* Mode Banner */}
            <div style={{
              background: '#eaf2dc',
              color: '#344b36',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              marginBottom: 16,
            }}>
              {mode === 'sale'
                ? 'Immediate purchase: Collect payment now, issue a receipt and automatically reduce store stock for the selected seed lot or fertilizer item.'
                : 'Farmer account issue: Record agreement and recovery terms. Deduct approved value from accepted harvest, installments or future payment. Physical return applies only to designated returnable equipment.'}
            </div>

            {/* Farmer / Contract Selectors */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12}>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>
                  FARMER / CUSTOMER
                </div>
                <Select
                  style={{ width: '100%' }}
                  value={selectedFarmer}
                  onChange={setSelectedFarmer}
                  showSearch
                >
                  <Select.Option value="Demo Farmer 128 · GR-128">Demo Farmer 128 · GR-128</Select.Option>
                  <Select.Option value="Demo Farmer 204 · GR-204">Demo Farmer 204 · GR-204</Select.Option>
                  <Select.Option value="Demo Farmer 251 · GR-251">Demo Farmer 251 · GR-251</Select.Option>
                  <Select.Option value="Walk-in Customer">Walk-in Customer (Retail)</Select.Option>
                  {growers.map(g => (
                    <Select.Option key={g.id} value={`${g.name} · ${g.code}`}>{g.name} · {g.code}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>
                  FARM / CONTRACT
                </div>
                <Select
                  style={{ width: '100%' }}
                  value={selectedContract}
                  onChange={setSelectedContract}
                >
                  <Select.Option value="GR-128 · Long Rains 2026">GR-128 · Long Rains 2026</Select.Option>
                  <Select.Option value="GR-204 · Long Rains 2026">GR-204 · Long Rains 2026</Select.Option>
                  <Select.Option value="GR-251 · Short Rains 2026">GR-251 · Short Rains 2026</Select.Option>
                  <Select.Option value="Retail customer · no contract">Retail customer · no contract</Select.Option>
                </Select>
              </Col>
            </Row>

            <Divider style={{ margin: '14px 0' }} />

            {/* Product Item Rows with Quantity Pickers */}
            <Title level={5} style={{ marginBottom: 12, color: '#153d2d' }}>Available Inputs & Seed Stock</Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {products.map((p) => {
                const qtyInCart = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: qtyInCart > 0 ? '#f6fbf4' : '#fafafa',
                      border: `1px solid ${qtyInCart > 0 ? '#c8ef76' : '#eef0e9'}`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#17372b' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#738075' }}>
                        {p.description || `${p.unit} pack`} · <Tag color="blue" style={{ fontSize: 10 }}>{p.total_stock || 0} in stock</Tag>
                      </div>
                    </div>

                    <div style={{ width: 120, textAlign: 'right', marginRight: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#153d2d' }}>
                        KSh {Number(p.selling_price || 0).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button
                        size="small"
                        icon={<MinusOutlined />}
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qtyInCart === 0}
                      />
                      <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                        {qtyInCart}
                      </span>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => updateQty(p.id, 1)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>

        {/* Right Column: Transaction Summary Cart & Payment Options */}
        <Col xs={24} lg={9}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 15px rgba(23, 55, 43, 0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, color: '#153d2d' }}>Transaction Summary</Title>
              <Tag color="green">{cartItems.length} lines selected</Tag>
            </div>

            {/* Cart Lines */}
            <div style={{ minHeight: 120, borderBottom: '1px solid #eef0e9', paddingBottom: 12, marginBottom: 16 }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#999', fontSize: 12 }}>
                  Use the +/- buttons to select seeds, fertilizer, or equipment
                </div>
              ) : (
                cartItems.map((it) => (
                  <div key={it.product_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.product.name}</div>
                      <div style={{ color: '#738075', fontSize: 11 }}>
                        {it.qty} × KSh {Number(it.unit_price).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#153d2d' }}>
                      KSh {Number(it.line_total).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 700, color: '#153d2d', marginBottom: 16 }}>
              <span>Total Payable</span>
              <span>KSh {subtotal.toLocaleString()}</span>
            </div>

            {/* Payment Method / Recovery Plan */}
            {mode === 'sale' ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 6 }}>
                  PAYMENT METHOD
                </div>
                <Radio.Group value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Radio value="cash" style={{ padding: '8px 12px', border: '1px solid #eef0e9', borderRadius: 6, margin: 0 }}>
                    Cash at counter
                  </Radio>
                  <Radio value="mpesa" style={{ padding: '8px 12px', border: '1px solid #eef0e9', borderRadius: 6, margin: 0 }}>
                    M-Pesa confirmation
                  </Radio>
                  <Radio value="farmer_account" style={{ padding: '8px 12px', border: '1px solid #eef0e9', borderRadius: 6, margin: 0 }}>
                    Farmer account ledger
                  </Radio>
                </Radio.Group>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>
                  RECOVERY PLAN
                </div>
                <Select value={recoveryPlan} onChange={setRecoveryPlan} style={{ width: '100%', marginBottom: 10 }}>
                  <Select.Option value="Deduct from accepted harvest">Deduct from accepted harvest</Select.Option>
                  <Select.Option value="Installments by agreed dates">Installments by agreed dates</Select.Option>
                  <Select.Option value="Repay at farmer service point">Repay at farmer service point</Select.Option>
                </Select>

                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>
                  AGREEMENT REFERENCE / DUE DATE
                </div>
                <Input value={agreementDate} onChange={(e) => setAgreementDate(e.target.value)} />
              </div>
            )}

            <Button
              type="primary"
              size="large"
              block
              onClick={handleCheckout}
              loading={transactMutation.isPending}
              disabled={cartItems.length === 0}
              style={{
                backgroundColor: '#153d2d',
                borderColor: '#153d2d',
                height: 48,
                fontWeight: 700,
                fontSize: 15,
                borderRadius: 8,
              }}
            >
              {mode === 'sale' ? 'Confirm Sale & Deduct Stock' : 'Issue on Farmer Account'}
            </Button>

            <div style={{ marginTop: 12, fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.4 }}>
              Automatic lot traceability, store stock reduction, and eTIMS tax compliance ready.
            </div>
          </Card>
        </Col>
      </Row>

      {/* Daily Cash-Up Modal */}
      <Modal
        title="POS Daily Cash-Up Summary"
        open={cashUpModal}
        onCancel={() => setCashUpModal(false)}
        footer={[
          <Button key="close" onClick={() => setCashUpModal(false)}>Close</Button>,
        ]}
      >
        <Alert
          message={`Today's Total Operations: KSh ${Number(cashUpData?.data?.summary?.grand_total || 0).toLocaleString()}`}
          description={`${cashUpData?.data?.summary?.total_txns || 0} counter transactions completed today.`}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          dataSource={cashUpData?.data?.breakdown || []}
          rowKey={(r, i) => `${r.payment_method}-${i}`}
          pagination={false}
          size="small"
          columns={[
            { title: 'Payment Channel', dataIndex: 'payment_method', key: 'pm', render: (pm) => <Tag color="blue">{pm?.toUpperCase()}</Tag> },
            { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag color={t === 'sale' ? 'green' : 'orange'}>{t?.toUpperCase()}</Tag> },
            { title: 'Transactions', dataIndex: 'count', key: 'count' },
            { title: 'Total Collected', dataIndex: 'total_amount', key: 'total', render: (tot) => <Text strong>KSh {Number(tot).toLocaleString()}</Text> },
          ]}
          locale={{ emptyText: 'No transactions recorded today yet' }}
        />
      </Modal>
    </div>
  );
}
