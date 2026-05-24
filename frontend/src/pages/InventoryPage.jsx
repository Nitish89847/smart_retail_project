import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI } from '../services/api';

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [summary, setSummary] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: '', movement_type: 'purchase', notes: '' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, sumRes] = await Promise.all([
        inventoryAPI.getProducts({ search, page_size: 100 }),
        inventoryAPI.getSummary(),
      ]);
      setProducts(prodRes.data.results || prodRes.data);
      setSummary(sumRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = products.filter(p => {
    if (!p.inventory) return filter === 'all';
    const s = p.inventory.stock_status;
    if (filter === 'low') return s === 'low_stock';
    if (filter === 'out') return s === 'out_of_stock';
    if (filter === 'ok') return s === 'in_stock';
    return true;
  });

  const handleUpdateStock = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await inventoryAPI.updateStock(stockModal.id, {
        quantity: parseInt(stockForm.quantity),
        movement_type: stockForm.movement_type,
        notes: stockForm.notes,
      });
      setStockModal(null);
      setSuccessMsg('Stock updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update stock');
    } finally { setSaving(false); }
  };

  const getStatusBadge = (inv) => {
    if (!inv) return <span className="badge badge-gray">N/A</span>;
    const map = { in_stock: ['badge-green', 'In Stock'], low_stock: ['badge-yellow', 'Low Stock'], out_of_stock: ['badge-red', 'Out of Stock'] };
    const [cls, lbl] = map[inv.stock_status] || ['badge-gray', 'Unknown'];
    return <span className={`badge ${cls}`}>{lbl}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Inventory Management</h1>
        <p>Monitor stock levels and manage restocking</p>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* Summary Cards */}
      {summary && (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Products', value: summary.total_products, icon: '📦', color: '#eff6ff' },
            { label: 'In Stock', value: summary.in_stock, icon: '✅', color: '#f0fdf4' },
            { label: 'Low Stock', value: summary.low_stock, icon: '⚠️', color: '#fffbeb' },
            { label: 'Out of Stock', value: summary.out_of_stock, icon: '🚫', color: '#fef2f2' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: s.color }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <div className="search-input">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search products..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          {['all', 'ok', 'low', 'out'].map(f => (
            <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter(f)}>
              {{ all: 'All', ok: '✅ In Stock', low: '⚠️ Low Stock', out: '🚫 Out of Stock' }[f]}
            </button>
          ))}
        </div>

        {loading ? <div className="loading">Loading inventory...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Category</th><th>Qty</th><th>Reorder Point</th><th>Status</th><th>Last Restocked</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={p.inventory?.stock_status === 'out_of_stock' ? { background: '#fff5f5' } : p.inventory?.stock_status === 'low_stock' ? { background: '#fffdf0' } : {}}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{p.sku}</code></td>
                    <td>{p.category_name || '—'}</td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 15, color: p.inventory?.quantity === 0 ? 'var(--danger)' : p.inventory?.is_low_stock ? 'var(--warning)' : 'var(--success)' }}>
                        {p.inventory?.quantity ?? '—'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.inventory?.reorder_point ?? '—'}</td>
                    <td>{getStatusBadge(p.inventory)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.inventory?.last_restocked ? new Date(p.inventory.last_restocked).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setStockModal(p); setStockForm({ quantity: '', movement_type: 'purchase', notes: '' }); }}>
                        Update Stock
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={8}><div className="empty-state"><h3>No products match this filter</h3></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Update Stock: {stockModal.name}</div>
              <button className="modal-close" onClick={() => setStockModal(null)}>×</button>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              Current stock: <strong>{stockModal.inventory?.quantity ?? 0}</strong> units
            </div>
            <form onSubmit={handleUpdateStock}>
              <div className="form-group">
                <label className="form-label">Movement Type *</label>
                <select className="form-select" value={stockForm.movement_type}
                  onChange={e => setStockForm({ ...stockForm, movement_type: e.target.value })}>
                  <option value="purchase">📥 Purchase / Restock</option>
                  <option value="sale">📤 Manual Sale</option>
                  <option value="adjustment">🔧 Manual Adjustment</option>
                  <option value="return">↩️ Return</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(use negative to reduce)</span></label>
                <input className="form-input" type="number" required value={stockForm.quantity}
                  onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })}
                  placeholder="e.g. 50 or -5" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={stockForm.notes}
                  onChange={e => setStockForm({ ...stockForm, notes: e.target.value })}
                  placeholder="Optional reason or reference" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Updating...' : 'Update Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
