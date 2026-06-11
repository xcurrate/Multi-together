const log = require('../../../logger');

/**
 * BaseSolver - Abstract class untuk semua captcha solver
 * Setiap solver baru harus meng-extend class ini
 */
class BaseSolver {
    constructor(apiKey) {
        if (this.constructor === BaseSolver) {
            throw new Error('BaseSolver adalah abstract class, tidak bisa di-instantiate langsung');
        }
        this.apiKey = apiKey;
        this.name = this.constructor.name;
    }

    /**
     * Method utama untuk solve captcha
     * @param {string} sitekey
     * @param {string} url
     * @param {object} options - { signal, timeout }
     * @returns {Promise<string>} - token hasil solve
     */
    async solve(sitekey, url, options = {}) {
        throw new Error('Method solve() harus di-override di subclass');
    }

    /**
     * Mendapatkan sisa saldo/credit solver
     */
    async getBalance() {
        throw new Error('Method getBalance() harus di-override di subclass');
    }

    getName() {
        return this.name;
    }

    // Helper untuk logging
    _logInfo(msg) {
        log.info(`[${this.name}] ${msg}`);
    }

    _logError(msg) {
        log.error(`[${this.name}] ${msg}`);
    }

    _logWarn(msg) {
        log.warn(`[${this.name}] ${msg}`);
    }
}

module.exports = BaseSolver;
