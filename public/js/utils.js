/**
 * utils.js — formatação, datas e helpers compartilhados.
 */

export const MESES       = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/** Formata número compacto (12.3k, 1.2M). */
export function fmtNum(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'k';
  return n.toLocaleString('pt-BR');
}

export function fmtInt(n) { return (Number(n)||0).toLocaleString('pt-BR'); }

/** Moeda BRL. */
export function fmtBRL(n, decimals = 0) {
  return (Number(n)||0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
}

/** Porcentagem com 2 casas. */
export function fmtPct(n, decimals = 2) {
  return ((Number(n)||0) * 100).toFixed(decimals) + '%';
}

/** Variação percentual segura. */
export function delta(cur, prev) {
  cur  = Number(cur)  || 0;
  prev = Number(prev) || 0;
  if (!prev) return cur ? 1 : 0;
  return (cur - prev) / Math.abs(prev);
}

/** Direção de variação considerando métrica (para CPL/spend menor é melhor). */
export function isGood(metric, d) {
  const lowerIsBetter = ['cpl','cpc','spend'];
  return lowerIsBetter.includes(metric) ? d < 0 : d > 0;
}

/** Debounce. */
export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Cria elemento com atributos e filhos (helper curto). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null || c === false) return;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  return el;
}

/** Toast no canto da tela. */
export function toast(msg, { error = false, ms = 3000 } = {}) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.toggle('error', !!error);
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

/** Retorna [from, to] YYYY-MM-DD para um período. */
export function rangeFor({ year, month, semester }) {
  const pad = (n) => String(n).padStart(2,'0');
  if (month) {
    const end = new Date(year, month, 0).getDate();
    return [`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(end)}`];
  }
  if (semester === 1) return [`${year}-01-01`, `${year}-06-30`];
  if (semester === 2) return [`${year}-07-01`, `${year}-12-31`];
  return [`${year}-01-01`, `${year}-12-31`];
}

/** Deriva KPIs a partir de totais brutos. */
export function deriveKpis(r) {
  const imp  = r.impressions || 0;
  const cli  = r.clicks || 0;
  const conv = r.conversions || 0;
  const spend= r.spend || 0;
  const rev  = r.revenue || 0;
  return {
    impressions: imp, clicks: cli, conversions: conv, spend, revenue: rev,
    ctr:  imp ? cli/imp : 0,
    cpc:  cli ? spend/cli : 0,
    cvr:  cli ? conv/cli : 0,
    cpl:  conv ? spend/conv : 0,
    roas: spend ? rev/spend : 0,
  };
}
