import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Button, Tag, Typography, Select, Input, Radio, message, Modal, Table, Divider, Alert, Space, Form, InputNumber, Descriptions } from 'antd';
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
  const [mode, setMode] = useState('sale'); // 'sale' | 'credit_issue'
  const [cart, setCart] = useState({}); // { [productId]: qty }
  const [selectedFarmer, setSelectedFarmer] = useState('');
  const [warehouseId, setWarehouseId] = useState();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [recoveryPlan, setRecoveryPlan] = useState('Deduct from accepted harvest');
  const [agreementRef, setAgreementRef] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [cashUpModal, setCashUpModal] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repaymentForm] = Form.useForm();
  const [receipt, setReceipt] = useState(null);

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

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses'),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['posBatches', warehouseId],
    queryFn: () => api.get(`/stock/available-batches?warehouse_id=${warehouseId}`),
    enabled: !!warehouseId,
  });

  const { data: creditLedgerData, refetch: refetchCreditLedger } = useQuery({
    queryKey: ['growerCreditLedger'],
    queryFn: () => api.get('/pos/credit-ledger'),
    enabled: repaymentOpen,
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
      setReceipt(res.data);
      queryClient.invalidateQueries({ queryKey: ['posProducts'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      queryClient.invalidateQueries({ queryKey: ['stockBatches'] });
      queryClient.invalidateQueries({ queryKey: ['posBatches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['growers'] });
      queryClient.invalidateQueries({ queryKey: ['growerCreditLedger'] });
    },
    onError: (err) => {
      message.error(err.message || 'Transaction failed');
    },
  });

  const repaymentMutation = useMutation({
    mutationFn: (values) => api.post('/pos/credit-payments', values),
    onSuccess: (res) => {
      message.success(res.message || 'Farmer repayment recorded');
      repaymentForm.resetFields();
      setRepaymentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['growers'] });
      queryClient.invalidateQueries({ queryKey: ['growerCreditLedger'] });
      queryClient.invalidateQueries({ queryKey: ['posCashUp'] });
    },
    onError: (err) => message.error(err.message || 'Repayment could not be recorded'),
  });

  const products = productsData?.data || [];
  const growers = growersData?.data || [];
  const warehouses = warehousesData?.data || [];
  const batches = batchesData?.data || [];
  const selectedGrower = growers.find((grower) => String(grower.id) === String(selectedFarmer));
  const selectedFarmerName = selectedGrower ? `${selectedGrower.name} · ${selectedGrower.code}` : selectedFarmer === 'walk-in' ? 'Walk-in Customer' : '';
  const availabilityByProduct = useMemo(() => batches.reduce((available, batch) => {
    available[batch.product_id] = (available[batch.product_id] || 0) + Number(batch.qty_on_hand || 0);
    return available;
  }, {}), [batches]);

  useEffect(() => {
    if (!warehouseId && warehouses.length) setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

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
      line_total: (prod?.selling_price || 0) * qty,
    };
  }).filter(it => it.product);

  const subtotal = cartItems.reduce((sum, it) => sum + it.line_total, 0);
  const taxAmount = cartItems.reduce((sum, item) => sum + item.line_total * Number(item.product.vat_pct ?? 16) / 100, 0);
  const total = subtotal + taxAmount;

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      return message.warning('Please select at least one product before confirming');
    }

    if (!warehouseId) return message.warning('Select the store that will issue this stock');
    if (!selectedFarmer) return message.warning('Select a farmer or walk-in customer');
    if (mode === 'credit_issue' && !selectedGrower) return message.warning('Input credit requires a registered contract farmer');
    if (mode === 'credit_issue' && !recoveryPlan) return message.warning('Choose an agreed recovery plan');

    const payload = {
      type: mode,
      farmer_name: selectedFarmerName,
      grower_id: selectedGrower?.id || null,
      contract_ref: selectedGrower?.contract_ref || null,
      warehouse_id: warehouseId,
      payment_method: paymentMethod,
      recovery_plan: mode === 'credit_issue' ? recoveryPlan : null,
      due_date: mode === 'credit_issue' ? dueDate || null : null,
      items: cartItems.map(it => ({
        product_id: it.product_id,
        qty: it.qty,
      })),
      notes: mode === 'credit_issue' ? `Input credit issued under ${agreementRef || selectedGrower?.contract_ref || 'farmer account'}` : 'Counter sale',
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
          <Button onClick={() => { setRepaymentOpen(true); refetchCreditLedger(); }}>
            Record Farmer Repayment
          </Button>
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
                type={mode === 'credit_issue' ? 'primary' : 'default'}
                onClick={() => setMode('credit_issue')}
                style={{
                  backgroundColor: mode === 'credit_issue' ? '#153d2d' : '#fff',
                  borderColor: mode === 'credit_issue' ? '#153d2d' : '#d9d9d9',
                  borderRadius: 8,
                  height: 38,
                  fontWeight: 600,
                }}
              >
                Input Credit / Harvest Recovery
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
                : 'Inputs leave the store now and are recorded as a farmer balance. Recover the agreed amount from accepted harvest, installments or a farmer service-point repayment. Seeds and fertiliser are consumables, so this records credit rather than a physical-return lease.'}
            </div>

            {/* Farmer / Contract Selectors */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12}>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>
                  FARMER / CUSTOMER
                </div>
                <Select
                  style={{ width: '100%' }}
                  value={selectedFarmer || undefined}
                  onChange={setSelectedFarmer}
                  showSearch
                  placeholder="Choose a registered farmer"
                  optionFilterProp="children"
                >
                  <Select.Option value="walk-in">Walk-in Customer (Retail)</Select.Option>
                  {growers.filter(g => g.status === 'active').map(g => (
                    <Select.Option key={g.id} value={String(g.id)}>{g.name} · {g.code}{Number(g.input_credit) > 0 ? ` · Due KES ${Number(g.input_credit).toLocaleString()}` : ''}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>
                  ISSUE FROM STORE
                </div>
                <Select
                  style={{ width: '100%' }}
                  value={warehouseId}
                  onChange={(value) => { setWarehouseId(value); setCart({}); }}
                  placeholder="Select the issuing store"
                >
                  {warehouses.map((warehouse) => <Select.Option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.location ? ` · ${warehouse.location}` : ''}</Select.Option>)}
                </Select>
              </Col>
            </Row>

            {selectedGrower?.contract_ref && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`Farmer contract: ${selectedGrower.contract_ref} · Current input balance KES ${Number(selectedGrower.input_credit || 0).toLocaleString()}`} />}

            <Divider style={{ margin: '14px 0' }} />

            {/* Product Item Rows with Quantity Pickers */}
            <Title level={5} style={{ marginBottom: 12, color: '#153d2d' }}>Available Inputs & Seed Stock</Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {products.map((p) => {
                const qtyInCart = cart[p.id] || 0;
                const available = availabilityByProduct[p.id] || 0;
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
                        {p.description || `${p.unit} pack`} · <Tag color={available > 0 ? 'blue' : 'default'} style={{ fontSize: 10 }}>{available} {p.unit} available in selected store</Tag>
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
                        disabled={!warehouseId || qtyInCart >= available}
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
                Select the farmer and issuing store, then add available inputs
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#738075', marginBottom: 6 }}>
              <span>Subtotal</span><span>KSh {subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#738075', marginBottom: 12 }}>
              <span>VAT</span><span>KSh {taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 700, color: '#153d2d', marginBottom: 16 }}>
              <span>Total Payable</span>
              <span>KSh {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
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

                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>INPUT AGREEMENT REFERENCE</div>
                <Input value={agreementRef} onChange={(e) => setAgreementRef(e.target.value)} placeholder={selectedGrower?.contract_ref || 'Agreement / issue reference'} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 11, color: '#738075', fontWeight: 600, marginBottom: 4 }}>AGREED REPAYMENT DATE (OPTIONAL)</div>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
              {mode === 'sale' ? 'Confirm Sale & Print Receipt' : 'Issue Inputs on Credit'}
            </Button>

            <div style={{ marginTop: 12, fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.4 }}>
              Stock is allocated by earliest-expiry batch. Receipt records the store, sold batches, quantities and farmer credit balance.
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
          message={`Today's POS value: KSh ${Number(cashUpData?.data?.summary?.grand_total || 0).toLocaleString()}`}
          description={`${cashUpData?.data?.summary?.total_txns || 0} counter sales and input-credit issues · Farmer repayments received: KSh ${Number(cashUpData?.data?.summary?.repayments_total || 0).toLocaleString()}`}
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
        <Divider />
        <Title level={5}>Farmer credit repayments</Title>
        <Table
          dataSource={cashUpData?.data?.repayments || []}
          rowKey="mode"
          pagination={false}
          size="small"
          columns={[
            { title: 'Received by', dataIndex: 'mode', key: 'mode', render: (mode) => <Tag color="green">{String(mode).replace('_', ' ').toUpperCase()}</Tag> },
            { title: 'Payments', dataIndex: 'count', key: 'count' },
            { title: 'Amount recovered', dataIndex: 'amount', key: 'amount', render: (amount) => `KSh ${Number(amount || 0).toLocaleString()}` },
          ]}
          locale={{ emptyText: 'No farmer repayments recorded today' }}
        />
      </Modal>

      <Modal
        title="Record Farmer Account Repayment"
        open={repaymentOpen}
        onCancel={() => setRepaymentOpen(false)}
        onOk={() => repaymentForm.submit()}
        confirmLoading={repaymentMutation.isPending}
        okText="Record Repayment"
        destroyOnClose
      >
        <Form form={repaymentForm} layout="vertical" onFinish={(values) => repaymentMutation.mutate(values)}>
          <Form.Item name="grower_id" label="Farmer with outstanding input credit" rules={[{ required: true, message: 'Choose a farmer account' }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select farmer">
              {(creditLedgerData?.data?.growers || growers).filter((grower) => Number(grower.input_credit) > 0).map((grower) => (
                <Select.Option key={grower.id} value={grower.id}>{grower.name} · {grower.code} — KES {Number(grower.input_credit).toLocaleString()} due</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount Received (KES)" rules={[{ required: true }]}>
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mode" label="Payment Method" initialValue="cash" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="cash">Cash</Select.Option>
                  <Select.Option value="mpesa">M-Pesa</Select.Option>
                  <Select.Option value="bank">Bank</Select.Option>
                  <Select.Option value="cheque">Cheque</Select.Option>
                  <Select.Option value="harvest_recovery">Harvest Recovery</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="date" label="Received Date" initialValue={new Date().toISOString().slice(0, 10)}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="reference" label="M-Pesa / Bank / Receipt Reference"><Input placeholder="Optional payment reference" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
          <Alert type="info" showIcon message="The payment will reduce the farmer's outstanding input balance. Payments greater than the balance will be rejected." />
        </Form>
      </Modal>

      <Modal
        title={receipt ? `${receipt.type === 'sale' ? 'Sales receipt' : 'Input credit issue'} · ${receipt.ref_no}` : 'Transaction receipt'}
        open={!!receipt}
        onCancel={() => setReceipt(null)}
        footer={[
          <Button key="close" onClick={() => setReceipt(null)}>Close</Button>,
          <Button key="print" type="primary" onClick={() => window.print()} style={{ backgroundColor: '#153d2d' }}>Print receipt</Button>,
        ]}
      >
        {receipt && <>
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Customer / Farmer">{receipt.farmer_name}</Descriptions.Item>
            <Descriptions.Item label="Receipt reference">{receipt.ref_no}</Descriptions.Item>
            <Descriptions.Item label="Store">{warehouses.find((warehouse) => warehouse.id === receipt.warehouse_id)?.name || 'Selected store'}</Descriptions.Item>
            <Descriptions.Item label="Transaction">{receipt.type === 'sale' ? 'Paid sale' : 'Input credit issue'}</Descriptions.Item>
            {receipt.credit_balance !== null && <Descriptions.Item label="Farmer balance after issue">KSh {Number(receipt.credit_balance).toLocaleString()}</Descriptions.Item>}
          </Descriptions>
          <Table
            dataSource={receipt.items || []}
            rowKey={(item, index) => `${item.sku}-${item.batch}-${index}`}
            pagination={false}
            size="small"
            columns={[
              { title: 'Product', dataIndex: 'product', key: 'product' },
              { title: 'Batch', dataIndex: 'batch', key: 'batch' },
              { title: 'Qty', dataIndex: 'quantity', key: 'qty', render: (qty, item) => `${qty} ${item.unit}` },
              { title: 'Line total', dataIndex: 'total', key: 'total', render: (amount) => `KES ${Number(amount).toLocaleString()}` },
            ]}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}><Text strong>Total incl. VAT: KES {Number(receipt.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text></div>
        </>}
      </Modal>
    </div>
  );
}
