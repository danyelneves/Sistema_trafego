/**
 * utils/omni-router.js — roteador de modelos de IA com fallback automático.
 *
 * Imports lazy: SDKs só são carregados quando uma chamada real é feita,
 * economizando memória/cold start em rotas que não usam IA.
 *
 * Níveis de complexidade:
 *  LOW    → Gemini Flash (ultra rápido, barato)
 *  MEDIUM → Claude Sonnet (balanceado, bom em copy/vendas)
 *  HIGH   → GPT-4o ou Claude Opus (raciocínio denso, planejamento)
 */
const log = require('../middleware/logger');

let _genAI, _Anthropic, _OpenAI;

function getGoogleGenerativeAI() {
  if (!_genAI) _genAI = require('@google/generative-ai').GoogleGenerativeAI;
  return _genAI;
}

function getAnthropic() {
  if (!_Anthropic) _Anthropic = require('@anthropic-ai/sdk').Anthropic;
  return _Anthropic;
}

function getOpenAI() {
  if (!_OpenAI) _OpenAI = require('openai').OpenAI;
  return _OpenAI;
}

async function callOpenAI(apiKey, model, prompt, maxTokens = 800) {
  const OpenAI = getOpenAI();
  const openai = new OpenAI({ apiKey, timeout: 30000 });
  const res = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  });
  return res.choices[0].message.content.trim();
}

async function callAnthropic(apiKey, model, prompt, maxTokens = 800) {
  const Anthropic = getAnthropic();
  const anthropic = new Anthropic({ apiKey, timeout: 30000 });
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

async function callGemini(apiKey, modelName, prompt) {
  const GoogleGenerativeAI = getGoogleGenerativeAI();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  // Promise.race garante timeout independente do SDK
  const res = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout 30s')), 30000)),
  ]);
  return res.response.text().trim();
}

async function generateWithOmniRouter(prompt, complexity = 'MEDIUM', keys = {}) {
  const { GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY } = keys;

  try {
    if (complexity === 'HIGH') {
      if (OPENAI_API_KEY) {
        log.debug('omni-router: HIGH → OpenAI gpt-4o');
        return await callOpenAI(OPENAI_API_KEY, 'gpt-4o', prompt, 1024);
      }
      if (ANTHROPIC_API_KEY) {
        log.debug('omni-router: HIGH → Claude Opus (fallback)');
        return await callAnthropic(ANTHROPIC_API_KEY, 'claude-3-opus-20240229', prompt, 1024);
      }
    }

    if (complexity === 'MEDIUM') {
      if (ANTHROPIC_API_KEY) {
        log.debug('omni-router: MEDIUM → Claude Sonnet');
        return await callAnthropic(ANTHROPIC_API_KEY, 'claude-sonnet-4-6', prompt, 800);
      }
      if (OPENAI_API_KEY) {
        log.debug('omni-router: MEDIUM → gpt-4o (fallback)');
        return await callOpenAI(OPENAI_API_KEY, 'gpt-4o', prompt, 800);
      }
    }

    if (complexity === 'LOW') {
      if (GEMINI_API_KEY) {
        log.debug('omni-router: LOW → Gemini Flash');
        return await callGemini(GEMINI_API_KEY, 'gemini-1.5-flash', prompt);
      }
    }

    // Fallback geral: usa qualquer modelo disponível
    log.warn('omni-router: nenhum modelo do nível solicitado disponível, usando fallback');
    if (GEMINI_API_KEY) return await callGemini(GEMINI_API_KEY, 'gemini-1.5-pro', prompt);
    if (ANTHROPIC_API_KEY) return await callAnthropic(ANTHROPIC_API_KEY, 'claude-sonnet-4-6', prompt, 800);
    if (OPENAI_API_KEY) return await callOpenAI(OPENAI_API_KEY, 'gpt-4o', prompt, 800);

    throw new Error('Nenhuma API Key de IA configurada (GEMINI/ANTHROPIC/OPENAI).');
  } catch (error) {
    log.error('omni-router falhou', error, { complexity });
    throw error;
  }
}

module.exports = { generateWithOmniRouter };
