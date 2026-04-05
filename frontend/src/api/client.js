import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
});

export const getAlerts = (params = {}) => api.get('/api/alerts', { params });
export const getStats = () => api.get('/api/stats');
export const getStatus = () => api.get('/api/status');
export const runAnalysis = (settings = {}) => api.get('/api/run-analysis', { params: settings });
export const runAnalysisWithLogs = (logs, settings = {}) =>
  api.post('/api/run-analysis', { logs }, { params: settings });

export const login = (data) => api.post('/api/auth/login', data);
export const signup = (data) => api.post('/api/auth/signup', data);

export const uploadLogs = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/api/upload-logs', form).catch(err => {
    console.error('Upload error:', err.response?.data);
    throw err;
  });
};

export const loadSampleData = () => api.get('/api/sample-data')

export const updateAlertStatus = (incidentId, status) => {
  return api.patch(`/api/alerts/${incidentId}/status`, { status });
};

export const updateAlertNotes = (incident_id, notes) =>
  api.patch(`/api/alerts/${incident_id}/notes`, { notes })

export const getIncidentReport = (incident_id) =>
  api.get(`/api/report/${incident_id}`)

// Downloads the full AI-generated incident report as a styled Excel file
// Includes severity-colored rows, LLM summaries, MITRE, playbook actions, etc.
export const exportReportCSV = () => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const url  = `${base}/api/report/export/xlsx`
  const link = document.createElement('a')
  link.href  = url
  link.download = 'soc-ai-incident-report.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default api;