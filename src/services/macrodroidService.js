const log = require('../../logger'); // Sesuaikan path logger-mu
const { accountPrefix } = require('../utils');

module.exports = (state) => ({
    async trigger(action) {
        try {
            // Mengambil ID dari config yang barusan kita pasang
            const deviceId = state.config.macrodroidId; 
            
            if (!deviceId) {
                log.warn(`${accountPrefix(state)}⚠️ MacroDroid ID belum diatur di config!`);
                return;
            }

            // Menyusun URL Webhook MacroDroid
            const webhookUrl = `https://trigger.macrodroid.com/${deviceId}/${action}`;

            // Menembak URL secara instan (0 delay)
            await fetch(webhookUrl);
            
            log.info(`${accountPrefix(state)}🚀 Berhasil mengirim trigger '${action}' ke MacroDroid!`);
        } catch (error) {
            log.error(`${accountPrefix(state)}❌ Gagal mengirim trigger MacroDroid (${action}): ${error.message}`);
        }
    }
});
