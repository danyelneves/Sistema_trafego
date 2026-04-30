const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

// ----------------------------------------------------------------
// POST /api/franchise/create
// Cria um novo locatário (Franquia White-Label)
// ----------------------------------------------------------------
router.post('/create', requireAuth, async (req, res) => {
  try {
    // Apenas o dono original (Workspace 1) pode criar franquias
    if (req.user.workspace_id !== 1) {
      return res.status(403).json({ error: "Apenas o Master Admin pode criar franquias." });
    }

    const { franchise_name, admin_email, nexus_fee } = req.body;
    
    // 1. Cria o Workspace da Franquia
    const wsInsert = `
      INSERT INTO workspaces (name, is_franchise, franchise_name, nexus_fee_percentage)
      VALUES ($1, true, $2, $3) RETURNING id
    `;
    const wsRow = await db.query(wsInsert, [`Franquia: ${franchise_name}`, franchise_name, nexus_fee || 5.0]);
    const newWsId = wsRow.rows[0].id;

    // 2. Cria o usuário Admin da Franquia (Senha padrão: Mudar123)
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Mudar123', 10);
    const uInsert = `
      INSERT INTO users (email, password_hash, name, role, workspace_id)
      VALUES ($1, $2, $3, 'admin', $4)
    `;
    await db.query(uInsert, [admin_email, hash, `Admin ${franchise_name}`, newWsId]);

    res.json({
      ok: true,
      message: "Franquia criada com sucesso!",
      login_url: `https://sistrafego.vercel.app/login`,
      admin_email: admin_email,
      default_password: "Mudar123",
      fee: `${nexus_fee}% retidos na fonte pelo NEXUS Black.`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
