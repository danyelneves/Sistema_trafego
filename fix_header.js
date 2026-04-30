const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf-8');

// Fix the import modal that was accidentally replaced
content = content.replace(
  /<div class="modal-actions">\s*<button class="btn-outline" id="btn-nav-kanban">.*?<\/div>/s,
  `<div class="modal-actions">
      <button class="btn" id="import-close">Fechar</button>
      <button class="btn" id="import-clear">Limpar</button>
      <button class="btn teal" id="import-run">Importar</button>
    </div>`
);

// Add the Launcher button to the actual header
const headerTarget = `        <button class="btn-outline" id="btn-nav-whatsapp">📱 Whats</button>`;
if (!content.includes('id="btn-nav-launcher"')) {
  content = content.replace(headerTarget, headerTarget + `\n        <button class="btn-outline" id="btn-nav-launcher" style="border-color: #ff007f; color: #ff007f;">🚀 Lançador</button>`);
}

fs.writeFileSync('public/index.html', content);
