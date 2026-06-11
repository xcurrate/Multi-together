module.exports = function createLogService({ logger }) {
    return {
    getRecentLines(filter = {}) {
        try {
            const lines = logger && typeof logger.getRecent === 'function'
                ? logger.getRecent()
                : [];
            const accountId = filter.accountId ? String(filter.accountId).trim() : '';
            if (!accountId) return lines;
            const accountPrefix = `[account:${accountId}]`;
            return lines.filter(line => String(line || '').includes(accountPrefix) || String(line || '').includes(accountId));
        } catch {
            return [];
        }
    }
    };
};
