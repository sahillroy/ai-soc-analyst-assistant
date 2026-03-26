import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
});

export const getAlerts = (params = {}) => api.get('/api/alerts', { params });
export const getStats = () => api.get('/api/stats');
export const getStatus = () => api.get('/api/status');
export const runAnalysis = () => api.post('/api/run-analysis');

export default api;