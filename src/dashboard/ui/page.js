const fs = require('fs');
const fileService = require('../services/fileService');
module.exports = function createPageRenderer({ CONSTANTS, configManager, profileManager, statsService, getStyles, getDashboardStatsCard, getLogCard, getLogRefreshScript, renderSettingsTabs }) {
function renderPage(config) {
        console.log('[DASHBOARD] Rendering page with config:', { port: config.port, token: config.token ? '***' : 'MISSING' });

        const { statusText, statusClass } = configManager.computeStatus(config);
        const channels = config.channels || [];
        const custom1 = config.delays.custom1 || CONSTANTS.DEFAULT_DELAYS.custom1;
        const custom2 = config.delays.custom2 || CONSTANTS.DEFAULT_DELAYS.custom2;
        const hasTelegram = config.settings?.telegram?.token && config.settings?.telegram?.chatId;

        const huntbot = config.huntbot || {};
        const control = config.settings.control || {};
        const rotation = config.settings.channelRotation || {};
        const boss = config.settings.boss || {};
        const msgFilter = config.settings.messageFilter || {};
        const voice = config.settings.voice || {};
        const statsSnapshot = statsService.getSnapshot(config);
        const viewingProfileId = config.viewingProfileId || '';

        const profiles = profileManager.getSavedProfiles();
        const activeProfileId = profileManager.getUserId(config.token);
        const profileOptions = profiles.map(id => {
            const profilePath = profileManager.getProfilePath(id);
            const profileConfig = fs.existsSync(profilePath)
                ? configManager.ensureShape(fileService.readJson(profilePath))
                : null;
            const profileStatus = profileConfig?.botStatus || { running: false, paused: true };
            const isRunning = !!profileStatus.running && !profileStatus.paused;
            return {
                id,
                meta: profileManager.getProfileMeta(id),
                displayName: profileManager.getProfileDisplayName(id),
                isActive: id === activeProfileId,
                isViewing: id === viewingProfileId,
                running: isRunning,
                paused: !isRunning,
                statusText: isRunning ? 'START' : 'PAUSE',
                statusClass: isRunning ? 'running' : 'paused'
            };
        });

        // Captcha config
        const captchaConfig = config.captcha || {};
        const nopechaKey = (captchaConfig.apiKeys && captchaConfig.apiKeys.NopechaSolver) || '';
        const twoCaptchaKey = (captchaConfig.apiKeys && captchaConfig.apiKeys.TwoCaptchaSolver) || '';
        const fallbackSolvers = captchaConfig.fallbackSolvers || [];

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OWO FARMING</title>
            ${getStyles()}
        </head>
        <body>
            <div class="container">
                <h2>OWO Farming Dashboard</h2>
                <div class="subtitle">Panel ringkas, nyaman, dan ringan untuk monitoring bot. ${viewingProfileId ? `Sedang melihat akun: ${viewingProfileId}` : ''}</div>

                <form action="/save" method="POST">
                    ${viewingProfileId ? `<input type="hidden" name="viewingProfileId" value="${viewingProfileId}">` : ''}
                    <div class="action-group">
                        ${viewingProfileId ? '<button type="submit" name="action" value="connectProfile" class="btn btn-connect">🔌 CONNECT / LOGIN</button>' : ''}
                        <button type="submit" name="action" value="${viewingProfileId ? 'startProfile' : 'start'}" class="btn btn-start">▶ ${viewingProfileId ? 'START / RESUME COMMANDS' : 'START ALL COMMANDS'}</button>
                        <button type="submit" name="action" value="${viewingProfileId ? 'pauseProfile' : 'pause'}" class="btn btn-pause">⏸ ${viewingProfileId ? 'PAUSE COMMANDS' : 'PAUSE ALL COMMANDS'}</button>
                        <button type="submit" name="action" value="joinVoice" class="btn btn-voice">🔊 JOIN VOICE</button>
                    </div>

                    ${renderSettingsTabs({
                        config,
                        profileOptions,
                        channels,
                        custom1,
                        custom2,
                        huntbot,
                        control,
                        rotation,
                        boss,
                        msgFilter,
                        voice,
                        captchaConfig,
                        nopechaKey,
                        twoCaptchaKey,
                        fallbackSolvers
                    })}
                    <button type="submit" name="action" value="save" class="btn btn-save" style="margin-top: 10px;">💾 SAVE CONFIGURATION</button>
                </form>

                <div class="status-box ${statusClass}">
                    <span style="font-size: 16px;">${statusText}</span>

                    <div id="userProfileBox" class="profile-box">
                        ⏳ Menghubungi Discord API...
                    </div>

                    ${hasTelegram ? '<div class="telegram-badge">📱 Telegram Active</div>' : ''}
                </div>

                ${getDashboardStatsCard(statsSnapshot)}
                ${getLogCard()}
            </div>

            ${getLogRefreshScript(profileOptions, viewingProfileId)}
        </body>
        </html>
        `;
    }

    return renderPage;
};
