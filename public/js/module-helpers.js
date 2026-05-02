/**
 * module-helpers.js — utilitários comuns das páginas de módulo.
 *
 * Funções globais expostas:
 *   apiCall(method, path, body)  → fetch wrapper que retorna JSON ou lança erro
 *   showOutput(targetId, data, type)  → renderiza output formatado num div
 *   showError(targetId, msg)
 *   formatJson(obj)  → formata JSON com syntax highlight básico
 *   showSpinner(button)  / hideSpinner(button)
 */
(function() {
  // Migração transparente de chaves antigas → novo prefixo nx_
  // (one-shot, evita deslogar usuários que já tinham sessão)
  try {
    ['token', 'theme'].forEach(k => {
      const oldVal = localStorage.getItem('maranet_' + k);
      if (oldVal && !localStorage.getItem('nx_' + k)) {
        localStorage.setItem('nx_' + k, oldVal);
      }
      localStorage.removeItem('maranet_' + k);
    });
  } catch { /* ignore */ }

  async function apiCall(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function showOutput(targetId, data, type = 'success') {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.classList.remove('success', 'error');
    el.classList.add(type);
    el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    el.style.display = 'block';
  }

  function showError(targetId, msg) {
    showOutput(targetId, msg, 'error');
  }

  function formatJson(obj) {
    return JSON.stringify(obj, null, 2);
  }

  function showSpinner(button) {
    if (!button) return;
    button._originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span> Processando...';
    button.disabled = true;
  }

  function hideSpinner(button) {
    if (!button || !button._originalText) return;
    button.innerHTML = button._originalText;
    button.disabled = false;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }

  function formatBRL(n) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
  }

  function formatRelative(isoDate) {
    if (!isoDate) return 'N/D';
    const diff = Date.now() - new Date(isoDate).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min atrás`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h atrás`;
    return `${Math.floor(hr / 24)}d atrás`;
  }

  window.NEXUS = { apiCall, showOutput, showError, formatJson, showSpinner, hideSpinner, escapeHtml, formatBRL, formatRelative };
})();
