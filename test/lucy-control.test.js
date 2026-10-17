const test = require('node:test');
const assert = require('node:assert/strict');

const createMessageHandler = require('../src/managers/message');

function createHandler({ lucyAllowIds = [] } = {}) {
    const calls = [];
    const telegram = [];
    let saves = 0;
    const state = {
        client: { isReady: () => true, user: { id: 'self' } },
        config: {
            botStatus: { running: false, paused: true },
            settings: {
                boss2: { enabled: false },
                gems: { enabled: false },
                adventure: { enabled: false }
            },
            otherCommands: [
                { text: 'lhunt', channelId: 'c1', enabled: false },
                { text: '', channelId: '', enabled: false },
                { text: 'lwork', channelId: 'c2', enabled: false }
            ],
            safety: {}
        }
    };
    const configManager = {
        getControlCommands: () => ({ startCmd: 'wcash', pauseCmd: 'wbuy 1', allowIds: [] }),
        getLucyControlCommands: () => ({ startCmd: 'lucy on', pauseCmd: 'lucy off', allowIds: lucyAllowIds }),
        save: () => { saves += 1; }
    };
    const loopManager = {
        startAll: () => calls.push('startAll'),
        stopAll: () => calls.push('stopAll'),
        startOtherCommand: (index) => calls.push(`startOther${index}`),
        stopOtherCommand: (index) => calls.push(`stopOther${index}`)
    };
    const adventureManager = {
        start: async (options) => { calls.push(`startAdventure:${options?.restart}`); return true; },
        stop: () => calls.push('stopAdventure')
    };
    const boss2Manager = { stop: () => calls.push('stopBoss2') };
    const gemsManager = { stop: () => calls.push('stopGems') };
    const telegramService = { send: (text) => telegram.push(text) };
    const handler = createMessageHandler(
        state, configManager, {}, {}, loopManager, {}, telegramService, null, null, {}, null,
        adventureManager, boss2Manager, gemsManager
    );
    return { state, handler, calls, telegram, getSaves: () => saves };
}

const message = (content, authorId = 'self') => ({ content, author: { id: authorId }, channel: { id: 'chan' } });

test('Lucy start word enables every Lucy feature and starts their schedulers without touching OwO', async () => {
    const { state, handler, calls, telegram, getSaves } = createHandler();
    await handler.handleControlCommands(message('Lucy On'));

    assert.equal(state.config.settings.boss2.enabled, true);
    assert.equal(state.config.settings.gems.enabled, true);
    assert.equal(state.config.settings.adventure.enabled, true);
    assert.ok(state.config.otherCommands.every(command => command.enabled === true));
    assert.deepEqual(calls, ['startOther0', 'startOther2', 'startAdventure:true']);
    assert.deepEqual(state.config.botStatus, { running: false, paused: true });
    assert.equal(getSaves(), 1);
    assert.match(telegram[0], /Lucy Started/);
});

test('Lucy pause word disables every Lucy feature and stops their schedulers', async () => {
    const { state, handler, calls, telegram } = createHandler();
    state.config.settings.boss2.enabled = true;
    state.config.settings.gems.enabled = true;
    state.config.settings.adventure.enabled = true;
    state.config.otherCommands.forEach(command => { command.enabled = true; });

    await handler.handleControlCommands(message('lucy off'));

    assert.equal(state.config.settings.boss2.enabled, false);
    assert.equal(state.config.settings.gems.enabled, false);
    assert.equal(state.config.settings.adventure.enabled, false);
    assert.ok(state.config.otherCommands.every(command => command.enabled === false));
    assert.deepEqual(calls, ['stopOther0', 'stopOther1', 'stopOther2', 'stopAdventure', 'stopBoss2', 'stopGems']);
    assert.match(telegram[0], /Lucy Paused/);
});

test('Lucy control only accepts the account itself or Lucy allowed IDs', async () => {
    const blocked = createHandler();
    await blocked.handler.handleControlCommands(message('lucy on', 'stranger'));
    assert.equal(blocked.state.config.settings.boss2.enabled, false);
    assert.deepEqual(blocked.calls, []);

    const allowed = createHandler({ lucyAllowIds: ['friend'] });
    await allowed.handler.handleControlCommands(message('lucy on', 'friend'));
    assert.equal(allowed.state.config.settings.boss2.enabled, true);
});

test('OwO control words keep working and do not toggle Lucy features', async () => {
    const { state, handler, calls } = createHandler();
    await handler.handleControlCommands(message('wcash'));
    assert.deepEqual(state.config.botStatus, { running: true, paused: false });
    assert.equal(state.config.settings.boss2.enabled, false);
    assert.deepEqual(calls, ['startAll']);
});
