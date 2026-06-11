const chalk = require('chalk');
const constants = require('./src/constants');

// --- FUNGSI HELPER WIB ---
const getWIBDate = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
};

const formatWIB = () => {
    const d = getWIBDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `[${hh}:${mm}:${ss}]`;
};

// --- LOG BUFFER ---
const logBuffer = [];
const plainLogBuffer = [];

function pushLogLine(line, plainLine) {
    const maxLines = constants.MAX_LOG_LINES || 20;

    logBuffer.push(line);
    plainLogBuffer.push(plainLine);

    while (logBuffer.length > maxLines) {
        logBuffer.shift();
    }

    while (plainLogBuffer.length > maxLines) {
        plainLogBuffer.shift();
    }
}

// --- RENDER TERMINAL ---
function render() {
    console.clear();
    console.log(logBuffer.join('\n'));
}

// --- LOGGING CORE ---
function write(levelPlain, levelColored, msg) {
    const timeStr = formatWIB();

    // simpan versi berwarna untuk terminal
    const coloredLine = `${chalk.gray(timeStr)} ${levelColored} ${msg}`;

    // simpan versi plain untuk dashboard
    const plainLine = `${timeStr} ${levelPlain} ${msg}`;

    pushLogLine(coloredLine, plainLine);

    render();

}

// --- EXPORT ---
module.exports = {
    info: (msg) => write('[INFO]', chalk.blue('[INFO]'), msg),
    warn: (msg) => write('[WARN]', chalk.yellow('[WARN]'), msg),
    error: (msg) => write('[ERR]', chalk.red('[ERR]'), msg),
    success: (msg) => write('[OK]', chalk.green('[OK]'), msg),
    battle: (msg) => write('[BATTLE]', chalk.magenta('[BATTLE]'), msg),
    captcha: (msg) => write('[CAPTCHA]', chalk.bgRed.white('[CAPTCHA]'), msg),
    getRecent: () => plainLogBuffer.slice()
};
