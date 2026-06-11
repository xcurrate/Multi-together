
const { Client } = require('discord.js-selfbot-v13');
const log = require('../../logger');
const statsService = require('../services/stats');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntilCaptchaClear(state) {
    while (state.hasActiveCaptcha) {
        log.warn('⏸️ Startup command ditahan: CAPTCHA sedang aktif. Menunggu verifikasi...');
        await wait(1000);
    }
}

async function sendStartupCommand(state, channel, cmd) {
    await waitUntilCaptchaClear(state);
    if (!state.client?.isReady()) return false;

    await channel.send(cmd);
    log.info(`🚀 [Startup Ready] Terkirim: ${cmd}`);

    const startedWait = Date.now();
    while (Date.now() - startedWait < 5000) {
        await waitUntilCaptchaClear(state);
        const remaining = 5000 - (Date.now() - startedWait);
        if (remaining > 0) await wait(Math.min(1000, remaining));
    }

    return true;
}

module.exports = (state, configManager, channelManager, messageHandler, telegramService, huntbotManager, voiceManager) => ({
    initialize() {
        if (state.client) {
            log.warn('🔄 Merestart sesi Discord...');
            try {
                state.client.destroy();
            } catch (e) { }
            state.client = null;
            
            // PENTING: Saat ganti akun/restart sesi, pastikan state autoMode HuntBot di-reset
            // agar tidak terkena guard clause (if (huntbotState.autoMode) return;)
            if (huntbotManager && typeof huntbotManager.stop === 'function') {
                huntbotManager.stop(); // Sesuaikan dengan fungsi stop/reset di huntbotManager-mu
            }
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

            if (voiceManager) {
                voiceManager.joinConfigured('restart').catch(err => log.error(`❌ Auto Join VC gagal: ${err.message}`));
            }

             // PERBAIKAN LOGIKA DISINI:
            const willRunStartupCommands = !state.hasRunInitialReadyCommands;

            if (huntbotManager) {
                // Huntbot akan otomatis bypass check di run pertama, 
                // tapi akan dipaksa checkStatus() saat ganti akun.
                huntbotManager.init({ skipInitialCheck: willRunStartupCommands });
            }

            // Pindahkan setTimeout keluar dari if (willRunStartupCommands) 
            // agar bisa dieksekusi setiap kali ada akun (token) yang ready.
            setTimeout(async () => {
                try {
                    const channelId = state.config.tiketandhb?.channelId;
                    const channel = state.client.channels.cache.get(channelId);

                    if (!channel) {
                        log.warn(`⚠️ Channel ${channelId} tidak ditemukan untuk mengirim command awal.`);
                        return;
                    }

                    // 1. Command yang HANYA jalan di run pertama (Akun A)
                    if (willRunStartupCommands) {
                        state.hasRunInitialReadyCommands = true; // Kunci agar tidak jalan lagi di akun berikutnya
                        log.info("🚀 Menjalankan command awal client-ready untuk sesi pertama...");
                        await sendStartupCommand(state, channel, "whb 1d");
                    }

                    // 2. Command yang jalan di SETIAP AKUN (Akun A, B, dst)
                    log.info("⚔️ Mengecek status World Boss untuk akun saat ini...");
                    await sendStartupCommand(state, channel, "wboss t");
                    
                    log.info("✅ Routine startup command selesai dieksekusi.");
                } catch (err) {
                    log.error(`❌ Gagal mengirim command: ${err.message}`);
                }
            }, 2000);

            
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
