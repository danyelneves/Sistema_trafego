const db = require('./db');
const s = k => db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value || '';

const customerId     = s('google.customerId').replace(/-/g, '');
const loginCustomerId = (s('google.loginCustomerId') || customerId).replace(/-/g, '');
const refreshToken   = s('google.refreshToken');
const clientId       = s('google.clientId');
const clientSecret   = s('google.clientSecret');
const devToken       = s('google.developerToken');

console.log('customerId:', customerId);
console.log('loginCustomerId:', loginCustomerId);
console.log('refreshToken:', refreshToken ? refreshToken.slice(0,20)+'...' : 'MISSING');

async function main() {
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'refresh_token', client_id:clientId, client_secret:clientSecret, refresh_token:refreshToken }).toString()
  });
  const td = await tr.json();
  console.log('\nOAuth2:', tr.status, td.error || 'OK', '— expires_in:', td.expires_in);
  if (!td.access_token) { console.log(JSON.stringify(td)); return; }

  for (const v of ['v16','v17','v18','v19']) {
    const url = `https://googleads.googleapis.com/${v}/customers/${customerId}/googleAds:search`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization':'Bearer '+td.access_token, 'developer-token':devToken, 'login-customer-id':loginCustomerId, 'Content-Type':'application/json' },
      body: JSON.stringify({ query: 'SELECT campaign.id FROM campaign LIMIT 1' })
    });
    const body = await r.text();
    console.log(`\n[${v}] ${r.status}:`, body.slice(0, 300));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
