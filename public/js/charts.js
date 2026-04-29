/**
 * charts.js — gráficos com linha de meta e marcadores de eventos.
 */
import { MESES, fmtBRL } from './utils.js';

const charts = {};

const baseOpts = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 500, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0c1d27',
      borderColor: 'rgba(0,173,167,0.4)',
      borderWidth: 1,
      titleColor: '#e8f4f8',
      bodyColor: '#6b9aaa',
      padding: 12,
      cornerRadius: 6,
      callbacks: {},
    },
  },
  scales: {
    x: {
      grid:  { color: 'rgba(0,173,167,0.05)' },
      ticks: { color: '#6b9aaa', font: { family: 'DM Mono', size: 10 } },
    },
    y: {
      grid:  { color: 'rgba(0,173,167,0.05)' },
      ticks: { color: '#6b9aaa', font: { family: 'DM Mono', size: 10 } },
      beginAtZero: true,
    },
  },
};

function ensure(name) {
  if (charts[name]) { charts[name].destroy(); delete charts[name]; }
}

function seriesByChannel(rows, field) {
  const byMonth = {};
  rows.forEach(r => {
    byMonth[r.month] = byMonth[r.month] || { google: 0, meta: 0 };
    byMonth[r.month][r.channel] = r[field] || 0;
  });
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return {
    labels: months.map(m => MESES[m-1]),
    google: months.map(m => byMonth[m]?.google || 0),
    meta:   months.map(m => byMonth[m]?.meta   || 0),
  };
}

/** Dataset de linha de meta horizontal. */
function goalDataset(label, value, length, color = 'rgba(250,204,21,0.75)') {
  if (!value || value <= 0) return null;
  return {
    type: 'line',
    label,
    data: Array(length).fill(value),
    borderColor: color,
    borderWidth: 1.5,
    borderDash: [5, 4],
    pointRadius: 0,
    fill: false,
    tension: 0,
    order: -1,
  };
}

/** Anotações de notas nos gráficos. */
function buildNoteAnnotations(notes, months) {
  const result = {};
  notes.forEach((n, i) => {
    const idx = months.indexOf(MESES[(n.month || 1) - 1]);
    if (idx < 0) return;
    result[`note_${i}`] = {
      type: 'point', xValue: idx, yValue: 0,
      backgroundColor: 'rgba(235,118,23,0.6)',
      radius: 4, borderWidth: 0,
    };
  });
  return result;
}

/** Gráfico Impressões por Mês */
export function renderImpressions(canvas, monthlyRows, channel, { notes = [], goal } = {}) {
  ensure('impressions');
  const s = seriesByChannel(monthlyRows, 'impressions');
  const datasets = [];
  if (channel === 'all' || channel === 'google')
    datasets.push({ label: 'Google', data: s.google, backgroundColor: 'rgba(66,133,244,0.7)', borderRadius: 0 });
  if (channel === 'all' || channel === 'meta')
    datasets.push({ label: 'Meta',   data: s.meta,   backgroundColor: 'rgba(8,102,255,0.5)',  borderRadius: 0 });
  const goalDs = goalDataset('Meta Impressões', goal, 12);
  if (goalDs) datasets.push(goalDs);

  charts.impressions = new Chart(canvas, {
    type: 'bar',
    data: { labels: s.labels, datasets },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${(ctx.parsed.y/1000).toFixed(1)}k` }
      }},
    },
  });
}

/** Gráfico Distribuição de Verba */
export function renderBudget(canvas, monthlyRows) {
  ensure('budget');
  const totals = { google: 0, meta: 0 };
  monthlyRows.forEach(r => { totals[r.channel] = (totals[r.channel] || 0) + (r.spend || 0); });
  const total = totals.google + totals.meta || 1;
  const gPct  = ((totals.google / total) * 100).toFixed(1);
  const mPct  = ((totals.meta   / total) * 100).toFixed(1);

  charts.budget = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Google Ads', 'Meta Ads'],
      datasets: [{
        label: 'Investimento',
        data: [totals.google, totals.meta],
        backgroundColor: ['rgba(66,133,244,0.75)', 'rgba(8,102,255,0.6)'],
        borderColor:     ['#4285F4', '#0866FF'],
        borderWidth: 1,
        borderRadius: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      animation: { duration: 500 },
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c1d27', borderColor: 'rgba(0,173,167,0.3)', borderWidth: 1,
          titleColor: '#e8f4f8', bodyColor: '#6b9aaa', padding: 12, cornerRadius: 6,
          callbacks: { label: ctx => ` ${fmtBRL(ctx.parsed.x)} (${ctx.dataIndex === 0 ? gPct : mPct}%)` },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(0,173,167,0.05)' }, ticks: { color: '#6b9aaa', font: { family: 'DM Mono', size: 10 }, callback: v => 'R$' + (v/1000).toFixed(0)+'k' } },
        y: { grid: { display: false }, ticks: { color: '#6b9aaa', font: { family: 'DM Mono', size: 11 } } },
      },
    },
  });
}

/** Gráfico Cliques & CTR */
export function renderClicksCtr(canvas, monthlyRows, channel, { notes = [] } = {}) {
  ensure('clicksCtr');
  const byMonth = {};
  monthlyRows.forEach(r => {
    byMonth[r.month] = byMonth[r.month] || { imp: 0, cli: 0 };
    if (channel === 'all' || channel === r.channel) {
      byMonth[r.month].imp += r.impressions || 0;
      byMonth[r.month].cli += r.clicks || 0;
    }
  });
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const labels = months.map(m => MESES[m-1]);
  const clicks = months.map(m => byMonth[m]?.cli || 0);
  const ctr    = months.map(m => {
    const o = byMonth[m];
    return o && o.imp ? +((o.cli / o.imp) * 100).toFixed(2) : 0;
  });

  charts.clicksCtr = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        { type: 'bar',  label: 'Cliques', data: clicks, backgroundColor: 'rgba(0,173,167,0.55)', borderRadius: 0, yAxisID: 'y' },
        { type: 'line', label: 'CTR %',   data: ctr,    borderColor: '#EB7617', backgroundColor: 'rgba(235,118,23,0.07)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, yAxisID: 'y1' },
      ],
    },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, mode: 'index', intersect: false } },
      scales: {
        x:  { ...baseOpts.scales.x },
        y:  { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => (v/1000).toFixed(0)+'k' } },
        y1: { position: 'right', grid: { display: false }, ticks: { color: '#EB7617', font: { family: 'DM Mono', size: 10 }, callback: v => v + '%' } },
      },
    },
  });
}

/** Gráfico Conversões com linha de meta */
export function renderConversions(canvas, monthlyRows, channel, { goals = [], notes = [] } = {}) {
  ensure('conv');
  const s = seriesByChannel(monthlyRows, 'conversions');
  const datasets = [];
  if (channel === 'all' || channel === 'google')
    datasets.push({ label: 'Google', data: s.google, borderColor: '#E8057E', backgroundColor: 'rgba(232,5,126,0.07)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5 });
  if (channel === 'all' || channel === 'meta')
    datasets.push({ label: 'Meta',   data: s.meta,   borderColor: '#0866FF', backgroundColor: 'rgba(8,102,255,0.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5 });

  // Linha de meta
  const convGoal = goals.find(g => g.metric === 'conversions');
  if (convGoal?.target) {
    const ds = goalDataset(`Meta: ${convGoal.target} conv.`, convGoal.target, 12, 'rgba(250,204,21,0.7)');
    if (ds) datasets.push(ds);
  }

  charts.conv = new Chart(canvas, {
    type: 'line',
    data: { labels: s.labels, datasets },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, mode: 'index', intersect: false } },
    },
  });
}

/** Gráfico Evolução do Investimento */
export function renderSpend(canvas, monthlyRows, channel) {
  ensure('spend');
  if (!canvas) return;
  const s = seriesByChannel(monthlyRows, 'spend');
  const datasets = [];
  if (channel === 'all' || channel === 'google')
    datasets.push({ label: 'Google', data: s.google, borderColor: '#4285F4', backgroundColor: 'rgba(66,133,244,0.07)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5 });
  if (channel === 'all' || channel === 'meta')
    datasets.push({ label: 'Meta',   data: s.meta,   borderColor: '#0866FF', backgroundColor: 'rgba(8,102,255,0.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5 });

  charts.spend = new Chart(canvas, {
    type: 'line',
    data: { labels: s.labels, datasets },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, mode: 'index', intersect: false, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}` } } },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => 'R$' + (v/1000).toFixed(0)+'k' } }
      }
    },
  });
}

/** Gráfico de Evolução do CPL */
export function renderCpl(canvas, monthlyRows, channel) {
  ensure('cpl');
  if (!canvas) return;
  const s = seriesByChannel(monthlyRows, 'spend');
  const conv = seriesByChannel(monthlyRows, 'conversions');
  
  const cplGoogle = s.google.map((spend, i) => conv.google[i] ? spend / conv.google[i] : 0);
  const cplMeta = s.meta.map((spend, i) => conv.meta[i] ? spend / conv.meta[i] : 0);

  const datasets = [];
  if (channel === 'all' || channel === 'google')
    datasets.push({ label: 'Google', data: cplGoogle, borderColor: '#4285F4', backgroundColor: 'rgba(66,133,244,0.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5 });
  if (channel === 'all' || channel === 'meta')
    datasets.push({ label: 'Meta',   data: cplMeta,   borderColor: '#0866FF', backgroundColor: 'rgba(8,102,255,0.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5 });

  charts.cpl = new Chart(canvas, {
    type: 'line',
    data: { labels: s.labels, datasets },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, mode: 'index', intersect: false, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}` } } },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => fmtBRL(v) } }
      }
    },
  });
}

/** Gráfico de Funil (Impressões -> Cliques -> Leads) */
export function renderFunnel(canvas, monthlyRows, channel) {
  ensure('funnel');
  if (!canvas) return;
  
  let imp = 0, cli = 0, conv = 0;
  monthlyRows.forEach(r => {
    if (channel === 'all' || channel === r.channel) {
      imp += (r.impressions || 0);
      cli += (r.clicks || 0);
      conv += (r.conversions || 0);
    }
  });

  charts.funnel = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Impressões', 'Cliques', 'Leads (Conv.)'],
      datasets: [{
        data: [imp, cli, conv],
        backgroundColor: ['rgba(0,173,167,0.7)', 'rgba(235,118,23,0.7)', 'rgba(232,5,126,0.7)'],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      ...baseOpts,
      indexAxis: 'y', // Funil deitado
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, callbacks: { label: ctx => ` ${ctx.formattedValue}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { display: false } },
        y: { grid: { display: false }, ticks: { color: '#e8f4f8', font: { family: 'DM Mono', size: 12 } } }
      }
    }
  });
}

/** Gráfico de Engajamento Social (Meta) */
export function renderSocial(canvas, monthlyRows, channel) {
  ensure('social');
  if (!canvas) return;
  
  const containerRow = document.getElementById('row-chart-social');
  if (channel === 'google') {
    if (containerRow) containerRow.style.display = 'none';
    return;
  } else {
    if (containerRow) containerRow.style.display = 'grid'; // .charts-row is CSS grid/flex
  }

  const byMonth = {};
  monthlyRows.forEach(r => {
    byMonth[r.month] = byMonth[r.month] || { video: 0, story: 0 };
    if (r.channel === 'meta') {
      byMonth[r.month].video += (r.videoViews || r.video_views || 0);
      byMonth[r.month].story += (r.storyViews || r.story_views || 0);
    }
  });

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const labels = months.map(m => MESES[m-1]);
  const videoData = months.map(m => byMonth[m]?.video || 0);
  const storyData = months.map(m => byMonth[m]?.story || 0);

  charts.social = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Reels / Vídeos', data: videoData, backgroundColor: 'rgba(8,102,255,0.7)', borderRadius: 2 },
        { label: 'Stories', data: storyData, backgroundColor: 'rgba(232,5,126,0.7)', borderRadius: 2 }
      ]
    },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, mode: 'index', intersect: false } },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => (v >= 1000 ? (v/1000).toFixed(1)+'k' : v) } }
      }
    }
  });
}

export function renderAll({ monthlyRows, channel, goals = [], notes = [] }) {
  renderImpressions(document.getElementById('chartImpressoes'), monthlyRows, channel, { notes });
  renderBudget     (document.getElementById('chartVerba'),      monthlyRows);
  renderClicksCtr  (document.getElementById('chartCliques'),    monthlyRows, channel, { notes });
  renderConversions(document.getElementById('chartConv'),       monthlyRows, channel, { goals, notes });
  renderSpend      (document.getElementById('chartSpend'),      monthlyRows, channel);
  renderCpl        (document.getElementById('chartCpl'),        monthlyRows, channel);
  renderFunnel     (document.getElementById('chartFunnel'),     monthlyRows, channel);
  renderSocial     (document.getElementById('chartSocial'),     monthlyRows, channel);
}
