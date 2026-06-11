const fs = require('fs');
const path = require('path');

module.exports = {
    readJson(filePath, defaultValue = {}) {
        try {
            if (!fs.existsSync(filePath)) return defaultValue;
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error reading JSON from ${filePath}:`, error.message);
            return defaultValue;
        }
    },

    writeJson(filePath, obj) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing JSON to ${filePath}:`, error.message);
            return false;
        }
    }
};
