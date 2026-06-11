const CONSTANTS = require('./constants');

// --- UTILITY FUNCTIONS ---
module.exports = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    removeInvisibleChars: (str) => str.replace(CONSTANTS.INVISIBLE_CHARS_REGEX, ''),
    
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