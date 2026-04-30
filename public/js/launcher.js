function openLauncherModal() {
  document.getElementById('modal-launcher').style.display = 'flex';
}

function closeLauncherModal() {
  document.getElementById('modal-launcher').style.display = 'none';
}

function setLauncherMode(mode) {
  document.getElementById('launcher-mode').value = mode;
  
  const tManual = document.getElementById('tab-manual');
  const tMatrix = document.getElementById('tab-matrix');
  const tAi = document.getElementById('tab-ai');
  
  // Reset tabs
  tManual.className = 'btn-outline';
  tMatrix.className = 'btn-outline';
  tAi.className = 'btn-outline';
  tAi.style.borderColor = '#ff007f'; tAi.style.color = '#ff007f';

  document.getElementById('launcher-fields-standard').style.display = 'none';
  document.getElementById('launcher-fields-ai').style.display = 'none';
  document.getElementById('matrix-hint').style.display = 'none';

  if (mode === 'manual') {
    tManual.className = 'btn teal';
    document.getElementById('launcher-fields-standard').style.display = 'block';
  } else if (mode === 'matrix') {
    tMatrix.className = 'btn teal';
    document.getElementById('launcher-fields-standard').style.display = 'block';
    document.getElementById('matrix-hint').style.display = 'inline';
  } else if (mode === 'ai') {
    tAi.className = 'btn';
    tAi.style.backgroundColor = '#ff007f'; tAi.style.color = '#fff';
    document.getElementById('launcher-fields-ai').style.display = 'block';
  }
}

async function launchCampaign() {
  const btn = document.getElementById('btn-launch');
  const status = document.getElementById('launcher-status');
  const mode = document.getElementById('launcher-mode').value;
  
  const payload = { mode };

  if (mode === 'ai') {
    payload.ai_prompt = document.getElementById('launcher-prompt').value;
    payload.daily_budget = document.getElementById('launcher-ai-budget').value;
    if(!payload.ai_prompt) { alert("Escreva um prompt para a IA!"); return; }
  } else {
    payload.campaign_name = document.getElementById('launcher-name').value;
    payload.daily_budget = document.getElementById('launcher-budget').value;
    payload.copy_text = document.getElementById('launcher-copy').value;
    if(!payload.campaign_name || !payload.copy_text) { alert("Preencha nome e copy!"); return; }
  }

  payload.ad_link = document.getElementById('launcher-link').value;

  btn.innerText = '🤖 Processando Lançamento...';
  btn.disabled = true;
  status.innerText = '';

  try {
    const res = await fetch('/api/launcher/meta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (res.ok) {
      status.innerText = `✅ SUCESSO! ${data.message}`;
      status.style.color = '#00ffa3';
      console.log('Criadas:', data.campaigns);
    } else {
      status.innerText = `❌ ERRO: ${data.error}`;
      status.style.color = '#ff3333';
    }
  } catch (e) {
    status.innerText = `❌ ERRO FATAL: ${e.message}`;
    status.style.color = '#ff3333';
  } finally {
    btn.innerText = '🚀 LANÇAR CAMPANHA';
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const launcherBtn = document.getElementById('btn-nav-launcher');
  if(launcherBtn) launcherBtn.addEventListener('click', openLauncherModal);
});
