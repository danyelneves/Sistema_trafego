const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Navigating to login...');
  await page.goto('https://sistrafego.vercel.app/login');
  
  await page.fill('#u', 'test@test.com');
  await page.fill('#p', 'test');
  await page.click('#btn-login');
  
  console.log('Waiting for navigation to dashboard...');
  await page.waitForTimeout(5000);
  
  const screenshotPath = '/Users/danielneves/.gemini/antigravity/brain/fc6cdb3c-3801-45e3-a828-ce48947ed01c/dashboard_screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to: ' + screenshotPath);
  
  await browser.close();
})();
