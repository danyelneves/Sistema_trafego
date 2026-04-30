const fs = require('fs');
const file = 'public/index.html';
let content = fs.readFileSync(file, 'utf-8');

const headPwa = `
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#000000">
  <link rel="apple-touch-icon" href="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Black_triangle.svg/512px-Black_triangle.svg.png">
`;

if (!content.includes('<link rel="manifest"')) {
  content = content.replace('</head>', headPwa + '\n</head>');
}

const swScript = `
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(err => {
        console.log('Service Worker registration failed: ', err);
      });
    });
  }
</script>
`;

if (!content.includes('serviceWorker.register')) {
  content = content.replace('</body>', swScript + '\n</body>');
}

fs.writeFileSync(file, content);
console.log("PWA settings injected into index.html");
