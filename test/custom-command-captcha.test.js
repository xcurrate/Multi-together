const test = require('node:test');
const assert = require('node:assert/strict');

const createLoopManager = require('../src/managers/loop');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('Custom Command keeps its remaining sends and delay paused while CAPTCHA is active', async () => {
    let sends = 0;
    const state = {
        hasActiveCaptcha: false,
        config: {
            otherCommands: [{
                text: '!test',
                channelId: '123',
                count: 2,
                delayMs: 50,
                captchaEnabled: true,
                enabled: true
            }]
        },
        loops: {},
        nextAt: {},
        otherCommandDelays: {}
    };
    const loopManager = createLoopManager(state, {
        async send() {
            sends += 1;
            return true;
        }
    });

    await loopManager.otherCommand(0, 2);
    assert.equal(sends, 1);

    await wait(10);
    state.hasActiveCaptcha = true;
    loopManager.pauseOtherCommandDelays();
    await wait(70);
    assert.equal(sends, 1, 'delay must not elapse while CAPTCHA is active');

    state.hasActiveCaptcha = false;
    loopManager.resumeOtherCommandDelays();
    await wait(60);
    assert.equal(sends, 2, 'the command resumes with the unsent target count');
    assert.equal(state.config.otherCommands[0].enabled, false);
});

test('Custom Command does not decrement its target after an unsuccessful send', async () => {
    let sends = 0;
    const state = {
        hasActiveCaptcha: false,
        config: {
            otherCommands: [{ text: '!test', channelId: '123', count: 1, delayMs: 5, captchaEnabled: true, enabled: true }]
        },
        loops: {},
        nextAt: {},
        otherCommandDelays: {}
    };
    const loopManager = createLoopManager(state, {
        async send() {
            sends += 1;
            return sends > 1;
        }
    });

    await loopManager.otherCommand(0, 1);
    await wait(20);
    assert.equal(sends, 2);
    assert.equal(state.config.otherCommands[0].enabled, false);
});
