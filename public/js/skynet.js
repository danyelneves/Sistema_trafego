
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ target_niche: niche, location: location })
    });
    const data = await res.json();
    
    if(res.ok) {
      let logHtml = `<h3 style="color:#00ffa3;">OPERAÇÃO BEM SUCEDIDA ✅</h3>`;
      logHtml += `<p style="color:#aaa;">Alvos Adquiridos: ${data.targets_acquired}</p>`;
      
      data.logs.forEach(log => {
        logHtml += `
          <div style="margin-top:15px; padding:10px; border-left:3px solid #ff0000; background:#111;">
            <div style="color:#fff;">🎯 ${log.target} (${log.phone})</div>
            <div style="color:#00ffa3; font-size:11px; margin-top:5px;">${log.ai_transcription}</div>
            <div style="color:#ffd700; font-size:11px; margin-top:5px;">Aguardando Pagamento em: ${log.checkout_sent}</div>
          </div>
        `;
      });
      result.innerHTML = logHtml;
    } else {
      result.innerHTML = `<div style="color:red;">Erro fatal: ${data.error}</div>`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha de comunicação com o cluster.</div>';
  }

  btn.innerText = "INICIAR CAÇADA GLOBAL";
  btn.disabled = false;
}
