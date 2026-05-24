import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { analyticsAPI } from '../services/api';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [inventoryStatus, setInventoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.getDashboard(),
      analyticsAPI.getRevenueTrend(),
      analyticsAPI.getCategoryPerformance(),
      analyticsAPI.getInventoryStatus(),
    ]).then(([d, r, c, i]) => {
      setDashboard(d.data);
      setRevenueTrend(r.data);
      setCategoryData(c.data);
      setInventoryStatus(i.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const kpis = [
    {
      label: 'Revenue This Month',
      value: `$${(dashboard?.revenue?.this_month || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `${dashboard?.revenue?.change_percent > 0 ? '+' : ''}${dashboard?.revenue?.change_percent}% vs last month`,
      changeClass: dashboard?.revenue?.change_percent >= 0 ? 'up' : 'down',
      icon: '💰', iconBg: '#eff6ff',
    },
    {
      label: 'Orders This Month',
      value: dashboard?.orders?.this_month || 0,
      change: 'Total confirmed orders',
      changeClass: '',
      icon: '🛒', iconBg: '#f0fdf4',
    },
    {
      label: 'Total Products',
      value: dashboard?.inventory?.total_products || 0,
      change: 'Active products in catalog',
      changeClass: '',
      icon: '📦', iconBg: '#fff7ed',
    },
    {
      label: 'Low Stock Alerts',
      value: dashboard?.inventory?.low_stock_alerts || 0,
      change: 'Products need restocking',
      changeClass: dashboard?.inventory?.low_stock_alerts > 0 ? 'down' : 'up',
      icon: '⚠️', iconBg: '#fef2f2',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's your store overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: kpi.iconBg }}>{kpi.icon}</div>
            <div className="stat-label">{kpi.label}</div>
            <div className="stat-value">{kpi.value}</div>
            <div className={`stat-change ${kpi.changeClass}`}>{kpi.change}</div>
          </div>
        ))}
      </div>

      {/* Revenue Trend + Inventory Pie */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-title">Monthly Revenue Trend</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Inventory Health</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={inventoryStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {inventoryStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Performance + Top Products */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Category Performance (Last 30 Days)</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>Top Selling Products</div>
            <Link to="/analytics" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Product</th><th>Units</th><th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.top_products || []).map((p, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{p.product__name}</td>
                    <td>{p.total_sold}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>${Number(p.total_revenue || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {!dashboard?.top_products?.length && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No sales data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
