const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

// Rota para disparar a criação da campanha via API do Facebook
router.post('/meta', requireAuth, async (req, res) => {
  try {
    const { campaign_name, daily_budget, copy_text, ad_link } = req.body;
    
    // Na vida real, esses dados virão do banco de dados (configurações do workspace)
    // Para esse MVP, usaremos variáveis de ambiente ou dados do DB.
    // O usuário precisará colocar as credenciais no .env
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'SUA_CHAVE_DE_ACESSO_AQUI';
    const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_123456789';

    if (ACCESS_TOKEN === 'SUA_CHAVE_DE_ACESSO_AQUI') {
      return res.status(400).json({ error: 'Você precisa configurar o META_ACCESS_TOKEN no sistema para criar campanhas remotamente.' });
    }

    // A lógica da API de Marketing do Meta (Graph API v19.0)
    // Passos: 1. Criar Campaign, 2. Criar AdSet, 3. Criar AdCreative, 4. Criar Ad.
    
    // Passo 1: Criar a Campanha
    const campaignPayload = new URLSearchParams({
      name: campaign_name,
      objective: 'OUTCOME_SALES', // Novo objetivo de Vendas do FB
      status: 'PAUSED', // Criamos pausada por segurança
      special_ad_categories: 'NONE',
      access_token: ACCESS_TOKEN
    });

    const fbApiUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}`;
    
    const campResponse = await fetch(`${fbApiUrl}/campaigns`, {
      method: 'POST',
      body: campaignPayload
    });
    const campData = await campResponse.json();

    if (campData.error) {
      throw new Error(`Erro no Facebook: ${campData.error.message}`);
    }

    // Retorna sucesso (No MVP nós paramos aqui, numa implementação full
    // criaríamos AdSet e Ad no mesmo fluxo usando o ID da campanha gerada)
    res.json({ 
      ok: true, 
      message: 'Campanha criada com sucesso direto no Facebook!', 
      campaign_id: campData.id 
    });

  } catch (error) {
    console.error('Erro no Launcher:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
