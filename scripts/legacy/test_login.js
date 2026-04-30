const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://sistrafego.vercel.app/login');
  await page.waitForTimeout(2000);
  
  const logs = [];
  page.on('console', msg => logs.push(msg.type() + ': ' + msg.text()));
  page.on('pageerror', err => logs.push('EXCEPTION: ' + err.message));
  
  await page.fill('#u', 'test@test.com');
  await page.fill('#p', 'test');
  await page.click('#btn-login');
  
  await page.waitForTimeout(2000);
  console.log('Logs:', logs);
  console.log('Final URL:', page.url());
  const errMsg = await page.$eval('#err', el => el.innerText).catch(()=>'');
  console.log('Error Message:', errMsg);
  
  await browser.close();
})();
