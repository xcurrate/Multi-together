const express = require('express');
const fs = require('fs');
function createDashboardRoutes({ configManager, fileService, profileManager, uiComponents, logService, statsService, discordProfileService }) {
    const router = express.Router();

    router.get('/api/profile', async (req, res) => {
        const config = configManager.get();
        const token = config.token;
        
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
            const config = configManager.ensureShape(configManager.get());
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
            const lines = logService.getRecentLines();
            res.setHeader('Cache-Control', 'no-store');
            res.json({ lines });
        } catch {
            res.status(500).json({ lines: [] });
        }
    });

    router.get('/api/stats', (req, res) => {
        try {
            const config = configManager.ensureShape(configManager.get());
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
                    
                    configManager.save(newConfig);
                    fileService.writeJson(profilePath, newConfig);
                    console.log(`[PROFILE] Profil baru untuk akun ${targetId} berhasil dibuat dengan pengaturan dari akun saat ini.`);
                }
                return res.send(uiComponents.getSavedResponse());
            }

            let config = configManager.ensureShape(configManager.get());
            config = configManager.applySave(config, body);
            config = configManager.applyAction(config, body.action);
            
            if (configManager.save(config)) {
                const activeId = profileManager.getUserId(config.token);
                if (activeId !== 'default') {
                    fileService.writeJson(profileManager.getProfilePath(activeId), config);
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
