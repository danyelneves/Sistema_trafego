const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf-8');

// 1. Add Market Button
const headerTarget = `        <button class="btn-outline" id="btn-nav-launcher" style="border-color: #ff007f; color: #ff007f;">🚀 Lançador</button>`;
if (!content.includes('id="btn-nav-market"')) {
  content = content.replace(headerTarget, headerTarget + `\n        <button class="btn-outline pulse" id="btn-nav-market" style="border-color: #ffcc00; color: #ffcc00;">💰 Lead Market</button>`);
}

// 2. Add Modal
const marketModal = `
<!-- ================================================================= MODAL · LEAD MARKETPLACE ================================================================= -->
<div class="modal-overlay" id="modal-market">
  <div class="modal modal-wide" style="max-width: 900px;">
    <h2>Bolsa de Valores de Leads 💰</h2>
    <div class="modal-subtitle">NEXUS Arbitrage. Compre tráfego no atacado e venda leads no varejo.</div>
    
    <div style="display:flex; gap:15px; margin-top:20px; text-align:center;">
      <div style="flex:1; background:#111; padding:20px; border:1px solid #333;">
        <div style="font-size:12px; color:#888;">Custo de Captação (Ads)</div>
        <div style="font-size:24px; color:#ff3333; font-weight:bold;" id="market-cost">R$ 0,00</div>
      </div>
      <div style="flex:1; background:#111; padding:20px; border:1px solid #333;">
        <div style="font-size:12px; color:#888;">Faturamento (Leads Vendidos)</div>
        <div style="font-size:24px; color:#00ffa3; font-weight:bold;" id="market-rev">R$ 0,00</div>
      </div>
      <div style="flex:1; background:#111; padding:20px; border:1px solid #ffcc00;">
        <div style="font-size:12px; color:#ffcc00;">Lucro Líquido (Arbitragem)</div>
        <div style="font-size:24px; color:#ffcc00; font-weight:bold;" id="market-profit">R$ 0,00</div>
      </div>
    </div>

    <div style="margin-top:30px; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0;">Leads Capturados (Mercado Ativo)</h3>
      <button class="btn teal" onclick="simularEntradaDeLead()">+ Simular Novo Lead</button>
    </div>

    <table class="data-table" style="margin-top:15px;">
      <thead>
        <tr>
          <th>ID</th>
          <th>Lead / Cidade</th>
          <th>Nicho</th>
          <th>Custo (R$)</th>
          <th>Status</th>
          <th>Link de Venda (Pix R$ 35)</th>
        </tr>
      </thead>
      <tbody id="market-tbody">
        <!-- Rendered via JS -->
      </tbody>
    </table>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeMarketModal()">Fechar</button>
    </div>
  </div>
</div>
`;

if (!content.includes('id="modal-market"')) {
  content = content.replace('<!-- ================================================================= FAB / PANEL · AI COPILOT ================================================================= -->', marketModal + '\n<!-- ================================================================= FAB / PANEL · AI COPILOT ================================================================= -->');
}

// 3. Add Script JS
if (!content.includes('js/market.js')) {
  content = content.replace('<script src="js/launcher.js"></script>', '<script src="js/launcher.js"></script>\n<script src="js/market.js"></script>');
}

fs.writeFileSync('public/index.html', content);
