
async function loadCheckoutOrders() {
  document.getElementById('modal-checkout-orders').style.display = 'flex';
  const tbody = document.getElementById('sales-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando...</td></tr>';
  
  try {
    const res = await fetch('/api/checkout/orders', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    
    document.getElementById('sales-total').innerText = `R$ ${Number(data.total).toFixed(2).replace('.',',')}`;
    tbody.innerHTML = '';
    
    if(data.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma venda encontrada.</td></tr>';
      return;
    }

    data.orders.forEach(o => {
      let badge = o.status === 'PAID' ? `<span style="color:#00ffa3;">APROVADO</span>` : `<span style="color:#ffcc00;">${o.status}</span>`;
      tbody.innerHTML += `
        <tr>
          <td>#${o.id}</td>
          <td>${o.customer_name}<br><small>${o.customer_email}</small></td>
          <td>${o.product_name}</td>
          <td>R$ ${o.amount}</td>
          <td>${o.payment_method}</td>
          <td>${badge}</td>
        </tr>
      `;
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Erro ao carregar vendas.</td></tr>';
  }
}
