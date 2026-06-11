const log = require('../../logger');
const accountPrefix = (state) => state?.accountId ? `[account:${state.accountId}] ` : '';
const { randomInt } = require('../utils');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
module.exports = (state, commandSender) => ({

    // Pastikan storage ada
    init() {
        state.nextAt = state.nextAt || {};
        state.loops = state.loops || {};
    },

    // Helper: schedule + simpan next run time
    _scheduleLoop(key, fn, delayMs) {
        const delay = Math.max(0, Number(delayMs) || 0);

        state.nextAt[key] = Date.now() + delay;

        if (state.loops[key]) clearTimeout(state.loops[key]);
        state.loops[key] = setTimeout(fn, delay);
    },

    // Delay normal (murni dari config)
    _getDefaultDelay(key) {
        const d = state.config?.delays?.[key];

        if (d?.min != null && d?.max != null) return randomInt(d.min, d.max);

        if (key === 'custom1') {
            const min = state.config?.delays?.custom1?.min || 60000;
            const max = state.config?.delays?.custom1?.max || 120000;
            return randomInt(min, max);
        }

        if (key === 'custom2') {
            const min = state.config?.delays?.custom2?.min || 60000;
            const max = state.config?.delays?.custom2?.max || 120000;
            return randomInt(min, max);
        }

        return 1000;
    },

    // Helper: resume berdasarkan sisa waktu
    _resumeLoop(key, fn) {
        const next = state.nextAt[key];

        if (typeof next !== 'number') {
            fn();
            return;
        }

        const remaining = next - Date.now();

        if (remaining <= 0) {
            fn();
            return;
        }

        this._scheduleLoop(key, fn, remaining);
    },

    async battle() {
        if (state.config.botStatus.paused || !state.config.settings?.battle) return;

        while (state.isBusy) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        state.isBusy = true;

        try {
            await commandSender.send('wb', 'Battle');
            await new Promise(resolve => setTimeout(resolve, 10));
            if (state.config.botStatus.paused || !state.config.settings?.battle) return;
            await commandSender.send('wh', 'Hunt');
        } catch (error) {
            log.error(`${accountPrefix(state)}❌ Gagal Battle/Hunt: ${error.message || error}`);
        } finally {
            state.isBusy = false;

            const d = randomInt(
                state.config.delays.battle.min,
                state.config.delays.battle.max
            );
            this._scheduleLoop('battle', () => this.battle(), d);
        }
    },

    async pray() {
        if (state.config.botStatus.paused || !state.config.settings?.pray) return;

        try {
            await commandSender.send('wpray', 'Pray');
        } catch (error) {
            log.error(`${accountPrefix(state)}❌ Gagal Pray: ${error.message || error}`);
        } finally {
            const d = randomInt(
                state.config.delays.pray.min,
                state.config.delays.pray.max
            );
            this._scheduleLoop('pray', () => this.pray(), d);
        }
    },

    async custom1() {
        if (state.config.botStatus.paused || !state.config.settings?.custom) return;

        const text = state.config.settings.text1?.trim();
        if (!text) return;

        while (state.isBusy) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        state.isBusy = true;

        try {
            await commandSender.send(text, 'Custom1');
        } catch (error) {
            log.error(`${accountPrefix(state)}❌ Gagal Custom1: ${error.message || error}`);
        } finally {
            state.isBusy = false;

            const min = state.config.delays.custom1?.min || 60000;
            const max = state.config.delays.custom1?.max || 120000;
            const d = randomInt(min, max);
            this._scheduleLoop('custom1', () => this.custom1(), d);
        }
    },

    async custom2() {
        if (state.config.botStatus.paused || !state.config.settings?.custom) return;

        const text = state.config.settings.text2?.trim();
        if (!text) return;

        try {
            await commandSender.send(text, 'Custom2');
        } catch (error) {
            log.error(`${accountPrefix(state)}❌ Gagal Custom2: ${error.message || error}`);
        } finally {
            const min = state.config.delays.custom2?.min || 60000;
            const max = state.config.delays.custom2?.max || 120000;
            const d = randomInt(min, max);
            this._scheduleLoop('custom2', () => this.custom2(), d);
        }
    },

    startAll() {
        this.init();
        this.stopAll();

        const isFirstLoopStartup = !state.hasUsedFirstLoopStartupStagger;
        state.hasUsedFirstLoopStartupStagger = true;

        let stagger = 0;
        const bump = () => {
            stagger += isFirstLoopStartup ? 5000 : randomInt(800, 1000);
            return stagger;
        };

        if (isFirstLoopStartup) {
            log.info(`${accountPrefix(state)}⏳ First loop startup: command awal loop diantrikan per 5 detik.`);
        }

        const scheduleStartup = (key, fn) => {
            state.loops[key] = setTimeout(() => {
                state.loops[key] = null;
                this._resumeLoop(key, fn);
            }, bump());
        };

        if (state.config.settings?.battle)
            scheduleStartup('battle', () => this.battle());

        if (state.config.settings?.hunt && typeof this.hunt === 'function')
            scheduleStartup('hunt', () => this.hunt());

        if (state.config.settings?.pray)
            scheduleStartup('pray', () => this.pray());

        if (state.config.settings?.custom) {
            if (state.config.settings.text1?.trim())
                scheduleStartup('custom1', () => this.custom1());

            if (state.config.settings.text2?.trim())
                scheduleStartup('custom2', () => this.custom2());
        }

        log.success(`${accountPrefix(state)}🔄 Semua loop dimulai / resume`);
    },

    stopAll() {
        let stopped = false;
        Object.keys(state.loops || {}).forEach(key => {
            if (state.loops[key]) {
                clearTimeout(state.loops[key]);
                state.loops[key] = null;
                stopped = true;
            }
        });

        if (state.responseTimeout) {
            clearTimeout(state.responseTimeout);
            state.responseTimeout = null;
            stopped = true;
        }

        if (stopped) log.info(`${accountPrefix(state)}⏹️ Semua loop dihentikan`);
    }
});
