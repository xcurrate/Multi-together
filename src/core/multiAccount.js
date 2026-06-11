const fs = require('fs');
const path = require('path');
const createAccountRuntime = require('./accountRuntime');
const statsService = require('../services/stats');
const log = require('../../logger');

const DEFAULT_MAX_ACCOUNTS = 4;

const readJson = (filePath, fallback = null) => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
};

const writeJson = (filePath, value) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const getAccountIdFromToken = createAccountRuntime.getAccountIdFromToken;

module.exports = function createMultiAccountManager({ rootState, baseDir = process.cwd(), configManager }) {
    const configPath = path.join(baseDir, 'config.json');
    const profilesDir = path.join(baseDir, 'profiles');
    const runtimes = new Map();
    rootState.accountRuntimes = runtimes;

    let lastGlobalStatus = null;

    function readMainConfig() {
        const config = configManager.read() || readJson(configPath, {}) || {};
        rootState.config = config;
        rootState.activeToken = config.token || '';
        rootState.multiAccount = config.multiAccount || { enabled: true, maxAccounts: DEFAULT_MAX_ACCOUNTS };
        return config;
    }

    function discoverAccountConfigs(mainConfig) {
        const maxAccounts = Math.max(1, Math.min(DEFAULT_MAX_ACCOUNTS, parseInt(mainConfig.multiAccount?.maxAccounts, 10) || DEFAULT_MAX_ACCOUNTS));
        const configsById = new Map();

        const addConfig = (config, filePath) => {
            if (!config?.token || String(config.token).length <= 20) return;
            const accountId = getAccountIdFromToken(config.token);
            if (configsById.has(accountId)) return;
            configsById.set(accountId, {
                accountId,
                config: {
                    ...config,
                    botStatus: { ...(mainConfig.botStatus || { running: false, paused: true }) }
                },
                filePath
            });
        };

        addConfig(mainConfig, configPath);

        if (fs.existsSync(profilesDir)) {
            fs.readdirSync(profilesDir)
                .filter(file => file.startsWith('config_') && file.endsWith('.json'))
                .sort()
                .forEach(file => addConfig(readJson(path.join(profilesDir, file)), path.join(profilesDir, file)));
        }

        return Array.from(configsById.values()).slice(0, maxAccounts);
    }

    function reconcile() {
        const mainConfig = readMainConfig();
        const desired = discoverAccountConfigs(mainConfig);
        const desiredIds = new Set(desired.map(item => item.accountId));

        for (const [accountId, runtime] of runtimes.entries()) {
            if (!desiredIds.has(accountId)) {
                log.warn(`🧹 Akun ${accountId} tidak lagi masuk slot paralel, sesi ditutup.`);
                runtime.destroy();
                runtimes.delete(accountId);
            }
        }

        for (const item of desired) {
            const existing = runtimes.get(item.accountId);
            if (existing) {
                existing.reloadConfig(item.config);
                existing.filePath = item.filePath;
            } else {
                runtimes.set(item.accountId, createAccountRuntime({
                    config: item.config,
                    filePath: item.filePath,
                    sharedStats: rootState.stats
                }));
            }
        }

        const globalStatus = JSON.stringify(mainConfig.botStatus || {});
        const statusChanged = globalStatus !== lastGlobalStatus;
        lastGlobalStatus = globalStatus;

        const shouldRun = !!mainConfig.botStatus?.running && !mainConfig.botStatus?.paused;
        for (const runtime of runtimes.values()) {
            runtime.state.config.botStatus = { running: shouldRun, paused: !shouldRun };
            statsService.syncBotUptime(runtime.state);
            if (shouldRun) {
                runtime.start();
            } else if (statusChanged) {
                runtime.pause();
            }
        }

        syncDashboardState();
    }

    function syncDashboardState() {
        const firstReady = Array.from(runtimes.values()).find(runtime => runtime.state.client?.isReady());
        const selected = firstReady || Array.from(runtimes.values())[0];
        if (!selected) return;

        rootState.activeChannelId = selected.state.activeChannelId;
        rootState.hasActiveCaptcha = Array.from(runtimes.values()).some(runtime => runtime.state.hasActiveCaptcha);
        rootState.client = selected.state.client;
    }

    function persistSlotsToMainConfig() {
        const mainConfig = readMainConfig();
        mainConfig.multiAccount = mainConfig.multiAccount || {};
        mainConfig.multiAccount.enabled = true;
        mainConfig.multiAccount.maxAccounts = Math.max(1, Math.min(DEFAULT_MAX_ACCOUNTS, parseInt(mainConfig.multiAccount.maxAccounts, 10) || DEFAULT_MAX_ACCOUNTS));
        writeJson(configPath, mainConfig);
        rootState.config = mainConfig;
        return mainConfig;
    }

    return {
        start() {
            persistSlotsToMainConfig();
            reconcile();
            setInterval(reconcile, 2000);
            setInterval(syncDashboardState, 1000);
        },
        getRuntimes() {
            return runtimes;
        }
    };
};
