const fetch = require('node-fetch');

async function run() {
  const url = 'https://sistrafego.vercel.app';
  try {
    // Login
    const resLogin = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'danyel', password: '123' }) // I don't know the password...
    });
    console.log('Login:', resLogin.status);
    
  } catch (e) {
    console.error(e);
  }
}
run();
