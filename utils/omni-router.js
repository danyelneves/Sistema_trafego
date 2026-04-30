const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');

/**
 * NEXUS OmniRouter (Roteador de Modelos Dinâmico)
 * Escolhe automaticamente a I.A. mais adequada e sua versão exata
 * baseada no nível de "necessidade/complexidade" da tarefa.
 */
async function generateWithOmniRouter(prompt, complexity = 'MEDIUM', keys) {
    const { GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY } = keys;

    // Níveis de Complexidade:
    // LOW: Tarefas rápidas, análise de dados curtos. Usa modelos ultrarrápidos (Flash / Haiku / Mini)
    // MEDIUM: Copywriting, Vendas NLP, Landing Pages. Usa modelos robustos (Sonnet / GPT-4o)
    // HIGH: Engenharia reversa profunda, planejamento estratégico. Usa modelos pesados (Opus / o1 / Pro)

    try {
        if (complexity === 'HIGH') {
            // Prioridade para raciocínio denso: OpenAI GPT-4o (ou modelo mais pesado) / Claude Opus
            if (OPENAI_API_KEY) {
                console.log("[OMNI-ROUTER] Complexidade HIGH -> Invocando OpenAI (gpt-4o)");
                const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
                const res = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: prompt }]
                });
                return res.choices[0].message.content.trim();
            } else if (ANTHROPIC_API_KEY) {
                console.log("[OMNI-ROUTER] Complexidade HIGH -> Invocando Claude Opus (Fallback)");
                const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
                const msg = await anthropic.messages.create({
                    model: "claude-3-opus-20240229", // Modelo de alta densidade
                    max_tokens: 1024,
                    messages: [{ role: "user", content: prompt }]
                });
                return msg.content[0].text.trim();
            }
        }

        if (complexity === 'MEDIUM') {
            // Prioridade para Vendas/Copy/Desenvolvimento Web: Claude 3.5 Sonnet
            if (ANTHROPIC_API_KEY) {
                console.log("[OMNI-ROUTER] Complexidade MEDIUM -> Invocando Claude 3.5 Sonnet");
                const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
                const msg = await anthropic.messages.create({
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 800,
                    messages: [{ role: "user", content: prompt }]
                });
                return msg.content[0].text.trim();
            } else if (OPENAI_API_KEY) {
                console.log("[OMNI-ROUTER] Complexidade MEDIUM -> Invocando OpenAI gpt-4o (Fallback)");
                const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
                const res = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: prompt }]
                });
                return res.choices[0].message.content.trim();
            }
        }

        if (complexity === 'LOW') {
            // Prioridade para velocidade e custo: Gemini 1.5 Flash
            if (GEMINI_API_KEY) {
                console.log("[OMNI-ROUTER] Complexidade LOW -> Invocando Gemini 1.5 Flash");
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const res = await model.generateContent(prompt);
                return res.response.text().trim();
            }
        }

        // FALLBACK GERAL: Se o modelo requisitado não tiver chave, usamos o que tiver disponível
        console.log("[OMNI-ROUTER] Fallback de Emergência Ativado.");
        if (GEMINI_API_KEY) {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Tenta usar a pro como backup geral
            const res = await model.generateContent(prompt);
            return res.response.text().trim();
        }

        throw new Error("Nenhuma API Key de Inteligência Artificial está configurada no painel.");

    } catch (error) {
        console.error("[OMNI-ROUTER ERRO]", error.message);
        throw error;
    }
}

module.exports = { generateWithOmniRouter };
