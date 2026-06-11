const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const state = require('../state');
const runtimeStatsService = require('../services/stats');
const logger = require('../../logger');

const CONSTANTS = require('./constants');
const fileService = require('./services/fileService');
const createProfileManager = require('./services/profileManager');
const createConfigManager = require('./services/configManager');
const createLogService = require('./services/logService');
const createStatsService = require('./services/statsService');
const discordProfileService = require('./services/discordProfileService');
const createUiComponents = require('./ui/components');
const createDashboardRoutes = require('./routes');
const { escapeHtml, serializeForScript } = require('./utils/html');

function createDashboardApp({ baseDir = path.join(__dirname, '../..') } = {}) {
    const configPath = path.join(baseDir, CONSTANTS.CONFIG_FILE);
    const profileManager = createProfileManager({ baseDir, fileService });
    const configManager = createConfigManager({ configPath, fileService, CONSTANTS });
    const logService = createLogService({ logger });
    const statsService = createStatsService({ state, runtimeStatsService, configManager });
    const uiComponents = createUiComponents({
        CONSTANTS,
        serializeForScript,
        escapeHtml,
        statsService,
        configManager,
        profileManager
    });

    const app = express();
    app.use(bodyParser.urlencoded({ extended: true }));

    const initialConfig = configManager.ensureShape(configManager.get());
    const port = process.env.SERVER_PORT || process.env.PORT || initialConfig.port || CONSTANTS.DEFAULT_PORT;

    console.log(`[DASHBOARD] Initial port check: PORT=${port}, initialConfig.port=${initialConfig.port}`);

    app.use(createDashboardRoutes({
        configManager,
        fileService,
        profileManager,
        uiComponents,
        logService,
        statsService,
        discordProfileService,
        state
    }));

    return { app, port };
}

module.exports = createDashboardApp;
