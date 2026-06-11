const { Client } = require('discord.js-selfbot-v13');
const log = require('../../logger');
const statsService = require('../services/stats');

module.exports = (state, configManager, channelManager, messageHandler, telegramService, huntbotManager) => ({
    initialize() {
        if (state.client) {
            log.warn('🔄 Merestart sesi Discord...');
            try {
                state.client.destroy();
            } catch (e) { }
            state.client = null;
        }

        state.client = new Client({ checkUpdate: false });

        state.client.on('ready', () => {
            log.success(`✅ Login Sukses: ${state.client.user.tag}`);
            telegramService.send(`🤖 <b>Bot Started</b>\nUser: ${state.client.user.tag}`);
            channelManager.updateActive();

            state.config.botStatus = state.config.botStatus || {};
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            statsService.syncBotUptime(state);
            configManager.save();

            // Inisialisasi HuntBot dan kirim command awal
            setTimeout(async () => {
                // Sekarang huntbotManager sudah dikenali karena sudah dimasukkan di parameter atas
                if (huntbotManager) {
                    log.info("🚀 Melakukan Auto-Command awal...");
                    
                    // 1. Jalankan Init (mengirim whb)
                    huntbotManager.init(); 

                    // 2. Jeda 5 detik agar natural
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // 3. Kirim wboss t
                    if (typeof huntbotManager.sendBossTicket === 'function') {
                        huntbotManager.sendBossTicket();
                    } else {
                        log.error("❌ Fungsi sendBossTicket tidak ditemukan di huntbotManager!");
                    }
                } else {
                    log.error("❌ huntbotManager undefined di client.js!");
                }
            }, 5000); 
        });

        state.client.on('messageCreate', (msg) => messageHandler.handle(msg));

        if (state.activeToken && state.activeToken.length > 20) {
            state.client.login(state.activeToken).catch(e => {
                log.error(`❌ Token Invalid / Login Gagal: ${e.message}`);
            });
        } else {
            log.error('❌ Tidak ada token yang valid di config!');
        }
    }
});
