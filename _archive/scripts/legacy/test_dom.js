const { JSDOM, VirtualConsole } = require('jsdom');
const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (msg) => { console.log("JS ERROR:", msg); });
virtualConsole.on("jsdomError", (err) => { console.log("JSDOM ERROR:", err.message); });

JSDOM.fromURL("https://sistrafego.vercel.app/", {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole
}).then(dom => {
  setTimeout(() => { console.log("Done"); process.exit(0); }, 3000);
}).catch(console.error);
