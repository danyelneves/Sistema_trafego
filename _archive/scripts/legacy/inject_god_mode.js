const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf-8');

// 1. Injetar links finais no menu Arsenal
const arsenalTarget = `<a href="#" onclick="openForgeModal()" style="display:block; padding:12px 15px; color:#ff4500; text-decoration:none; border-bottom:1px solid #222;">⚡ Forja de Páginas (Forge)</a>`;
const godModeLinks = `
            <a href="#" onclick="openVoiceModal()" style="display:block; padding:12px 15px; color:#9400d3; text-decoration:none; border-bottom:1px solid #222;">📞 Voice AI (Robô Call Center)</a>
            <a href="#" onclick="openSyndicateModal()" style="display:block; padding:12px 15px; color:#ffd700; text-decoration:none;">👑 Syndicate (Sócios Automáticos)</a>
`;
if (!html.includes('📞 Voice AI')) {
  html = html.replace(arsenalTarget, arsenalTarget + godModeLinks);
}

// 2. Modais para Voice e Syndicate
const godModeModals = `
<!-- ================================================================= MODAL · NEXUS VOICE ================================================================= -->
<div class="modal-overlay" id="modal-voice">
  <div class="modal modal-wide" style="max-width: 600px; border: 1px solid #9400d3;">
    <h2 style="color: #9400d3;">NEXUS Voice AI 📞</h2>
    <div class="modal-subtitle">A sua telefonista invisível que liga pros leads em 3 segundos.</div>
    
    <div class="form-group" style="margin-top:20px;">
      <label style="color:#aaa;">Nome do Lead</label>
      <input type="text" id="voice-name" placeholder="Roberto Almeida" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">Telefone / WhatsApp</label>
      <input type="text" id="voice-phone" placeholder="11999999999" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;">
      
      <label style="color:#aaa;">Script de Atendimento da IA</label>
      <textarea id="voice-script" rows="4" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; margin-top:5px; margin-bottom:15px;" placeholder="Aja como uma secretária de clínica de estética. Confirme o agendamento de botox e seja simpática."></textarea>
    </div>

    <button class="btn-save pulse" id="btn-voice" onclick="startAICall()" style="width: 100%; background: #9400d3; color: #fff; margin-top:10px; font-weight:bold;">📞 INICIAR LIGAÇÃO DA IA</button>
    <div id="voice-result" style="margin-top:20px; text-align:left; background:#111; padding:15px; border-radius:8px; border:1px solid #333; display:none;"></div>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-voice').style.display='none'">Fechar</button>
    </div>
  </div>
</div>

<!-- ================================================================= MODAL · NEXUS SYNDICATE ================================================================= -->
<div class="modal-overlay" id="modal-syndicate">
  <div class="modal modal-wide" style="max-width: 600px; border: 1px solid #ffd700;">
    <h2 style="color: #ffd700;">NEXUS Syndicate 👑</h2>
    <div class="modal-subtitle">Contratos Inteligentes: Você paga o tráfego, a venda cai no Checkout, você retém 30% na fonte.</div>
    
    <div style="background:#111; padding:20px; border-radius:8px; margin-top:20px; text-align:center;">
      <div style="color:#888; font-size:12px;">Taxa de Pedágio Padrão</div>
      <div style="color:#ffd700; font-size:32px; font-weight:bold;">30%</div>
      <p style="color:#aaa; font-size:12px; margin-top:10px;">A cada venda feita pelo checkout nativo, o motor desvia a sua fatia automaticamente antes de repassar ao sócio/produtor.</p>
    </div>

    <button class="btn-save" onclick="alert('Link de Coprodução copiado! Envie para o parceiro.');" style="width: 100%; background: #ffd700; color: #000; margin-top:20px; font-weight:bold;">🔗 GERAR LINK DE PARCERIA (SMART CONTRACT)</button>

    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn-cancel" onclick="document.getElementById('modal-syndicate').style.display='none'">Fechar</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modal-voice')) {
  html = html.replace('<!-- ================================================================= MODAL · NEXUS FORGE ================================================================= -->', godModeModals + '\n<!-- ================================================================= MODAL · NEXUS FORGE ================================================================= -->');
}
fs.writeFileSync('public/index.html', html);

// 3. JS Logic for Voice and Syndicate
const jsContent = `
function openVoiceModal() {
  document.getElementById('modal-voice').style.display = 'flex';
}

function openSyndicateModal() {
  document.getElementById('modal-syndicate').style.display = 'flex';
}

async function startAICall() {
  const name = document.getElementById('voice-name').value;
  const phone = document.getElementById('voice-phone').value;
  const script = document.getElementById('voice-script').value;
  const btn = document.getElementById('btn-voice');
  const result = document.getElementById('voice-result');

  if(!name || !phone) return alert("Preencha o nome e telefone do lead.");

  btn.innerText = "A IA ESTÁ LIGANDO... 📡";
  btn.disabled = true;
  result.style.display = 'block';
  result.innerHTML = '<span style="color:#9400d3;">Sintetizando voz neural e conectando ao PABX...</span>';

  try {
    const res = await fetch('/api/voice/call', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify({ lead_name: name, lead_phone: phone, script })
    });
    const data = await res.json();
    
    if(res.ok) {
      result.innerHTML = \`<h3 style="color:#00ffa3;">LIGAÇÃO CONCLUÍDA ✅</h3>
      <p style="color:#fff;">Duração: \${data.duration_estimate}</p>
      <p style="color:#aaa; font-size:12px; margin-top:10px;"><strong>Transcrição da Chamada:</strong></p>
      <div style="background:#000; padding:10px; border-radius:4px; font-family:monospace; color:#00ffa3; font-size:11px;">\${data.ai_transcription}</div>
      <p style="color:#00ffa3; font-weight:bold; margin-top:10px;">Resultado: AGENDADO COM SUCESSO</p>\`;
    } else {
      result.innerHTML = \`<div style="color:red;">Erro: \${data.error}</div>\`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha de comunicação com operadora.</div>';
  }

  btn.innerText = "📞 INICIAR LIGAÇÃO DA IA";
  btn.disabled = false;
}
`;

fs.writeFileSync('public/js/god_mode.js', jsContent);

let finalHtml = fs.readFileSync('public/index.html', 'utf-8');
if (!finalHtml.includes('js/god_mode.js')) {
  finalHtml = finalHtml.replace('<script src="js/forge.js"></script>', '<script src="js/forge.js"></script>\n<script src="js/god_mode.js"></script>');
  fs.writeFileSync('public/index.html', finalHtml);
}
