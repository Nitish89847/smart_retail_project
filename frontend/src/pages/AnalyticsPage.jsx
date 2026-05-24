import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { analyticsAPI } from '../services/api';

export default function AnalyticsPage() {
  const [dailyTrend, setDailyTrend] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [restockSuggestions, setRestockSuggestions] = useState([]);
  const [inventoryStatus, setInventoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsAPI.getDailyTrend(days),
      analyticsAPI.getCategoryPerformance(),
      analyticsAPI.getTopProducts(10, days),
      analyticsAPI.getRestockSuggestions(),
      analyticsAPI.getInventoryStatus(),
    ]).then(([d, c, t, r, i]) => {
      setDailyTrend(d.data);
      setCategoryData(c.data);
      setTopProducts(t.data);
      setRestockSuggestions(r.data);
      setInventoryStatus(i.data);
    }).finally(() => setLoading(false));
  }, [days]);

  const urgencyBadge = (u) => {
    const map = { critical: 'badge-red', high: 'badge-yellow', medium: 'badge-blue', low: 'badge-green' };
    return <span className={`badge ${map[u] || 'badge-gray'}`}>{u}</span>;
  };

  if (loading) return <div className="loading">Loading analytics...</div>;

  const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Analytics</h1><p>Sales trends, category performance, and restocking insights</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 14, 30, 90].map(d => (
            <button key={d} className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(d)}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Daily Revenue Trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Daily Revenue — Last {days} Days</div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={Math.floor(dailyTrend.length / 10)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v, n) => [n === 'revenue' ? `$${v.toFixed(2)}` : v, n === 'revenue' ? 'Revenue' : 'Units']} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[3, 3, 0, 0]} name="revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Category Performance */}
        <div className="card">
          <div className="card-title">Category Performance</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={90}
                  label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Health */}
        <div className="card">
          <div className="card-title">Inventory Health</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={inventoryStatus} dataKey="value" cx="50%" cy="50%" outerRadius={80}>
                  {inventoryStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Top Products by Revenue (Last {days} Days)</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rank</th><th>Product</th><th>SKU</th><th>Category</th><th>Units Sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? ['#ffd700','#c0c0c0','#cd7f32'][i] : 'var(--bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                      {i + 1}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><code style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{p.sku}</code></td>
                  <td>{p.category || '—'}</td>
                  <td>{p.units_sold}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>${p.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {!topProducts.length && <tr><td colSpan={6}><div className="empty-state"><h3>No sales data for this period</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Smart Restock Suggestions */}
      <div className="card">
        <div className="card-title">🤖 Smart Restock Suggestions</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          AI-generated suggestions based on current stock levels and sales velocity.
        </p>
        {restockSuggestions.length === 0 ? (
          <div className="empty-state"><h3>✅ All stock levels are healthy!</h3></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Daily Velocity</th><th>Days to Stockout</th><th>Suggest Qty</th><th>Urgency</th><th>Reason</th></tr></thead>
              <tbody>
                {restockSuggestions.map((s, i) => (
                  <tr key={i} style={{ background: s.urgency === 'critical' ? '#fff5f5' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{s.product_name}</td>
                    <td>{s.category}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: s.current_stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                        {s.current_stock}
                      </span>
                    </td>
                    <td>{s.daily_velocity}/day</td>
                    <td>{s.days_to_stockout ? `~${s.days_to_stockout}d` : '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.suggested_quantity}</td>
                    <td>{urgencyBadge(s.urgency)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}