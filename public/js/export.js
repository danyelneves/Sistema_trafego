/**
 * export.js — exportação em PDF e CSV.
 *
 * PDF: usa window.print() com um CSS dedicado para impressão. Simples, zero dependências
 *      pesadas, e o usuário já pode "Salvar como PDF" no diálogo nativo do macOS/Chrome.
 *
 * CSV: exporta o dataset atualmente carregado (daily rows com derivadas).
 */
import { fmtInt } from './utils.js';

export function exportPDF() {
  // prepara título temporário da aba para que o arquivo PDF saia com nome decente
  const orig = document.title;
  const period = document.querySelector('[data-print-period]')?.textContent?.trim() || '';
  document.title = `Maranet Central de Trafego ${period}`.replace(/\s+/g,'-');
  setTimeout(() => { window.print(); document.title = orig; }, 50);
}

export function exportCSV(rows, filename = 'maranet-detalhamento.csv') {
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const lines = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/** Exporta backup JSON (campanhas, dados diários, metas, notas) via Save As. */
export async function exportBackupJSON(api) {
  const [campaigns, goals, notes, daily] = await Promise.all([
    api.campaigns(),
    api.goals(),
    api.notes(),
    api.daily(),
  ]);
  const payload = { exported_at: new Date().toISOString(), campaigns, goals, notes, daily };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maranet-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return { counts: { campaigns: campaigns.length, goals: goals.length, notes: notes.length, daily: daily.length } };
}
