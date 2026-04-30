
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ franchise_name: name, admin_email: email, nexus_fee: fee })
    });
    const data = await res.json();
    
    if(res.ok) {
      result.innerHTML = `<h3 style="color:#00ffa3;">FRANQUIA CRIADA COM SUCESSO 🏢✅</h3>
      <p style="color:#fff;">Envie os dados abaixo para o seu cliente:</p>
      <div style="background:#000; padding:10px; border-radius:4px; font-family:monospace; color:#00ffa3; font-size:12px; margin-top:10px;">
        URL: ${data.login_url}<br>
        Login: ${data.admin_email}<br>
        Senha: ${data.default_password}
      </div>
      <p style="color:#ff0055; font-weight:bold; margin-top:10px;">Regra Ativa: ${data.fee}</p>`;
    } else {
      result.innerHTML = `<div style="color:red;">Erro: ${data.error}</div>`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha ao comunicar com o servidor raiz.</div>';
  }

  btn.innerText = "GERAR NOVA FRANQUIA";
  btn.disabled = false;
}
