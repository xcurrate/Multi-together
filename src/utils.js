const CONSTANTS = require('./constants');

const getDiscordUsername = (state) => {
    const user = state?.client?.user;
    if (user?.tag) return user.tag;
    if (user?.username) return user.username;
    return state?.accountUsername || state?.discordUsername || '';
};

const accountPrefix = (state) => {
    if (!state?.accountId) return '';
    const username = getDiscordUsername(state);
    return username
        ? `[account:${state.accountId} user:${username}] `
        : `[account:${state.accountId}] `;
};

// --- UTILITY FUNCTIONS ---
module.exports = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    removeInvisibleChars: (str) => str.replace(CONSTANTS.INVISIBLE_CHARS_REGEX, ''),

    getDiscordUsername,

    accountPrefix,
    
    safeJsonStringify: (obj) => {
        try {
            return JSON.stringify(obj);
        } catch {
            return '';
        }
    },
    
    deepCopy: (obj) => {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch {
            return obj;
        }
    }
};