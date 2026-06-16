// Client API Layer mapping directly to FastAPI Backend endpoints
const API_BASE = '/api';

async function request(url, options = {}) {
  const headers = options.headers || {};
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP Error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // RFP / Tender Authoring
  listTenders: () => request('/rfp/list'),
  getTender: (id) => request(`/rfp/${id}`),
  generateRFP: (data) => request('/rfp/generate', { method: 'POST', body: data }),
  updateRFP: (id, data) => request(`/rfp/${id}`, { method: 'PUT', body: data }),

  // Pre-Bid Queries
  getPreBidQueries: (tenderId) => request(`/prebid/${tenderId}/queries`),
  analyzePreBidQuery: (data) => request('/prebid/analyze', { method: 'POST', body: data }),
  updatePreBidQuery: (id, data) => request(`/prebid/${id}`, { method: 'PUT', body: data }),
  generatePreBidReport: (tenderId) => request(`/prebid/${tenderId}/export_report`, { method: 'POST' }),

  // Document Processing
  uploadDocument: (formData) => request('/document/upload', { method: 'POST', body: formData }),
  extractDocumentMetadata: (docId) => request('/document/extract', { method: 'POST', body: { document_id: docId } }),
  getDocument: (id) => request(`/document/${id}`),
  getDocumentStatus: (id) => request(`/document/${id}/status`),
  updateDocumentMetadata: (id, data) => request(`/document/${id}`, { method: 'PUT', body: data }),
  commitDocument: (id) => request(`/document/${id}/commit`, { method: 'POST' }),
  getDocumentHistory: (tenderId) => request(`/document/history${tenderId ? `?tender_id=${tenderId}` : ''}`),
  getDocumentDownloadUrl: (id) => `${API_BASE}/document/${id}/download`,

  // Pre-Qualification
  evaluatePQ: (data) => request('/pq/evaluate', { method: 'POST', body: data }),
  getPQResults: (tenderId) => request(`/pq/${tenderId}/results`),

  // Technical Evaluation
  evaluateTechnical: (data) => request('/technical/evaluate', { method: 'POST', body: data }),
  getTechnicalResults: (tenderId) => request(`/technical/${tenderId}/results`),

  // Shortfall Detection
  analyzeShortfall: (data) => request('/shortfall/analyze', { method: 'POST', body: data }),

  // Financial Evaluation
  evaluateFinancial: (data) => request('/financial/evaluate', { method: 'POST', body: data }),
  getFinancialResults: (tenderId) => request(`/financial/${tenderId}/results`),

  // Final Recommendation
  generateRecommendation: (tenderId) => request('/recommendation/generate', { method: 'POST', body: { tender_id: tenderId } }),
  getRecommendationHistory: (tenderId) => request(`/recommendation/${tenderId}/history`),

  // Vendors
  registerVendor: (data) => request('/vendor/register', { method: 'POST', body: data }),
  listVendors: () => request('/vendor/list'),
  getVendor: (id) => request(`/vendor/${id}`),

  // Audit Trails
  getAuditLogs: (tenderId, module) => {
    let query = '';
    const params = ['limit=1000000'];
    if (tenderId) params.push(`tender_id=${tenderId}`);
    if (module) params.push(`module=${module}`);
    if (params.length > 0) query = `?${params.join('&')}`;
    return request(`/audit/logs${query}`);
  },
  getAuditSummary: () => request('/audit/summary'),

  // Dashboard Charts
  getDashboardStats: () => request('/dashboard/stats'),
};

export default api;
