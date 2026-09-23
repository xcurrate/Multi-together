const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const createDashboardApp = require('../src/dashboard/app');

function authHeader() {
    return `Basic ${Buffer.from('dashboard:zuya2000').toString('base64')}`;
}

async function withDashboard(callback) {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-save-'));
    fs.writeFileSync(path.join(baseDir, 'config.json'), JSON.stringify({ token: '', settings: {} }));
    const { app } = createDashboardApp({ baseDir });
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));

    try {
        await callback(`http://127.0.0.1:${server.address().port}`, baseDir);
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(baseDir, { recursive: true, force: true });
    }
}

test('POST /save parses URL-encoded dashboard data and reports persistence as JSON', async () => {
    await withDashboard(async (url, baseDir) => {
        const response = await fetch(`${url}/save`, {
            method: 'POST',
            headers: {
                Authorization: authHeader(),
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json'
            },
            body: new URLSearchParams({ action: 'save', token: 'saved-token', chan1: '12345' })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, message: 'Configuration saved' });
        const savedConfig = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), 'utf8'));
        assert.equal(savedConfig.token, 'saved-token');
        assert.deepEqual(savedConfig.channels, ['12345']);
    });
});

test('POST /save returns a JSON failure for an invalid AJAX action request', async () => {
    await withDashboard(async (url) => {
        const response = await fetch(`${url}/save`, {
            method: 'POST',
            headers: {
                Authorization: authHeader(),
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json'
            },
            body: new URLSearchParams({ action: 'loadProfile' })
        });

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { success: false, message: 'Profile must be selected' });
    });
});

test('POST /save uses the JSON Accept header when the AJAX header is unavailable', async () => {
    await withDashboard(async (url) => {
        const response = await fetch(`${url}/save`, {
            method: 'POST',
            headers: {
                Authorization: authHeader(),
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                Accept: 'application/json'
            },
            body: new URLSearchParams({ action: 'save', token: 'accept-header-token' })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, message: 'Configuration saved' });
    });
});

test('dashboard renders an accessible save status toast', async () => {
    await withDashboard(async (url) => {
        const response = await fetch(url, { headers: { Authorization: authHeader() } });
        const html = await response.text();

        assert.equal(response.status, 200);
        assert.match(html, /id="saveToast" class="save-toast" role="status" aria-live="polite"/);
        assert.match(html, /function toUrlEncodedBody\(formData\)/);
        assert.match(html, /credentials: 'include'/);
        assert.match(html, /showToast\('success', 'Tersimpan'\)/);
        assert.match(html, /showToast\('error', error\.message \? 'Gagal: ' \+ error\.message : 'Gagal'\)/);
    });
});
