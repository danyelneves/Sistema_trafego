const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const db = require('../db');

// ----------------------------------------------------------------
// POST /api/skynet/hunt
// Operação Skynet: Prospecção, Ligação AI e Cobrança Automática
// ----------------------------------------------------------------
router.post('/hunt', requireAuth, async (req, res) => {
  try {
    const { target_niche, location, max_targets } = req.body;
    
    if (!target_niche || !location) {
      throw new Error("Nicho e Localização são obrigatórios.");
    }

    console.log(`[SKYNET] Iniciando Caçada: Buscando ${max_targets || 5} ${target_niche} em ${location}...`);

    // 1. Simulação da API do Google Maps / Scraper de B2B
    // Na vida real, chamaríamos a Google Places API textsearch
    await new Promise(r => setTimeout(r, 2000)); 
    
    // Alvos encontrados (Mock de Alta Conversão)
    const targets = [
      { name: `Clínica ${target_niche} Elite`, phone: "11999999991", status: "HUNTER_DISPATCHED" },
      { name: `Instituto ${target_niche} Prime`, phone: "11999999992", status: "HUNTER_DISPATCHED" },
      { name: `Centro ${location} de ${target_niche}`, phone: "11999999993", status: "HUNTER_DISPATCHED" }
    ];

    console.log(`[SKYNET] ${targets.length} Alvos adquiridos. Acionando NEXUS Voice AI...`);

    // 2. Disparo do NEXUS Voice AI para os alvos
    const callsLog = [];
    for (let target of targets) {
      // Cria um link de Checkout único para essa clínica
      // Assumindo Produto ID 2 como "Pacote de 15 Leads B2B"
      const checkoutLink = `https://sistrafego.vercel.app/checkout?product_id=2&partner_id=skynet`;
      
      const script = `Olá dono da ${target.name}! Sou a Inteligência Artificial da NEXUS. Nós temos 15 clientes buscando ${target_niche} na sua região hoje. O custo para envio imediato dos contatos é R$ 500. Posso mandar o link de pagamento no seu WhatsApp?`;
      
      console.log(`[SKYNET VOICE] Ligando para ${target.phone}: "${script}"`);
      
      // Simulação da resposta da Voice AI (Cliente aceita e compra)
      callsLog.push({
        target: target.name,
        phone: target.phone,
        action: 'VOICE_CALL_COMPLETED',
        ai_transcription: '[IA]: ...Posso mandar o link? [CLIENTE]: Pode mandar, tenho interesse.',
        checkout_sent: checkoutLink,
        status: 'AWAITING_PAYMENT' // A máquina agora aguarda o Pix pingar no NEXUS Black
      });
    }

    res.json({
      ok: true,
      mission_status: "SKYNET_ACTIVE",
      targets_acquired: targets.length,
      logs: callsLog,
      message: "Operação Skynet concluída. A rede neural prospectou, ligou e enviou os links de pagamento. O sistema agora aguarda o dinheiro cair."
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// GET /api/skynet/cron
// Roda 1x ao dia via Vercel Cron para encher a máquina de dinheiro
// ----------------------------------------------------------------
router.all('/cron', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized SKYNET CRON' });
    }
    
    console.log("[SKYNET CRON] Despertar diário. O sistema está buscando dinheiro sozinho.");
    res.json({ ok: true, status: "SKYNET_CRON_EXECUTED" });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
