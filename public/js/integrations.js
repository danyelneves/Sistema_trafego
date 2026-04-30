async function openIntegrationsModal() {
    try {
        const token = localStorage.getItem('maranet_token');
        const res = await fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        document.getElementById('int-gemini').value = data['gemini.apiKey'] || '';
        document.getElementById('int-google').value = data['google.mapsApiKey'] || '';
        document.getElementById('int-meta-token').value = data['meta.accessToken'] || '';
        document.getElementById('int-meta-adaccount').value = data['meta.adAccountId'] || '';
        document.getElementById('int-stripe').value = data['stripe.secretKey'] || '';
        document.getElementById('int-mp').value = data['mercadopago.accessToken'] || '';
        document.getElementById('int-admin-phone').value = data['admin.phone'] || '';
        
        document.getElementById('modal-integrations').style.display = 'flex';
    } catch(e) {
        alert('Erro ao carregar integrações: ' + e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-integrations')?.addEventListener('click', openIntegrationsModal);

    document.getElementById('btn-save-integrations')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-integrations');
        const oldText = btn.innerHTML;
        btn.innerHTML = 'Salvando...';
        btn.disabled = true;

        const payload = {
            'gemini.apiKey': document.getElementById('int-gemini').value,
            'google.mapsApiKey': document.getElementById('int-google').value,
            'meta.accessToken': document.getElementById('int-meta-token').value,
            'meta.adAccountId': document.getElementById('int-meta-adaccount').value,
            'stripe.secretKey': document.getElementById('int-stripe').value,
            'mercadopago.accessToken': document.getElementById('int-mp').value,
            'admin.phone': document.getElementById('int-admin-phone').value
        };

        try {
            const token = localStorage.getItem('maranet_token');
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                alert('Integrações salvas com sucesso!');
                document.getElementById('modal-integrations').style.display = 'none';
            } else {
                const data = await res.json();
                alert('Erro ao salvar: ' + (data.error || 'Desconhecido'));
            }
        } catch(e) {
            alert('Erro de rede: ' + e.message);
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    });
});
