const log = require('../../logger');
const { accountPrefix, safeJsonStringify } = require('../utils');

const ADVENTURE_COMMAND = 'Ladv';
const NEXT_ADVENTURE_DELAY_MS = 2000;

const messageText = (msg) => {
    const embeds = (msg.embeds || []).flatMap(embed => [
        embed.title,
        embed.description,
        embed.author?.name,
        embed.footer?.text,
        ...(embed.fields || []).flatMap(field => [field.name, field.value])
    ]);

    return [msg.content || '', ...embeds, safeJsonStringify(msg.components || [])]
        .filter(Boolean)
        .join(' ');
};

module.exports = (state, configManager, commandSender) => ({
    getSettings() {
        return configManager.getAdventureSettings();
    },

    findButton(obj, targetId) {
        if (!obj || typeof obj !== 'object') return null;

        const id = obj.custom_id || obj.customId;
        if (id === targetId) return obj;

        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = this.findButton(item, targetId);
                if (found) return found;
            }
            return null;
        }

        for (const key in obj) {
            if (['client', 'guild', 'channel', 'member'].includes(key)) continue;
            const found = this.findButton(obj[key], targetId);
            if (found) return found;
        }
        return null;
    },

    matchesTarget(msg, settings = this.getSettings()) {
        return settings.enabled === true
            && String(msg.author?.id || '') === settings.targetId
            && String(msg.channel?.id || msg.channelId || '') === settings.channelId
            && String(msg.guild?.id || msg.guildId || '') === settings.guildId;
    },

    async start({ restart = false } = {}) {
        const settings = this.getSettings();
        if (!settings.enabled || !settings.targetId || !settings.channelId || !settings.guildId) {
            log.warn(`${accountPrefix(state)}⚠️ Auto Adventure tidak dimulai: targetId, channelId, atau guildId belum lengkap.`);
            return false;
        }

        if (state.adventureActive && !restart) return true;

        this.stopTimer();
        state.adventurePaused = false;
        state.adventureActive = true;
        const sent = await this.sendAdventureCommand();
        if (!sent) state.adventureActive = false;
        return sent;
    },

    stopTimer() {
        if (state.adventureTimer) clearTimeout(state.adventureTimer);
        state.adventureTimer = null;
    },

    stop() {
        this.stopTimer();
        state.adventurePaused = false;
        state.adventureProcessing = false;
        state.adventureActive = false;
    },

    pauseForMap() {
        this.stopTimer();
        state.adventurePaused = true;
        log.warn(`${accountPrefix(state)}Pilih map terlebih dahulu!`);
    },

    async sendAdventureCommand() {
        const settings = this.getSettings();
        if (!settings.enabled || state.adventurePaused) return false;

        return commandSender.send(ADVENTURE_COMMAND, 'Adventure', settings.channelId);
    },

    scheduleNextCommand() {
        if (state.adventureTimer || state.adventurePaused || !this.getSettings().enabled) return false;

        state.adventureTimer = setTimeout(async () => {
            state.adventureTimer = null;
            await this.sendAdventureCommand();
        }, NEXT_ADVENTURE_DELAY_MS);
        return true;
    },

    async handle(msg) {
        if (!this.matchesTarget(msg) || state.adventurePaused || state.adventureProcessing) return false;

        state.adventureProcessing = true;
        try {
            const text = messageText(msg);
            if (text.includes('🗺️ Adventure Map')) {
                this.pauseForMap();
                return true;
            }

            if (!text.includes('Sylvaris')) return false;

            const exploreButton = this.findButton(msg.components, 'adv:explore');
            if (exploreButton && exploreButton.disabled !== true) {
                await msg.clickButton(exploreButton.custom_id || exploreButton.customId);
                log.success(`${accountPrefix(state)}🗺️ ACTION: Explore Sylvaris!`);
            }

            this.scheduleNextCommand();
            return true;
        } catch (error) {
            log.error(`${accountPrefix(state)}Handle Adventure Error: ${error.message}`);
            return false;
        } finally {
            state.adventureProcessing = false;
        }
    }
});
