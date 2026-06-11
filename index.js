const startDashboard = require('./dashboard');
const state = require('./src/state');
const { CookieJar } = require('tough-cookie');
const createConfigManager = require('./src/services/config');
const createDailyResetManager = require('./src/managers/dailyReset');
const createTelegramService = require('./src/services/telegram');
const createMultiAccountManager = require('./src/core/multiAccount');

state.cookieJar = new CookieJar();

const configManager = createConfigManager(state);
const telegramService = createTelegramService(state);
const dailyResetManager = createDailyResetManager(state, telegramService);
const multiAccountManager = createMultiAccountManager({ rootState: state, configManager });

const initialize = () => {
    state.config = configManager.read() || {};
    state.activeToken = state.config.token || '';

    startDashboard();

    // Daily reset tetap memakai state dashboard/global, sementara runtime akun
    // masing-masing berjalan paralel lewat MultiAccountManager.
    setInterval(() => dailyResetManager.checkAndReset(), require('./src/constants').RESET_CHECK_INTERVAL_MS);

    multiAccountManager.start();
};

process.on('unhandledRejection', (reason, promise) => {
    console.log('⚠️ [ANTI-CRASH] Unhandled Rejection dihentikan:', reason.message || reason);
});

process.on('uncaughtException', (error, origin) => {
    console.log('⚠️ [ANTI-CRASH] Uncaught Exception dihentikan:', error.message || error);
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
    console.log('⚠️ [ANTI-CRASH] Uncaught Exception Monitor:', error.message || error);
});

// Start the application
initialize();
