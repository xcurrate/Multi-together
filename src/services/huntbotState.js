// src/services/huntbotState.js
module.exports = {
    autoMode: false,            // Status auto mode
    activeHunt: null,           // { startTime, returnTime, endTime, hours, minutes, channelId, messageId, animals, essence, exp }
    pendingCaptcha: null,       // { password, messageId, timestamp }
    lastUpgradeLevel: null,     // { duration, level, progress, essence }
    lastProgress: null,         // { percentage, animals, returnTime, raw }
    lastResponse: null,         // { animals, essence, exp }
    monitorInterval: null,      // setInterval handle
    notifiedSoon: false         // Untuk notif 5 menit
};