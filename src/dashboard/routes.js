const express = require('express');
const fs = require('fs');
function createDashboardRoutes({ configManager, fileService, profileManager, uiComponents, logService, statsService, discordProfileService, state }) {
    const router = express.Router();


    const getProfileConfigByAccountId = (accountId) => {
        const id = String(accountId || '');
        const mainConfig = configManager.ensureShape(configManager.get());
        const mainId = profileManager.getUserId(mainConfig.token);
        if (id === mainId) {
            return { config: mainConfig, saveTarget: 'main', filePath: null };
        }

        const profilePath = profileManager.getProfilePath(id);
        if (!fs.existsSync(profilePath)) return null;
        return {
            config: configManager.ensureShape(fileService.readJson(profilePath)),
            saveTarget: profilePath,
            filePath: profilePath
        };
    };

    const saveAccountConfig = (target, config) => {
        if (!target) return false;
        const saved = target.saveTarget === 'main'
            ? configManager.save(config)
            : fileService.writeJson(target.saveTarget, config);
        if (saved && target.saveTarget === 'main') {
            const activeId = profileManager.getUserId(config.token);
            if (activeId !== 'default') {
                fileService.writeJson(profileManager.getProfilePath(activeId), config);
            }
        }
        return saved;
    };

    const setAccountStatus = (accountId, shouldRun) => {
        const target = getProfileConfigByAccountId(accountId);
        if (!target) return false;
        target.config.botStatus = { running: !!shouldRun, paused: !shouldRun };
        const saved = saveAccountConfig(target, target.config);
        const manager = state?.multiAccountManager;
        if (manager) {
            if (typeof manager.reconcile === 'function') manager.reconcile();
            if (shouldRun && typeof manager.startAccount === 'function') manager.startAccount(accountId);
            if (!shouldRun && typeof manager.pauseAccount === 'function') manager.pauseAccount(accountId);
        }
        return saved;
    };

    const setAllAccountStatuses = (shouldRun) => {
        const mainConfig = configManager.ensureShape(configManager.get());
        const ids = new Set(profileManager.getSavedProfiles());
        const mainId = profileManager.getUserId(mainConfig.token);
        if (mainId !== 'default') ids.add(mainId);
        if (!ids.size) {
            mainConfig.botStatus = { running: !!shouldRun, paused: !shouldRun };
            configManager.save(mainConfig);
        }
        ids.forEach(id => setAccountStatus(id, shouldRun));
        const manager = state?.multiAccountManager;
        if (manager && typeof manager.reconcile === 'function') manager.reconcile();
    };

    router.get('/api/profile', async (req, res) => {
        const config = configManager.get();
        let token = config.token;

        if (req.query.profileId) {
            const profilePath = profileManager.getProfilePath(String(req.query.profileId));
            if (fs.existsSync(profilePath)) {
                const profileConfig = fileService.readJson(profilePath);
                token = profileConfig.token || token;
            }
        }
        
        if (!token) return res.status(400).json({ error: 'Tidak ada token.' });

        try {
            const parsedData = await discordProfileService.fetchCurrentProfile(token);
            if (parsedData && parsedData.id && parsedData.username) {
                profileManager.saveProfileMeta(
                    parsedData.id,
                    parsedData.username,
                    parsedData.global_name,
                    parsedData.avatar
                );
            }
            res.json(parsedData);
        } catch (error) {
            console.error('API Profile Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', (req, res) => {
        console.log('[DASHBOARD] GET / - Rendering dashboard');
        try {
            let config = configManager.ensureShape(configManager.get());
            if (req.query.profileId) {
                const profilePath = profileManager.getProfilePath(String(req.query.profileId));
                if (fs.existsSync(profilePath)) {
                    config = configManager.ensureShape(fileService.readJson(profilePath));
                    config.viewingProfileId = String(req.query.profileId);
                    config.globalBotStatus = configManager.ensureShape(configManager.get()).botStatus;
                }
            }
            const html = uiComponents.renderPage(config);
            console.log('[DASHBOARD] Dashboard HTML generated, size:', html.length, 'bytes');
            res.send(html);
        } catch (error) {
            console.error('[DASHBOARD] Error rendering dashboard:', error);
            res.status(500).send(`<pre>Error: ${error.message}\n${error.stack}</pre>`);
        }
    });

    router.get('/logs', (req, res) => {
        try {
            let accountId = req.query.accountId ? String(req.query.accountId) : '';
            if (!accountId && req.query.profileId) accountId = String(req.query.profileId);
            const lines = logService.getRecentLines({ accountId });
            res.setHeader('Cache-Control', 'no-store');
            res.json({ lines, accountId: accountId || null, filterMode: accountId ? 'prefix-or-id' : 'all' });
        } catch {
            res.status(500).json({ lines: [] });
        }
    });

    router.post('/account/:accountId/start', (req, res) => {
        const accountId = String(req.params.accountId || '');
        const saved = setAccountStatus(accountId, true);
        if (!saved) return res.status(404).send('Account not found');
        res.redirect(req.get('referer') || `/?profileId=${encodeURIComponent(accountId)}`);
    });

    router.post('/account/:accountId/pause', (req, res) => {
        const accountId = String(req.params.accountId || '');
        const saved = setAccountStatus(accountId, false);
        if (!saved) return res.status(404).send('Account not found');
        res.redirect(req.get('referer') || `/?profileId=${encodeURIComponent(accountId)}`);
    });

    router.get('/api/stats', (req, res) => {
        try {
            let config = configManager.ensureShape(configManager.get());
            if (req.query.profileId) {
                const profilePath = profileManager.getProfilePath(String(req.query.profileId));
                if (fs.existsSync(profilePath)) {
                    config = configManager.ensureShape(fileService.readJson(profilePath));
                }
            }
            const snapshot = statsService.getSnapshot(config);
            snapshot.captcha.lastDetectedAtFormatted = statsService.formatTime(snapshot.captcha.lastDetectedAt);
            snapshot.captcha.lastSolvedAtFormatted = statsService.formatTime(snapshot.captcha.lastSolvedAt);
            snapshot.commands.recent = (snapshot.commands.recent || []).map(item => ({
                ...item,
                atFormatted: statsService.formatTime(item.at)
            }));
            res.setHeader('Cache-Control', 'no-store');
            res.json(snapshot);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/export-config', (req, res) => {
        try {
            const config = configManager.ensureShape(configManager.get());
            const activeId = profileManager.getUserId(config.token);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `owo-config-${activeId}-${timestamp}.json`;

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Cache-Control', 'no-store');
            res.send(JSON.stringify(config, null, 2));
        } catch (error) {
            res.status(500).send(`Failed to export config: ${error.message}`);
        }
    });

    router.post('/save', (req, res) => {
        try {
            const body = req.body;
            
            if (body.action === 'loadProfile') {
                const targetId = body.selectedProfile;
                if (targetId) {
                    const profilePath = profileManager.getProfilePath(targetId);
                    if (fs.existsSync(profilePath)) {
                        const loadedConfig = fileService.readJson(profilePath);
                        configManager.save(loadedConfig); 
                        console.log(`[PROFILE] Akun ${targetId} berhasil dimuat.`);
                    }
                }
                return res.send(uiComponents.getSavedResponse());
            }

            if (body.action === 'newProfile') {
                const newToken = body.newToken;
                if (newToken) {
                    const targetId = profileManager.getUserId(newToken);
                    const profilePath = profileManager.getProfilePath(targetId);
                    
                    let currentConfig = configManager.ensureShape(configManager.get());
                    let newConfig = JSON.parse(JSON.stringify(currentConfig));
                    newConfig.token = newToken;
                    
                    fileService.writeJson(profilePath, newConfig);
                    console.log(`[PROFILE] Profil baru untuk akun ${targetId} berhasil dibuat dan akan dijalankan paralel bila masuk slot.`);
                }
                return res.send(uiComponents.getSavedResponse());
            }

            if (body.profileAction) {
                const [action, accountId] = String(body.profileAction).split(':');
                if (accountId && (action === 'start' || action === 'pause')) {
                    setAccountStatus(accountId, action === 'start');
                    return res.send(uiComponents.getSavedResponse());
                }
            }

            const viewingProfileId = body.viewingProfileId ? String(body.viewingProfileId) : '';
            if (viewingProfileId && (body.action === 'startProfile' || body.action === 'pauseProfile')) {
                setAccountStatus(viewingProfileId, body.action === 'startProfile');
                return res.send(uiComponents.getSavedResponse());
            }

            const isGlobalAction = body.action === 'start' || body.action === 'pause';
            let config;
            let saveTarget = 'main';

            if (viewingProfileId && !isGlobalAction) {
                const profilePath = profileManager.getProfilePath(viewingProfileId);
                config = configManager.ensureShape(fs.existsSync(profilePath) ? fileService.readJson(profilePath) : configManager.get());
                config = configManager.applySave(config, body);
                saveTarget = profilePath;
            } else {
                config = configManager.ensureShape(configManager.get());
                if (!isGlobalAction) {
                    config = configManager.applySave(config, body);
                    config = configManager.applyAction(config, body.action);
                } else {
                    setAllAccountStatuses(body.action === 'start');
                    return res.send(uiComponents.getSavedResponse());
                }
            }
            
            const saved = saveTarget === 'main'
                ? configManager.save(config)
                : fileService.writeJson(saveTarget, config);

            if (saved) {
                if (saveTarget === 'main') {
                    const activeId = profileManager.getUserId(config.token);
                    if (activeId !== 'default') {
                        fileService.writeJson(profileManager.getProfilePath(activeId), config);
                    }
                }
                res.send(uiComponents.getSavedResponse());
            } else {
                res.status(500).send('Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    return router;
}

module.exports = createDashboardRoutes;
