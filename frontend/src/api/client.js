import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
});

export const getAlerts = (params = {}) => api.get('/api/alerts', { params });
export const getStats = () => api.get('/api/stats');
export const getStatus = () => api.get('/api/status');
export const runAnalysis = () => api.post('/api/run-analysis');

export const updateAlertStatus = (incidentId, status) => {
  return fetch(`http://127.0.0.1:8000/api/alerts/${incidentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
};

export const updateAlertNotes = (incident_id, notes) =>
  api.patch(`/api/alerts/${incident_id}/notes`, { notes })

export default api;