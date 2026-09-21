const crypto = require('crypto');

function credentialsMatch(actual, expected) {
    const actualBuffer = Buffer.from(actual, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    return actualBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function createDashboardAuth({
    username = process.env.DASHBOARD_USERNAME || 'dashboard',
    password = process.env.DASHBOARD_PASSWORD || 'zuya2000'
} = {}) {
    return (req, res, next) => {
        const authorization = req.get('authorization') || '';
        const [scheme, encodedCredentials] = authorization.split(' ');

        if (scheme === 'Basic' && encodedCredentials) {
            try {
                const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
                const separatorIndex = decodedCredentials.indexOf(':');
                const providedUsername = decodedCredentials.slice(0, separatorIndex);
                const providedPassword = decodedCredentials.slice(separatorIndex + 1);

                if (separatorIndex >= 0
                    && credentialsMatch(providedUsername, username)
                    && credentialsMatch(providedPassword, password)) {
                    return next();
                }
            } catch {
                // Treat malformed credentials the same as an invalid login attempt.
            }
        }

        res.set('WWW-Authenticate', 'Basic realm="Bot Dashboard", charset="UTF-8"');
        return res.status(401).send('Dashboard authentication required.');
    };
}

module.exports = createDashboardAuth;
