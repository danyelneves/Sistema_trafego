const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ----------------------------------------------------------------
// POST /api/forge/generate
// Cria uma Landing Page Inteira via IA baseada no nicho
// ----------------------------------------------------------------
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { niche, name, slug } = req.body;
    
    // Puxa as configurações
    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [req.user.workspace_id]);
    const getSetting = (k) => settings.find(s => s.key === k)?.value;

    const OPENAI_API_KEY = getSetting('openai.apiKey');
    const GEMINI_API_KEY = getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY && !OPENAI_API_KEY) throw new Error("I.A. não configurada.");

    // O Prompt Mágico do Mutant Funnel
    const prompt = `Atue como um Web Designer Sênior e Copywriter de Alta Conversão.
Crie o código HTML COMPLETO de uma Landing Page (Página de Vendas) para o nicho de: ${niche}.
O nome do projeto é: ${name}.

Regras Obrigatórias:
1. Use APENAS a CDN do Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>).
2. O Design DEVE SER brutalista, escuro (fundo preto #0a0a0a, textos brancos) com toques de cor neon (ex: verde limão #00ffa3 ou azul cyano). Extremamente premium.
3. Seções Obrigatórias: Hero (Headline forte + Botão WhatsApp), Benefícios, Prova Social, e Formulário de Captura ou Botão Final.
4. INJETE ESTE SCRIPT NO FINAL DO BODY (Isso a torna uma Página Mutante):
<script>
  // Script Mutante: Altera a Headline com base no UTM Term para bater exatamente com a pesquisa do usuário
  const params = new URLSearchParams(window.location.search);
  const termo = params.get('utm_term');
  if(termo) {
    const headline = document.getElementById('mutant-headline');
    if(headline) headline.innerText = termo.charAt(0).toUpperCase() + termo.slice(1).replace(/-/g, ' ');
  }
</script>
5. Coloque o id="mutant-headline" no H1 principal.
6. Retorne APENAS o código HTML puro, sem blocos \`\`\`html. Sem explicações.`;

    let htmlContent = "";

    // 1. Tenta OpenAI GPT-4o
    if (OPENAI_API_KEY) {
        try {
            const { OpenAI } = require('openai');
            const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }]
            });
            htmlContent = completion.choices[0].message.content.trim();
            console.log("[FORGE ROUTER] Usando OpenAI GPT-4o");
        } catch (e) {
            console.error("[FORGE ROUTER] Falha no OpenAI. Caindo pro Gemini.");
        }
    }

    // 2. Fallback Gemini
    if (!htmlContent && GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        htmlContent = await result.response.text();
        console.log("[FORGE ROUTER] Usando Gemini 1.5 Flash");
    }

    if (!htmlContent) throw new Error("Nenhuma IA conseguiu gerar a página.");

    htmlContent = htmlContent.replace("```html", "").replace("```", "").trim();

    // Salva no Banco de Dados
    const sql = `
      INSERT INTO funnels (workspace_id, slug, name, niche, html_content)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const { rows } = await db.query(sql, [req.user.workspace_id, slug, name, niche, htmlContent]);

    res.json({ ok: true, funnel_id: rows[0].id, slug: slug });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// GET /api/forge/list
// ----------------------------------------------------------------
router.get('/list', requireAuth, async (req, res) => {
  try {
    const funnels = await db.all('SELECT id, slug, name, niche, visits, conversions, created_at FROM funnels WHERE workspace_id = $1 ORDER BY id DESC', [req.user.workspace_id]);
    res.json({ ok: true, funnels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
