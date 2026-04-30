const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf-8');

// 1. Adicionar Botão "NEXUS Forge" no Menu Arsenal
const arsenalTarget = `<a href="#" onclick="openVisionModal()" style="display:block; padding:12px 15px; color:#00ffff; text-decoration:none; border-bottom:1px solid #222;">👁️ Vision AI (Clonagem)</a>`;
const newArsenalLink = `
            <a href="#" onclick="openForgeModal()" style="display:block; padding:12px 15px; color:#ff4500; text-decoration:none; border-bottom:1px solid #222;">⚡ Forja de Páginas (Forge)</a>
`;
if (!html.includes('⚡ Forja de Páginas')) {
  html = html.replace(arsenalTarget, arsenalTarget + newArsenalLink);
}

// 2. Adicionar Modal do NEXUS Forge
const forgeModal = `
<!-- ================================================================= MODAL · NEXUS FORGE ================================================================= -->
<div class="modal-overlay" id="modal-forge">
  <div class="modal modal-wide" style="max-width: 600px; border: 1px solid #ff4500;">
    <h2 style="color: #ff4500;">NEXUS Forge ⚡</h2>
    <div class="modal-subtitle">Gere uma Landing Page de Alta Conversão "Mutante" em 10 segundos. Hospedada na sua infra.</div>
    
    <div class="form-group" style="margin-top:20px;">
      <label style="color:#aaa;">Nome do Projeto (Ex: Dentista Elite)</label>
      <input type="text" id="forge-name" placeholder="Dentista Elite" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">Nicho e Oferta (Descreva o que a página vende)</label>
      <input type="text" id="forge-niche" placeholder="Implantes Dentários em São Paulo com foco em público Classe A" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">URL Personalizada (Slug)</label>
      <div style="display:flex; align-items:center; background:#111; border:1px solid #333; margin-top:5px; padding-left:10px;">
        <span style="color:#888;">sistrafego.vercel.app/f/</span>
        <input type="text" id="forge-slug" placeholder="dentista-sp" style="width:100%; padding:10px; background:transparent; border:none; color:#fff; outline:none;">
      </div>
    </div>

    <button class="btn-save pulse" id="btn-forge" onclick="generateFunnel()" style="width: 100%; background: #ff4500; color: #fff; margin-top:20px; font-weight:bold;">FORJAR LANDING PAGE (IA)</button>
    <div id="forge-result" style="margin-top:20px; text-align:center;"></div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-forge').style.display='none'">Fechar</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modal-forge')) {
  html = html.replace('<!-- ================================================================= MODAL · HIVE MIND ================================================================= -->', forgeModal + '\n<!-- ================================================================= MODAL · HIVE MIND ================================================================= -->');
}
fs.writeFileSync('public/index.html', html);

// 3. JS Logic for Forge
const jsContent = `
function openForgeModal() {
  document.getElementById('modal-forge').style.display = 'flex';
}

async function generateFunnel() {
  const name = document.getElementById('forge-name').value;
  const niche = document.getElementById('forge-niche').value;
  const slug = document.getElementById('forge-slug').value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const btn = document.getElementById('btn-forge');
  const result = document.getElementById('forge-result');

  if(!name || !niche || !slug) return alert("Preencha todos os campos.");

  btn.innerText = "A INTELIGÊNCIA ARTIFICIAL ESTÁ CODIFICANDO... ⚡";
  btn.disabled = true;
  result.innerHTML = '<span style="color:#ff4500;">Escrevendo HTML, CSS e Gatilhos Mentais...</span>';

  try {
    const res = await fetch('/api/forge/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ name, niche, slug })
    });
    const data = await res.json();
    
    if(res.ok) {
      result.innerHTML = \`<h3 style="color:#00ffa3;">PÁGINA FORJADA COM SUCESSO! ✅</h3>
      <p style="color:#fff;">O seu site já está online.</p>
      <a href="/f/\${data.slug}" target="_blank" style="display:inline-block; margin-top:10px; padding:10px 20px; background:#00ffa3; color:#000; font-weight:bold; text-decoration:none; border-radius:4px;">ABRIR SITE AGORA</a>
      <p style="color:#888; font-size:12px; margin-top:15px;">Dica: Teste o parâmetro mutante acessando /f/\${data.slug}?utm_term=Oferta_Especial</p>\`;
    } else {
      result.innerHTML = \`<div style="color:red;">Erro: \${data.error}</div>\`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha de conexão.</div>';
  }

  btn.innerText = "FORJAR LANDING PAGE (IA)";
  btn.disabled = false;
}
`;

fs.writeFileSync('public/js/forge.js', jsContent);

let finalHtml = fs.readFileSync('public/index.html', 'utf-8');
if (!finalHtml.includes('js/forge.js')) {
  finalHtml = finalHtml.replace('<script src="js/final_boss.js"></script>', '<script src="js/final_boss.js"></script>\n<script src="js/forge.js"></script>');
  fs.writeFileSync('public/index.html', finalHtml);
}
