const fs = require('fs');
const files = ['public/index.html', 'public/login.html', 'public/report.html', 'public/js/app.js'];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf-8');
    // Global replace for Maranet -> NEXUS OS (for specific contexts)
    content = content.replace(/Maranet Central de Tráfego/g, 'NEXUS OS');
    content = content.replace(/Maranet · Central de Tráfego/g, 'NEXUS OS');
    content = content.replace(/Maranet · Login/g, 'NEXUS OS | Login');
    content = content.replace(/Maranet - Relatório Mágico/g, 'NEXUS OS | Relatório Mágico');
    content = content.replace(/Maranet Copilot/g, 'NEXUS Copilot');
    content = content.replace(/Pixel Maranet/g, 'Nexus Pixel');
    content = content.replace(/Maranet Telecom/g, 'NEXUS OS');
    fs.writeFileSync(f, content);
    console.log(`Updated ${f}`);
  }
});
