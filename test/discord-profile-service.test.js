const { EventEmitter } = require('node:events');
const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');

const { fetchCurrentProfile } = require('../src/dashboard/services/discordProfileService');

function respondWith(statusCode, body) {
    const originalRequest = https.request;
    let options;

    https.request = (requestOptions, callback) => {
        options = requestOptions;
        const response = new EventEmitter();
        response.statusCode = statusCode;

        process.nextTick(() => {
            callback(response);
            response.emit('data', body);
            response.emit('end');
        });

        return {
            on() { return this; },
            end() {}
        };
    };

    return {
        options: () => options,
        restore: () => { https.request = originalRequest; }
    };
}

test('reads a successful profile using Discord API v10', async () => {
    const mock = respondWith(200, JSON.stringify({ id: '123', username: 'owo' }));

    try {
        await assert.doesNotReject(fetchCurrentProfile('token'));
        assert.equal(mock.options().path, '/api/v10/users/@me');
        assert.equal(mock.options().headers.Accept, 'application/json');
    } finally {
        mock.restore();
    }
});

test('reports Discord error responses instead of treating them as profiles', async () => {
    const mock = respondWith(401, JSON.stringify({ message: '401: Unauthorized' }));

    try {
        await assert.rejects(fetchCurrentProfile('expired-token'), /401: Unauthorized \(HTTP 401\)/);
    } finally {
        mock.restore();
    }
});

test('includes the HTTP status when Discord returns a non-JSON response', async () => {
    const mock = respondWith(503, '<html>Service unavailable</html>');

    try {
        await assert.rejects(fetchCurrentProfile('token'), /Respons Discord tidak valid \(HTTP 503\)/);
    } finally {
        mock.restore();
    }
});
