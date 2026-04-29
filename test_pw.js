const { chromium } = require('/tmp/node_modules/playwright');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PW LOG:', msg.text()));
  page.on('pageerror', err => console.log('PW ERROR:', err.message, err.stack));

  await page.goto('https://sistrafego.vercel.app/login');
  
  await page.fill('#u', 'admin');
  await page.fill('#p', 'admin123');
  await page.click('#btn-login');
  
  await page.waitForTimeout(3000);
  
  await browser.close();
}
run();
