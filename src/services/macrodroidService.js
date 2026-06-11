const log = require('../../logger'); // Sesuaikan path logger-mu

module.exports = (state) => ({
    async trigger(action) {
        try {
            // Mengambil ID dari config yang barusan kita pasang
            const deviceId = state.config.macrodroidId; 
            
            if (!deviceId) {
                log.warn("⚠️ MacroDroid ID belum diatur di config!");
                return;
            }

            // Menyusun URL Webhook MacroDroid
            const webhookUrl = `https://trigger.macrodroid.com/${deviceId}/${action}`;

            // Menembak URL secara instan (0 delay)
            await fetch(webhookUrl);
            
            log.info(`🚀 Berhasil mengirim trigger '${action}' ke MacroDroid!`);
        } catch (error) {
            log.error(`❌ Gagal mengirim trigger MacroDroid (${action}): ` + error.message);
        }
    }
});
