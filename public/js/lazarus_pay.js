
async function runLazarus() {
  const offer = document.getElementById('lazarus-offer').value;
  const rawData = document.getElementById('lazarus-leads').value;
  const statusDiv = document.getElementById('lazarus-status');
  const resDiv = document.getElementById('lazarus-results');

  if(!offer || !rawData) return alert("Preencha oferta e leads!");

  const lines = rawData.split('\n');
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ contacts, context_offer: offer })
    });
    const data = await res.json();

    statusDiv.innerText = "✅ " + data.message;
    statusDiv.style.color = "#00ffa3";

    resDiv.style.display = 'block';
    resDiv.innerHTML = '<strong>Mensagens Autônomas Geradas:</strong><br><br>';
    data.data.forEach(d => {
      resDiv.innerHTML += `<strong style="color:#00ffff;">${d.name} (${d.phone}):</strong> ${d.message_sent}<br><br>`;
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    document.getElementById('pay-balance').innerText = `R$ ${Number(data.balance).toFixed(2).replace('.',',')}`;
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ client_name: client, amount: Number(amount), description: 'Fatura Tráfego' })
    });
    const data = await res.json();

    if(res.ok) {
      status.style.color = "#00ffa3";
      status.innerHTML = `
        ✅ Fatura Criada! <br><br>
        <strong>Código PIX Copia e Cola para enviar ao cliente:</strong><br>
        <div style="background:#000; padding:10px; margin-top:10px; border-radius:5px; font-family:monospace; color:#fff;">${data.pix_code}</div>
        <br>
        <small style="color:#888;">(NEXUS descontará 2.5% ao confirmar o pagamento)</small>
      `;
    } else {
      status.innerText = "❌ Erro: " + data.error;
      status.style.color = "#ff3333";
    }
  } catch(e) {
    status.innerText = "❌ Erro: " + e.message;
  }
}
