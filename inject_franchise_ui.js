const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf-8');

// 1. Injetar link do Gestor de Franquias no Dropdown Arsenal
const arsenalTarget = `<a href="#" onclick="openSyndicateModal()" style="display:block; padding:12px 15px; color:#ffd700; text-decoration:none;">👑 Syndicate (Sócios Automáticos)</a>`;
const franchiseLink = `
            <a href="#" onclick="openSyndicateModal()" style="display:block; padding:12px 15px; color:#ffd700; text-decoration:none; border-bottom:1px solid #222;">👑 Syndicate (Sócios Automáticos)</a>
            <a href="#" onclick="openFranchiseModal()" style="display:block; padding:12px 15px; color:#ff0055; text-decoration:none;">🏢 Gestor de Franquias (SaaS)</a>
`;
if (!html.includes('🏢 Gestor de Franquias')) {
  html = html.replace(arsenalTarget, franchiseLink);
}

// 2. Modal de Franquias
const franchiseModal = `
<!-- ================================================================= MODAL · NEXUS FRANCHISE ================================================================= -->
<div class="modal-overlay" id="modal-franchise">
  <div class="modal modal-wide" style="max-width: 600px; border: 1px solid #ff0055;">
    <h2 style="color: #ff0055;">Licenciamento NEXUS (SaaS) 🏢</h2>
    <div class="modal-subtitle">Alugue o sistema para outras agências. Configure o nome deles e cobre um pedágio invisível.</div>
    
    <div class="form-group" style="margin-top:20px;">
      <label style="color:#aaa;">Nome da Franquia (Ex: Agência XYZ)</label>
      <input type="text" id="fran-name" placeholder="Agência XYZ" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">Email do Dono da Franquia</label>
      <input type="email" id="fran-email" placeholder="dono@agenciaxyz.com" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">Seu Pedágio (% do Checkout NEXUS Black deles)</label>
      <input type="number" id="fran-fee" value="5.0" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
    </div>

    <button class="btn-save pulse" id="btn-fran" onclick="createFranchise()" style="width: 100%; background: #ff0055; color: #fff; margin-top:10px; font-weight:bold;">GERAR NOVA FRANQUIA</button>
    <div id="fran-result" style="margin-top:20px; text-align:left; background:#111; padding:15px; border-radius:8px; border:1px solid #333; display:none;"></div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-franchise').style.display='none'">Fechar</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modal-franchise')) {
  html = html.replace('<!-- ================================================================= MODAL · NEXUS SYNDICATE ================================================================= -->', franchiseModal + '\n<!-- ================================================================= MODAL · NEXUS SYNDICATE ================================================================= -->');
}
fs.writeFileSync('public/index.html', html);

// 3. JS Logic for Franchise
const jsContent = `
function openFranchiseModal() {
  document.getElementById('modal-franchise').style.display = 'flex';
}

async function createFranchise() {
  const name = document.getElementById('fran-name').value;
  const email = document.getElementById('fran-email').value;
  const fee = document.getElementById('fran-fee').value;
  const btn = document.getElementById('btn-fran');
  const result = document.getElementById('fran-result');

  if(!name || !email) return alert("Preencha o nome e email.");

  btn.innerText = "ALOCANDO SERVIDOR E BANCO DE DADOS... 📡";
  btn.disabled = true;
  result.style.display = 'block';
  result.innerHTML = '<span style="color:#ff0055;">Criando ambiente isolado... Configurando regras de pedágio financeiro...</span>';

  try {
    const res = await fetch('/api/franchise/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ franchise_name: name, admin_email: email, nexus_fee: fee })
    });
    const data = await res.json();
    
    if(res.ok) {
      result.innerHTML = \`<h3 style="color:#00ffa3;">FRANQUIA CRIADA COM SUCESSO 🏢✅</h3>
      <p style="color:#fff;">Envie os dados abaixo para o seu cliente:</p>
      <div style="background:#000; padding:10px; border-radius:4px; font-family:monospace; color:#00ffa3; font-size:12px; margin-top:10px;">
        URL: \${data.login_url}<br>
        Login: \${data.admin_email}<br>
        Senha: \${data.default_password}
      </div>
      <p style="color:#ff0055; font-weight:bold; margin-top:10px;">Regra Ativa: \${data.fee}</p>\`;
    } else {
      result.innerHTML = \`<div style="color:red;">Erro: \${data.error}</div>\`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha ao comunicar com o servidor raiz.</div>';
  }

  btn.innerText = "GERAR NOVA FRANQUIA";
  btn.disabled = false;
}
`;

fs.writeFileSync('public/js/franchise.js', jsContent);

let finalHtml = fs.readFileSync('public/index.html', 'utf-8');
if (!finalHtml.includes('js/franchise.js')) {
  finalHtml = finalHtml.replace('<script src="js/god_mode.js"></script>', '<script src="js/god_mode.js"></script>\n<script src="js/franchise.js"></script>');
  fs.writeFileSync('public/index.html', finalHtml);
}
