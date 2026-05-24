import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI, inventoryAPI } from '../services/api';

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue',
  shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red'
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [products, setProducts] = useState([]);
  const [orderForm, setOrderForm] = useState({ customer_name: '', customer_email: '', discount: 0, notes: '', items: [] });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, ...(statusFilter && { status: statusFilter }) };
      const res = await ordersAPI.getOrders(params);
      setOrders(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { inventoryAPI.getProducts({ page_size: 200 }).then(r => setProducts(r.data.results || r.data)); }, []);

  const addItem = () => setOrderForm(f => ({ ...f, items: [...f.items, { product_id: '', quantity: 1 }] }));
  const removeItem = (i) => setOrderForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, key, val) => setOrderForm(f => {
    const items = [...f.items]; items[i] = { ...items[i], [key]: val }; return { ...f, items };
  });

  const calcTotal = () => orderForm.items.reduce((sum, item) => {
    const p = products.find(p => p.id === parseInt(item.product_id));
    return sum + (p ? parseFloat(p.price) * parseInt(item.quantity || 0) : 0);
  }, 0);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.items.length) { setCreateError('Add at least one product.'); return; }
    setSaving(true); setCreateError('');
    try {
      await ordersAPI.createOrder({
        ...orderForm,
        items: orderForm.items.map(i => ({ product_id: parseInt(i.product_id), quantity: parseInt(i.quantity) }))
      });
      setShowCreate(false);
      setOrderForm({ customer_name: '', customer_email: '', discount: 0, notes: '', items: [] });
      fetchOrders();
    } catch (err) {
      const d = err.response?.data;
      setCreateError(d ? (typeof d === 'string' ? d : Object.values(d).flat().join(' ')) : 'Failed to create order.');
    } finally { setSaving(false); }
  };

  const handleStatusUpdate = async (orderId, status) => {
    await ordersAPI.updateStatus(orderId, status);
    fetchOrders();
    if (detailOrder?.id === orderId) setDetailOrder(prev => ({ ...prev, status }));
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Orders</h1><p>Create and manage customer orders</p></div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateError(''); }}>+ New Order</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search orders or customers..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {['pending','confirmed','shipped','delivered','cancelled'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {loading ? <div className="loading">Loading orders...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{o.order_number}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                      {o.customer_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.customer_email}</div>}
                    </td>
                    <td>{o.items?.length || 0} item(s)</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>${Number(o.net_amount || o.total_amount).toFixed(2)}</td>
                    <td><span className={`badge ${STATUS_COLORS[o.status] || 'badge-gray'}`}>{o.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetailOrder(o)}>View</button>
                        {o.status === 'pending' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleStatusUpdate(o.id, 'confirmed')}>Confirm</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!orders.length && <tr><td colSpan={7}><div className="empty-state"><h3>No orders found</h3></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create New Order</div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            {createError && <div className="alert alert-error">{createError}</div>}
            <form onSubmit={handleCreateOrder}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input className="form-input" required value={orderForm.customer_name}
                    onChange={e => setOrderForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="John Smith" />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Email</label>
                  <input className="form-input" type="email" value={orderForm.customer_email}
                    onChange={e => setOrderForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="john@example.com" />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>Order Items *</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
                </div>
                {orderForm.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select className="form-select" value={item.product_id}
                      onChange={e => updateItem(i, 'product_id', e.target.value)} required>
                      <option value="">Select product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — ${Number(p.price).toFixed(2)} (Stock: {p.inventory?.quantity ?? 0})</option>
                      ))}
                    </select>
                    <input type="number" className="form-input" style={{ width: 70 }} min={1} value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)} required />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>×</button>
                  </div>
                ))}
                {!orderForm.items.length && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>No items added yet.</div>}
              </div>

              {orderForm.items.length > 0 && (
                <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontWeight: 600, fontSize: 15 }}>
                  Estimated Total: ${calcTotal().toFixed(2)}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Discount ($)</label>
                  <input className="form-input" type="number" step="0.01" value={orderForm.discount}
                    onChange={e => setOrderForm(f => ({ ...f, discount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={orderForm.notes}
                    onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div className="modal-overlay" onClick={() => setDetailOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Order: {detailOrder.order_number}</div>
              <button className="modal-close" onClick={() => setDetailOrder(null)}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><strong>Customer:</strong> {detailOrder.customer_name}</div>
                <span className={`badge ${STATUS_COLORS[detailOrder.status] || 'badge-gray'}`}>{detailOrder.status}</span>
              </div>
              {detailOrder.customer_email && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{detailOrder.customer_email}</div>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead><tr style={{ background: 'var(--bg)' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: 12 }}>Product</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: 12 }}>Qty</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: 12 }}>Price</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: 12 }}>Subtotal</th>
              </tr></thead>
              <tbody>
                {(detailOrder.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontSize: 13 }}>{item.product_name}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontSize: 13 }}>{item.quantity}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontSize: 13 }}>${Number(item.unit_price).toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>${Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              Total: ${Number(detailOrder.net_amount || detailOrder.total_amount).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {detailOrder.status === 'pending' && <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(detailOrder.id, 'confirmed')}>Confirm</button>}
              {detailOrder.status === 'confirmed' && <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(detailOrder.id, 'shipped')}>Mark Shipped</button>}
              {detailOrder.status === 'shipped' && <button className="btn btn-success btn-sm" onClick={() => handleStatusUpdate(detailOrder.id, 'delivered')}>Mark Delivered</button>}
              {['pending','confirmed'].includes(detailOrder.status) && <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(detailOrder.id, 'cancelled')}>Cancel</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
