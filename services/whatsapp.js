const axios = require('axios');

async function sendWhatsAppMessage(waUrl, waToken, number, message) {
    const payload = { number, message, text: message }; // Suporte duplo Z-API e Evolution
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': waToken || '',
            'apikey': waToken || ''
        },
        timeout: 8000
    };

    try {
        await axios.post(waUrl, payload, config);
        return true;
    } catch (e) {
        console.error("[WA API] Falha de envio, tentando novamente em 1.5s...");
        await new Promise(r => setTimeout(r, 1500));
        try {
            await axios.post(waUrl, payload, config);
            return true;
        } catch (err) {
            throw new Error(`[WA API] Falha final: ${err.message}`);
        }
    }
}

module.exports = {
    sendWhatsAppMessage
};
