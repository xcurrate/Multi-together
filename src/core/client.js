
const { Client } = require('discord.js-selfbot-v13');
const log = require('../../logger');
const statsService = require('../services/stats');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const accountPrefix = (state) => state?.accountId ? `[account:${state.accountId}] ` : '';

async function waitUntilCaptchaClear(state) {
    while (state.hasActiveCaptcha) {
        log.warn(`${accountPrefix(state)}⏸️ Startup command ditahan: CAPTCHA sedang aktif. Menunggu verifikasi...`);
        await wait(1000);
    }
}

async function sendStartupCommand(state, channel, cmd) {
    await waitUntilCaptchaClear(state);
    if (!state.client?.isReady()) return false;

    await channel.send(cmd);
    log.info(`${accountPrefix(state)}🚀 [Startup Ready] Terkirim: ${cmd}`);

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
            log.warn(`${accountPrefix(state)}🔄 Merestart sesi Discord...`);
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
            log.success(`${accountPrefix(state)}✅ Login Sukses: ${state.client.user.tag}`);
            telegramService.send(`🤖 <b>Bot Started</b>\nUser: ${state.client.user.tag}`);
            channelManager.updateActive();

            state.config.botStatus = state.config.botStatus || { running: false, paused: true };
            if (typeof state.config.botStatus.running !== 'boolean') state.config.botStatus.running = false;
            if (typeof state.config.botStatus.paused !== 'boolean') state.config.botStatus.paused = !state.config.botStatus.running;
            statsService.syncBotUptime(state);
            configManager.save();

            if (voiceManager && state.config.botStatus?.running === true && state.config.botStatus?.paused !== true) {
                voiceManager.joinConfigured('restart').catch(err => log.error(`${accountPrefix(state)}❌ Auto Join VC gagal: ${err.message}`));
            }

            if (huntbotManager) {
                // Startup ready sequence selalu mengirim whb sendiri setiap client ready/login,
                // jadi initial check HuntBot otomatis dilewati agar tidak double-send.
                huntbotManager.init({ skipInitialCheck: true });
            }

            // Startup command wajib dieksekusi setiap client ready/login, termasuk mode connect/prepare.
            setTimeout(async () => {
                try {
                    const channelId = state.config.tiketandhb?.channelId;
                    const channel = state.client.channels.cache.get(channelId);

                    if (!channel) {
                        log.warn(`${accountPrefix(state)}⚠️ Channel ${channelId} tidak ditemukan untuk mengirim command awal.`);
                        return;
                    }

                    log.info(`${accountPrefix(state)}🚀 Menjalankan startup command setiap client ready/login...`);
                    await sendStartupCommand(state, channel, "whb 1d");

                    log.info(`${accountPrefix(state)}⚔️ Mengecek status World Boss untuk akun saat ini...`);
                    await sendStartupCommand(state, channel, "wboss t");
                    
                    log.info(`${accountPrefix(state)}✅ Routine startup command selesai dieksekusi.`);
                } catch (err) {
                    log.error(`${accountPrefix(state)}❌ Gagal mengirim command: ${err.message}`);
                }
            }, 2000);

            
        });

        state.client.on('messageCreate', (msg) => messageHandler.handle(msg));

        if (state.activeToken && state.activeToken.length > 20) {
            state.client.login(state.activeToken).catch(e => {
                log.error(`${accountPrefix(state)}❌ Token Invalid / Login Gagal: ${e.message}`);
            });
        } else {
            log.error(`${accountPrefix(state)}❌ Tidak ada token yang valid di config!`);
        }
    }
});
