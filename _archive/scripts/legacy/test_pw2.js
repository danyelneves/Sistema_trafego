const { chromium } = require('/tmp/node_modules/playwright');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PW LOG:', msg.location().url, msg.text()));
  page.on('pageerror', err => console.log('PW ERROR:', err.message, err.stack));

  console.log('Indo para login...');
  await page.goto('https://sistrafego.vercel.app/login');
  
  await page.fill('#user', 'admin');
  await page.fill('#pass', 'admin123');
  await page.click('#btn-login');
  
  console.log('Aguardando painel...');
  await page.waitForTimeout(5000);
  
  await browser.close();
}
run();
