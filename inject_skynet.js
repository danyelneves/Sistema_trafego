const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf-8');

// 1. Injetar link da Skynet no Dropdown Arsenal
const arsenalTarget = `<a href="#" onclick="openFranchiseModal()" style="display:block; padding:12px 15px; color:#ff0055; text-decoration:none;">🏢 Gestor de Franquias (SaaS)</a>`;
const skynetLink = `
            <a href="#" onclick="openFranchiseModal()" style="display:block; padding:12px 15px; color:#ff0055; text-decoration:none; border-bottom:1px solid #222;">🏢 Gestor de Franquias (SaaS)</a>
            <a href="#" onclick="openSkynetModal()" style="display:block; padding:12px 15px; color:#ff0000; text-decoration:none; font-weight:bold; text-transform:uppercase;">🤖 Operação Skynet</a>
`;
if (!html.includes('🤖 Operação Skynet')) {
  html = html.replace(arsenalTarget, skynetLink);
}

// 2. Modal da Skynet
const skynetModal = `
<!-- ================================================================= MODAL · NEXUS SKYNET ================================================================= -->
<div class="modal-overlay" id="modal-skynet">
  <div class="modal modal-wide" style="max-width: 700px; border: 1px solid #ff0000; box-shadow: 0 0 50px rgba(255,0,0,0.2);">
    <h2 style="color: #ff0000; text-transform:uppercase;">Operação Skynet 🤖🔥</h2>
    <div class="modal-subtitle">O grau máximo de automação. A máquina caça, liga, vende e cobra as empresas sozinha. Você só recebe os recibos do Checkout.</div>
    
    <div class="form-group" style="margin-top:20px;">
      <label style="color:#aaa;">Qual nicho a máquina deve caçar?</label>
      <input type="text" id="skynet-niche" placeholder="Ex: Dentistas de Implante" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #ff0000; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">Qual cidade ou região?</label>
      <input type="text" id="skynet-location" placeholder="Ex: São Paulo, Capital" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #ff0000; margin-top:5px; margin-bottom:15px;">
    </div>

    <button class="btn-save pulse" id="btn-skynet" onclick="launchSkynet()" style="width: 100%; background: #ff0000; color: #fff; margin-top:10px; font-weight:bold; font-size:18px;">INICIAR CAÇADA GLOBAL</button>
    
    <div id="skynet-result" style="margin-top:20px; text-align:left; background:#050505; padding:15px; border-radius:8px; border:1px solid #ff0000; display:none; font-family:monospace;"></div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-skynet').style.display='none'">Abortar Missão</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modal-skynet')) {
  html = html.replace('<!-- ================================================================= MODAL · NEXUS FRANCHISE ================================================================= -->', skynetModal + '\n<!-- ================================================================= MODAL · NEXUS FRANCHISE ================================================================= -->');
}
fs.writeFileSync('public/index.html', html);

// 3. JS Logic for Skynet
const jsContent = `
function openSkynetModal() {
  document.getElementById('modal-skynet').style.display = 'flex';
}

async function launchSkynet() {
  const niche = document.getElementById('skynet-niche').value;
  const location = document.getElementById('skynet-location').value;
  const btn = document.getElementById('btn-skynet');
  const result = document.getElementById('skynet-result');

  if(!niche || !location) return alert("Parâmetros de alvo ausentes.");

  btn.innerText = "SISTEMA DESPERTANDO... BUSCANDO ALVOS... 📡";
  btn.disabled = true;
  result.style.display = 'block';
  result.innerHTML = '<span style="color:#ff0000;">[LOG] Varrendo Google Maps via API Rest... Extraindo telefones corporativos...</span>';

  try {
    const res = await fetch('/api/skynet/hunt', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ target_niche: niche, location: location })
    });
    const data = await res.json();
    
    if(res.ok) {
      let logHtml = \`<h3 style="color:#00ffa3;">OPERAÇÃO BEM SUCEDIDA ✅</h3>\`;
      logHtml += \`<p style="color:#aaa;">Alvos Adquiridos: \${data.targets_acquired}</p>\`;
      
      data.logs.forEach(log => {
        logHtml += \`
          <div style="margin-top:15px; padding:10px; border-left:3px solid #ff0000; background:#111;">
            <div style="color:#fff;">🎯 \${log.target} (\${log.phone})</div>
            <div style="color:#00ffa3; font-size:11px; margin-top:5px;">\${log.ai_transcription}</div>
            <div style="color:#ffd700; font-size:11px; margin-top:5px;">Aguardando Pagamento em: \${log.checkout_sent}</div>
          </div>
        \`;
      });
      result.innerHTML = logHtml;
    } else {
      result.innerHTML = \`<div style="color:red;">Erro fatal: \${data.error}</div>\`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha de comunicação com o cluster.</div>';
  }

  btn.innerText = "INICIAR CAÇADA GLOBAL";
  btn.disabled = false;
}
`;

fs.writeFileSync('public/js/skynet.js', jsContent);

let finalHtml = fs.readFileSync('public/index.html', 'utf-8');
if (!finalHtml.includes('js/skynet.js')) {
  finalHtml = finalHtml.replace('<script src="js/franchise.js"></script>', '<script src="js/franchise.js"></script>\n<script src="js/skynet.js"></script>');
  fs.writeFileSync('public/index.html', finalHtml);
}
