const CONSTANTS = require('../constants');
const log = require('../../logger');
const statsService = require('../services/stats');

module.exports = (state, configManager, clientManager, channelManager, loopManager, telegramService, voiceManager) => ({
    start() {
        setInterval(() => {
            const result = configManager.updateFromDisk();

 if (result.tokenChanged) {
    statsService.syncBotUptime(state, { token: result.previousToken, forceActive: false });

    log.warn('⚠️ Token berubah! Login ulang...');

    state.hasActiveCaptcha = false;

    state.activeToken = state.config.token;

    clientManager.initialize();
    return;
}

            if (result.channelsChanged) {
                log.info('🔄 Daftar Channel berubah. Mengupdate target...');
                channelManager.updateActive();
            }

            if (result.voiceChanged && voiceManager) {
                log.info('🔊 Pengaturan Voice Channel berubah. Menerapkan ulang...');
                if (state.config.settings?.voice?.enabled) {
                    voiceManager.joinConfigured('dashboard').catch(err => log.error(`❌ Auto Join VC gagal: ${err.message}`));
                } else {
                    const count = voiceManager.leaveAllCachedGuilds();
                    log.info(`🔇 Auto Join VC dinonaktifkan. Koneksi VC ditutup: ${count}`);
                }
            }

            if (result.statusChanged) {
                this.handleStatusChange(result);
            }
        }, CONSTANTS.POLLING_INTERVAL_MS);
    },

    handleStatusChange(result) {
        const { wasPaused, wasRunning, nowPaused, nowRunning } = result;

        if (wasPaused && !nowPaused && nowRunning) {
            log.success('▶️ Bot di-START dari dashboard');
            state.config.botStatus.paused = false;
            state.config.botStatus.running = true;
            statsService.syncBotUptime(state);
            
            if (!state.client?.isReady()) {
                clientManager.initialize();
            } else {
                loopManager.startAll();
                channelManager.scheduleRotation();
            }
            
            telegramService.send(`▶️ <b>Bot Started</b> via Dashboard`);
        }
        
        else if (!wasPaused && nowPaused && !nowRunning) {
            log.warn('⏸️ Bot di-PAUSE dari dashboard');
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            statsService.syncBotUptime(state);
            
            loopManager.stopAll();
            channelManager.stopRotation();
            
            telegramService.send(`⏸️ <b>Bot Paused</b> via Dashboard`);
        }
    }
});
