const fs = require('fs');
const path = require('path');

module.exports = function createProfileManager({ baseDir, fileService }) {
    return {
    getUserId(token) {
        if (!token || typeof token !== 'string') return 'default';

        try {
            const parts = token.split('.');
            if (parts.length < 2) return 'default';

            const base64Id = parts[0];
            const padded = base64Id + '='.repeat((4 - base64Id.length % 4) % 4);
            const decodedId = Buffer.from(padded, 'base64').toString('utf8');

            if (/^\d{17,20}$/.test(decodedId)) {
                return decodedId;
            }
            return 'default';
        } catch (err) {
            console.error('[PROFILE] Gagal parse token:', err.message);
            return 'default';
        }
    },

    getProfilePath(id) {
        const dir = path.join(baseDir, 'profiles');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, `config_${id}.json`);
    },

    getMetaPath() {
        const dir = path.join(baseDir, 'profiles');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, 'meta.json');
    },

    readMeta() {
        const meta = fileService.readJson(this.getMetaPath(), { profiles: {} });
        if (!meta.profiles || typeof meta.profiles !== 'object') meta.profiles = {};
        return meta;
    },

    getSavedProfiles() {
        const dir = path.join(baseDir, 'profiles');
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(f => f.startsWith('config_') && f.endsWith('.json'))
            .map(f => f.replace('config_', '').replace('.json', ''));
    },

    saveProfileMeta(id, username, globalName, avatar) {
        const metaPath = this.getMetaPath();
        let meta = this.readMeta();
        
        meta.profiles[id] = {
            username,
            globalName,
            avatar
        };
        
        fileService.writeJson(metaPath, meta);
    },

    getProfileMeta(id) {
        const meta = this.readMeta();
        return meta.profiles && meta.profiles[id] ? meta.profiles[id] : null;
    },

    getProfileDisplayName(id) {
        const meta = this.getProfileMeta(id);
        if (meta && meta.globalName) {
            return meta.globalName;
        } else if (meta && meta.username) {
            return `@${meta.username}`;
        }
        return `Akun ${id}`;
    }
    };
};
