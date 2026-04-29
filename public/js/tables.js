/**
 * tables.js — tabelas com ordenação por coluna, busca e drill-down.
 */
import { MESES_FULL, fmtInt, fmtBRL, fmtPct } from './utils.js';

function rowNote(notes, year, month, channel) {
  const match = notes.find(n =>
    n.year === year && n.month === month &&
    (n.channel === channel || n.channel === 'all')
  );
  return match ? `<span class="note-dot" title="${escapeAttr(match.text)}"></span>` : '';
}

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/** Tabela detalhada por mês × canal. */
export function renderDetailTable(tbody, monthlyRows, notes, channel, year) {
  const byMonth = {};
  monthlyRows.forEach(r => {
    byMonth[r.month] = byMonth[r.month] || { google: null, meta: null };
    byMonth[r.month][r.channel] = r;
  });
  const months = Object.keys(byMonth).map(Number).sort((a,b) => a - b);
  const maxConv = Math.max(1, ...monthlyRows.map(r => r.conversions || 0));

  const rows = [];
  months.forEach(m => {
    const data = byMonth[m];
    const showG = channel !== 'meta'   && data.google;
    const showM = channel !== 'google' && data.meta;

    const pushRow = (ch, r, showMonth) => {
      const pBar = Math.round(((r.conversions || 0) / maxConv) * 100);
      const tagCls = ch === 'google' ? 'google' : 'meta';
      const label  = ch === 'google' ? 'Google' : 'Meta';
      const barCol = ch === 'google' ? '#4285F4' : '#0866FF';
      rows.push(`
        <tr>
          <td>${showMonth ? MESES_FULL[m-1] : ''}${rowNote(notes, year, m, ch)}</td>
          <td><span class="src-tag ${tagCls}">● ${label}</span></td>
          <td class="num">${fmtInt(r.impressions)}</td>
          <td class="num">${fmtInt(r.clicks)}</td>
          <td class="num">${fmtPct(r.ctr)}</td>
          <td class="num">${fmtInt(r.conversions)}</td>
          <td class="num">${fmtInt(r.sales || 0)}</td>
          <td class="num">${fmtBRL(r.spend)}</td>
          <td class="num">${fmtBRL(r.cpl || 0, 2)}</td>
          <td class="num">${fmtBRL(r.cac || 0, 2)}</td>
          <td><div class="perf-bar"><div class="perf-bar-fill" style="width:${pBar}%;background:linear-gradient(90deg,${barCol},var(--teal))"></div></div></td>
        </tr>
      `);
    };

    if (showG) pushRow('google', data.google, true);
    if (showM) pushRow('meta',   data.meta,   !showG);
  });

  tbody.innerHTML = rows.join('') || `<tr><td colspan="9" class="muted" style="text-align:center;padding:24px">Sem dados para o período.</td></tr>`;
}

// -----------------------------------------------------------------------
// Estado de ordenação da tabela de campanhas
// -----------------------------------------------------------------------
let _sortCol = 'spend';
let _sortDir = -1; // -1 = desc, 1 = asc

/**
 * Tabela de campanhas com ordenação clicável, busca e drill-down.
 * @param {HTMLElement} container  wrapper (não apenas o tbody)
 * @param {Array}  rows
 * @param {Function} onDrill  callback(campaign)
 */
export function renderCampaignTable(container, rows, onDrill) {
  const list = rows.filter(r => (r.spend || 0) > 0 || (r.conversions || 0) > 0);

  if (!list.length) {
    container.innerHTML = `
      <div class="table-header"><div><div class="chart-title">Campanhas — Desempenho no Período</div>
      <div class="chart-subtitle">Ranking por investimento · clique em 🔍 para detalhe diário</div></div></div>
      <p class="muted" style="text-align:center;padding:24px">Nenhuma campanha com dados no período.</p>`;
    return;
  }

  // ---- Busca ----
  const searchId = 'camp-search-' + Math.random().toString(36).slice(2);
  const columns = [
    { key: 'campaign_name', label: 'Campanha',   sortable: true  },
    { key: 'channel',       label: 'Canal',       sortable: true  },
    { key: 'status',        label: 'Status',      sortable: false },
    { key: 'impressions',   label: 'Impressões',  sortable: true  },
    { key: 'reach',         label: 'Alcance',     sortable: true  },
    { key: 'frequency',     label: 'Freq.',       sortable: true  },
    { key: 'video_views',   label: 'Views (Vídeo)',sortable:true  },
    { key: 'clicks',        label: 'Cliques',     sortable: true  },
    { key: 'conversions',   label: 'Leads',       sortable: true  },
    { key: 'sales',         label: 'Vendas',      sortable: true  },
    { key: 'spend',         label: 'Investimento',sortable: true  },
    { key: 'cpl',           label: 'CPL',         sortable: true  },
    { key: 'cac',           label: 'CAC',         sortable: true  },
    { key: 'roas',          label: 'ROAS',        sortable: true  },
    { key: '_drill',        label: '',            sortable: false },
  ];

  function buildHTML(filtered) {
    const sorted = [...filtered].sort((a, b) => {
      const av = a[_sortCol] ?? 0;
      const bv = b[_sortCol] ?? 0;
      return typeof av === 'string' ? av.localeCompare(bv) * _sortDir : (av - bv) * _sortDir;
    });

    const maxSpend = Math.max(1, ...sorted.map(r => r.spend || 0));
    const maxConv  = Math.max(1, ...sorted.map(r => r.conversions || 0));

    const thead = `<thead><tr>` + columns.map(c => {
      if (!c.sortable) return `<th>${c.label}</th>`;
      const active = _sortCol === c.key;
      const arrow  = active ? (_sortDir === -1 ? ' ↓' : ' ↑') : '';
      return `<th class="sortable${active ? ' sort-active' : ''}" data-sort="${c.key}">${c.label}${arrow}</th>`;
    }).join('') + `</tr></thead>`;

    const tbody = `<tbody>` + sorted.map(r => {
      const spendBar = Math.round(((r.spend || 0) / maxSpend) * 100);
      const convBar  = Math.round(((r.conversions || 0) / maxConv) * 100);
      const statusCls = r.status || 'active';
      const tagCls    = r.channel === 'google' ? 'google' : 'meta';
      const label     = r.channel === 'google' ? 'Google' : 'Meta';
      return `
        <tr>
          <td>
            <div class="camp-name">${escapeAttr(r.campaign_name)}</div>
            <div class="muted" style="font-size:10px;letter-spacing:1px">${escapeAttr(r.objective || '—')}</div>
          </td>
          <td><span class="src-tag ${tagCls}">● ${label}</span></td>
          <td><span class="status-pill ${statusCls}">${statusCls}</span></td>
          <td class="num">${fmtInt(r.impressions)}</td>
          <td class="num">${fmtInt(r.reach || 0)}</td>
          <td class="num">${r.frequency > 0 ? (r.frequency).toFixed(2) + 'x' : '—'}</td>
          <td class="num">${fmtInt(r.video_views || 0)}</td>
          <td class="num">
            ${fmtInt(r.clicks)}
          </td>
          <td class="num">
            ${fmtInt(r.conversions)}
            <div class="perf-bar"><div class="perf-bar-fill" style="width:${convBar}%;background:linear-gradient(90deg,var(--teal),#00f5d4)"></div></div>
          </td>
          <td class="num">${fmtInt(r.sales || 0)}</td>
          <td class="num">
            ${fmtBRL(r.spend)}
            <div class="perf-bar"><div class="perf-bar-fill" style="width:${spendBar}%"></div></div>
          </td>
          <td class="num">${fmtBRL(r.cpl || 0, 2)}</td>
          <td class="num">${fmtBRL(r.cac || 0, 2)}</td>
          <td class="num">${(r.roas || 0).toFixed(2)}x</td>
          <td class="num">
            <button class="btn small drill-btn"
              data-id="${r.campaign_id}"
              data-name="${escapeAttr(r.campaign_name)}"
              data-channel="${r.channel}"
              title="Ver detalhe diário">🔍</button>
          </td>
        </tr>`;
    }).join('') + `</tbody>`;

    return thead + tbody;
  }

  // Monta o HTML completo do container
  container.innerHTML = `
    <div class="table-header">
      <div>
        <div class="chart-title">Campanhas — Desempenho no Período</div>
        <div class="chart-subtitle">Ranking por investimento · clique no cabeçalho para ordenar · 🔍 para detalhe diário</div>
      </div>
      <div class="camp-search-wrap">
        <input id="${searchId}" class="camp-search" placeholder="🔍  Buscar campanha…" autocomplete="off">
      </div>
    </div>
    <div style="overflow-x:auto">
      <table id="camp-table">${buildHTML(list)}</table>
    </div>
  `;

  const table  = container.querySelector('#camp-table');
  const search = container.querySelector(`#${searchId}`);

  // Ordenação
  table.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (_sortCol === col) { _sortDir *= -1; }
      else { _sortCol = col; _sortDir = -1; }
      const q = search?.value.toLowerCase() || '';
      const filtered = q ? list.filter(r => r.campaign_name.toLowerCase().includes(q)) : list;
      table.innerHTML = buildHTML(filtered);
      bindDrill();
      bindSort();
    });
  });

  // Busca
  search?.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    const filtered = q ? list.filter(r => r.campaign_name.toLowerCase().includes(q)) : list;
    table.innerHTML = buildHTML(filtered);
    bindDrill();
    bindSort();
  });

  function bindDrill() {
    table.querySelectorAll('.drill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        onDrill?.({ id: Number(btn.dataset.id), name: btn.dataset.name, channel: btn.dataset.channel });
      });
    });
  }
  function bindSort() {
    table.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (_sortCol === col) { _sortDir *= -1; }
        else { _sortCol = col; _sortDir = -1; }
        const q = search?.value.toLowerCase() || '';
        const filtered = q ? list.filter(r => r.campaign_name.toLowerCase().includes(q)) : list;
        table.innerHTML = buildHTML(filtered);
        bindDrill(); bindSort();
      });
    });
  }

  bindDrill();
}

/** Tabela de Dados Demográficos. */
export function renderDemographics(demographics) {
  const regionTbody = document.getElementById('demo-region-tbody');
  const ageTbody = document.getElementById('demo-age-tbody');
  if (!regionTbody || !ageTbody) return;

  const regions = demographics.filter(d => d.type === 'region');
  const ageGenders = demographics.filter(d => d.type === 'age' || d.type === 'gender');

  const buildRow = r => {
    const tagCls = r.channel === 'google' ? 'google' : 'meta';
    const label  = r.channel === 'google' ? 'Google' : 'Meta';
    return `
      <tr>
        <td>${escapeAttr(r.dimension)}</td>
        <td><span class="src-tag ${tagCls}">● ${label}</span></td>
        <td class="num">${fmtBRL(r.spend)}</td>
        <td class="num">${fmtInt(r.conversions)}</td>
        <td class="num">${fmtBRL(r.cpl || 0, 2)}</td>
      </tr>
    `;
  };

  regionTbody.innerHTML = regions.length ? regions.map(buildRow).join('') : '<tr><td colspan="5" style="text-align:center;color:#a8a29e;padding:12px">Sem dados de região</td></tr>';
  ageTbody.innerHTML = ageGenders.length ? ageGenders.map(buildRow).join('') : '<tr><td colspan="5" style="text-align:center;color:#a8a29e;padding:12px">Sem dados demográficos</td></tr>';
}

/** Galeria de Criativos (Ad-level) */
export function renderAds(ads) {
  const tbody = document.getElementById('ads-tbody');
  if (!tbody) return;

  if (!ads || !ads.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#a8a29e;padding:12px">Sem dados de criativos importados</td></tr>';
    return;
  }

  const buildRow = r => {
    const tagCls = r.channel === 'google' ? 'google' : 'meta';
    const label  = r.channel === 'google' ? 'Google' : 'Meta';
    const thumb  = r.thumbnail_url 
      ? `<img src="${escapeAttr(r.thumbnail_url)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` 
      : `<div style="width:40px;height:40px;background:#1a1a1a;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px">N/A</div>`;
      
    return `
      <tr>
        <td style="padding:4px">${thumb}</td>
        <td>${escapeAttr(r.ad_name || r.ad_id)}</td>
        <td style="color:#a8a29e;font-size:12px">${escapeAttr(r.campaign_name)}</td>
        <td><span class="src-tag ${tagCls}">● ${label}</span></td>
        <td class="num">${fmtBRL(r.spend)}</td>
        <td class="num" title="CPL: ${fmtBRL(r.cpl || 0, 2)}">${fmtInt(r.conversions)} <span style="font-size:10px;color:#888">(${fmtBRL(r.cpl || 0, 2)})</span></td>
        <td class="num" style="color:#00ADA7;font-weight:bold">${fmtInt(r.crmSales)}</td>
        <td class="num" style="color: ${r.cac > 200 ? '#ff6464' : '#4ecb71'}">${r.crmSales ? fmtBRL(r.cac || 0, 2) : '-'}</td>
      </tr>
    `;
  };

  tbody.innerHTML = ads.map(buildRow).join('');
}
