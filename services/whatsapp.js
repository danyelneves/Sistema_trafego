const crypto = require('crypto');
const axios = require('axios');

async function sendWhatsAppMessage(waUrl, waToken, number, message) {
    try {
        const payload = {
            number: number,
            message: message,
            text: message // Suporte duplo Z-API e Evolution
        };

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': waToken || '',
                'apikey': waToken || ''
            },
            timeout: 8000
        };

        await axios.post(waUrl, payload, config);
        return true;
    } catch (e) {
        console.error("[WA API] Falha de envio, tentando novamente...");
        try {
            // Retry
            const payload = { number, message, text: message };
            const config = { headers: { 'Content-Type': 'application/json', 'Authorization': waToken || '', 'apikey': waToken || '' }, timeout: 8000 };
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
