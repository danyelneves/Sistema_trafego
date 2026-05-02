const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImRpc3BsYXlfbmFtZSI6IkFkbWluIiwiaWF0IjoxNzc3NTI4Mzg1LCJleHAiOjE3NzgxMzMxODV9.T6TEb4ECQLTpY9pCj4LvMTUnCdK0bA0w-MStqnB0p10";
  
  await page.goto('https://sistrafego.vercel.app/login');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
    document.cookie = `auth_token=${t}; path=/`;
  }, token);
  
  await page.goto('https://sistrafego.vercel.app/');
  await page.waitForTimeout(3000);
  
  const logs = [];
  page.on('console', msg => logs.push(msg.type() + ': ' + msg.text()));
  page.on('pageerror', err => logs.push('EXCEPTION: ' + err.message));
  
  const title = await page.title();
  const btn = await page.$('#btn-refresh');
  if (btn) {
    await btn.click();
    console.log('Clicked btn-refresh');
  } else {
    console.log('btn-refresh NOT FOUND');
  }
  
  await page.waitForTimeout(3000);
  console.log('Title:', title);
  console.log('Final URL:', page.url());
  console.log('Logs:', logs);
  
  await browser.close();
})();
