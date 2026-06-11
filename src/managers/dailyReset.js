const CONSTANTS = require('../constants');
const log = require('../../logger'); // Akan selalu mencetak log dengan jam WIB

module.exports = (state, telegramService) => ({
    checkAndReset() {
        const now = new Date();
        
        // 1. Waktu Pasifik HANYA untuk mengecek jadwal (menangani DST)
        const timeInPacific = now.toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });

        const [hourStr, minuteStr] = timeInPacific.split(':');
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        if (hour === CONSTANTS.DAILY_RESET_HOUR && minute === CONSTANTS.DAILY_RESET_MINUTE) {
            if (state.stopBossHunt) {
                state.stopBossHunt = false;
                
                // Konsol: Cukup kirim pesannya saja. 
                // logger.js Anda akan otomatis mengubahnya menjadi: [15:00:00] [OK] ⏰ DAILY RESET...
                log.success("⏰ DAILY RESET (Server Pasifik)! Bot siap berburu! ⚔️");
                
                // Telegram: Kita ambil waktu WIB manual khusus untuk pesan chat
                const timeForTelegram = now.toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                telegramService.send(
                    "⏰ <b>DAILY RESET!</b>\n" +
                    `Waktu Reset: ${timeForTelegram} WIB\n` +
                    "Tiket telah di-reset berdasarkan server Pasifik.\n" +
                    "Bot kembali aktif mencari Boss! ⚔️"
                );
            }
        }
    }
});
