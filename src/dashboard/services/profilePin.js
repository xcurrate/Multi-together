const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PIN_PATTERN = /^\d{4}$/;
const SESSION_MS = 12 * 60 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

module.exports = function createProfilePin({ baseDir, profileManager, fileService }) {
    const attempts = new Map();

    function readPin(id) {
        return profileManager.getProfileMeta(id)?.pin || null;
    }

    function writeMeta(meta) {
        return fileService.writeJson(profileManager.getMetaPath(), meta);
    }

    function digest(pin, salt) {
        return crypto.scryptSync(pin, salt, 64).toString('hex');
    }

    function timingSafePinMatch(pin, record) {
        if (!PIN_PATTERN.test(String(pin || '')) || !record?.salt || !record?.hash) return false;
        try {
            const actual = Buffer.from(digest(String(pin), record.salt), 'hex');
            const expected = Buffer.from(String(record.hash), 'hex');
            return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
        } catch {
            return false;
        }
    }

    function setPin(id, pin) {
        if (!PIN_PATTERN.test(String(pin || ''))) return { ok: false, message: 'PIN harus tepat 4 digit angka' };
        const meta = profileManager.readMeta();
        meta.profiles[id] = meta.profiles[id] || {};
        const salt = crypto.randomBytes(16).toString('hex');
        meta.profiles[id].pin = { hash: digest(String(pin), salt), salt };
        if (!writeMeta(meta)) return { ok: false, message: 'Gagal menyimpan PIN' };
        attempts.delete(id);
        return { ok: true };
    }

    function deletePin(id) {
        const meta = profileManager.readMeta();
        if (meta.profiles?.[id]) {
            delete meta.profiles[id].pin;
            if (!writeMeta(meta)) return false;
        }
        attempts.delete(id);
        return true;
    }

    function getSecret() {
        if (process.env.DASHBOARD_SESSION_SECRET) return process.env.DASHBOARD_SESSION_SECRET;
        const secretPath = path.join(baseDir, 'profiles', '.session-secret');
        fs.mkdirSync(path.dirname(secretPath), { recursive: true });
        try {
            return fs.readFileSync(secretPath, 'utf8').trim();
        } catch {
            const secret = crypto.randomBytes(48).toString('hex');
            try {
                fs.writeFileSync(secretPath, secret, { flag: 'wx', mode: 0o600 });
                return secret;
            } catch {
                return fs.readFileSync(secretPath, 'utf8').trim();
            }
        }
    }

    function sign(payload) {
        const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
        return encoded + '.' + signature;
    }

    function verifyCookie(value, id) {
        if (!value || !readPin(id)) return false;
        const [encoded, signature] = String(value).split('.');
        if (!encoded || !signature) return false;
        const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest();
        let actual;
        try { actual = Buffer.from(signature, 'base64url'); } catch { return false; }
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
        try {
            const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
            const pin = readPin(id);
            return payload.profileId === String(id)
                && Number(payload.exp) > Date.now()
                && payload.pinVersion === pin.hash.slice(0, 16);
        } catch {
            return false;
        }
    }

    function cookieName(id) {
        return 'profile_access_' + String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function getCookie(req, id) {
        const raw = String(req.headers.cookie || '');
        const prefix = cookieName(id) + '=';
        const item = raw.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : '';
    }

    function setSessionCookie(res, id) {
        const pin = readPin(id);
        const value = sign({ profileId: String(id), exp: Date.now() + SESSION_MS, pinVersion: pin.hash.slice(0, 16) });
        res.setHeader('Set-Cookie', cookieName(id) + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + Math.floor(SESSION_MS / 1000) + '; HttpOnly; SameSite=Lax');
    }

    function clearSessionCookie(res, id) {
        res.setHeader('Set-Cookie', cookieName(id) + '=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    }

    function isUnlocked(req, id) {
        return !readPin(id) || verifyCookie(getCookie(req, id), id);
    }

    function attemptStatus(id, ip) {
        const key = String(id) + ':' + String(ip || 'unknown');
        const entry = attempts.get(key);
        if (!entry) return { key, lockedMs: 0, count: 0 };
        if (entry.lockUntil && entry.lockUntil <= Date.now()) {
            attempts.delete(key);
            return { key, lockedMs: 0, count: 0 };
        }
        return { key, lockedMs: Math.max(0, (entry.lockUntil || 0) - Date.now()), count: entry.count || 0 };
    }

    function recordFailure(id, ip) {
        const status = attemptStatus(id, ip);
        if (status.lockedMs > 0) return status;
        const count = status.count + 1;
        const entry = count >= MAX_ATTEMPTS ? { count, lockUntil: Date.now() + LOCK_MS } : { count, lockUntil: 0 };
        attempts.set(status.key, entry);
        return { key: status.key, count, lockedMs: Math.max(0, entry.lockUntil - Date.now()) };
    }

    function clearFailures(id, ip) {
        attempts.delete(String(id) + ':' + String(ip || 'unknown'));
    }

    function lockPage(id, message = '') {
        const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
        return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buka Profile</title><body style="font:16px system-ui;max-width:420px;margin:12vh auto;padding:24px;background:#10131b;color:#f4f6fb;border-radius:16px"><h2>🔒 Profile Terkunci</h2><p>Masukkan PIN 4 digit untuk membuka profile ini.</p>${message ? '<p style="color:#ffb4a9">' + message + '</p>' : ''}<form method="post" action="/profile/${encodeURIComponent(safeId)}/unlock"><input name="pin" type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" minlength="4" autocomplete="current-password" required style="box-sizing:border-box;width:100%;padding:12px;font-size:22px;letter-spacing:8px;margin:10px 0"><button style="width:100%;padding:12px" type="submit">Buka Profile</button></form><p style="font-size:12px;color:#b7bdca">Jika lupa PIN, pemilik server harus menghapus properti <code>profiles[${safeId}].pin</code> di <code>profiles/meta.json</code>.</p><p><a style="color:#a8c7fa" href="/">Kembali ke Control Panel</a></p></body></html>`;
    }

    return { PIN_PATTERN, readPin, setPin, deletePin, timingSafePinMatch, isUnlocked, setSessionCookie, clearSessionCookie, attemptStatus, recordFailure, clearFailures, lockPage, cookieName };
};
