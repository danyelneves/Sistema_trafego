document.getElementById('btn-extract').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Extraindo...";
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes("facebook.com/ads/library")) {
    statusEl.textContent = "Erro: Funciona apenas na FB Ads Library.";
    return;
  }

  const apiUrl = document.getElementById('api-url').value;
  const wsId = document.getElementById('ws-id').value;

  chrome.tabs.sendMessage(tab.id, { action: "extract_ad" }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      statusEl.textContent = "Erro ao injetar script ou não encontrou anúncio visível.";
      return;
    }

    if (response.success && response.ad) {
      statusEl.textContent = "Enviando para o Nexus...";
      
      try {
        const payload = {
          workspace_id: wsId,
          ad_url: response.ad.adUrl,
          ad_media_url: response.ad.mediaUrl,
          ad_copy: response.ad.copyText,
          competitor_name: response.ad.advertiser
        };

        const res = await fetch(`${apiUrl}/api/empire/spy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          statusEl.textContent = "Salvo com sucesso no Nexus Raio-X! ✅";
          statusEl.style.color = "#00ffcc";
        } else {
          statusEl.textContent = "Falha na API: " + await res.text();
          statusEl.style.color = "red";
        }
      } catch (e) {
        statusEl.textContent = "Erro de conexão: " + e.message;
        statusEl.style.color = "red";
      }
    } else {
      statusEl.textContent = "Nenhum anúncio focado encontrado.";
    }
  });
});
