/**
 * kpis.js — cards de KPI com sparklines, barra de progresso e semáforo.
 */
import { fmtNum, fmtInt, fmtBRL, fmtPct, delta, isGood } from './utils.js';

const LABELS = {
  impressions: 'Impressões',
  reach:       'Alcance',
  frequency:   'Frequência',
  video_views: 'Views de Vídeo',
  clicks:      'Cliques',
  conversions: 'Leads',
  spend:       'Investimento',
  sales:       'Vendas (CRM)',
  revenue:     'Receita',
  ctr:         'CTR',
  cpl:         'CPL',
  cpc:         'CPC',
  cvr:         'Tx Conversão',
  cac:         'CAC',
  roas:        'ROAS',
};

function formatVal(metric, v) {
  if (['spend', 'revenue', 'cpl', 'cpc', 'cac'].includes(metric)) return fmtBRL(v, 2);
  if (['ctr','cvr'].includes(metric))                             return fmtPct(v);
  if (['roas', 'frequency'].includes(metric))                     return (Number(v)||0).toFixed(2) + 'x';
  if (['impressions','reach','video_views','clicks', 'sales', 'conversions'].includes(metric)) return fmtNum(v);
  return fmtInt(v);
}

function deltaBadge(metric, cur, prev, label = 'vs anterior') {
  const d = delta(cur, prev);
  if (prev === 0 && cur === 0) return { class: 'flat', arrow: '•', pct: '—', label };
  const up  = d > 0;
  const cls = d === 0 ? 'flat' : (isGood(metric, d) ? 'up' : 'down');
  const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '•';
  const pct   = (Math.abs(d) * 100).toFixed(1) + '%';
  return { class: cls, arrow, pct, label };
}

function goalFor(metric, channel, goals) {
  const scope = goals.find(g => g.metric === metric && g.channel === channel);
  if (scope) return scope;
  if (channel !== 'all') return goals.find(g => g.metric === metric && g.channel === 'all') || null;
  return null;
}

function goalStatus(metric, value, goal) {
  if (!goal) return null;
  const ratio = goal.target ? (value / goal.target) : 0;
  const dir   = goal.direction || 'min';
  let state;
  if (dir === 'min') {
    state = ratio >= 1 ? 'ok' : ratio >= 0.8 ? 'warn' : 'bad';
  } else {
    state = ratio <= 1 ? 'ok' : ratio <= 1.1 ? 'warn' : 'bad';
  }
  return { state, ratio: Math.min(ratio, 1.5), ratioRaw: ratio, target: goal.target, direction: dir };
}

/**
 * Desenha um sparkline inline usando SVG.
 * @param {number[]} values - série de valores (máx 12 pontos)
 * @param {'up'|'down'|'flat'} trend
 */
function sparklineSVG(values, trend) {
  if (!values || values.length < 2) return '';
  const w = 80, h = 28, pad = 2;
  const max = Math.max(...values, 0.001);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts   = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const polyline = pts.map(p => p.join(',')).join(' ');
  // Área abaixo da linha
  const areaPath = `M${pts[0][0]},${h} ` + pts.map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length-1][0]},${h} Z`;
  const color = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : '#00ADA7';
  const alpha = trend === 'up' ? '0.15' : trend === 'down' ? '0.12' : '0.1';
  return `
    <svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none">
      <path d="${areaPath}" fill="${color}" fill-opacity="${alpha}"/>
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="2.5" fill="${color}"/>
    </svg>`;
}

/**
 * Barra de progresso da meta.
 */
function goalProgressBar(gs) {
  if (!gs) return '';
  const pct = Math.min(gs.ratio * 100, 100);
  const colorMap = { ok: '#4ade80', warn: '#facc15', bad: '#f87171' };
  const color = colorMap[gs.state];
  const label = gs.direction === 'min' ? 'da meta mínima' : 'do limite máximo';
  return `
    <div class="goal-progress-wrap">
      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${pct.toFixed(0)}%;background:${color}"></div>
      </div>
      <div class="goal-progress-label">
        <span class="goal-dot ${gs.state}"></span>
        <span>${pct.toFixed(0)}% ${label}</span>
        <span class="muted">· alvo: ${formatVal('spend' /* handled externally */, gs.target)}</span>
      </div>
    </div>`;
}

/**
 * Renderiza a grade de KPIs.
 * @param {HTMLElement} root
 * @param {{ current, previous, yoy }} data   agregados brutos
 * @param {'all'|'google'|'meta'} channel
 * @param {Array} goals
 * @param {Array} monthlyRows  - todas as linhas mensais do período (para sparklines)
 */
export function renderKPIs(root, data, channel, goals = [], monthlyRows = []) {
  const cur = data.current;
  const cards = channel === 'all'
    ? [
        { metric: 'impressions', cls: 'combined' },
        { metric: 'reach',       cls: 'combined' },
        { metric: 'conversions', cls: 'conv' },
        { metric: 'sales',       cls: 'combined' },
        { metric: 'spend',       cls: 'cost' },
        { metric: 'cpl',         cls: 'combined' },
        { metric: 'cac',         cls: 'cost' },
        { metric: 'roas',        cls: 'combined' },
      ]
    : [
        { metric: 'impressions', cls: channel },
        { metric: 'reach',       cls: channel },
        { metric: 'frequency',   cls: channel },
        { metric: 'video_views', cls: channel },
        { metric: 'conversions', cls: 'conv' },
        { metric: 'spend',       cls: 'cost' },
        { metric: 'cpl',         cls: channel },
        { metric: 'roas',        cls: channel },
      ];

  // Pré-calcula série mensal por métrica filtrada por canal
  function sparkSeries(metric) {
    const byMonth = {};
    monthlyRows.forEach(r => {
      if (channel !== 'all' && r.channel !== channel) return;
      const m = r.month;
      byMonth[m] = byMonth[m] || { imp:0, cli:0, conv:0, spend:0, rev:0, sales:0, reach:0, vv:0 };
      byMonth[m].imp   += r.impressions  || 0;
      byMonth[m].cli   += r.clicks       || 0;
      byMonth[m].conv  += r.conversions  || 0;
      byMonth[m].spend += r.spend        || 0;
      byMonth[m].rev   += r.revenue      || 0;
      byMonth[m].sales += r.sales        || 0;
      byMonth[m].reach += r.reach        || 0;
      byMonth[m].vv    += r.video_views  || 0;
    });
    return Object.keys(byMonth).sort((a,b)=>a-b).map(m => {
      const o = byMonth[m];
      const imp = o.imp, cli = o.cli, conv = o.conv, spend = o.spend, rev = o.rev, sales = o.sales, reach = o.reach, vv = o.vv;
      const derived = {
        impressions: imp, clicks: cli, conversions: conv, spend, revenue: rev, sales, reach, video_views: vv,
        ctr: imp   ? cli/imp    : 0,
        cpc: cli   ? spend/cli  : 0,
        cvr: cli   ? conv/cli   : 0,
        cpl: conv  ? spend/conv : 0,
        cac: sales ? spend/sales: 0,
        roas:spend ? rev/spend  : 0,
        frequency: reach ? imp/reach : 0,
      };
      return derived[metric] ?? 0;
    }).slice(-6); // últimos 6 meses
  }

  root.innerHTML = cards.map(({ metric, cls, extra }) => {
    const val  = cur[metric] ?? 0;
    const prev = data.previous?.[metric] ?? 0;
    const yoy  = data.yoy?.[metric]      ?? 0;

    const d1 = deltaBadge(metric, val, prev, 'vs período anterior');
    const d2 = deltaBadge(metric, val, yoy,  'vs ano anterior');

    const goal = goalFor(metric, channel, goals);
    const gs   = goalStatus(metric, val, goal);

    // Sparkline
    const series   = sparkSeries(metric);
    const trendCls = d1.class;
    const sparkHtml = sparklineSVG(series, trendCls);

    // Barra de progresso da meta
    let goalHtml = '';
    if (gs) {
      const pct     = Math.min(gs.ratioRaw * 100, 100).toFixed(0);
      const colorMap = { ok: '#4ade80', warn: '#facc15', bad: '#f87171' };
      const color   = colorMap[gs.state];
      const goalLabel= gs.direction === 'min' ? 'da meta' : 'do limite';
      goalHtml = `
        <div class="goal-progress-wrap">
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="goal-progress-label">
            <span class="goal-dot ${gs.state}"></span>
            <span>${pct}% ${goalLabel}: ${formatVal(metric, gs.target)}</span>
          </div>
        </div>`;
    }

    const extraLine  = extra?.includes('ctr') ? `<div class="kpi-sub">CTR: ${fmtPct(cur.ctr)}</div>` : '';
    const sourceLabel = channel === 'all' ? 'Google + Meta' : (channel === 'google' ? 'Google Ads' : 'Meta Ads');

    return `
      <div class="kpi-card ${cls}">
        <div class="kpi-card-top">
          <div>
            <div class="kpi-source"><div class="src-dot ${cls}"></div>${sourceLabel}</div>
            <div class="kpi-label">${LABELS[metric]}</div>
            <div class="kpi-value">${formatVal(metric, val)}</div>
          </div>
          <div class="kpi-spark">${sparkHtml}</div>
        </div>
        <div class="kpi-deltas">
          <div class="kpi-delta ${d1.class}">
            <span class="delta-arrow">${d1.arrow}</span><span class="delta-pct">${d1.pct}</span><small>${d1.label}</small>
          </div>
          <div class="kpi-delta ${d2.class}">
            <span class="delta-arrow">${d2.arrow}</span><span class="delta-pct">${d2.pct}</span><small>${d2.label}</small>
          </div>
        </div>
        ${extraLine}
        ${goalHtml}
      </div>
    `;
  }).join('');
}

/**
 * Renderiza o painel de saúde / status das campanhas.
 * @param {HTMLElement} root
 * @param {Array}  campRows  - linhas de by-campaign com KPIs
 * @param {Array}  goals
 */
export function renderHealthPanel(root, campRows, goals) {
  if (!root || !campRows?.length) { root && (root.innerHTML = ''); return; }

  let ok = 0, warn = 0, bad = 0;
  campRows.forEach(r => {
    if (!r.spend && !r.conversions) return;
    // Avalia CPL e ROAS se houver meta
    const cplGoal = goals.find(g => g.metric === 'cpl');
    if (cplGoal && r.cpl > 0) {
      const ratio = r.cpl / cplGoal.target;
      if (cplGoal.direction === 'max') {
        if (ratio <= 1)    ok++;
        else if (ratio <= 1.2) warn++;
        else               bad++;
        return;
      }
    }
    // Fallback: usa status da campanha
    if (r.status === 'active')       ok++;
    else if (r.status === 'paused')  warn++;
    else                             bad++;
  });

  const total = ok + warn + bad;
  if (!total) { root.innerHTML = ''; return; }

  const score = Math.round((ok / total) * 100);
  const scoreCls = score >= 70 ? 'ok' : score >= 40 ? 'warn' : 'bad';
  const scoreColors = { ok: '#4ade80', warn: '#facc15', bad: '#f87171' };

  root.innerHTML = `
    <div class="health-panel fade-in">
      <div class="health-score">
        <div class="health-score-num" style="color:${scoreColors[scoreCls]}">${score}</div>
        <div class="health-score-label">Score</div>
      </div>
      <div class="health-divider"></div>
      <div class="health-item ok">
        <span class="health-dot ok"></span>
        <span class="health-count">${ok}</span>
        <span class="health-text">no alvo</span>
      </div>
      <div class="health-item warn">
        <span class="health-dot warn"></span>
        <span class="health-count">${warn}</span>
        <span class="health-text">em alerta</span>
      </div>
      <div class="health-item bad">
        <span class="health-dot bad"></span>
        <span class="health-count">${bad}</span>
        <span class="health-text">crítica${bad !== 1 ? 's' : ''}</span>
      </div>
      <div class="health-divider"></div>
      <div class="health-text muted" style="font-size:10px;letter-spacing:1px;">${total} campanha${total !== 1 ? 's' : ''} ativas</div>
    </div>
  `;
}

/**
 * Renderiza os KPIs específicos de Social (Instagram/Facebook)
 */
export function renderSocialKPIs(root, data, channel) {
  if (!root) return;
  // Só mostra se estiver na aba "Consolidado" ou "Meta"
  if (channel === 'google') {
    root.style.display = 'none';
    return;
  }
  
  const cur = data.current || {};
  const prev = data.previous || {};
  const yoy = data.yoy || {};
  
  const socialCards = [
    { metric: 'videoViews',     label: 'Reels / Vídeo Views', cls: 'meta' },
    { metric: 'storyViews',     label: 'Story Views',         cls: 'meta' },
    { metric: 'linkClicks',     label: 'Link Clicks',         cls: 'meta' },
    { metric: 'postEngagement', label: 'Engajamento',         cls: 'meta' }
  ];

  // Se todos os valores atuais forem zero, podemos esconder o grid inteiro 
  // (opcional, mas bom se não houver dados de Instagram)
  const totalSocial = socialCards.reduce((acc, c) => acc + (cur[c.metric] || 0), 0);
  if (totalSocial === 0) {
    root.style.display = 'none';
    return;
  }

  root.style.display = 'grid';
  root.innerHTML = socialCards.map(({ metric, label, cls }) => {
    const val  = cur[metric] ?? 0;
    const pVal = prev[metric] ?? 0;
    const yVal = yoy[metric] ?? 0;

    const d1 = deltaBadge(metric, val, pVal, 'vs anterior');
    const d2 = deltaBadge(metric, val, yVal, 'vs ano anterior');

    return `
      <div class="kpi-card ${cls}" style="border-color: rgba(8, 102, 255, 0.3);">
        <div class="kpi-card-top">
          <div>
            <div class="kpi-source"><div class="src-dot ${cls}"></div>Instagram / FB</div>
            <div class="kpi-label">${label}</div>
            <div class="kpi-value">${fmtInt(val)}</div>
          </div>
        </div>
        <div class="kpi-deltas">
          <div class="kpi-delta ${d1.class}">
            <span class="delta-arrow">${d1.arrow}</span><span class="delta-pct">${d1.pct}</span><small>${d1.label}</small>
          </div>
          <div class="kpi-delta ${d2.class}">
            <span class="delta-arrow">${d2.arrow}</span><span class="delta-pct">${d2.pct}</span><small>${d2.label}</small>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza o Pacing Panel.
 */
export function renderPacingPanel(container, monthlyRows, goals, year, month, channel) {
  if (!container) return;
  if (!month) { container.style.display = 'none'; return; } // Apenas quando filtrado por mês

  const spendGoal = goals.find(g => g.metric === 'spend' && (g.channel === channel || g.channel === 'all'));
  if (!spendGoal || spendGoal.target <= 0) {
    container.style.display = 'none';
    return;
  }

  const target = spendGoal.target;
  const monthData = monthlyRows.filter(r => r.month === month && (channel === 'all' || r.channel === channel));
  const spend = monthData.reduce((acc, r) => acc + (r.spend || 0), 0);

  const now = new Date();
  const isCurrentMonth = (now.getFullYear() === year && (now.getMonth() + 1) === month);
  const isPastMonth = (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1));
  
  const daysInMonth = new Date(year, month, 0).getDate();
  let daysPassed = 0;
  if (isPastMonth) daysPassed = daysInMonth;
  else if (isCurrentMonth) daysPassed = now.getDate();

  const timePct = daysPassed / daysInMonth;
  const timePctLabel = Math.round(timePct * 100);
  
  const spendPct = spend / target;
  const spendPctLabel = Math.round(spendPct * 100);

  const projSpend = timePct > 0 ? (spend / timePct) : 0;
  const isOver = projSpend > target * 1.05;
  const isWarn = projSpend > target && !isOver;

  let statusCls = 'ok';
  let statusText = '● NO RITMO';
  if (isOver) { statusCls = 'bad'; statusText = '● ESTOURO PROJETADO'; }
  else if (isWarn) { statusCls = 'warn'; statusText = '● ATENÇÃO'; }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="pacing-panel">
      <div class="pacing-header">
        <div class="pacing-title">Calculadora de Pacing <span class="muted" style="text-transform:none; font-weight:normal;">— Ritmo de Verba</span></div>
        <div class="pacing-status ${statusCls}">${statusText}</div>
      </div>
      <div class="pacing-metrics">
        <div>Progresso do Mês: <span class="mono">${timePctLabel}%</span> (${daysPassed} de ${daysInMonth} dias)</div>
        <div>Verba Consumida: <span class="mono">${fmtBRL(spend)}</span> / <span class="mono">${fmtBRL(target)}</span> (${spendPctLabel}%)</div>
        <div>Projeção Final: <span class="mono">${fmtBRL(projSpend)}</span></div>
      </div>
      <div class="pacing-track">
        ${isCurrentMonth ? `<div class="pacing-time-marker" style="left: ${Math.min(100, Math.max(0, timePctLabel))}%;"></div>` : ''}
        <div class="pacing-bar ${statusCls}" style="width: ${Math.min(100, Math.max(0, spendPctLabel))}%;"></div>
      </div>
    </div>
  `;
}
