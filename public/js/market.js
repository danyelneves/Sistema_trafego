function openMarketModal() {
  document.getElementById('modal-market').style.display = 'flex';
  loadMarketDashboard();
}

function closeMarketModal() {
  document.getElementById('modal-market').style.display = 'none';
}

async function loadMarketDashboard() {
  try {
    const res = await fetch('/api/market/dashboard', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();

    document.getElementById('market-cost').innerText = `R$ ${Number(data.cost).toFixed(2).replace('.',',')}`;
    document.getElementById('market-rev').innerText = `R$ ${Number(data.revenue).toFixed(2).replace('.',',')}`;
    document.getElementById('market-profit').innerText = `R$ ${Number(data.net_profit).toFixed(2).replace('.',',')}`;

    const tbody = document.getElementById('market-tbody');
    tbody.innerHTML = '';

    data.leads.forEach(lead => {
      let statusBadge = lead.status === 'AVAILABLE' 
        ? `<span class="badge" style="background:#ffcc00; color:#000;">À VENDA</span>` 
        : `<span class="badge" style="background:#00ffa3; color:#000;">VENDIDO: R$ ${lead.sold_price}</span>`;

      // Se não vendido, mostra o link pra comprar
      let actionHtml = lead.status === 'AVAILABLE'
        ? `<a href="/api/market/buy/${lead.id}/1" target="_blank" style="color:#00ffff;">Simular Compra do Lead</a>`
        : `<span style="color:#666;">Comprado por: ID ${lead.buyer_id}</span>`;

      tbody.innerHTML += `
        <tr>
          <td>#${lead.id}</td>
          <td><strong>${lead.lead_name}</strong><br><small>${lead.city}</small></td>
          <td>${lead.niche}</td>
          <td>R$ ${lead.captured_cost}</td>
          <td>${statusBadge}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    });
  } catch(e) {
    console.error("Market Error", e);
  }
}

async function simularEntradaDeLead() {
  try {
    // Simula que uma campanha autônoma capturou um lead do Facebook Ads e bateu no webhook
    await fetch('/api/market/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 1, // hardcoded for simulation
        niche: 'Energia Solar',
        city: 'São Paulo',
        lead_name: 'Marcos Energia ' + Math.floor(Math.random()*100),
        lead_phone: '11999998888',
        captured_cost: 5.50 // Custou R$ 5,50 no Face Ads
      })
    });

    // Se fosse vida real, ele dispararia o whatsapp pros compradores dessa cidade
    alert("🤖 O robô capturou um novo Lead no Facebook (Custo: R$ 5,50). Notificando as empresas locais via WhatsApp...");
    loadMarketDashboard();

  } catch(e) {
    alert('Erro ao simular');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nav-market');
  if(btn) btn.addEventListener('click', openMarketModal);
});
