module.exports = function createLogService({ logger }) {
    return {
    getRecentLines() {
        try {
            return logger && typeof logger.getRecent === 'function' 
                ? logger.getRecent() 
                : [];
        } catch {
            return [];
        }
    }
    };
};
