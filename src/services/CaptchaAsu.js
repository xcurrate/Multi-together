const log = require('../../logger');

/**
 * CaptchaAsu - Multi Solver Orchestrator dengan Sequential Fallback
 * Versi lengkap dengan dukungan multiple fallback
 */
class CaptchaAsu {
    constructor(config = {}) {
        this.solvers = new Map(); // name -> solver instance
        this.primarySolverName = null;
        this.fallbackSolverNames = [];

        this.maxTotalTimeMs = config.maxTotalTimeMs || 10 * 60 * 1000;
        this.retryPerSolver = config.retryPerSolver || 2;
        this.timeoutPerAttemptMs = config.timeoutPerAttemptMs || 30000;

        this.stats = {
            totalAttempts: 0,
            success: 0,
            failed: 0,
            bySolver: {}
        };
    }

    registerSolver(solverInstance) {
        if (!solverInstance || typeof solverInstance.solve !== 'function') {
            throw new Error('Solver harus memiliki method solve()');
        }
        const name = solverInstance.getName();
        this.solvers.set(name, solverInstance);
        this.stats.bySolver[name] = { success: 0, failed: 0 };
        log.info(`[CaptchaAsu] Solver registered: ${name}`);
    }

    setSolverOrder(primaryName, fallbackNames = []) {
        if (!this.solvers.has(primaryName)) {
            throw new Error(`Primary solver "${primaryName}" belum diregister`);
        }

        this.primarySolverName = primaryName;
        this.fallbackSolverNames = fallbackNames.filter(name => this.solvers.has(name));

        log.info(`[CaptchaAsu] Primary: ${primaryName}`);
        if (this.fallbackSolverNames.length > 0) {
            log.info(`[CaptchaAsu] Fallbacks: ${this.fallbackSolverNames.join(' → ')}`);
        }
    }

    async solve(sitekey, url, options = {}) {
        const startTime = Date.now();
        this.stats.totalAttempts++;

        const solverOrder = [this.primarySolverName, ...this.fallbackSolverNames]
            .filter(Boolean)
            .filter((name, index, arr) => arr.indexOf(name) === index); // unique

        if (solverOrder.length === 0) {
            throw new Error('Tidak ada solver yang terdaftar');
        }

        for (const solverName of solverOrder) {
            const solver = this.solvers.get(solverName);
            if (!solver) continue;

            const solverStartTime = Date.now();

            for (let attempt = 1; attempt <= this.retryPerSolver; attempt++) {
                // Cek total time
                if (Date.now() - startTime > this.maxTotalTimeMs) {
                    throw new Error('Total solve time exceeded maximum limit (10 minutes)');
                }

                try {
                    log.info(`[CaptchaAsu] Mencoba ${solverName} (attempt ${attempt}/${this.retryPerSolver})`);

                    const token = await Promise.race([
                        solver.solve(sitekey, url, options),
                        this._createTimeout(this.timeoutPerAttemptMs, solverName)
                    ]);

                    const duration = ((Date.now() - solverStartTime) / 1000).toFixed(1);
                    log.success(`[CaptchaAsu] ✅ Berhasil dengan ${solverName} dalam ${duration}s`);

                    this.stats.success++;
                    this.stats.bySolver[solverName].success++;

                    return token;

                } catch (error) {
                    const isAbort = error.name === 'AbortError';
                    const isTimeout = error.message.includes('timeout');

                    if (isAbort) {
                        log.info(`[CaptchaAsu] ${solverName} dibatalkan (manual solve)`);
                        throw error;
                    }

                    log.warn(`[CaptchaAsu] ${solverName} gagal (attempt ${attempt}): ${error.message}`);

                    if (attempt < this.retryPerSolver) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            // Solver ini gagal total setelah semua retry
            this.stats.bySolver[solverName].failed++;
            log.error(`[CaptchaAsu] ${solverName} gagal setelah ${this.retryPerSolver} percobaan`);

            if (solverOrder.indexOf(solverName) < solverOrder.length - 1) {
                log.warn(`[CaptchaAsu] Beralih ke solver berikutnya...`);
            }
        }

        this.stats.failed++;
        throw new Error('Semua solver gagal. Tidak ada solusi yang ditemukan.');
    }

    _createTimeout(ms, solverName) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${solverName} timeout setelah ${ms / 1000} detik`));
            }, ms);
        });
    }

    getStats() {
        return JSON.parse(JSON.stringify(this.stats));
    }

    getRegisteredSolvers() {
        return Array.from(this.solvers.keys());
    }
}

module.exports = CaptchaAsu;
