const log = require('../../logger');

module.exports = (state, configManager) => ({
    updateActive() {
        const valid = configManager.getValidChannels();
        if (valid.length === 0) return false;

        if (state.activeChannelId && valid.includes(state.activeChannelId)) {
            return true;
        }

        const newChannelId = valid[Math.floor(Math.random() * valid.length)];
        state.activeChannelId = newChannelId;

        if (state.client?.isReady()) {
            const channel = state.client.channels.cache.get(newChannelId);
            if (channel) log.info(`📡 Channel Aktif: ${channel.name}`);
        }

        return true;
    },

    pickNext() {
        const valid = configManager.getValidChannels();
        if (valid.length === 0) return null;
        if (valid.length === 1) return valid[0];

        let next = valid[Math.floor(Math.random() * valid.length)];
        let attempts = 0;
        while (next === state.activeChannelId && attempts < 10) {
            next = valid[Math.floor(Math.random() * valid.length)];
            attempts++;
        }
        return next;
    },

    stopRotation() {
        if (state.channelRotateTimer) {
            clearTimeout(state.channelRotateTimer);
            state.channelRotateTimer = null;
        }
    },

    scheduleRotation() {
        this.stopRotation();

        const settings = configManager.getRotationSettings();
        if (!settings.enabled) return;

        const delay = Math.floor(Math.random() * (settings.maxMs - settings.minMs + 1)) + settings.minMs;

        state.channelRotateTimer = setTimeout(() => {
            const nextId = this.pickNext();
            if (nextId) {
                state.lastChannelId = state.activeChannelId;
                state.activeChannelId = nextId;

                if (state.client?.isReady()) {
                    const channel = state.client.channels.cache.get(nextId);
                    if (channel) log.info(`🔁 Rotated Channel: ${channel.name}`);
                }
            }
            this.scheduleRotation();
        }, delay);
    }
});