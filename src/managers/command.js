const CONSTANTS = require('../constants');
const log = require('../../logger');
const { sleep, randomInt } = require('../utils');
const statsService = require('../services/stats');

module.exports = (state, channelManager, emergencyHandler) => ({
    async send(cmd, type = '') {
        if (state.hasActiveCaptcha) {
            log.warn(`⚠️ Command [${cmd}] ditahan: CAPTCHA sedang aktif.`);
            return;
        }
        if (state.config.botStatus.paused || !state.config.botStatus.running) return;
        if (!state.client?.isReady()) return;

        if (!state.activeChannelId && !channelManager.updateActive()) return;

        const channel = state.client.channels.cache.get(state.activeChannelId);
        if (!channel) return;

        await channel.sendTyping();
        await sleep(randomInt(CONSTANTS.MIN_TYPING_DELAY, CONSTANTS.MAX_TYPING_DELAY));

        if (state.hasActiveCaptcha) {
            log.warn(`⚠️ Command [${cmd}] dibatalkan setelah typing: CAPTCHA sedang aktif.`);
            return;
        }

        const maxRetries = 2;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await channel.send(cmd);
                statsService.recordCommand(state, cmd, type);
                log.info(`📨 Sent: ${cmd} [${type}]`);

                if (type === 'Battle' || type === 'Hunt') {
                    this.setResponseTimeout(type);
                }
                return; // Success
            } catch (e) {
                lastError = e;

                const isRateLimit = e.code === 429 || (e.message && e.message.toLowerCase().includes('rate limit'));
                const isNetworkError = e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.message?.includes('fetch');

                if (attempt < maxRetries && (isRateLimit || isNetworkError)) {
                    const delay = 1500 * attempt;
                    log.warn(`⚠️ Gagal kirim command [${cmd}] (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... (${e.message})`);
                    await sleep(delay);
                    continue;
                }

                // Final error after retries or non-retryable error
                log.error(`❌ Gagal mengirim command [${cmd}] [${type}] setelah ${attempt} percobaan: ${e.message}`, {
                    code: e.code,
                    status: e.status,
                    command: cmd,
                    type: type,
                    stack: e.stack?.split('\n').slice(0, 5).join('\n') // partial stack
                });
                break;
            }
        }
    },

    setResponseTimeout(type) {
        if (state.responseTimeout) {
            log.warn(`⏳ Timeout already active, skipping new timeout for ${type}`);
            return;
        }

        state.responseTimeout = setTimeout(() => {
            log.error(`⛔ TIMEOUT 40s - No response from OwO for ${type}`);
            emergencyHandler.pause('TIMEOUT 40s (OwO No Response)');
        }, CONSTANTS.RESPONSE_TIMEOUT_MS);

        log.info(`⏲️ Response timeout set for ${type}: ${CONSTANTS.RESPONSE_TIMEOUT_MS / 1000}s`);
    },

    clearResponseTimeout() {
        if (state.responseTimeout) {
            clearTimeout(state.responseTimeout);
            state.responseTimeout = null;
            log.info(`✅ Response timeout cleared - OwO responded in time`);
        }
    }
});
