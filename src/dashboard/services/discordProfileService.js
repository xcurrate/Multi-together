const https = require('https');

function fetchCurrentProfile(token) {
    const options = {
        hostname: 'discord.com',
        path: '/api/v9/users/@me',
        method: 'GET',
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error('Gagal membaca data dari Discord'));
                }
            });
        });

        request.on('error', reject);
        request.end();
    });
}

module.exports = { fetchCurrentProfile };
