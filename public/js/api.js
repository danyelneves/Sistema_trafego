/**
 * api.js — wrapper de fetch para a API do backend.
 */
async function call(path, { method = 'GET', body, query } = {}) {
  const url = new URL(path, location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (res.status === 401) { location.href = '/login'; throw new Error('não autenticado'); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

export const api = {
  me:         ()         => call('/api/auth/me'),
  logout:     ()         => call('/api/auth/logout', { method: 'POST' }),
  settings:   ()         => call('/api/settings'),
  getViewerLink: ()      => call('/api/auth/viewer-link'),

  campaigns:      (q)    => call('/api/campaigns', { query: q }),
  createCampaign: (body) => call('/api/campaigns', { method: 'POST', body }),
  updateCampaign: (id, body) => call(`/api/campaigns/${id}`, { method: 'PATCH', body }),
  deleteCampaign: (id)   => call(`/api/campaigns/${id}`, { method: 'DELETE' }),

  daily:      (q)        => call('/api/metrics/daily', { query: q }),
  upsertDaily:(body)     => call('/api/metrics/daily', { method: 'POST', body }),
  bulkDaily:  (rows)     => call('/api/metrics/bulk',  { method: 'POST', body: rows }),
  monthly:    (q)        => call('/api/metrics/monthly', { query: q }),
  summary:    (q)        => call('/api/metrics/summary', { query: q }),
  byCampaign: (q)        => call('/api/metrics/by-campaign', { query: q }),
  kpis:       (q)        => call('/api/metrics/kpis', { query: q }),
  demographics: (q)      => call('/api/metrics/demographics', { query: q }),
  placements:   (q)      => call('/api/metrics/placements', { query: q }),
  ads:        (q)        => call('/api/metrics/ads', { query: q }),
  aiInsights: (q)        => call('/api/ai/insights', { query: q }),

  goals:        (q)      => call('/api/goals', { query: q }),
  upsertGoal:   (body)   => call('/api/goals', { method: 'POST', body }),
  deleteGoal:   (id)     => call(`/api/goals/${id}`, { method: 'DELETE' }),

  notes:        (q)      => call('/api/notes', { query: q }),
  createNote:   (body)   => call('/api/notes', { method: 'POST', body }),
  deleteNote:   (id)     => call(`/api/notes/${id}`, { method: 'DELETE' }),

  // Usuários
  users:        ()             => call('/api/users'),
  createUser:   (body)         => call('/api/users', { method: 'POST', body }),
  updateUser:   (id, body)     => call(`/api/users/${id}`, { method: 'PATCH', body }),
  deleteUser:   (id)           => call(`/api/users/${id}`, { method: 'DELETE' }),

  // Workspaces
  getWorkspaces:   ()          => call('/api/workspaces'),
  switchWorkspace: (wId)       => call('/api/workspaces/switch', { method: 'POST', body: { workspace_id: wId } }),

  // Alertas
  alertConfigs:       ()       => call('/api/alerts/config'),
  createAlertConfig:  (body)   => call('/api/alerts/config', { method: 'POST', body }),
  toggleAlert:        (id, on) => call(`/api/alerts/config/${id}`, { method: 'PATCH', body: { active: on } }),
  deleteAlertConfig:  (id)     => call(`/api/alerts/config/${id}`, { method: 'DELETE' }),
  testAlert:          (email)  => call('/api/alerts/test', { method: 'POST', body: { email } }),
  alertLog:           ()       => call('/api/alerts/log'),

  // Importação CSV
  importCSV:    (csv)          => call('/api/import/csv', { method: 'POST', body: { csv } }),

  // Drill-down campanha
  drill:        (id, q)        => call(`/api/drill/${id}`, { query: q }),

  // Sincronização Google Ads / Meta
  syncStatus:   ()             => call('/api/sync/status'),
  syncGoogle:   (body)         => call('/api/sync/google', { method: 'POST', body }),
  syncMeta:     (body)         => call('/api/sync/meta',   { method: 'POST', body }),
};
