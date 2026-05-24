import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', password2: '', role: 'staff', store_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.values(data).flat().join(' ');
        setError(msg);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const f = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <span className="auth-brand-icon">🏬</span>
          <h1>SmartRetail</h1>
          <p>AI-Powered Inventory & Analytics</p>
        </div>
        <div className="auth-features">
          <div className="auth-feature"><span>📊</span> Real-time analytics dashboard</div>
          <div className="auth-feature"><span>🤖</span> AI demand forecasting</div>
          <div className="auth-feature"><span>📦</span> Smart inventory management</div>
          <div className="auth-feature"><span>⚠️</span> Automatic restock alerts</div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h2>Create account</h2>
          <p className="auth-subtitle">Start managing your retail store</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" placeholder="John" {...f('first_name')} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" placeholder="Doe" {...f('last_name')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" placeholder="johndoe" required {...f('username')} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" placeholder="john@store.com" required {...f('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">Store Name</label>
              <input className="form-input" placeholder="My Retail Store" {...f('store_name')} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" required {...f('password')} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input className="form-input" type="password" required {...f('password2')} />
              </div>
            </div>
            <button className="btn btn-primary auth-btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}