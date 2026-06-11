const BaseSolver = require('./BaseSolver');
const log = require('../../../logger');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function throwIfAborted(signal) {
    if (signal?.aborted) {
        const err = new Error('NopeCha solver dibatalkan karena CAPTCHA sudah selesai manual.');
        err.name = 'AbortError';
        throw err;
    }
}

class NopechaSolver extends BaseSolver {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = 'https://api.nopecha.com/v1';
    }

    async getBalance() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${this.apiKey}` }
            });
            const data = await response.json();
            return data.credit !== undefined ? data.credit : 'Tidak diketahui';
        } catch (error) {
            this._logError(`Gagal cek saldo: ${error.message}`);
            return 'Error';
        }
    }

    async solve(sitekey, url, options = {}) {
        const { signal } = options;
        throwIfAborted(signal);

        this._logInfo('Memesan teka-teki hCaptcha...');

        try {
            const submitResponse = await fetch(`${this.baseUrl}/token/hcaptcha`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${this.apiKey}`
                },
                body: JSON.stringify({ sitekey, url }),
                signal
            });

            throwIfAborted(signal);
            const submitData = await submitResponse.json();

            if (submitResponse.status !== 200 || !submitData.data) {
                throw new Error(submitData.message || 'Gagal membuat tugas NopeCha');
            }

            const jobId = submitData.data;
            this._logInfo(`Job ID: ${jobId.substring(0, 8)}... | Menunggu AI...`);

            let solvedToken = null;
            let attempt = 0;
            const maxPolls = 24; // 24 * 5 detik = 2 menit

            while (!solvedToken && attempt < maxPolls) {
                attempt++;
                await wait(5000);
                throwIfAborted(signal);

                const pollResponse = await fetch(`${this.baseUrl}/token/hcaptcha?id=${jobId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${this.apiKey}` },
                    signal
                });

                throwIfAborted(signal);
                const pollData = await pollResponse.json();

                if (pollResponse.status === 200 && pollData.data) {
                    this._logInfo('Berhasil mendapatkan token!');
                    return pollData.data;
                } else if (pollData.message && pollData.message.toLowerCase().includes('incomplete')) {
                    if (attempt % 3 === 0) {
                        this._logInfo(`AI masih bekerja... (${attempt * 5}s)`);
                    }
                } else {
                    throw new Error(pollData.message || 'Error saat mengambil token');
                }
            }

            throw new Error('Job Timeout (AI gagal menyelesaikan dalam 2 menit)');

        } catch (error) {
            if (error.name === 'AbortError') throw error;
            this._logError(`Gagal solve: ${error.message}`);
            throw error;
        }
    }
}

module.exports = NopechaSolver;
