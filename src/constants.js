// --- CONSTANTS & CONFIGURATION ---
module.exports = {

    TICKET_CHANNEL_ID: '1499159557132390470',
    OWO_IDS: ['408785106942164992','1343111797057654856'], // OwO Main & Beta
    BOSS_COOLDOWN_MS: 295000, // 4m 55s
    RESPONSE_TIMEOUT_MS: 40000,
    TICKET_CHECK_DELAY_MS: 15000,
    CAPTCHA_KEYWORDS: [
        'are you a real human',
        'verify that you are human',
        'please complete your captcha'
    ],
    MAX_LOG_LINES: 20,
    
    DAILY_RESET_HOUR: 0,
    DAILY_RESET_MINUTE: 0,
    MAX_SET_SIZE: 500,
    MIN_TYPING_DELAY: 290,
    MAX_TYPING_DELAY: 300,
    POLLING_INTERVAL_MS: 3000,
    RESET_CHECK_INTERVAL_MS: 60000,
    INVISIBLE_CHARS_REGEX: /[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g,
// --- CONSTANTS & CONFIGURATION ---
    HUNTBOT: {
        COMMANDS: {
            CHECK: "whb",
            SELL: "wsell all",
            SACRIFICE: "wsc all",
            UPGRADE: "wupg",
            AUTO_HUNT: "owo autohunt"
        },
        UPGRADE_TYPES: ["duration", "efficiency", "cost", "gain", "experience", "radar"],
        DEFAULT_UPGRADE: "duration",
        DEFAULT_DURATION: "1D",
        // REGEX untuk embed
        PROGRESS_REGEX: {
            PERCENTAGE: /(\d+\.?\d*)%\s*DONE/i,
            ANIMALS: /(\d+)\s*ANIMALS\s*CAPTURED/i,
            PROGRESS_BAR: /(\[■+□+\])/,
            TIME: /I WILL BE BACK IN ([\dH ]+M?)/i
        },
        UPGRADE_REGEX: {
            DURATION: /`([\d.]+H)`/i,
            LEVEL: /Lvl (\d+)/i,
            PROGRESS: /\[(\d+)\/(\d+)\]/,
            ESSENCE: /([\d,]+)\s*Animal Essence/i
        },
        RESPONSE_TIMEOUT: 30000
    }

   
    

};