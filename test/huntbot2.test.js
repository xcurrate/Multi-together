const test = require('node:test');
const assert = require('node:assert/strict');
const Huntbot2 = require('../src/managers/Huntbot2');

test('normalizes Huntbot2 settings and supported duration', () => {
    assert.deepEqual(Huntbot2.normalizeSettings({ enabled: true, channelId: '123', duration: '5m', sellAnimals: true }), {
        enabled: true, channelId: '123', duration: '5M', sellAnimals: true
    });
    assert.equal(Huntbot2.normalizeSettings({ duration: 'not-a-duration' }).duration, '1D');
});
test('parses Lucy Huntbot return time', () => {
    assert.equal(Huntbot2.parseReturnTime('BEEP BOOP. dzula AKU AKAN KEMBALI DALAM 1M DENGAN 1 HEWAN'), '1M');
});
test('extracts image URL embedded in component text', () => {
    const msg = { content: '', attachments: { values: () => [] }, components: [{ components: [{ content: '[gambar](https://cdn.discordapp.com/attachments/123/abc.png?x=1)' }] }] };
    assert.equal(Huntbot2.extractImageUrl(msg), 'https://cdn.discordapp.com/attachments/123/abc.png?x=1');
});
test('finds confirmation button by custom id', () => {
    assert.deepEqual(Huntbot2.findButton([{ components: [{ custom_id: 'sac_confirm', disabled: false }] }], 'sac_confirm'), { custom_id: 'sac_confirm', disabled: false });
});
