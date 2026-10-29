const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const createSlotPermissionManager = require('../src/dashboard/services/slotPermissionManager');

const OWNER_PASSWORD = 'test-owner-password-123';
const ACCOUNT_ID = '123456789012345678';

test('slot grants are one-time, persistent, and protected by the owner password', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-manager-'));
    try {
        const manager = createSlotPermissionManager({ baseDir, password: OWNER_PASSWORD });
        assert.equal(manager.isConfigured(), true);
        assert.equal(manager.verifyOwnerPassword(OWNER_PASSWORD), true);
        assert.equal(manager.verifyOwnerPassword('wrong-password'), false);

        assert.deepEqual(manager.grant(ACCOUNT_ID, 'donation'), { ok: true });
        assert.equal(manager.get(ACCOUNT_ID).status, 'available');
        assert.equal(manager.grant(ACCOUNT_ID).ok, false);
        assert.deepEqual(manager.consume(ACCOUNT_ID), { ok: true });
        assert.equal(manager.consume(ACCOUNT_ID).ok, false);
        assert.equal(manager.get(ACCOUNT_ID).status, 'used');
        assert.equal(fs.existsSync(path.join(baseDir, 'slot-permissions.json')), true);

        const restartedManager = createSlotPermissionManager({ baseDir, password: OWNER_PASSWORD });
        assert.equal(restartedManager.get(ACCOUNT_ID).status, 'used');
        const revoked = restartedManager.revoke(ACCOUNT_ID);
        assert.deepEqual(revoked, { ok: true, wasUsed: true });
        assert.equal(restartedManager.get(ACCOUNT_ID).status, 'revoked');
    } finally {
        fs.rmSync(baseDir, { recursive: true, force: true });
    }
});
