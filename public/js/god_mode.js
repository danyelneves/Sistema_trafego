
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ lead_name: name, lead_phone: phone, script })
    });
    const data = await res.json();
    
    if(res.ok) {
      result.innerHTML = `<h3 style="color:#00ffa3;">LIGAÇÃO CONCLUÍDA ✅</h3>
      <p style="color:#fff;">Duração: ${data.duration_estimate}</p>
      <p style="color:#aaa; font-size:12px; margin-top:10px;"><strong>Transcrição da Chamada:</strong></p>
      <div style="background:#000; padding:10px; border-radius:4px; font-family:monospace; color:#00ffa3; font-size:11px;">${data.ai_transcription}</div>
      <p style="color:#00ffa3; font-weight:bold; margin-top:10px;">Resultado: AGENDADO COM SUCESSO</p>`;
    } else {
      result.innerHTML = `<div style="color:red;">Erro: ${data.error}</div>`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha de comunicação com operadora.</div>';
  }

  btn.innerText = "📞 INICIAR LIGAÇÃO DA IA";
  btn.disabled = false;
}
