/**
 * api.js - Axios instance configured with JWT authentication
 * Automatically attaches token to every request and handles 401 errors.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle token expiry - try refresh, else logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (refresh) {
          const res = await axios.post(`${API_BASE}/auth/token/refresh/`, { refresh });
          localStorage.setItem('access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        }
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const authAPI = {
  login: (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  getProfile: () => api.get('/auth/profile/'),
};

// --- Inventory ---
export const inventoryAPI = {
  getProducts: (params) => api.get('/inventory/products/', { params }),
  getProduct: (id) => api.get(`/inventory/products/${id}/`),
  createProduct: (data) => api.post('/inventory/products/', data),
  updateProduct: (id, data) => api.patch(`/inventory/products/${id}/`, data),
  deleteProduct: (id) => api.delete(`/inventory/products/${id}/`),
  updateStock: (id, data) => api.post(`/inventory/products/${id}/update-stock/`, data),
  getLowStock: () => api.get('/inventory/products/low-stock/'),
  getSummary: () => api.get('/inventory/products/summary/'),
  getCategories: () => api.get('/inventory/categories/'),
  createCategory: (data) => api.post('/inventory/categories/', data),
  getMovements: (params) => api.get('/inventory/movements/', { params }),
};

// --- Orders ---
export const ordersAPI = {
  getOrders: (params) => api.get('/orders/', { params }),
  getOrder: (id) => api.get(`/orders/${id}/`),
  createOrder: (data) => api.post('/orders/', data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/update-status/`, { status }),
  getRecentOrders: () => api.get('/orders/recent/'),
  getSalesSummary: (days) => api.get('/orders/sales/summary/', { params: { days } }),
  getMonthlyRevenue: () => api.get('/orders/sales/monthly/'),
};

// --- Analytics ---
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard/'),
  getRevenueTrend: () => api.get('/analytics/revenue-trend/'),
  getDailyTrend: (days) => api.get('/analytics/daily-trend/', { params: { days } }),
  getCategoryPerformance: () => api.get('/analytics/category-performance/'),
  getInventoryStatus: () => api.get('/analytics/inventory-status/'),
  getRestockSuggestions: () => api.get('/analytics/restock-suggestions/'),
  getTopProducts: (limit, days) => api.get('/analytics/top-products/', { params: { limit, days } }),
};

// --- ML ---
export const mlAPI = {
  predictDemand: (productId, days, model) =>
    api.get(`/ml/predict/${productId}/`, { params: { days, model } }),
  predictAll: () => api.get('/ml/predict-all/'),
  recommend: (productId) => api.get(`/ml/recommend/${productId}/`),
  getForecastChart: (productId, days) =>
    api.get(`/ml/forecast-chart/${productId}/`, { params: { days } }),
};

export default api;
