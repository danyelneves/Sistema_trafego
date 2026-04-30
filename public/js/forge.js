
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ name, niche, slug })
    });
    const data = await res.json();
    
    if(res.ok) {
      result.innerHTML = `<h3 style="color:#00ffa3;">PÁGINA FORJADA COM SUCESSO! ✅</h3>
      <p style="color:#fff;">O seu site já está online.</p>
      <a href="/f/${data.slug}" target="_blank" style="display:inline-block; margin-top:10px; padding:10px 20px; background:#00ffa3; color:#000; font-weight:bold; text-decoration:none; border-radius:4px;">ABRIR SITE AGORA</a>
      <p style="color:#888; font-size:12px; margin-top:15px;">Dica: Teste o parâmetro mutante acessando /f/${data.slug}?utm_term=Oferta_Especial</p>`;
    } else {
      result.innerHTML = `<div style="color:red;">Erro: ${data.error}</div>`;
    }
  } catch(e) {
    result.innerHTML = '<div style="color:red;">Falha de conexão.</div>';
  }

  btn.innerText = "FORJAR LANDING PAGE (IA)";
  btn.disabled = false;
}
