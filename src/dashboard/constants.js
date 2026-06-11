module.exports = {
    DEFAULT_PORT: 4002,
    MAX_LOG_LINES: 15,
    LOG_REFRESH_INTERVAL_MS: 1000,
    REDIRECT_DELAY_SECONDS: 1,
    CONFIG_FILE: 'config.json',
    PROFILES_META_FILE: 'profiles/meta.json',
    DEFAULT_DELAYS: {
        hunt: { min: 15000, max: 15000 },
        battle: { min: 15000, max: 15000 },
        pray: { min: 15000, max: 15000 },
        custom1: { min: 60000, max: 120000 },
        custom2: { min: 60000, max: 120000 }
    }
};
