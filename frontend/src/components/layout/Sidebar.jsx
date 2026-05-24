import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/products', icon: '📦', label: 'Products' },
  { path: '/inventory', icon: '🏪', label: 'Inventory' },
  { path: '/orders', icon: '🛒', label: 'Orders' },
  { path: '/analytics', icon: '📈', label: 'Analytics' },
  { path: '/predictions', icon: '🤖', label: 'AI Predictions' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🏬</span>
        <div>
          <div className="brand-name">SmartRetail</div>
          <div className="brand-sub">AI Analytics</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.first_name || user?.username}</div>
            <div className="user-role">{user?.profile?.role || 'staff'}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Logout">⏻</button>
      </div>
    </aside>
  );
}
