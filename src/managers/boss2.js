const CONSTANTS = require('../constants');
const log = require('../../logger');
const { safeJsonStringify, removeInvisibleChars, accountPrefix, randomInt } = require('../utils');

const MAX_TIMER_MS = 2147483647;
const TEXT_KEYS = new Set(['content', 'title', 'description', 'name', 'value', 'label', 'text']);

const toIdList = (value) => (Array.isArray(value) ? value : String(value || '').split(','))
    .map(item => String(item).trim())
    .filter(Boolean);

const toNonNegativeInt = (value, fallback) => {
    const num = parseInt(value, 10);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const toText = (value, fallback) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
};

const normalizeBoss2Settings = (raw = {}) => {
    const defaults = CONSTANTS.BOSS2_DEFAULTS;
    const delayMinMs = toNonNegativeInt(raw.delayMinMs, defaults.delayMinMs);
    return {
        enabled: raw.enabled === true,
        allowedGuilds: toIdList(raw.allowedGuilds),
        channelIds: toIdList(raw.channelIds),
        appearText: toText(raw.appearText, defaults.appearText),
        defeatedText: toText(raw.defeatedText, defaults.defeatedText),
        buttonId: toText(raw.buttonId, defaults.buttonId),
        fightsPerBoss: Math.min(defaults.maxFightsPerBoss, Math.max(1, toNonNegativeInt(raw.fightsPerBoss, defaults.fightsPerBoss))),
        delayMinMs,
        delayMaxMs: Math.max(delayMinMs, toNonNegativeInt(raw.delayMaxMs, defaults.delayMaxMs))
    };
};

const toPlainData = (value) => {
    if (!value) return null;
    try {
        return JSON.parse(safeJsonStringify(value) || 'null');
    } catch {
        return null;
    }
};

const findButton = (node, targetId) => {
    if (!node || typeof node !== 'object') return null;
    if ((node.custom_id || node.customId) === targetId) return node;

    for (const child of Array.isArray(node) ? node : Object.values(node)) {
        const found = findButton(child, targetId);
        if (found) return found;
    }
    return null;
};

const collectTexts = (node, texts = []) => {
    if (!node || typeof node !== 'object') return texts;
    for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string' && TEXT_KEYS.has(key)) texts.push(value);
        else if (value && typeof value === 'object') collectTexts(value, texts);
    }
    return texts;
};

const parseDiscordTimestamp = (text, label) => {
    const match = text.match(new RegExp(`${label}\\s*<t:(\\d+)(?::[a-zA-Z])?>`, 'i'));
    return match ? parseInt(match[1], 10) * 1000 : null;
};

const parseRaidMessage = (msg, settings) => {
    const components = toPlainData(msg.components) || [];
    const embeds = toPlainData(msg.embeds) || [];
    const text = removeInvisibleChars([msg.content || '', ...collectTexts(embeds), ...collectTexts(components)].join('\n'));
    const lowerText = text.toLowerCase();
    const button = findButton(components, settings.buttonId);
    const fightMatch = text.match(/fight\s+kamu:\s*(\d+)\s*\/\s*(\d+)/i);

    return {
        isAppear: lowerText.includes(settings.appearText.toLowerCase()),
        isDefeated: lowerText.includes(settings.defeatedText.toLowerCase()),
        button,
        buttonActive: !!button && button.disabled !== true,
        endsAt: parseDiscordTimestamp(text, 'berakhir'),
        nextSpawnAt: parseDiscordTimestamp(text, 'boss\\s+baru'),
        fightsUsed: fightMatch ? parseInt(fightMatch[1], 10) : null,
        fightsMax: fightMatch ? parseInt(fightMatch[2], 10) : null
    };
};

const formatWib = (timestampMs) => new Date(timestampMs).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

const formatCountdown = (timestampMs) => {
    const diff = Math.max(0, timestampMs - Date.now());
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}j ${minutes % 60}m` : `${minutes}m ${seconds}d`;
};

const createBoss2Manager = (state, configManager) => {
    state.boss2Raids = state.boss2Raids || new Map();
    state.boss2Timers = state.boss2Timers || new Set();

    const prefix = () => `${accountPrefix(state)}🐲 Auto Boss2: `;

    const schedule = (callback, atMs) => {
        const delay = Math.min(MAX_TIMER_MS, Math.max(0, atMs - Date.now()));
        const timer = setTimeout(() => {
            state.boss2Timers.delete(timer);
            callback();
        }, delay);
        state.boss2Timers.add(timer);
        return timer;
    };

    const cancel = (timer) => {
        if (!timer) return;
        clearTimeout(timer);
        state.boss2Timers.delete(timer);
    };

    const wait = (ms) => new Promise(resolve => schedule(resolve, Date.now() + ms));

    const getRaid = (key) => {
        if (!state.boss2Raids.has(key)) {
            state.boss2Raids.set(key, { messageId: null, status: 'idle', fightsDone: 0, fighting: false });
        }
        return state.boss2Raids.get(key);
    };

    return {
        getRaidState(key) {
            return state.boss2Raids.get(key) || null;
        },

        isAllowed(msg, settings) {
            const myId = state.client?.user?.id;
            const authorId = String(msg.author?.id || '');
            if (myId && authorId === myId) return false;
            if (authorId !== CONSTANTS.LUCY_BOT_ID) return false;
            if (settings.allowedGuilds.length > 0 && !settings.allowedGuilds.includes(msg.guildId)) return false;
            if (settings.channelIds.length > 0 && !settings.channelIds.includes(msg.channel?.id)) return false;
            return true;
        },

        async handle(msg) {
            const settings = configManager.getBoss2Settings();
            if (!settings.enabled || !msg?.components?.length) return null;
            if (!this.isAllowed(msg, settings)) return null;

            const info = parseRaidMessage(msg, settings);
            const key = msg.guildId || msg.channel?.id || 'dm';

            if (info.isDefeated || info.nextSpawnAt || (info.button && !info.buttonActive)) {
                this.handleEnded(key, msg, info);
                return 'ended';
            }

            if (info.isAppear && info.buttonActive) {
                return this.handleAppear(key, msg, info, settings);
            }
            return null;
        },

        async handleAppear(key, msg, info, settings) {
            const raid = getRaid(key);

            const isNewRaid = raid.messageId !== msg.id ||
                (raid.status !== 'active' && info.endsAt && info.endsAt !== raid.endsAt);
            if (isNewRaid) {
                cancel(raid.escapeTimer);
                Object.assign(raid, {
                    messageId: msg.id,
                    status: 'active',
                    fightsDone: 0,
                    fighting: false,
                    endsAt: null,
                    escapeTimer: null,
                    nextSpawnAt: null
                });
                cancel(raid.spawnTimer);
                raid.spawnTimer = null;
                log.success(`${prefix()}Guild Boss muncul di ${msg.guild?.name || key}!`);
            }

            if (raid.status !== 'active') return null;

            if (info.endsAt && info.endsAt !== raid.endsAt) {
                raid.endsAt = info.endsAt;
                cancel(raid.escapeTimer);
                raid.escapeTimer = schedule(() => {
                    if (raid.messageId === msg.id && raid.status === 'active') {
                        raid.status = 'escaped';
                        log.warn(`${prefix()}Waktu boss habis (kabur). Menunggu info "Boss baru"...`);
                    }
                }, info.endsAt);
                log.info(`${prefix()}Boss berakhir jam ${formatWib(info.endsAt)} WIB (sisa ${formatCountdown(info.endsAt)}).`);
            }

            return this.fight(raid, msg, info, settings);
        },

        async fight(raid, msg, info, settings) {
            if (raid.fighting) return null;
            raid.fighting = true;
            const messageId = msg.id;
            const target = info.fightsMax ? Math.min(settings.fightsPerBoss, info.fightsMax) : settings.fightsPerBoss;
            let fightsDone = info.fightsUsed !== null ? Math.max(raid.fightsDone, info.fightsUsed) : raid.fightsDone;
            const canContinue = () => raid.messageId === messageId &&
                raid.status === 'active' &&
                configManager.getBoss2Settings().enabled;

            try {
                while (fightsDone < target && canContinue()) {
                    const delayMs = randomInt(settings.delayMinMs, settings.delayMaxMs);
                    if (delayMs > 0) await wait(delayMs);
                    if (!canContinue()) break;

                    try {
                        await msg.clickButton(info.button.custom_id || info.button.customId);
                    } catch (error) {
                        log.error(`${prefix()}Gagal klik Fight: ${error.message || error}`);
                        break;
                    }
                    fightsDone += 1;
                    raid.fightsDone = fightsDone;
                    log.success(`${prefix()}⚔️ Fight ${fightsDone}/${target}`);
                }
            } finally {
                raid.fighting = false;
            }
            return 'fought';
        },

        handleEnded(key, msg, info) {
            const raid = getRaid(key);
            const wasActive = raid.status === 'active';
            cancel(raid.escapeTimer);
            raid.escapeTimer = null;
            raid.status = 'ended';
            raid.messageId = raid.messageId || msg.id;

            if (wasActive) {
                log.warn(`${prefix()}Boss ${info.isDefeated ? 'telah dikalahkan' : 'selesai'} / tombol Fight mati. Berhenti fight.`);
            }

            if (info.nextSpawnAt && info.nextSpawnAt !== raid.nextSpawnAt) {
                raid.nextSpawnAt = info.nextSpawnAt;
                cancel(raid.spawnTimer);
                raid.spawnTimer = schedule(() => {
                    raid.spawnTimer = null;
                    log.info(`${prefix()}Waktu boss baru tiba. Menunggu pesan "Guild Boss Telah Muncul"...`);
                }, info.nextSpawnAt);
                log.info(`${prefix()}Boss baru muncul jam ${formatWib(info.nextSpawnAt)} WIB (dalam ${formatCountdown(info.nextSpawnAt)}).`);
            }
        },

        stop() {
            for (const timer of state.boss2Timers) clearTimeout(timer);
            state.boss2Timers.clear();
            for (const raid of state.boss2Raids.values()) {
                raid.escapeTimer = null;
                raid.spawnTimer = null;
                if (raid.status === 'active') raid.status = 'idle';
            }
        }
    };
};

createBoss2Manager.normalizeBoss2Settings = normalizeBoss2Settings;
createBoss2Manager.parseRaidMessage = parseRaidMessage;
createBoss2Manager.collectTexts = collectTexts;
createBoss2Manager.toPlainData = toPlainData;
module.exports = createBoss2Manager;
