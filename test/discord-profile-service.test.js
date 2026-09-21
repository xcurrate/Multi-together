const test = require('node:test');
const assert = require('node:assert/strict');

const { getCurrentProfile } = require('../src/dashboard/services/discordProfileService');

test('returns the profile from an authenticated Discord client without an API request', () => {
    const profile = getCurrentProfile({
        user: {
            id: '123',
            username: 'owo',
            globalName: 'OwO User',
            avatar: 'avatar-hash'
        }
    });

    assert.deepEqual(profile, {
        id: '123',
        username: 'owo',
        global_name: 'OwO User',
        avatar: 'avatar-hash'
    });
});

test('does not provide a profile before the Discord client is ready', () => {
    assert.equal(getCurrentProfile(null), null);
    assert.equal(getCurrentProfile({ user: { id: '123' } }), null);
});
