const puppeteer = require('puppeteer');
const jwt = require('jsonwebtoken');

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Listen for console and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure().errorText));

  // Set cookie for auth
  const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin', workspace_id: 1 }, SECRET);
  await page.setCookie({ name: 'auth', value: token, domain: 'sistrafego.vercel.app' });

  console.log('Navigating to dashboard...');
  await page.goto('https://sistrafego.vercel.app/', { waitUntil: 'networkidle0' });

  // Get some HTML to verify
  const content = await page.evaluate(() => document.body.innerHTML.substring(0, 100));
  console.log('Body prefix:', content);
  
  await browser.close();
}
run();
