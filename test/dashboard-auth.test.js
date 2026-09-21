const test = require('node:test');
const assert = require('node:assert/strict');

const createDashboardAuth = require('../src/dashboard/auth');

function runMiddleware(middleware, authorization) {
    const response = {
        headers: {},
        statusCode: null,
        body: null,
        set(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        }
    };
    let calledNext = false;

    middleware({ get: () => authorization }, response, () => {
        calledNext = true;
    });

    return { calledNext, response };
}

test('allows the configured dashboard credentials', () => {
    const middleware = createDashboardAuth({ username: 'dashboard', password: 'zuya2000' });
    const credentials = Buffer.from('dashboard:zuya2000').toString('base64');

    const { calledNext, response } = runMiddleware(middleware, `Basic ${credentials}`);

    assert.equal(calledNext, true);
    assert.equal(response.statusCode, null);
});

test('rejects missing and invalid dashboard credentials', () => {
    const middleware = createDashboardAuth({ username: 'dashboard', password: 'zuya2000' });

    for (const authorization of ['', `Basic ${Buffer.from('dashboard:wrong-password').toString('base64')}`]) {
        const { calledNext, response } = runMiddleware(middleware, authorization);

        assert.equal(calledNext, false);
        assert.equal(response.statusCode, 401);
        assert.match(response.headers['WWW-Authenticate'], /^Basic /);
    }
});
