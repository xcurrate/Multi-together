const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const log = require('../../logger');
const accountPrefix = (state) => state?.accountId ? `[account:${state.accountId}] ` : '';

const VOICE_CHANNEL_TYPES = new Set(['GUILD_VOICE', 'GUILD_STAGE_VOICE', 2, 13]);

module.exports = (state, configManager) => ({
    getSettings() {
        const voice = state.config.settings?.voice || {};
        return {
            enabled: voice.enabled === true,
            channelId: voice.channelId ? String(voice.channelId).trim() : ''
        };
    },

    ensureConfig() {
        state.config.settings = state.config.settings || {};
        state.config.settings.voice = state.config.settings.voice || { enabled: false, channelId: '' };
        return state.config.settings.voice;
    },

    isVoiceChannel(channel) {
        return channel && VOICE_CHANNEL_TYPES.has(channel.type) && channel.guild && channel.guild.voiceAdapterCreator;
    },

    async resolveVoiceChannel(channelId) {
        if (!channelId) return null;

        let voiceChannel = state.client?.channels?.cache?.get(channelId) || null;
        if (!voiceChannel && state.client?.channels?.fetch) {
            try {
                voiceChannel = await state.client.channels.fetch(channelId);
            } catch (err) {
                log.warn(`${accountPrefix(state)}⚠️ Gagal fetch Voice Channel ${channelId}: ${err.message}`);
            }
        }

        return this.isVoiceChannel(voiceChannel) ? voiceChannel : null;
    },

    async join(channelId, options = {}) {
        const targetChannelId = channelId ? String(channelId).trim() : '';
        const { persist = false, source = 'manual' } = options;

        if (!state.client?.isReady()) {
            log.warn(`${accountPrefix(state)}⚠️ Client belum ready, join VC dibatalkan.`);
            return null;
        }

        const voiceChannel = await this.resolveVoiceChannel(targetChannelId);
        if (!voiceChannel) {
            log.error(`${accountPrefix(state)}❌ Voice Channel tidak ditemukan atau ID salah!`);
            return null;
        }

        const group = state.accountId || 'default';
        const existingConnection = getVoiceConnection(voiceChannel.guild.id, group);
        if (existingConnection && state.lastVoiceChannelId === voiceChannel.id) {
            return { connection: existingConnection, voiceChannel };
        }
        if (existingConnection) existingConnection.destroy();

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true,
            group
        });

        state.lastVoiceChannelId = voiceChannel.id;

        if (persist) {
            const voiceConfig = this.ensureConfig();
            voiceConfig.channelId = voiceChannel.id;
            configManager.save();
        }

        log.success(`${accountPrefix(state)}🔊 Berhasil join VC (${source}): ${voiceChannel.name}`);
        return { connection, voiceChannel };
    },

    async joinConfigured(source = 'auto') {
        const { enabled, channelId } = this.getSettings();
        if (!enabled) {
            return null;
        }

        if (!channelId) {
            log.warn(`${accountPrefix(state)}⚠️ Auto Join VC aktif, tapi Voice Channel ID belum diatur.`);
            return null;
        }

        return this.join(channelId, { persist: false, source });
    },

    leave(guildId) {
        const connection = getVoiceConnection(guildId, state.accountId || 'default');
        if (!connection) return false;
        connection.destroy();
        return true;
    },

    leaveAllCachedGuilds() {
        const guilds = state.client?.guilds?.cache;
        if (!guilds) return 0;

        let count = 0;
        guilds.forEach((guild) => {
            if (this.leave(guild.id)) count += 1;
        });
        return count;
    }
});
