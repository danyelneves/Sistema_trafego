const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf-8');

// 1. Add Hive Mind and Vision AI links to Arsenal dropdown
const arsenalTarget = `<a href="/checkout?product_id=1" target="_blank" style="display:block; padding:12px 15px; color:#fff; text-decoration:none; border-bottom:1px solid #222;">🛒 Ver Meu Checkout</a>`;
const newArsenalLinks = `
            <a href="#" onclick="openHiveModal()" style="display:block; padding:12px 15px; color:#ff007f; text-decoration:none; border-bottom:1px solid #222;">🧠 Mente de Colmeia</a>
            <a href="#" onclick="openVisionModal()" style="display:block; padding:12px 15px; color:#00ffff; text-decoration:none; border-bottom:1px solid #222;">👁️ Vision AI (Clonagem)</a>
`;
if (!html.includes('🧠 Mente de Colmeia')) {
  html = html.replace(arsenalTarget, arsenalTarget + newArsenalLinks);
}

// 2. Add Modals for Hive and Vision
const finalBossModals = `
<!-- ================================================================= MODAL · HIVE MIND ================================================================= -->
<div class="modal-overlay" id="modal-hive">
  <div class="modal modal-wide" style="max-width: 700px; border: 1px solid #ff007f;">
    <h2 style="color: #ff007f;">Mente de Colmeia NEXUS 🧠</h2>
    <div class="modal-subtitle">Tendências Globais Anônimas captadas na rede nas últimas horas.</div>
    
    <div id="hive-insights" style="margin-top:20px; font-size:16px; line-height:1.6; padding:20px; background:#111; border-radius:8px; border:1px dashed #ff007f; min-height:100px;">
      <div style="text-align:center; color:#888;">Clique no botão abaixo para sondar a rede neural do Brasil...</div>
    </div>

    <button class="btn-save pulse" onclick="scanHive()" style="width: 100%; background: #ff007f; color: #fff; margin-top:20px; font-weight:bold;">SONDAR COLMEIA AGORA</button>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-hive').style.display='none'">Fechar</button>
    </div>
  </div>
</div>

<!-- ================================================================= MODAL · VISION AI ================================================================= -->
<div class="modal-overlay" id="modal-vision">
  <div class="modal modal-wide" style="max-width: 800px; border: 1px solid #00ffff;">
    <h2 style="color: #00ffff;">Engenharia Reversa (Vision AI) 👁️</h2>
    <div class="modal-subtitle">Suba o print de um anúncio concorrente e a IA vai hackear e recriar.</div>
    
    <div style="display:flex; gap:20px; margin-top:20px;">
      <div style="flex:1;">
        <label style="display:block; margin-bottom:10px; font-weight:bold;">Tipo de Análise</label>
        <select id="vision-type" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:5px;">
          <option value="ad">Print de Anúncio (Meta/Google)</option>
          <option value="lp">Print de Landing Page (Site)</option>
        </select>
        
        <label style="display:block; margin-top:20px; margin-bottom:10px; font-weight:bold;">Upload da Imagem</label>
        <input type="file" id="vision-file" accept="image/*" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:5px;">
        
        <button class="btn-save pulse" onclick="runVision()" style="width: 100%; background: #00ffff; color: #000; margin-top:20px; font-weight:bold;">HACKEAR IMAGEM AGORA</button>
        <div id="vision-status" style="margin-top:10px; font-size:12px; color:#888;"></div>
      </div>
      
      <div style="flex:1.5; background:#111; padding:20px; border:1px solid #333; border-radius:8px; overflow-y:auto; max-height:400px;" id="vision-results">
        <div style="text-align:center; color:#555; margin-top:150px;">O resultado da clonagem aparecerá aqui.</div>
      </div>
    </div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-vision').style.display='none'">Fechar</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modal-hive')) {
  html = html.replace('<!-- ================================================================= MODAL · NEXUS PAY ================================================================= -->', finalBossModals + '\n<!-- ================================================================= MODAL · NEXUS PAY ================================================================= -->');
}
fs.writeFileSync('public/index.html', html);

// 3. JS Logic for Hive and Vision
const jsContent = `
function openHiveModal() {
  document.getElementById('modal-hive').style.display = 'flex';
}

function openVisionModal() {
  document.getElementById('modal-vision').style.display = 'flex';
}

async function scanHive() {
  const box = document.getElementById('hive-insights');
  box.innerHTML = '<div style="text-align:center; color:#ff007f;">Conectando ao banco de dados nacional... Analisando trilhões de métricas... 🧠</div>';
  
  try {
    const res = await fetch('/api/hive/pulse', {
      headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
    });
    const data = await res.json();
    
    if(res.ok) {
      box.innerHTML = data.insights;
    } else {
      box.innerHTML = \`<div style="color:red;">Erro: \${data.error}</div>\`;
    }
  } catch(e) {
    box.innerHTML = '<div style="color:red;">Falha de conexão com a rede.</div>';
  }
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function runVision() {
  const fileInput = document.getElementById('vision-file');
  const type = document.getElementById('vision-type').value;
  const status = document.getElementById('vision-status');
  const results = document.getElementById('vision-results');

  if(fileInput.files.length === 0) return alert("Selecione uma imagem!");

  status.innerText = "Lendo pixels da imagem... Enviando para a IA Visual...";
  status.style.color = "#00ffff";
  results.innerHTML = '<div style="text-align:center; color:#00ffff; margin-top:150px;">Processando engenharia reversa... 👁️</div>';

  try {
    const base64 = await getBase64(fileInput.files[0]);
    
    const res = await fetch('/api/vision/reverse', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ imageBase64: base64, type })
    });
    const data = await res.json();
    
    if(res.ok) {
      status.innerText = "Hackeamento concluído com sucesso!";
      results.innerHTML = data.analysis;
    } else {
      status.innerText = "Falhou.";
      results.innerHTML = \`<div style="color:red;">Erro: \${data.error}</div>\`;
    }
  } catch(e) {
    status.innerText = "Erro.";
    results.innerHTML = \`<div style="color:red;">Falha: \${e.message}</div>\`;
  }
}
`;

fs.writeFileSync('public/js/final_boss.js', jsContent);

let finalHtml = fs.readFileSync('public/index.html', 'utf-8');
if (!finalHtml.includes('js/final_boss.js')) {
  finalHtml = finalHtml.replace('<script src="js/checkout_orders.js"></script>', '<script src="js/checkout_orders.js"></script>\n<script src="js/final_boss.js"></script>');
  fs.writeFileSync('public/index.html', finalHtml);
}
