async function openIntegrationsModal() {
    try {
        const token = localStorage.getItem('maranet_token');
        const res = await fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        document.getElementById('int-gemini').value = data['gemini.apiKey'] || '';
        document.getElementById('int-google').value = data['google.mapsApiKey'] || '';
        document.getElementById('int-meta-token').value = data['meta.accessToken'] || '';
        document.getElementById('int-meta-adaccount').value = data['meta.adAccountId'] || '';
        document.getElementById('int-meta-backup').value = data['meta.backupAdAccountId'] || '';
        document.getElementById('int-stripe').value = data['stripe.secretKey'] || '';
        document.getElementById('int-mp').value = data['mercadopago.accessToken'] || '';
        document.getElementById('int-admin-phone').value = data['admin.phone'] || '';

        document.getElementById('int-gemini').value = data['gemini.apiKey'] || '';
        document.getElementById('int-anthropic').value = data['anthropic.apiKey'] || '';
        document.getElementById('int-openai').value = data['openai.apiKey'] || '';
        document.getElementById('int-eleven').value = data['elevenlabs.apiKey'] || '';
        document.getElementById('int-voice-id').value = data['elevenlabs.voiceId'] || '';
        document.getElementById('int-heygen').value = data['heygen.apiKey'] || '';

        document.getElementById('toggle-forge').checked = data['toggle.sentinel_forge'] === 'true';
        document.getElementById('toggle-oracle').checked = data['toggle.skynet_oracle'] === 'true';
        document.getElementById('toggle-lazarus').checked = data['toggle.lazarus_protocol'] === 'true';
        document.getElementById('toggle-hive').checked = data['toggle.hive_mind'] === 'true';
        document.getElementById('toggle-corsario').checked = data['toggle.nexus_corsario'] === 'true';
        document.getElementById('toggle-doppelganger').checked = data['toggle.doppelganger'] === 'true';
        document.getElementById('toggle-poltergeist').checked = data['toggle.poltergeist'] === 'true';
        
        const tempMap = {
            '1': '🧊 Fria (Conservador - Corta gastos rápido)',
            '2': '⚖️ Morna (Equilibrada - Dá respiro à campanha)',
            '3': '🔥 Quente (Agressivo - Escala brutal, Risco Máximo)'
        };
        const tempValue = data['sentinel.temperature'] || '2';
        document.getElementById('int-temp').value = tempValue;
        const lbl = document.getElementById('lbl-temp');
        if(lbl) lbl.innerText = 'Nível: ' + tempMap[tempValue];

        document.getElementById('modal-integrations').style.display = 'flex';
    } catch(e) {
        alert('Erro ao carregar integrações: ' + e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-integrations')?.addEventListener('click', openIntegrationsModal);

    const tempSlider = document.getElementById('int-temp');
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            const tempMap = {
                '1': '🧊 Fria (Conservador - Corta gastos rápido)',
                '2': '⚖️ Morna (Equilibrada - Dá respiro à campanha)',
                '3': '🔥 Quente (Agressivo - Escala brutal, Risco Máximo)'
            };
            const lbl = document.getElementById('lbl-temp');
            if (lbl) lbl.innerText = 'Nível: ' + tempMap[e.target.value];
        });
    }

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
            'meta.backupAdAccountId': document.getElementById('int-meta-backup').value,
            'stripe.secretKey': document.getElementById('int-stripe').value,
            'mercadopago.accessToken': document.getElementById('int-mp').value,
            'admin.phone': document.getElementById('int-admin-phone').value,
            'toggle.sentinel_forge': document.getElementById('toggle-forge').checked ? 'true' : 'false',
            'toggle.skynet_oracle': document.getElementById('toggle-oracle').checked ? 'true' : 'false',
            'toggle.lazarus_protocol': document.getElementById('toggle-lazarus').checked ? 'true' : 'false',
            'toggle.hive_mind': document.getElementById('toggle-hive').checked ? 'true' : 'false',
            'toggle.nexus_corsario': document.getElementById('toggle-corsario').checked ? 'true' : 'false',
            'toggle.doppelganger': document.getElementById('toggle-doppelganger').checked ? 'true' : 'false',
            'toggle.poltergeist': document.getElementById('toggle-poltergeist').checked ? 'true' : 'false',
            'sentinel.temperature': document.getElementById('int-temp').value,
            
            'gemini.apiKey': document.getElementById('int-gemini').value,
            'anthropic.apiKey': document.getElementById('int-anthropic').value,
            'openai.apiKey': document.getElementById('int-openai').value,
            'elevenlabs.apiKey': document.getElementById('int-eleven').value,
            'elevenlabs.voiceId': document.getElementById('int-voice-id').value,
            'heygen.apiKey': document.getElementById('int-heygen').value
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
