import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI } from '../services/api';

const EMPTY_FORM = {
  name: '', sku: '', category: '', description: '',
  price: '', cost_price: '', initial_quantity: 0, reorder_point: 10
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, search, ...(categoryFilter && { category: categoryFilter }) };
      const res = await inventoryAPI.getProducts(params);
      setProducts(res.data.results || res.data);
      setTotalCount(res.data.count || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, categoryFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { inventoryAPI.getCategories().then(r => setCategories(r.data.results || r.data)); }, []);

  const openCreate = () => { setEditProduct(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, category: p.category || '', description: p.description || '', price: p.price, cost_price: p.cost_price, initial_quantity: 0, reorder_point: p.inventory?.reorder_point || 10 });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editProduct) {
        await inventoryAPI.updateProduct(editProduct.id, { name: form.name, category: form.category || null, description: form.description, price: form.price, cost_price: form.cost_price });
      } else {
        await inventoryAPI.createProduct(form);
      }
      setShowModal(false); fetchProducts();
    } catch (err) {
      const d = err.response?.data;
      setError(d ? Object.values(d).flat().join(' ') : 'Failed to save product.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await inventoryAPI.updateProduct(id, { is_active: false });
    fetchProducts();
  };

  const getStatusBadge = (inv) => {
    if (!inv) return <span className="badge badge-gray">No Inventory</span>;
    const cls = { in_stock: 'badge-green', low_stock: 'badge-yellow', out_of_stock: 'badge-red' };
    const label = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' };
    return <span className={`badge ${cls[inv.stock_status] || 'badge-gray'}`}>{label[inv.stock_status]}</span>;
  };

  const f = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Products</h1><p>Manage your product catalog</p></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Product</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search products..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select" style={{ width: 180 }} value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {loading ? <div className="loading">Loading products...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.description.slice(0, 50)}{p.description.length > 50 ? '...' : ''}</div>}
                    </td>
                    <td><code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{p.sku}</code></td>
                    <td>{p.category_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>${Number(p.price).toFixed(2)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>${Number(p.cost_price).toFixed(2)}</td>
                    <td>{p.inventory?.quantity ?? '—'}</td>
                    <td>{getStatusBadge(p.inventory)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={8}><div className="empty-state"><h3>No products found</h3><p>Add your first product to get started.</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {totalCount > 20 && (
          <div className="pagination">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page}</span>
            <button className="page-btn" disabled={products.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editProduct ? 'Edit Product' : 'Add New Product'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input className="form-input" required {...f('name')} placeholder="e.g. Wireless Earbuds Pro" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-input" required {...f('sku')} disabled={!!editProduct} placeholder="ELEC-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" {...f('category')}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Selling Price ($) *</label>
                  <input className="form-input" type="number" step="0.01" required {...f('price')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price ($)</label>
                  <input className="form-input" type="number" step="0.01" {...f('cost_price')} placeholder="0.00" />
                </div>
              </div>
              {!editProduct && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Initial Stock</label>
                    <input className="form-input" type="number" {...f('initial_quantity')} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reorder Point</label>
                    <input className="form-input" type="number" {...f('reorder_point')} placeholder="10" />
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" {...f('description')} placeholder="Brief product description..." />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editProduct ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}