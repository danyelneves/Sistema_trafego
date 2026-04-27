/**
 * drill.js — modal de drill-down: série diária de uma campanha.
 */
import { api }   from './api.js';
import { fmtBRL, fmtInt, fmtPct, MESES } from './utils.js';

let drillChart = null;

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id)  { document.getElementById(id).classList.add('open'); }

function fmtMetric(m, v) {
  v = Number(v) || 0;
  if (['spend','cpl','cpc'].includes(m)) return fmtBRL(v, 2);
  if (['ctr','cvr'].includes(m))         return fmtPct(v);
  if (m === 'roas')                      return v.toFixed(2) + 'x';
  return fmtInt(v);
}

export function mountDrillModal() {
  const modal = document.getElementById('modal-drill');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-drill'); });
  document.getElementById('drill-close').addEventListener('click', () => closeModal('modal-drill'));

  return {
    open: async (campaign, year, month) => {
      document.getElementById('drill-title').textContent = campaign.name;
      document.getElementById('drill-channel').textContent =
        campaign.channel === 'google' ? '● Google Ads' : '● Meta Ads';
      document.getElementById('drill-channel').className =
        'drill-channel-badge ' + campaign.channel;

      openModal('modal-drill');

      try {
        const data = await api.drill(campaign.id, { year, month });
        renderDrillChart(data);
        renderDrillTable(data);
        renderDrillTotals(data.totals);
      } catch (e) {
        document.getElementById('drill-tbody').innerHTML =
          `<tr><td colspan="8" style="text-align:center;color:#ff6464">Erro: ${e.message}</td></tr>`;
      }
    },
  };
}

function renderDrillChart(data) {
  const canvas = document.getElementById('drill-chart');
  if (drillChart) { drillChart.destroy(); drillChart = null; }

  const labels = data.rows.map(r => r.date.slice(5));   // MM-DD
  const spend  = data.rows.map(r => r.spend || 0);
  const conv   = data.rows.map(r => r.conversions || 0);
  const clicks = data.rows.map(r => r.clicks || 0);

  drillChart = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar', label: 'Investimento (R$)', data: spend,
          backgroundColor: 'rgba(0,173,167,0.55)', borderRadius: 2, yAxisID: 'y',
        },
        {
          type: 'line', label: 'Conversões', data: conv,
          borderColor: '#E8057E', backgroundColor: 'rgba(232,5,126,0.08)',
          fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3, yAxisID: 'y1',
        },
        {
          type: 'line', label: 'Cliques', data: clicks,
          borderColor: '#4285F4', backgroundColor: 'transparent',
          tension: 0.3, borderWidth: 1.5, pointRadius: 2, yAxisID: 'y2', hidden: true,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#6b9aaa', font: { size: 11 }, boxWidth: 10, padding: 12 } },
        tooltip: { backgroundColor: '#0c1d27', borderColor: 'rgba(0,173,167,0.3)', borderWidth: 1, titleColor: '#e8f4f8', bodyColor: '#6b9aaa' },
      },
      scales: {
        x:  { grid: { color: 'rgba(0,173,167,0.06)' }, ticks: { color: '#6b9aaa', font: { size: 9 }, maxTicksLimit: 20 } },
        y:  { grid: { color: 'rgba(0,173,167,0.06)' }, ticks: { color: '#6b9aaa', font: { size: 10 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'k' }, beginAtZero: true },
        y1: { position: 'right', grid: { display: false }, ticks: { color: '#E8057E', font: { size: 10 } }, beginAtZero: true },
        y2: { display: false, beginAtZero: true },
      },
    },
  });
}

function renderDrillTable(data) {
  const tbody = document.getElementById('drill-tbody');
  if (!data.rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:18px">Nenhum dado no período.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${fmtInt(r.impressions)}</td>
      <td>${fmtInt(r.clicks)}</td>
      <td>${fmtPct(r.ctr)}</td>
      <td>${fmtInt(r.conversions)}</td>
      <td>${fmtBRL(r.spend, 2)}</td>
      <td>${fmtBRL(r.cpl, 2)}</td>
      <td>${r.roas > 0 ? r.roas.toFixed(2) + 'x' : '—'}</td>
    </tr>
  `).join('');
}

function renderDrillTotals(t) {
  const el = document.getElementById('drill-totals');
  if (!t) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="drill-kpi-row">
      <div class="drill-kpi"><div class="drill-kpi-label">Impressões</div><div class="drill-kpi-val">${fmtInt(t.impressions)}</div></div>
      <div class="drill-kpi"><div class="drill-kpi-label">Cliques</div><div class="drill-kpi-val">${fmtInt(t.clicks)}</div></div>
      <div class="drill-kpi"><div class="drill-kpi-label">CTR</div><div class="drill-kpi-val">${fmtPct(t.ctr)}</div></div>
      <div class="drill-kpi"><div class="drill-kpi-label">Conversões</div><div class="drill-kpi-val">${fmtInt(t.conversions)}</div></div>
      <div class="drill-kpi"><div class="drill-kpi-label">Investimento</div><div class="drill-kpi-val">${fmtBRL(t.spend, 2)}</div></div>
      <div class="drill-kpi"><div class="drill-kpi-label">CPL</div><div class="drill-kpi-val">${fmtBRL(t.cpl, 2)}</div></div>
      <div class="drill-kpi"><div class="drill-kpi-label">ROAS</div><div class="drill-kpi-val">${t.roas > 0 ? t.roas.toFixed(2) + 'x' : '—'}</div></div>
    </div>
  `;
}
