const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ----------------------------------------------------------------
// POST /api/vision/reverse
// Engenharia Reversa Visual de Anúncios e Landing Pages
// ----------------------------------------------------------------
router.post('/reverse', requireAuth, async (req, res) => {
  try {
    const { imageBase64, type } = req.body; 
    // imageBase64 vem no formato "data:image/jpeg;base64,/9j/4AAQSk..."
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    // Remove the prefix "data:image/jpeg;base64,"
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Para imagens, gemini-2.5-pro ou gemini-2.5-flash ambos suportam multimodal
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = "";
    if (type === 'ad') {
      prompt = `Aja como o maior hacker de copy do mundo. Analise esta imagem que é um anúncio (Facebook/Insta). 
Desmonte a engenharia reversa dela:
1. Qual o gatilho psicológico principal usado?
2. Por que a paleta de cores ou a foto chama atenção?
3. Crie 2 variações MELHORES de Headline (Título) baseadas nisso para eu usar e destruir esse concorrente.
Responda em HTML limpo (usando <p>, <strong>, <ul>). Sem crases.`;
    } else {
      prompt = `Aja como o maior engenheiro de conversão do mundo. Analise esta imagem que é um print de uma Landing Page.
Faça engenharia reversa dela:
1. Descreva a estrutura (Ex: Hero com VSL à esquerda, formulário à direita).
2. Escreva um código HTML/Tailwind simples de 1 seção (apenas o body) que clone essa estrutura visual de forma otimizada.
Responda a análise em HTML limpo (usando <p>, <strong>) e em seguida coloque o código de clonagem dentro de uma tag <pre><code>. Sem marcações Markdown \`\`\`.`;
    }

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    let responseText = await result.response.text();

    res.json({
      ok: true,
      analysis: responseText
    });

  } catch (error) {
    console.error('Vision API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
