const CONSTANTS = require('../constants');
const log = require('../../logger');
const accountPrefix = (state) => state?.accountId ? `[account:${state.accountId}] ` : '';
const { removeInvisibleChars } = require('../utils');
const statsService = require('../services/stats');

// === Import CaptchaAsu System ===
const CaptchaAsu = require('../services/CaptchaAsu');
const NopechaSolver = require('../services/solvers/NopechaSolver');

module.exports = (state, configManager, loopManager, telegramService, channelManager, macrodroidService) => {
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const recordCaptchaDetected = () => statsService.recordCaptchaDetected(state);
    const recordCaptchaSolved = () => statsService.recordCaptchaSolved(state);

    const shouldStopSolving = (runId) => !state.hasActiveCaptcha || state.captchaSolveRunId !== runId;
    const abortActiveSolver = () => {
        if (state.captchaSolverAbortController && !state.captchaSolverAbortController.signal.aborted) {
            state.captchaSolverAbortController.abort();
        }
        state.captchaSolverAbortController = null;
    };

    // === Inisialisasi CaptchaAsu ===
    let captchaAsu = null;

    const initCaptchaAsu = () => {
        if (captchaAsu) return captchaAsu;

        const captchaConfig = state.config.captcha || {};
        const apiKeys = captchaConfig.apiKeys || {};

        captchaAsu = new CaptchaAsu({
            maxTotalTimeMs: captchaConfig.maxTotalTimeMs || 600000,
            retryPerSolver: captchaConfig.retryPerSolver || 2,
            timeoutPerAttemptMs: captchaConfig.timeoutPerAttemptMs || 30000
        });

        // Register solver yang tersedia
        if (apiKeys.NopechaSolver) {
            captchaAsu.registerSolver(new NopechaSolver(apiKeys.NopechaSolver));
        }
        // Nanti bisa ditambahkan solver lain di sini

        // Set urutan solver
        const primary = captchaConfig.primarySolver || 'NopechaSolver';
        const fallbacks = captchaConfig.fallbackSolvers || [];
        try {
            captchaAsu.setSolverOrder(primary, fallbacks);
        } catch (e) {
            log.warn(`${accountPrefix(state)}[Captcha] Gagal set solver order: ${e.message}`);
        }

        return captchaAsu;
    };

    const captchaHandler = {
        isHandlingProcess: false,

        isCaptcha(content) {
            const lowerContent = removeInvisibleChars(content).toLowerCase();
            return CONSTANTS.CAPTCHA_KEYWORDS.some(keyword => lowerContent.includes(keyword)) ||
                   /\b[1-5]\/5\b/.test(lowerContent);
        },

        async submitKeOwO(solvedToken) {
            log.info(`${accountPrefix(state)}Memulai proses auto-login (OAuth2) ke web OwO...`);
            const discordToken = state.activeToken;
            if (!discordToken) throw new Error("Discord token tidak ditemukan di state.activeToken.");

            const authUrl = "https://discord.com/api/v9/oauth2/authorize?client_id=408785106942164992&response_type=code&redirect_uri=https://owobot.com/api/auth/discord/redirect&scope=identify guilds";
            const payload = { authorize: true, integration_type: 0, permissions: "0", location_context: { guild_id: "10000", channel_id: "10000", channel_type: 10000 } };

            const oauthResp = await fetch(authUrl, {
                method: "POST",
                headers: { "Authorization": discordToken, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (oauthResp.status !== 200) throw new Error(`OAuth Discord gagal (HTTP ${oauthResp.status})`);
            const oauthJson = await oauthResp.json();
            const redirectUrl = oauthJson.location;
            if (!redirectUrl) throw new Error("Tidak mendapatkan redirect_url dari Discord");

            const redirectResp = await fetch(redirectUrl, { redirect: 'manual' });

            let owoCookies = "";
            if (redirectResp.headers.getSetCookie) {
                owoCookies = redirectResp.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
            } else {
                const setCookieStr = redirectResp.headers.get('set-cookie');
                if (setCookieStr) owoCookies = setCookieStr.split(',').map(c => c.split(';')[0]).join('; ');
            }

            const authCheckResp = await fetch("https://owobot.com/api/auth", {
                method: "GET", headers: { "Cookie": owoCookies }
            });

            if (authCheckResp.status !== 200) throw new Error(`Sesi ditolak oleh OwO (HTTP ${authCheckResp.status})`);

            log.info(`${accountPrefix(state)}Sesi valid! Menyerahkan Token hCaptcha ke OwO...`);

            const verifyResp = await fetch("https://owobot.com/api/captcha/verify", {
                method: "POST",
                headers: {
                    "Cookie": owoCookies, "Referer": "https://owobot.com/captcha",
                    "Origin": "https://owobot.com", "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token: solvedToken })
            });

            if (verifyResp.status === 200) {
                log.success(`${accountPrefix(state)}🎉 Verifikasi Captcha di server OwO BERHASIL!`);
                return true;
            } else {
                const errorText = await verifyResp.text();
                throw new Error(`OwO menolak token (HTTP ${verifyResp.status}): ${errorText}`);
            }
        },

        async handle() {
            if (this.isHandlingProcess) return;
            this.isHandlingProcess = true;

            log.captcha(`${accountPrefix(state)}⛔ CAPTCHA! Bot Paused.`);
            recordCaptchaDetected();
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            state.hasActiveCaptcha = true;
            statsService.syncBotUptime(state);
            state.captchaSolveRunId = (state.captchaSolveRunId || 0) + 1;
            const solveRunId = state.captchaSolveRunId;
            abortActiveSolver();
            state.captchaSolverAbortController = new AbortController();
            configManager.save();
            loopManager.stopAll();

            const now = Date.now();
            const cooldownMs = 5000;

            if (!state.lastCaptchaAlertTime || (now - state.lastCaptchaAlertTime > cooldownMs)) {

                telegramService.send(`🚨 <b>CAPTCHA DETEKSI!</b>\nBot: ${state.client.user.username}`);
                state.lastCaptchaAlertTime = now;

                if (state.config.autosolver) {
                    telegramService.send(`Bypass Gaib berjalan... 🤖⚡`);

                    try {
                        const asu = initCaptchaAsu();

                        if (!asu || asu.solvers.length === 0) {
                            throw new Error('Tidak ada solver yang terdaftar atau API key kosong');
                        }

                        const SITE_KEY = "a6a1d5ce-612d-472d-8e37-7601408fbc09";
                        const TARGET_URL = "https://owobot.com/captcha";

                        const solvedToken = await asu.solve(SITE_KEY, TARGET_URL, {
                            signal: state.captchaSolverAbortController?.signal
                        });

                        log.success(`${accountPrefix(state)}✅ Captcha sukses dipecahkan oleh CaptchaAsu!`);
                        await this.submitKeOwO(solvedToken);
                        await this.resume();

                    } catch (error) {
                        if (error.name === 'AbortError' || shouldStopSolving(solveRunId)) {
                            log.info(`${accountPrefix(state)}🛑 Bypass otomatis dibatalkan karena CAPTCHA selesai manual.`);
                        } else {
                            log.error(`${accountPrefix(state)}❌ CaptchaAsu Gagal: ${error.message}`);
                            telegramService.send(`❌ <b>Bypass Gagal!</b>\n${error.message}`);

                            if (macrodroidService) {
                                await macrodroidService.trigger("kena_captcha");
                            }
                        }
                    } finally {
                        if (state.captchaSolveRunId === solveRunId) {
                            state.captchaSolverAbortController = null;
                        }
                        this.isHandlingProcess = false;
                    }

                } else {
                    log.info(`${accountPrefix(state)}⏸️ Autosolver OFF. Silakan selesaikan Captcha secara manual.`);
                    telegramService.send(`ℹ️ <b>Autosolver OFF!</b>\nSilakan selesaikan Captcha secara manual.`);

                    if (macrodroidService) {
                        await macrodroidService.trigger("kena_captcha");
                    }
                    this.isHandlingProcess = false;
                }

            } else {
                log.warn(`${accountPrefix(state)}⚠️ Captcha spam terdeteksi, trigger ditahan.`);
                this.isHandlingProcess = false;
            }
        },

        async resume() {
            const wasActiveCaptcha = !!state.hasActiveCaptcha;
            state.captchaSolveRunId = (state.captchaSolveRunId || 0) + 1;
            abortActiveSolver();

            log.success(`${accountPrefix(state)}✅ Resuming Bot...`);
            telegramService.send("🎉 <b>Captcha Selesai!</b>\nAkun terbebas.");

            if (macrodroidService) {
                await macrodroidService.trigger("captcha_selesai");
            }

            state.config.botStatus.paused = false;
            state.config.botStatus.running = true;
            state.hasActiveCaptcha = false;
            statsService.syncBotUptime(state);
            if (wasActiveCaptcha) recordCaptchaSolved();
            configManager.save();
            loopManager.startAll();
        }
    };

    return captchaHandler;
};
