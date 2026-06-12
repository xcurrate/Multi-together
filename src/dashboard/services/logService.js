module.exports = function createLogService({ logger }) {
    return {
        getRecentLines(filter = {}) {
            try {
                const accountId = filter.accountId ? String(filter.accountId).trim() : '';
                const limit = Number.isFinite(Number(filter.limit)) && Number(filter.limit) > 0
                    ? Number(filter.limit)
                    : undefined;

                if (!logger || typeof logger.getRecent !== 'function') return [];

                return logger.getRecent({
                    accountId,
                    limit,
                    globalOnly: !accountId
                });
            } catch {
                return [];
            }
        }
    };
};
