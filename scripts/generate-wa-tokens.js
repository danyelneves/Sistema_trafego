const crypto = require('crypto');
const db = require('../db');

async function generateWaTokens() {
  console.log("Iniciando geração de Tokens de WhatsApp para workspaces existentes...");
  try {
    const workspaces = await db.all("SELECT id, name FROM workspaces");
    let count = 0;

    for (const ws of workspaces) {
      const existingToken = await db.get(
        "SELECT id FROM workspace_settings WHERE workspace_id = $1 AND key = 'whatsapp.webhook.token'",
        [ws.id]
      );

      if (!existingToken) {
        const newToken = crypto.randomUUID();
        await db.run(
          "INSERT INTO workspace_settings (workspace_id, key, value) VALUES ($1, 'whatsapp.webhook.token', $2)",
          [ws.id, newToken]
        );
        console.log(`[OK] Token gerado para Workspace ID: ${ws.id} (${ws.name}): ${newToken}`);
        count++;
      } else {
        console.log(`[SKIP] Workspace ID: ${ws.id} já possui um token de WhatsApp.`);
      }
    }
    console.log(`\nFinalizado! ${count} tokens gerados com sucesso.`);
    process.exit(0);
  } catch (error) {
    console.error("Erro fatal ao gerar tokens:", error.message);
    process.exit(1);
  }
}

generateWaTokens();
