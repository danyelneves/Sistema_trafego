

/**
 * Envia uma mensagem via WhatsApp.
 * Pode ser adaptado para Z-API, Evolution API, CallMeBot, Twilio, etc.
 * Atualmente usa a API pública e gratuita CallMeBot apenas como exemplo/fallback,
 * ou uma URL de Webhook personalizada via variável de ambiente.
 */
async function sendWhatsApp(phone, message) {
  // Limpa o número (apenas dígitos)
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (!cleanPhone) return false;

  console.log(`[WhatsApp] Preparando envio para ${cleanPhone}...`);

  // Se o usuário tiver um Webhook genérico ou Evolution API configurado no .env
  if (process.env.WHATSAPP_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.WHATSAPP_API_KEY ? `Bearer ${process.env.WHATSAPP_API_KEY}` : ''
        },
        body: JSON.stringify({
          number: cleanPhone,
          message: message
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`[WhatsApp] Mensagem enviada para ${cleanPhone} via Webhook.`);
      return true;
    } catch (e) {
      console.error(`[WhatsApp] Erro no Webhook: ${e.message}`);
      return false;
    }
  }

  // Fallback: CallMeBot (Gratuito para testes/uso pessoal)
  // Requer que o usuário pegue a API Key no bot do CallMeBot.
  // Vamos usar a API KEY do ambiente se existir, senão alertamos no log.
  const apikey = process.env.CALLMEBOT_API_KEY;
  if (apikey) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(message)}&apikey=${apikey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CallMeBot HTTP ${res.status}`);
      console.log(`[WhatsApp] Mensagem enviada para ${cleanPhone} via CallMeBot.`);
      return true;
    } catch (e) {
      console.error(`[WhatsApp] Erro no CallMeBot: ${e.message}`);
      return false;
    }
  }

  console.log(`[WhatsApp] Aviso: Nenhuma API configurada no .env (WHATSAPP_WEBHOOK_URL ou CALLMEBOT_API_KEY). A mensagem não foi enviada para ${cleanPhone}.`);
  return false;
}

module.exports = { sendWhatsApp };
