const db = require('./db');
async function check() {
  const { rows } = await db.query('SELECT * FROM workspace_settings');
  console.log("Workspace settings:", rows);
  process.exit(0);
}
check();
