async function forceSentinel() {
    const btn = document.getElementById('btn-sentinel-force');
    if (!btn) return;

    const oldText = btn.innerHTML;
    btn.innerHTML = '⚡ Rodando IA...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        const token = localStorage.getItem('nx_token');
        if (!token) {
            alert('Você precisa estar logado para forçar o Sentinel.');
            return;
        }

        const res = await fetch('/api/sentinel/force', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            alert('Erro ao rodar Sentinel: ' + (data.error || 'Falha desconhecida.'));
            return;
        }

        let reportStr = '';
        if (Array.isArray(data.report)) {
            reportStr = data.report.join('\n\n');
        } else {
            reportStr = data.report;
        }

        alert('⚡ Relatório SENTINEL:\n\n' + reportStr);

    } catch (e) {
        console.error(e);
        alert('Erro de rede ao contatar o Sentinel.');
    } finally {
        btn.innerHTML = oldText;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}
