/**
 * scripts/generate-wa-tokens.js
 *
 * Gera tokens UUID v4 de webhook do WhatsApp para cada workspace existente.
 * Tokens são gravados em tokens-wa.json (chmod 600). Stdout só recebe IDs/status.
 *
 * Uso:
 *   node scripts/generate-wa-tokens.js
 *   chmod 600 tokens-wa.json   # garante permissão restrita
 *   # distribuir e depois:
 *   shred -u tokens-wa.json    # remove com sobrescrita
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function generateWaTokens() {
  console.log("Iniciando geração de Tokens de WhatsApp para workspaces existentes...");
  const outFile = path.join(process.cwd(), 'tokens-wa.json');
  const generated = [];

  try {
    const workspaces = await db.all("SELECT id, name FROM workspaces");

    for (const ws of workspaces) {
      const existingToken = await db.get(
        "SELECT value FROM workspace_settings WHERE workspace_id = $1 AND key = 'whatsapp.webhook.token'",
        [ws.id]
      );

      if (!existingToken) {
        const newToken = crypto.randomUUID();
        await db.run(
          "INSERT INTO workspace_settings (workspace_id, key, value) VALUES ($1, 'whatsapp.webhook.token', $2)",
          [ws.id, newToken]
        );
        console.log(`[OK] Token gerado para Workspace ID: ${ws.id} (${ws.name})`);
        generated.push({ workspace_id: ws.id, name: ws.name, token: newToken, status: 'created' });
      } else {
        console.log(`[SKIP] Workspace ID: ${ws.id} já possui um token de WhatsApp.`);
        generated.push({ workspace_id: ws.id, name: ws.name, token: existingToken.value, status: 'existing' });
      }
    }

    fs.writeFileSync(outFile, JSON.stringify(generated, null, 2));
    try { fs.chmodSync(outFile, 0o600); } catch (_) { /* chmod só funciona em unix */ }

    const createdCount = generated.filter(g => g.status === 'created').length;
    console.log(`\nFinalizado! ${createdCount} tokens novos. Tokens gravados em: ${outFile}`);
    console.log(`[ATENÇÃO] Distribua os tokens via canal seguro e remova o arquivo com: shred -u ${outFile}`);
    process.exit(0);
  } catch (error) {
    console.error("Erro fatal ao gerar tokens:", error.message);
    process.exit(1);
  }
}

generateWaTokens();
