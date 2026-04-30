function openLauncherModal() {
  document.getElementById('modal-launcher').style.display = 'flex';
}

function closeLauncherModal() {
  document.getElementById('modal-launcher').style.display = 'none';
}

async function launchCampaign() {
  const btn = document.getElementById('btn-launch');
  const status = document.getElementById('launcher-status');
  
  const campaign_name = document.getElementById('launcher-name').value;
  const daily_budget = document.getElementById('launcher-budget').value;
  const copy_text = document.getElementById('launcher-copy').value;
  const ad_link = document.getElementById('launcher-link').value;

  if(!campaign_name || !daily_budget) {
    alert("Preencha o nome e o orçamento!");
    return;
  }

  btn.innerText = '🚀 Lançando nos servidores do Meta...';
  btn.disabled = true;
  status.innerText = '';
  status.style.color = '#fff';

  try {
    const res = await fetch('/api/launcher/meta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ campaign_name, daily_budget, copy_text, ad_link })
    });

    const data = await res.json();
    
    if (res.ok) {
      status.innerText = `✅ SUCESSO! Campanha criada remotamente. ID: ${data.campaign_id}`;
      status.style.color = '#00ffa3';
    } else {
      status.innerText = `❌ ERRO: ${data.error}`;
      status.style.color = '#ff3333';
    }
  } catch (e) {
    status.innerText = `❌ ERRO FATAL: ${e.message}`;
    status.style.color = '#ff3333';
  } finally {
    btn.innerText = '🚀 LANÇAR CAMPANHA AGORA';
    btn.disabled = false;
  }
}

// Attach to UI
document.addEventListener('DOMContentLoaded', () => {
  const launcherBtn = document.getElementById('btn-nav-launcher');
  if(launcherBtn) launcherBtn.addEventListener('click', openLauncherModal);
});
