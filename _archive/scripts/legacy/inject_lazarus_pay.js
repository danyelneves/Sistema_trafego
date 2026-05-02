const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf-8');

// 1. Add Buttons to Header
const headerTarget = `<button class="btn-outline pulse" id="btn-nav-market" style="border-color: #ffcc00; color: #ffcc00;">💰 Lead Market</button>`;
const newButtons = `
        <button class="btn-outline" id="btn-nav-lazarus" style="border-color: #8a2be2; color: #8a2be2;" onclick="document.getElementById('modal-lazarus').style.display='flex'">🧟 Lázaro</button>
        <button class="btn-outline" id="btn-nav-pay" style="border-color: #00ffa3; color: #00ffa3;" onclick="loadNexusPay()">💳 NEXUS Pay</button>
`;

if (!content.includes('id="btn-nav-lazarus"')) {
  content = content.replace(headerTarget, headerTarget + newButtons);
}

// 2. Add Modals for Lazarus and Pay
const extraModals = `
<!-- ================================================================= MODAL · PROTOCOLO LÁZARO ================================================================= -->
<div class="modal-overlay" id="modal-lazarus">
  <div class="modal modal-wide" style="max-width: 600px; border: 1px solid #8a2be2;">
    <h2 style="color: #8a2be2;">Protocolo Lázaro 🧟</h2>
    <div class="modal-subtitle">Ressuscite leads mortos com Inteligência Artificial e WhatsApp.</div>
    
    <div class="form-group" style="margin-top:20px;">
      <label>Oferta / Isca de Reativação</label>
      <input type="text" id="lazarus-offer" placeholder="Ex: Sobrou uma vaga na agenda de amanhã com desconto de Black Friday">
    </div>

    <div class="form-group">
      <label>Leads Mortos (Nome, Telefone, Motivo da Perda)</label>
      <textarea id="lazarus-leads" rows="5" placeholder="João,11999999999,Achou caro&#10;Maria,11988888888,Sumiu do WhatsApp"></textarea>
    </div>

    <button class="btn-save pulse" onclick="runLazarus()" style="width: 100%; background: #8a2be2; color: #fff;">RESSUSCITAR LEADS AGORA</button>
    <div id="lazarus-status" style="margin-top: 15px; font-weight: bold; text-align: center; font-size: 14px;"></div>

    <div id="lazarus-results" style="margin-top: 15px; text-align:left; font-size:12px; background:#111; padding:10px; border-radius:8px; display:none;"></div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-lazarus').style.display='none'">Fechar</button>
    </div>
  </div>
</div>

<!-- ================================================================= MODAL · NEXUS PAY ================================================================= -->
<div class="modal-overlay" id="modal-pay">
  <div class="modal modal-wide" style="max-width: 600px; border: 1px solid #00ffa3;">
    <h2 style="color: #00ffa3;">NEXUS Pay 💳</h2>
    <div class="modal-subtitle">Cobre seus clientes de gestão de tráfego direto por aqui. Taxa: 2.5%</div>
    
    <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:20px; border-radius:8px; margin-top:20px;">
      <div>
        <div style="color:#888; font-size:12px;">Saldo Disponível</div>
        <div style="color:#00ffa3; font-size:28px; font-weight:bold;" id="pay-balance">R$ 0,00</div>
      </div>
      <button class="btn teal" onclick="alert('Funcionalidade de Saque bancário em breve.')">Sacar</button>
    </div>

    <div style="margin-top:20px; border-top:1px solid #333; padding-top:20px;">
      <h3>Gerar Nova Fatura Pix</h3>
      <div class="form-group">
        <label>Nome do Cliente / Empresa</label>
        <input type="text" id="pay-client" placeholder="Ex: Clínica Odonto Prime">
      </div>
      <div class="form-group">
        <label>Valor da Cobrança (R$)</label>
        <input type="number" id="pay-amount" placeholder="2000.00">
      </div>
      <button class="btn-save" onclick="generateCharge()" style="width: 100%; background: #00ffa3; color: #000; font-weight:bold;">GERAR COBRANÇA PIX</button>
    </div>

    <div id="pay-status" style="margin-top: 15px; font-weight: bold; text-align: center; font-size: 14px; word-break: break-all;"></div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-pay').style.display='none'">Fechar</button>
    </div>
  </div>
</div>
`;

if (!content.includes('id="modal-lazarus"')) {
  content = content.replace('<!-- ================================================================= FAB / PANEL · AI COPILOT ================================================================= -->', extraModals + '\n<!-- ================================================================= FAB / PANEL · AI COPILOT ================================================================= -->');
}

fs.writeFileSync('public/index.html', content);

// 3. Script JS for Lazarus and Pay
const jsContent = `
async function runLazarus() {
  const offer = document.getElementById('lazarus-offer').value;
  const rawData = document.getElementById('lazarus-leads').value;
  const statusDiv = document.getElementById('lazarus-status');
  const resDiv = document.getElementById('lazarus-results');

  if(!offer || !rawData) return alert("Preencha oferta e leads!");

  const lines = rawData.split('\\n');
  const contacts = lines.map(l => {
    const parts = l.split(',');
    return { name: parts[0], phone: parts[1], reason: parts[2] };
  }).filter(c => c.name && c.phone);

  statusDiv.innerText = "🔮 O Lázaro está ressuscitando " + contacts.length + " leads. Aguarde...";
  statusDiv.style.color = "#8a2be2";
  
  try {
    const res = await fetch('/api/lazarus/revive', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ contacts, context_offer: offer })
    });
    const data = await res.json();

    statusDiv.innerText = "✅ " + data.message;
    statusDiv.style.color = "#00ffa3";

    resDiv.style.display = 'block';
    resDiv.innerHTML = '<strong>Mensagens Autônomas Geradas:</strong><br><br>';
    data.data.forEach(d => {
      resDiv.innerHTML += \`<strong style="color:#00ffff;">\${d.name} (\${d.phone}):</strong> \${d.message_sent}<br><br>\`;
    });

  } catch(e) {
    statusDiv.innerText = "❌ Erro: " + e.message;
    statusDiv.style.color = "#ff3333";
  }
}

async function loadNexusPay() {
  document.getElementById('modal-pay').style.display = 'flex';
  try {
    const res = await fetch('/api/pay/statement', {
      headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
    });
    const data = await res.json();
    document.getElementById('pay-balance').innerText = \`R$ \${Number(data.balance).toFixed(2).replace('.',',')}\`;
  } catch(e) {}
}

async function generateCharge() {
  const client = document.getElementById('pay-client').value;
  const amount = document.getElementById('pay-amount').value;
  const status = document.getElementById('pay-status');

  if(!client || !amount) return alert("Preencha cliente e valor.");

  status.innerText = "Processando...";
  
  try {
    const res = await fetch('/api/pay/charge', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ client_name: client, amount: Number(amount), description: 'Fatura Tráfego' })
    });
    const data = await res.json();

    if(res.ok) {
      status.style.color = "#00ffa3";
      status.innerHTML = \`
        ✅ Fatura Criada! <br><br>
        <strong>Código PIX Copia e Cola para enviar ao cliente:</strong><br>
        <div style="background:#000; padding:10px; margin-top:10px; border-radius:5px; font-family:monospace; color:#fff;">\${data.pix_code}</div>
        <br>
        <small style="color:#888;">(NEXUS descontará 2.5% ao confirmar o pagamento)</small>
      \`;
    } else {
      status.innerText = "❌ Erro: " + data.error;
      status.style.color = "#ff3333";
    }
  } catch(e) {
    status.innerText = "❌ Erro: " + e.message;
  }
}
`;

fs.writeFileSync('public/js/lazarus_pay.js', jsContent);

content = fs.readFileSync('public/index.html', 'utf-8');
if (!content.includes('js/lazarus_pay.js')) {
  content = content.replace('<script src="js/market.js"></script>', '<script src="js/market.js"></script>\n<script src="js/lazarus_pay.js"></script>');
  fs.writeFileSync('public/index.html', content);
}
