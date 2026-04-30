
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    
    if(res.ok) {
      box.innerHTML = data.insights;
    } else {
      box.innerHTML = `<div style="color:red;">Erro: ${data.error}</div>`;
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ imageBase64: base64, type })
    });
    const data = await res.json();
    
    if(res.ok) {
      status.innerText = "Hackeamento concluído com sucesso!";
      results.innerHTML = data.analysis;
    } else {
      status.innerText = "Falhou.";
      results.innerHTML = `<div style="color:red;">Erro: ${data.error}</div>`;
    }
  } catch(e) {
    status.innerText = "Erro.";
    results.innerHTML = `<div style="color:red;">Falha: ${e.message}</div>`;
  }
}
