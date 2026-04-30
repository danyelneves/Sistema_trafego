async function loadSaasAdmin() {
    try {
        const token = localStorage.getItem('maranet_token');
        const res = await fetch('/api/billing/master', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            alert('Acesso Negado. Apenas o Administrator (Workspace 1) tem acesso à visão de Faturamento SaaS.');
            document.getElementById('modal-saas').style.display = 'none';
            return;
        }

        const data = await res.json();
        
        document.getElementById('saas-total-tenants').innerText = data.total_customers || 0;
        document.getElementById('saas-api-cost').innerText = data.your_api_cost || 'R$ 0,00';
        document.getElementById('saas-billed').innerText = data.your_revenue_billed || 'R$ 0,00';
        document.getElementById('saas-profit').innerText = data.profit || 'R$ 0,00';

        const tbody = document.getElementById('saas-tbody');
        tbody.innerHTML = '';

        if (data.tenants && data.tenants.length > 0) {
            data.tenants.forEach(t => {
                const isOverLimit = parseFloat(t.credits_used || 0) >= parseFloat(t.credits_limit || 0);
                const statusHtml = isOverLimit 
                    ? '<span style="color:#ff3333; font-weight:bold;">⚠️ Limite Atingido (Bloqueado)</span>' 
                    : '<span style="color:#00ffa3; font-weight:bold;">✅ Ativo</span>';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #333;">${t.workspace_id}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #333;">${t.workspace_name || 'Desconhecido'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #333;">
                        <span style="background:#222; padding:4px 8px; border-radius:4px; font-size:12px;">${t.plan_type || 'TRIAL'}</span>
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #333;">R$ ${parseFloat(t.credits_limit || 0).toFixed(2)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #333; color: ${isOverLimit ? '#ff3333' : '#fff'}">R$ ${parseFloat(t.credits_used || 0).toFixed(2)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #333;">${statusHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('modal-saas').style.display = 'flex';
    } catch (e) {
        console.error('Erro ao carregar SaaS:', e);
        alert('Erro de conexão ao carregar gestão SaaS.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnSaas = document.getElementById('btn-saas');
    if (btnSaas) {
        btnSaas.addEventListener('click', (e) => {
            e.preventDefault();
            loadSaasAdmin();
        });
    }
});
