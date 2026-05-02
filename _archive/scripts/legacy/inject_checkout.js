const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf-8');

// Add "Produtos" button
const targetBtn = `<button class="btn-outline" id="btn-nav-pay" style="border-color: #00ffa3; color: #00ffa3;" onclick="loadNexusPay()">💳 NEXUS Pay</button>`;
if (!content.includes('id="btn-nav-products"')) {
  content = content.replace(targetBtn, targetBtn + `\n        <button class="btn-outline" id="btn-nav-products" onclick="window.open('/checkout?product_id=1', '_blank')" style="border-color: #fff; color: #fff;">🛒 Ver Meu Checkout</button>`);
  fs.writeFileSync('public/index.html', content);
}
