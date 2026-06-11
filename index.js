const startDashboard = require('./dashboard');
const log = require('./logger');

// Load state
const state = require('./src/state');
const { CookieJar } = require('tough-cookie');
state.cookieJar = new CookieJar();


// Load constants
const CONSTANTS = require('./src/constants');

// Load services
const createTelegramService = require('./src/services/telegram');
const createMacrodroidService = require('./src/services/macrodroidService');
const createConfigManager = require('./src/services/config');

// Initialize services dengan state
const telegramService = createTelegramService(state);
const macrodroidService = createMacrodroidService(state);
const configManager = createConfigManager(state);
// Load managers (dengan dependency injection)
const createChannelManager = require('./src/managers/channel');
const createBossManager = require('./src/managers/boss');
const createCaptchaHandler = require('./src/managers/captcha');
const createCommandSender = require('./src/managers/command');
const createLoopManager = require('./src/managers/loop');
const createEmergencyHandler = require('./src/managers/emergency');
const createDailyResetManager = require('./src/managers/dailyReset');
const createMessageHandler = require('./src/managers/message');
const huntbotState = require('./src/services/huntbotState');
const captchaSolver = require('./src/services/captchaSolver');  // <-- UBAH INI
const createHuntbotManager = require('./src/managers/huntbot');
const createVoiceManager = require('./src/managers/voice');

// Initialize managers dengan dependencies
const channelManager = createChannelManager(state, configManager);
const loopManagerWrapper = {
    stopAll: () => {
        if (typeof loopManager !== 'undefined' && loopManager) {
            loopManager.stopAll();
        }
    },
    startAll: () => {
        if (typeof loopManager !== 'undefined' && loopManager) {
            loopManager.startAll();
        }
    }
};

const bossManager = createBossManager(state, configManager, telegramService);
const emergencyHandler = createEmergencyHandler(state, configManager, loopManagerWrapper, channelManager, telegramService, macrodroidService);
const commandSender = createCommandSender(state, channelManager, emergencyHandler);
const loopManager = createLoopManager(state, commandSender);
const captchaHandler = createCaptchaHandler(state, configManager, loopManager, telegramService, channelManager, macrodroidService);
const dailyResetManager = createDailyResetManager(state, telegramService);
const voiceManager = createVoiceManager(state, configManager);

// huntbot 
const huntbotManager = createHuntbotManager(
    state, 
    huntbotState, 
    configManager, 
    commandSender, 
    telegramService,
    captchaSolver  // <-- LANGSUNG PAKE, tanpa ()
);

// Di bagian initialize managers
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
    commandSender,  // <-- TAMBAHKAN INI!
    voiceManager
);
///


// Load core modules
const createClientManager = require('./src/core/client');
const createPollingSystem = require('./src/core/polling');

const clientManager = createClientManager(state, configManager, channelManager, messageHandler, telegramService, huntbotManager, voiceManager);
const pollingSystem = createPollingSystem(state, configManager, clientManager, channelManager, loopManager, telegramService, voiceManager);

// --- INITIALIZATION ---
const initialize = () => {
    // Load config awal
    state.config = configManager.read() || {};
    state.activeToken = state.config.token || '';

    // Start Dashboard
    startDashboard();

    // Start Daily Reset Checker
    setInterval(() => dailyResetManager.checkAndReset(), CONSTANTS.RESET_CHECK_INTERVAL_MS);

    // Start Polling System
    pollingSystem.start();

    // Initialize Client
    clientManager.initialize();


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
