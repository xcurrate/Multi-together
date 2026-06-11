const fs = require('fs');
const CONSTANTS = require('../constants');
const { safeJsonStringify } = require('../utils');

const ensureRuntimeShape = (config = {}) => {
    config.settings = config.settings || {};
    config.settings.voice = config.settings.voice || { enabled: false, channelId: '' };
    return config;
};

module.exports = (state) => ({
    read() {
        try {
            const raw = fs.readFileSync('./config.json', 'utf8');
            return ensureRuntimeShape(JSON.parse(raw));
        } catch (e) {
            return null;
        }
    },

    save() {
        ensureRuntimeShape(state.config);
        fs.writeFileSync('./config.json', JSON.stringify(state.config, null, 2));
    },

    getRotationSettings() {
        const r = state.config.settings?.channelRotation || {};
        return {
            enabled: r.enabled === true,
            minMs: Math.max(1000, parseInt(r.minMs, 10) || 8 * 60 * 1000),
            maxMs: Math.max(1000, parseInt(r.maxMs, 10) || 15 * 60 * 1000)
        };
    },

    getControlCommands() {
        const ctrl = state.config.settings?.control || {};
        return {
            startCmd: String(ctrl.start || "wo").toLowerCase(),
            pauseCmd: String(ctrl.pause || "winv").toLowerCase(),
            allowIds: Array.isArray(ctrl.allowIds) ? ctrl.allowIds.map(String) : []
        };
    },

    getBossSettings() {
        const boss = state.config.settings?.boss || {};
        return {
            enabled: boss.enabled === true,
            allowedGuilds: Array.isArray(boss.allowedGuilds) ? boss.allowedGuilds : []
        };
    },

    getValidChannels() {
        const channels = Array.isArray(state.config.channels) ? state.config.channels : [];
        return channels.filter(c => c && String(c).length > 5);
    },

    updateFromDisk() {
        const diskConfig = this.read();
        if (!diskConfig) return false;

        const previousToken = state.activeToken;
        const tokenChanged = diskConfig.token !== state.activeToken;
        const channelsChanged = safeJsonStringify(state.config.channels) !== safeJsonStringify(diskConfig.channels);
        const voiceChanged = safeJsonStringify(state.config.settings?.voice) !== safeJsonStringify(diskConfig.settings?.voice);
        
        const wasPaused = state.config.botStatus?.paused;
        const wasRunning = state.config.botStatus?.running;
        const nowPaused = diskConfig.botStatus?.paused;
        const nowRunning = diskConfig.botStatus?.running;
        
        const statusChanged = wasPaused !== nowPaused || wasRunning !== nowRunning;

        state.config = diskConfig;

        return { tokenChanged, previousToken, channelsChanged, voiceChanged, statusChanged, wasPaused, wasRunning, nowPaused, nowRunning };
    }
});
