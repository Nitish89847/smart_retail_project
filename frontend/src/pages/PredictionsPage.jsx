import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { mlAPI, inventoryAPI } from '../services/api';

export default function PredictionsPage() {
  const [allPredictions, setAllPredictions] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [modelType, setModelType] = useState('random_forest');
  const [forecastDays, setForecastDays] = useState(30);
  const [chartData, setChartData] = useState(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [chartError, setChartError] = useState('');

  // Load summary predictions for all products on mount
  useEffect(() => {
    setLoadingAll(true);
    mlAPI.predictAll()
      .then(r => setAllPredictions(r.data))
      .catch(console.error)
      .finally(() => setLoadingAll(false));

    inventoryAPI.getProducts({ page_size: 200 })
      .then(r => setProducts(r.data.results || r.data))
      .catch(console.error);
  }, []);

  // Load forecast chart for selected product
  const handleForecast = async () => {
    if (!selectedProduct) return;
    setLoadingChart(true);
    setChartError('');
    setChartData(null);
    setRecommendations(null);
    try {
      const [chartRes, recRes] = await Promise.all([
        mlAPI.getForecastChart(selectedProduct, forecastDays),
        mlAPI.recommend(selectedProduct),
      ]);
      setChartData(chartRes.data);
      setRecommendations(recRes.data);
    } catch (err) {
      setChartError('Failed to load forecast. Please try again.');
      console.error(err);
    } finally {
      setLoadingChart(false);
    }
  };

  // Merge historical + forecast for the chart
  const buildChartData = () => {
    if (!chartData) return [];
    const hist = (chartData.historical || []).map(h => ({
      date: h.date,
      actual: h.actual,
      predicted: null,
    }));
    const forecast = (chartData.forecast || []).map(f => ({
      date: f.date,
      actual: null,
      predicted: f.predicted,
    }));
    return [...hist, ...forecast];
  };

  const coverageBadge = (covers) =>
    covers
      ? <span className="badge badge-green">✅ Sufficient</span>
      : <span className="badge badge-red">⚠️ Restock Needed</span>;

  const confidenceColor = (conf) => {
    if (conf >= 70) return 'var(--success)';
    if (conf >= 40) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div>
      <div className="page-header">
        <h1>🤖 AI Demand Predictions</h1>
        <p>Machine learning demand forecasting using Random Forest &amp; Linear Regression</p>
      </div>

      {/* Model Info Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', borderRadius: 10, padding: '16px 24px', marginBottom: 24, color: 'white', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {[
          { icon: '🌲', title: 'Random Forest', desc: '100 decision trees — high accuracy for complex patterns' },
          { icon: '📉', title: 'Linear Regression', desc: 'Fast, interpretable baseline for trend analysis' },
          { icon: '⚙️', title: 'Feature Engineering', desc: 'Lag features, rolling averages, seasonality signals' },
          { icon: '📊', title: 'Metrics', desc: 'MAE & R² score reported for every prediction' },
        ].map((item, i) => (
          <div key={i} style={{ flex: '1 1 180px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Forecast Chart Panel */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Product Demand Forecast</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '2 1 200px', marginBottom: 0 }}>
            <label className="form-label">Select Product</label>
            <select className="form-select" value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}>
              <option value="">-- Choose a product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label className="form-label">ML Model</label>
            <select className="form-select" value={modelType}
              onChange={e => setModelType(e.target.value)}>
              <option value="random_forest">🌲 Random Forest</option>
              <option value="linear_regression">📉 Linear Regression</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 120px', marginBottom: 0 }}>
            <label className="form-label">Forecast Days</label>
            <select className="form-select" value={forecastDays}
              onChange={e => setForecastDays(Number(e.target.value))}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginBottom: 0, height: 36 }}
            onClick={handleForecast}
            disabled={!selectedProduct || loadingChart}
          >
            {loadingChart ? '⏳ Forecasting...' : '🚀 Run Forecast'}
          </button>
        </div>

        {chartError && <div className="alert alert-error">{chartError}</div>}

        {loadingChart && (
          <div className="loading" style={{ height: 300 }}>
            Running ML model... training on sales history...
          </div>
        )}

        {chartData && !loadingChart && (
          <>
            {/* Metrics */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Product', value: chartData.product_name },
                { label: 'Model', value: chartData.metrics?.model_type?.replace('_', ' ') },
                { label: 'Training Samples', value: chartData.metrics?.training_samples },
                { label: 'MAE', value: chartData.metrics?.mae?.toFixed(2) },
                { label: 'R² Score', value: chartData.metrics?.r2_score?.toFixed(3) },
              ].map((m, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 16px', flex: '1 1 120px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{m.value ?? '—'}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={buildChartData()} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-30} textAnchor="end"
                    interval={Math.floor(buildChartData().length / 12)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2}
                    dot={{ r: 2 }} name="Actual Sales" connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2}
                    strokeDasharray="5 5" dot={{ r: 2 }} name="AI Forecast" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {!chartData && !loadingChart && (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <h3>Select a product and run a forecast</h3>
            <p>The AI model will train on historical sales data and predict future demand.</p>
          </div>
        )}
      </div>

      {/* Product Recommendations */}
      {recommendations && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">🛍️ Frequently Bought Together — {recommendations.product_name}</div>
          {recommendations.recommendations.length === 0 ? (
            <div className="empty-state"><h3>No co-purchase data yet</h3><p>More orders needed to generate recommendations.</p></div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {recommendations.recommendations.map((r, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', flex: '1 1 160px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.product_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Co-purchased {r.score} time{r.score !== 1 ? 's' : ''}</div>
                  <div style={{ marginTop: 8 }}>
                    {'⭐'.repeat(Math.min(5, Math.ceil(r.score / 2)))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Products 7-Day Prediction Table */}
      <div className="card">
        <div className="card-title">📋 7-Day Demand Forecast — All Products</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Random Forest predictions trained on each product's sales history. Products needing restock are shown first.
        </p>

        {loadingAll ? (
          <div className="loading">Training models for all products...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Predicted 7d Demand</th>
                  <th>Model Confidence</th>
                  <th>Stock Coverage</th>
                </tr>
              </thead>
              <tbody>
                {allPredictions.map((p, i) => (
                  <tr key={i}
                    style={{ background: !p.stock_covers_demand ? '#fff5f5' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{p.product_name}</td>
                    <td>{p.category}</td>
                    <td>
                      <span style={{ fontWeight: 700,
                        color: p.current_stock === 0 ? 'var(--danger)'
                          : p.current_stock < p.predicted_demand_7d ? 'var(--warning)'
                          : 'var(--success)' }}>
                        {p.current_stock}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      ~{p.predicted_demand_7d} units
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, p.confidence)}%`,
                            background: confidenceColor(p.confidence),
                            borderRadius: 3,
                            transition: 'width 0.5s',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: confidenceColor(p.confidence), minWidth: 35 }}>
                          {p.confidence}%
                        </span>
                      </div>
                    </td>
                    <td>{coverageBadge(p.stock_covers_demand)}</td>
                  </tr>
                ))}
                {!allPredictions.length && (
                  <tr><td colSpan={6}>
                    <div className="empty-state"><h3>No products found</h3></div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
