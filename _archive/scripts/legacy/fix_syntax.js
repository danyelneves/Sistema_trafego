const fs = require('fs');
const files = [
  'routes/sentinel.js',
  'routes/skynet.js',
  'routes/franchise.js',
  'routes/forge.js',
  'routes/voice.js',
  'routes/checkout.js'
];
for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    fs.writeFileSync(file, content);
  }
}
console.log("Fixed syntax");
