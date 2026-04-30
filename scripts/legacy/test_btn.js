const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://sistrafego.vercel.app/login');
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake_token');
    document.cookie = 'auth_token=fake_token; path=/';
  });
  
  await page.goto('https://sistrafego.vercel.app/');
  await page.waitForTimeout(2000);
  
  const logs = [];
  page.on('console', msg => logs.push(msg.type() + ': ' + msg.text()));
  page.on('pageerror', err => logs.push('EXCEPTION: ' + err.message));
  
  const btn = await page.$('#btn-refresh');
  if (btn) {
    await btn.click();
    console.log('Clicked btn-refresh');
  } else {
    console.log('btn-refresh NOT FOUND');
  }
  
  await page.waitForTimeout(2000);
  console.log('Logs:', logs);
  
  await browser.close();
})();
