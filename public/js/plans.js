async function loadMyPlan() {
    try {
        const token = localStorage.getItem('maranet_token');
        const res = await fetch('/api/billing/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('plan-current-name').innerText = data.plan_type || 'TRIAL';
            document.getElementById('plan-usage-text').innerText = `R$ ${data.credits_used.toFixed(2)} / R$ ${data.credits_limit.toFixed(2)}`;
            
            const pct = Math.min((data.credits_used / (data.credits_limit || 1)) * 100, 100);
            const progressBar = document.getElementById('plan-progress-bar');
            progressBar.style.width = `${pct}%`;

            if (pct >= 100) {
                progressBar.style.background = 'linear-gradient(90deg, #ff0000, #ff3333)';
            } else if (pct >= 80) {
                progressBar.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
            } else {
                progressBar.style.background = 'linear-gradient(90deg, #00ffa3, #00ffff)';
            }
        }
    } catch (e) {
        console.error('Erro ao buscar plano atual:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnPlan = document.getElementById('btn-plan');
    if (btnPlan) {
        btnPlan.addEventListener('click', loadMyPlan);
    }

    const upgradeBtns = document.querySelectorAll('.btn-upgrade');
    upgradeBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const planName = e.target.getAttribute('data-plan');
            const token = localStorage.getItem('maranet_token');
            
            if(confirm(`Deseja migrar para o plano ${planName}? Isso gerará uma assinatura recorrente no cartão.`)) {
                try {
                    const res = await fetch('/api/billing/upgrade', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ plan_name: planName })
                    });
                    
                    const data = await res.json();
                    if (res.ok) {
                        if (data.checkout_url) {
                            // Se a API retornou um link de pagamento do Mercado Pago (Chave real configurada)
                            alert(`Você será redirecionado para o Checkout Seguro do Mercado Pago.`);
                            window.location.href = data.checkout_url;
                        } else {
                            // Upgrade Fiado (Dono não colocou a chave ainda)
                            alert(`Sucesso! ${data.message}`);
                            loadMyPlan(); // Reload progress bar
                        }
                    } else {
                        alert(`Erro: ${data.error}`);
                    }
                } catch(err) {
                    alert('Erro ao tentar upgrade: ' + err.message);
                }
            }
        });
    });
});
