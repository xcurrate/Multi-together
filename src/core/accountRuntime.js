const path = require('path');
const fs = require('fs');

const createTelegramService = require('../services/telegram');
const createMacrodroidService = require('../services/macrodroidService');
const createChannelManager = require('../managers/channel');
const createBossManager = require('../managers/boss');
const createCaptchaHandler = require('../managers/captcha');
const createCommandSender = require('../managers/command');
const createLoopManager = require('../managers/loop');
const createEmergencyHandler = require('../managers/emergency');
const createMessageHandler = require('../managers/message');
const createHuntbotManager = require('../managers/huntbot');
const createVoiceManager = require('../managers/voice');
const createClientManager = require('./client');
const captchaSolver = require('../services/captchaSolver');
const log = require('../../logger');
const CONSTANTS = require('../constants');
const { safeJsonStringify } = require('../utils');

const getAccountIdFromToken = (token) => {
    if (!token || typeof token !== 'string') return 'default';
    try {
        const base64Id = token.split('.')[0];
        const padded = base64Id + '='.repeat((4 - base64Id.length % 4) % 4);
        const decodedId = Buffer.from(padded, 'base64').toString('utf8');
        return /^\d{17,20}$/.test(decodedId) ? decodedId : 'default';
    } catch {
        return 'default';
    }
};

const ensureRuntimeShape = (config = {}) => {
    config.settings = config.settings || {};
    config.settings.voice = config.settings.voice || { enabled: false, channelId: '' };
    config.settings.channelRotation = config.settings.channelRotation || { enabled: false, minMs: 180000, maxMs: 360000 };
    config.settings.control = config.settings.control || { start: 'wcash', pause: 'wbuy 1', allowIds: [] };
    config.settings.boss = config.settings.boss || { enabled: true, allowedGuilds: [] };
    config.settings.messageFilter = config.settings.messageFilter || { enabled: true, channelIds: [], guildIds: [], debug: false, debugOnlyOwO: false };
    config.settings.telegram = config.settings.telegram || { token: '', chatId: '' };
    config.settings.huntbot = config.settings.huntbot || { enabled: true };
    config.botStatus = config.botStatus || { running: false, paused: true };
    config.channels = Array.isArray(config.channels) ? config.channels : [];
    config.tiketandhb = config.tiketandhb || { channelId: '' };
    config.safety = config.safety || { cctv: false };
    config.delays = config.delays || {};
    Object.keys(CONSTANTS.DEFAULT_DELAYS || {}).forEach(key => {
        config.delays[key] = {
            ...CONSTANTS.DEFAULT_DELAYS[key],
            ...(config.delays[key] || {})
        };
    });
    config.huntbot = config.huntbot || { enabled: true, autoMode: true, defaultUpgrade: 'duration', defaultDuration: '1D', notifyProgress: true };
    config.captcha = config.captcha || {};
    return config;
};

const createRuntimeState = ({ config, sharedStats }) => ({
    client: null,
    config: ensureRuntimeShape(config),
    activeToken: config.token || '',
    activeChannelId: null,
    stopBossHunt: false,
    lastRefillTimestamp: 0,
    foughtBosses: new Set(),
    bossCooldowns: new Map(),
    bossRespawnTimers: new Map(),
    responseTimeout: null,
    hasActiveCaptcha: false,
    hasRunInitialReadyCommands: false,
    isStartupReadyRoutine: false,
    hasUsedFirstLoopStartupStagger: false,
    isBusy: false,
    nextAt: {},
    startupJitterMs: Math.floor(Math.random() * 4500),
    captchaSolverAbortController: null,
    captchaSolveRunId: 0,
    stats: sharedStats,
    channelRotateTimer: null,
    lastChannelId: null,
    lastTicketCheck: 0,
    loops: {
        battle: null,
        hunt: null,
        pray: null,
        custom1: null,
        custom2: null
    }
});

const createRuntimeConfigManager = (state, filePath) => ({
    read() {
        try {
            return ensureRuntimeShape(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        } catch {
            return state.config;
        }
    },

    save() {
        ensureRuntimeShape(state.config);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(state.config, null, 2));
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
            startCmd: String(ctrl.start || 'wo').toLowerCase(),
            pauseCmd: String(ctrl.pause || 'winv').toLowerCase(),
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

const createHuntbotState = () => ({
    autoMode: false,
    activeHunt: null,
    pendingCaptcha: null,
    lastUpgradeLevel: null,
    lastProgress: null,
    lastResponse: null,
    monitorInterval: null,
    notifiedSoon: false
});

module.exports = function createAccountRuntime({ config, filePath, sharedStats }) {
    const accountId = getAccountIdFromToken(config.token);
    const state = createRuntimeState({ config, sharedStats });
    state.accountId = accountId;
    const configManager = createRuntimeConfigManager(state, filePath);
    const telegramService = createTelegramService(state);
    const macrodroidService = createMacrodroidService(state);
    const channelManager = createChannelManager(state, configManager);
    const loopManagerWrapper = {
        stopAll: () => loopManager && loopManager.stopAll(),
        startAll: () => loopManager && loopManager.startAll()
    };
    const bossManager = createBossManager(state, configManager, telegramService);
    const emergencyHandler = createEmergencyHandler(state, configManager, loopManagerWrapper, channelManager, telegramService, macrodroidService);
    const commandSender = createCommandSender(state, channelManager, emergencyHandler);
    const loopManager = createLoopManager(state, commandSender);
    const captchaHandler = createCaptchaHandler(state, configManager, loopManager, telegramService, channelManager, macrodroidService);
    const voiceManager = createVoiceManager(state, configManager);
    const huntbotManager = createHuntbotManager(state, createHuntbotState(), configManager, commandSender, telegramService, captchaSolver);
    const messageHandler = createMessageHandler(
        state,
        configManager,
        bossManager,
        captchaHandler,
        loopManager,
        channelManager,
        telegramService,
        macrodroidService,
        huntbotManager,
        commandSender,
        voiceManager
    );
    const clientManager = createClientManager(state, configManager, channelManager, messageHandler, telegramService, huntbotManager, voiceManager);

    let readyLoopWatcher = null;
    let runtimeRunning = false;
    let loopsActive = false;
    let loopConfigSignature = '';

    const getLoopConfigSignature = (nextConfig = state.config) => safeJsonStringify({
        channels: nextConfig.channels || [],
        delays: nextConfig.delays || {},
        commands: {
            battle: nextConfig.settings?.battle,
            hunt: nextConfig.settings?.hunt,
            pray: nextConfig.settings?.pray,
            custom: nextConfig.settings?.custom,
            text1: nextConfig.settings?.text1,
            text2: nextConfig.settings?.text2
        },
        rotation: nextConfig.settings?.channelRotation || {}
    });

    const originalLoopStartAll = loopManager.startAll.bind(loopManager);
    const originalLoopStopAll = loopManager.stopAll.bind(loopManager);
    loopManager.startAll = () => {
        originalLoopStartAll();
        loopsActive = true;
        loopConfigSignature = getLoopConfigSignature();
    };
    loopManager.stopAll = () => {
        originalLoopStopAll();
        loopsActive = false;
    };

    const joinConfiguredVoice = (source) => {
        if (!state.client?.isReady()) return;
        voiceManager.joinConfigured(source).catch(err => log.error(`[account:${accountId}] ❌ Auto Join VC gagal: ${err.message}`));
    };

    const activateReadyRuntime = (source = 'start') => {
        if (!state.client?.isReady()) return false;
        const nextLoopSignature = getLoopConfigSignature();
        if (!loopsActive || nextLoopSignature !== loopConfigSignature) {
            loopManager.startAll();
            loopConfigSignature = nextLoopSignature;
            loopsActive = true;
        }
        channelManager.scheduleRotation();
        joinConfiguredVoice(source);
        return true;
    };

    const startLoopsWhenReady = () => {
        if (readyLoopWatcher) clearInterval(readyLoopWatcher);
        readyLoopWatcher = setInterval(() => {
            if (!state.config.botStatus?.running || state.config.botStatus?.paused) {
                clearInterval(readyLoopWatcher);
                readyLoopWatcher = null;
                return;
            }
            if (state.client?.isReady()) {
                activateReadyRuntime('ready');
                clearInterval(readyLoopWatcher);
                readyLoopWatcher = null;
            }
        }, 1000);
    };

    return {
        accountId,
        filePath,
        state,
        configManager,
        clientManager,
        channelManager,
        loopManager,
        voiceManager,
        getDisplayName() {
            return state.client?.user?.tag || accountId;
        },
        connect() {
            const statusChanged = !!state.config.botStatus?.running || !state.config.botStatus?.paused;
            runtimeRunning = false;
            state.config.botStatus = { running: false, paused: true };
            if (statusChanged) configManager.save();
            if (readyLoopWatcher) {
                clearInterval(readyLoopWatcher);
                readyLoopWatcher = null;
            }
            loopManager.stopAll();
            loopsActive = false;
            channelManager.stopRotation();

            if (!state.client) {
                log.info(`[account:${accountId}] 🔌 Connect/Login akun tanpa start loop.`);
                clientManager.initialize();
                return true;
            }

            if (!state.client.isReady()) {
                log.info(`[account:${accountId}] 🔌 Client sudah ada, menunggu ready tanpa start loop.`);
                return true;
            }

            log.info(`[account:${accountId}] ✅ Client sudah ready, tetap paused; loop tidak dijalankan.`);
            channelManager.updateActive();
            return true;
        },
        start() {
            const wasRuntimeRunning = runtimeRunning;
            const statusChanged = !state.config.botStatus?.running || !!state.config.botStatus?.paused;
            runtimeRunning = true;
            state.config.botStatus = { running: true, paused: false };
            if (statusChanged) configManager.save();

            if (!state.client) {
                log.info(`[account:${accountId}] 🚀 Menjalankan akun paralel: ${accountId}`);
                clientManager.initialize();
                startLoopsWhenReady();
                return;
            }

            if (!state.client.isReady()) {
                if (!wasRuntimeRunning) {
                    log.info(`[account:${accountId}] ▶️ Resume diminta; menunggu sesi Discord yang sudah ada siap tanpa login ulang.`);
                }
                startLoopsWhenReady();
                return;
            }

            if (!wasRuntimeRunning || !loopsActive) {
                if (!wasRuntimeRunning) log.info(`[account:${accountId}] ▶️ Melanjutkan loop akun paralel: ${accountId}`);
                activateReadyRuntime(wasRuntimeRunning ? 'reconcile' : 'start');
            }
        },
        pause() {
            const wasRuntimeRunning = runtimeRunning;
            const statusChanged = !!state.config.botStatus?.running || !state.config.botStatus?.paused;
            runtimeRunning = false;
            state.config.botStatus = { running: false, paused: true };
            if (statusChanged) configManager.save();
            if (!wasRuntimeRunning && !loopsActive) return;
            if (wasRuntimeRunning) log.info(`[account:${accountId}] ⏸ Menjeda akun paralel: ${accountId}`);
            loopManager.stopAll();
            loopsActive = false;
            channelManager.stopRotation();
        },
        destroy() {
            this.pause();
            if (readyLoopWatcher) clearInterval(readyLoopWatcher);
            readyLoopWatcher = null;
            if (state.client) {
                try { state.client.destroy(); } catch (error) { log.warn(`Gagal destroy client ${accountId}: ${error.message}`); }
                state.client = null;
            }
        },
        reloadConfig(nextConfig) {
            const oldConfig = state.config;
            const oldToken = state.activeToken;
            const oldLoopSignature = getLoopConfigSignature(oldConfig);
            const oldVoice = safeJsonStringify(oldConfig.settings?.voice || {});
            const oldChannels = safeJsonStringify(oldConfig.channels || []);
            const oldStatus = safeJsonStringify(oldConfig.botStatus || {});

            state.config = ensureRuntimeShape(nextConfig);
            state.activeToken = state.config.token || '';

            const tokenChanged = oldToken !== state.activeToken;
            const voiceChanged = oldVoice !== safeJsonStringify(state.config.settings?.voice || {});
            const channelsChanged = oldChannels !== safeJsonStringify(state.config.channels || []);
            const statusChanged = oldStatus !== safeJsonStringify(state.config.botStatus || {});
            const loopConfigChanged = oldLoopSignature !== getLoopConfigSignature(state.config);

            if (tokenChanged) {
                log.warn(`[account:${accountId}] Token berubah, runtime akan dibuat ulang.`);
                this.destroy();
                return;
            }

            if (statusChanged) log.info(`[account:${accountId}] 🔁 Status config berubah: running=${!!state.config.botStatus?.running}, paused=${!!state.config.botStatus?.paused}`);
            if (channelsChanged) log.info(`[account:${accountId}] 📡 Config channel berubah (${(state.config.channels || []).length} channel).`);
            if (voiceChanged) log.info(`[account:${accountId}] 🔊 Config voice berubah: enabled=${state.config.settings?.voice?.enabled === true}, channel=${state.config.settings?.voice?.channelId || '-'}`);
            if (loopConfigChanged && !channelsChanged) log.info(`[account:${accountId}] ⚙️ Config loop/delay berubah.`);

            if (!runtimeRunning || !state.client?.isReady()) return;

            if (channelsChanged) channelManager.updateActive();
            if (loopConfigChanged || channelsChanged) {
                loopsActive = false;
                activateReadyRuntime('config');
            } else if (voiceChanged) {
                joinConfiguredVoice('config');
            }
        }
    };
};

module.exports.getAccountIdFromToken = getAccountIdFromToken;
module.exports.ensureRuntimeShape = ensureRuntimeShape;
