const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf-8');

// 1. Limpar Header antigo e colocar Dropdown
const oldHeaderBtnsRegex = /<button class="btn-outline" id="btn-nav-kanban">.*?<\/button>\s*<button class="btn-outline" id="btn-nav-whatsapp">.*?<\/button>\s*<button class="btn-outline" id="btn-nav-launcher".*?<\/button>\s*<button class="btn-outline pulse" id="btn-nav-market".*?<\/button>\s*<button class="btn-outline" id="btn-nav-lazarus".*?<\/button>\s*<button class="btn-outline" id="btn-nav-pay".*?<\/button>\s*<button class="btn-outline" id="btn-nav-products".*?<\/button>/s;

const cleanDropdown = `
        <button class="btn-outline" id="btn-nav-kanban" style="border: 1px solid #333;">🗂️ CRM</button>
        <button class="btn-outline" id="btn-nav-whatsapp" style="border: 1px solid #333;">📱 Whats</button>
        
        <div class="dropdown-wrapper" style="position:relative; display:inline-block;">
          <button class="btn-save pulse" onclick="document.getElementById('arsenal-menu').classList.toggle('show-dropdown')" style="background:#00ffa3; color:#000; font-weight:bold; font-size:14px; padding: 10px 15px;">🔥 Arsenal Black ▼</button>
          <div id="arsenal-menu" class="dropdown-content" style="display:none; position:absolute; right:0; top:45px; background:#111; min-width:200px; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid #333; z-index:1000; border-radius:8px; overflow:hidden;">
            <a href="#" onclick="openLauncherModal()" style="display:block; padding:12px 15px; color:#fff; text-decoration:none; border-bottom:1px solid #222;">🚀 Lançador Autônomo</a>
            <a href="#" onclick="openMarketModal()" style="display:block; padding:12px 15px; color:#ffcc00; text-decoration:none; border-bottom:1px solid #222;">💰 Bolsa de Leads</a>
            <a href="#" onclick="document.getElementById('modal-lazarus').style.display='flex'" style="display:block; padding:12px 15px; color:#8a2be2; text-decoration:none; border-bottom:1px solid #222;">🧟 Protocolo Lázaro</a>
            <a href="#" onclick="loadNexusPay()" style="display:block; padding:12px 15px; color:#00ffa3; text-decoration:none; border-bottom:1px solid #222;">💳 NEXUS Pay</a>
            <a href="/checkout?product_id=1" target="_blank" style="display:block; padding:12px 15px; color:#fff; text-decoration:none; border-bottom:1px solid #222;">🛒 Ver Meu Checkout</a>
            <a href="#" onclick="loadCheckoutOrders()" style="display:block; padding:12px 15px; color:#aaa; text-decoration:none;">📈 Vendas do Checkout</a>
          </div>
        </div>
`;

if (html.match(oldHeaderBtnsRegex)) {
  html = html.replace(oldHeaderBtnsRegex, cleanDropdown);
}

// Ensure JS to handle dropdown toggle closing on outside click
if (!html.includes('closeDropdownOutside')) {
  html = html.replace('</body>', `
<script>
  window.onclick = function(event) {
    if (!event.target.matches('.btn-save') && !event.target.matches('.pulse')) {
      var dropdowns = document.getElementsByClassName("dropdown-content");
      for (var i = 0; i < dropdowns.length; i++) {
        var openDropdown = dropdowns[i];
        if (openDropdown.style.display === 'block' || openDropdown.classList.contains('show-dropdown')) {
          openDropdown.style.display = 'none';
          openDropdown.classList.remove('show-dropdown');
        }
      }
    } else {
      let menu = document.getElementById('arsenal-menu');
      if(menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
  }
</script>
</body>
  `);
}

// 2. Add Modal for Checkout Orders
const ordersModal = `
<!-- ================================================================= MODAL · NEXUS BLACK VENDAS ================================================================= -->
<div class="modal-overlay" id="modal-checkout-orders">
  <div class="modal modal-wide" style="max-width: 800px; border: 1px solid #00ffa3;">
    <h2 style="color: #00ffa3;">Vendas NEXUS Black 🛒</h2>
    <div class="modal-subtitle">Acompanhe os recebimentos diretos do seu Checkout sem taxas.</div>
    
    <div style="background:#111; padding:20px; border-radius:8px; margin-top:20px; text-align:center;">
      <div style="color:#888; font-size:12px;">Faturamento Total (Aprovado)</div>
      <div style="color:#00ffa3; font-size:32px; font-weight:bold;" id="sales-total">R$ 0,00</div>
    </div>

    <table class="data-table" style="margin-top:20px;">
      <thead>
        <tr>
          <th>ID</th>
          <th>Cliente</th>
          <th>Produto</th>
          <th>Valor</th>
          <th>Método</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="sales-tbody">
      </tbody>
    </table>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-checkout-orders').style.display='none'">Fechar</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modal-checkout-orders')) {
  html = html.replace('<!-- ================================================================= MODAL · NEXUS PAY ================================================================= -->', ordersModal + '\n<!-- ================================================================= MODAL · NEXUS PAY ================================================================= -->');
}

fs.writeFileSync('public/index.html', html);

// 3. JS Logic for Fetching Orders
const jsContent = `
async function loadCheckoutOrders() {
  document.getElementById('modal-checkout-orders').style.display = 'flex';
  const tbody = document.getElementById('sales-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando...</td></tr>';
  
  try {
    const res = await fetch('/api/checkout/orders', {
      headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
    });
    const data = await res.json();
    
    document.getElementById('sales-total').innerText = \`R$ \${Number(data.total).toFixed(2).replace('.',',')}\`;
    tbody.innerHTML = '';
    
    if(data.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma venda encontrada.</td></tr>';
      return;
    }

    data.orders.forEach(o => {
      let badge = o.status === 'PAID' ? \`<span style="color:#00ffa3;">APROVADO</span>\` : \`<span style="color:#ffcc00;">\${o.status}</span>\`;
      tbody.innerHTML += \`
        <tr>
          <td>#\${o.id}</td>
          <td>\${o.customer_name}<br><small>\${o.customer_email}</small></td>
          <td>\${o.product_name}</td>
          <td>R$ \${o.amount}</td>
          <td>\${o.payment_method}</td>
          <td>\${badge}</td>
        </tr>
      \`;
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Erro ao carregar vendas.</td></tr>';
  }
}
`;

fs.writeFileSync('public/js/checkout_orders.js', jsContent);

let finalHtml = fs.readFileSync('public/index.html', 'utf-8');
if (!finalHtml.includes('js/checkout_orders.js')) {
  finalHtml = finalHtml.replace('<script src="js/lazarus_pay.js"></script>', '<script src="js/lazarus_pay.js"></script>\n<script src="js/checkout_orders.js"></script>');
  fs.writeFileSync('public/index.html', finalHtml);
}
