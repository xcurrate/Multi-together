const BaseSolver = require('./BaseSolver');

/**
 * TwoCaptchaSolver - Placeholder untuk 2Captcha
 * TODO: Implementasi lengkap nanti
 */
class TwoCaptchaSolver extends BaseSolver {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = 'https://2captcha.com';
    }

    async getBalance() {
        // TODO: Implementasi cek balance 2Captcha
        this._logInfo('getBalance() belum diimplementasikan');
        return 'Not implemented';
    }

    async solve(sitekey, url, options = {}) {
        const { signal } = options;
        
        this._logInfo('TwoCaptcha solve dipanggil (masih placeholder)');
        
        // TODO: Implementasi solve menggunakan 2Captcha API
        // Contoh endpoint: https://2captcha.com/in.php
        
        throw new Error('TwoCaptchaSolver belum diimplementasikan sepenuhnya');
    }
}

module.exports = TwoCaptchaSolver;
