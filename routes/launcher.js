const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.post('/meta', requireAuth, async (req, res) => {
  try {
    const { mode, campaign_name, daily_budget, copy_text, ad_link, ai_prompt } = req.body;
    
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'SUA_CHAVE_DE_ACESSO_AQUI';
    const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_123456789';
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (ACCESS_TOKEN === 'SUA_CHAVE_DE_ACESSO_AQUI') {
      return res.status(400).json({ error: 'Você precisa configurar o META_ACCESS_TOKEN no .env' });
    }

    let finalCampaigns = [];

    // ----------------------------------------------------
    // MODE 1: MANUAL (1 Campaign)
    // ----------------------------------------------------
    if (mode === 'manual' || !mode) {
      finalCampaigns.push({ name: campaign_name, budget: daily_budget, copy: copy_text });
    } 
    
    // ----------------------------------------------------
    // MODE 2: MATRIX (A/B Test)
    // ----------------------------------------------------
    else if (mode === 'matrix') {
      const copys = copy_text.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (copys.length === 0) throw new Error("Insira as copys separadas por |");
      
      copys.forEach((copy, idx) => {
        finalCampaigns.push({
          name: `${campaign_name} [Matrix V${idx+1}]`,
          budget: daily_budget,
          copy: copy
        });
      });
    } 
    
    // ----------------------------------------------------
    // MODE 3: SELF-DRIVING AI (Gemini generates everything)
    // ----------------------------------------------------
    else if (mode === 'ai') {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");
      
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Você é um gestor de tráfego de elite. Crie a estrutura de uma campanha de Facebook Ads de alta conversão baseado no seguinte objetivo: "${ai_prompt}".
Responda EXATAMENTE neste formato JSON, sem crases, sem formatação Markdown:
{
  "campaign_name": "Nome da Campanha Agressivo",
  "daily_budget": 100,
  "copy_text": "Texto persuasivo do anúncio..."
}`;
      
      const result = await model.generateContent(prompt);
      let text = await result.response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const aiGenerated = JSON.parse(text);
      finalCampaigns.push({
        name: aiGenerated.campaign_name,
        budget: aiGenerated.daily_budget || daily_budget,
        copy: aiGenerated.copy_text
      });
    }

    // FIRE TO FACEBOOK API
    const fbApiUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}`;
    const results = [];

    for (let camp of finalCampaigns) {
      const campaignPayload = new URLSearchParams({
        name: camp.name,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: 'NONE',
        access_token: ACCESS_TOKEN
      });

      const campResponse = await fetch(`${fbApiUrl}/campaigns`, {
        method: 'POST',
        body: campaignPayload
      });
      const campData = await campResponse.json();

      if (campData.error) {
        throw new Error(`Erro FB: ${campData.error.message}`);
      }

      results.push({
        id: campData.id,
        name: camp.name,
        copy: camp.copy
      });
    }

    res.json({ 
      ok: true, 
      message: `${results.length} campanha(s) enviada(s) ao Facebook!`, 
      campaigns: results 
    });

  } catch (error) {
    console.error('Erro no Launcher:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
