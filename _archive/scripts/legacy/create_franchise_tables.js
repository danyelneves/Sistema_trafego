const db = require('./db');

async function setupFranchiseSystem() {
  try {
    // Adicionar colunas de White-Label na tabela workspaces se não existirem
    const sqlAlters = [
      "ALTER TABLE workspaces ADD COLUMN is_franchise BOOLEAN DEFAULT false;",
      "ALTER TABLE workspaces ADD COLUMN franchise_name VARCHAR(255);",
      "ALTER TABLE workspaces ADD COLUMN franchise_logo VARCHAR(500);",
      "ALTER TABLE workspaces ADD COLUMN nexus_fee_percentage NUMERIC DEFAULT 5.0;" // O pedágio do Daniel
    ];

    for (let query of sqlAlters) {
      try {
        await db.run(query);
      } catch(e) {
        // Ignora se a coluna já existir
      }
    }

    console.log("Sistema de Franquias (White-Label) preparado no Banco de Dados.");
  } catch(e) {
    console.error("Erro ao preparar franquias:", e.message);
  }
}

setupFranchiseSystem();
