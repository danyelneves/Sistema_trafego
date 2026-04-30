const express = require('express');
const router = express.Router();

// ----------------------------------------------------------------
// POST /api/poltergeist/dispatch
// Protocolo Poltergeist: Controle de Hardware (Impressora) e Logística (Uber)
// ----------------------------------------------------------------
router.post('/dispatch', async (req, res) => {
    try {
        const { order_id, total_amount, address, items } = req.body;
        
        console.log(`[POLTERGEIST] Sinal recebido. Pedido #${order_id} finalizado. Valor: R$${total_amount}`);

        // 1. Simulação: API de Impressora Térmica Cloud (ex: PrintNode API)
        console.log(`[POLTERGEIST] Enviando Payload ZPL para Impressora Térmica da Cozinha (IP/Cloud)...`);
        await new Promise(r => setTimeout(r, 800)); // Latência de hardware
        console.log(`[POLTERGEIST] Comanda impressa fisicamente. Nenhuma interação humana necessária na loja.`);

        // 2. Simulação: Integração Uber Direct / Flash API ou Lalamove
        console.log(`[POLTERGEIST] Invocando API de Logística Urbana (Uber Flash) para o endereço: ${address}...`);
        await new Promise(r => setTimeout(r, 1200)); // Busca de motorista
        
        const driverName = "Carlos";
        const vehiclePlate = "ABC-1234";

        console.log(`[POLTERGEIST] Motorista ${driverName} (${vehiclePlate}) está a 2 minutos do restaurante.`);

        res.json({
            ok: true,
            status: "GHOST_OPERATIONS_COMPLETED",
            hardware_logs: "Printed via Cloud Queue",
            logistics: {
                driver: driverName,
                plate: vehiclePlate,
                eta: "2 mins"
            }
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
