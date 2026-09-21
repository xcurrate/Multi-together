const https = require('https');

function fetchCurrentProfile(token) {
    const options = {
        hostname: 'discord.com',
        path: '/api/v10/users/@me',
        method: 'GET',
        headers: {
            'Authorization': token,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                let parsedData;

                try {
                    parsedData = JSON.parse(data);
                } catch (error) {
                    const details = data.trim().replace(/\s+/g, ' ').slice(0, 160);
                    const suffix = details ? `: ${details}` : '';
                    reject(new Error(`Respons Discord tidak valid (HTTP ${response.statusCode || 'tidak diketahui'})${suffix}`));
                    return;
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const message = parsedData.message || 'Discord menolak permintaan profil.';
                    reject(new Error(`${message} (HTTP ${response.statusCode})`));
                    return;
                }

                resolve(parsedData);
            });
        });

        request.on('error', reject);
        request.end();
    });
}

module.exports = { fetchCurrentProfile };
