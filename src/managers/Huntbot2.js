const axios = require('axios');
const log = require('../../logger');
const { accountPrefix, randomInt } = require('../utils');
const TooEz = require('./TooEz');

const DEFAULTS = { enabled: false, channelId: '', duration: '1D', sellAnimals: false };
const VALID_DURATIONS = new Set(['1M','5M','10M','30M','1H','6H','12H','1D']);
const RETURN_TIME_PATTERN = /AKU AKAN KEMBALI DALAM\s+(.+?)\s+DENGAN\b/i;
const DM_DONE_TEXT = 'huntbot sudah selesai berburu hewan silahkan gunakan command lucy autohunt untuk mengambil hasilnya!';

function normalizeSettings(raw = {}) {
    const duration = String(raw.duration || DEFAULTS.duration).trim().toUpperCase();
    return { enabled: raw.enabled === true, channelId: String(raw.channelId || '').trim(), duration: VALID_DURATIONS.has(duration) ? duration : DEFAULTS.duration, sellAnimals: raw.sellAnimals === true };
}
function cleanText(value) {
    return String(value || '').replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
}
function collectStrings(node, output = []) {
    if (node == null) return output;
    if (typeof node === 'string') { output.push(node); return output; }
    if (Array.isArray(node)) { for (const item of node) collectStrings(item, output); return output; }
    if (typeof node === 'object') for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string' && ['content','title','description','name','value','label','text','url','custom_id','customId'].includes(key)) output.push(value);
        else if (value && typeof value === 'object') collectStrings(value, output);
    }
    return output;
}
function getMessageText(msg) { return cleanText([msg?.content || '', ...collectStrings(msg?.components || []), ...collectStrings(msg?.embeds || [])].join('\n')); }
function findButton(node, customId) {
    if (!node || typeof node !== 'object') return null;
    if ((node.custom_id || node.customId) === customId) return node;
    for (const child of Array.isArray(node) ? node : Object.values(node)) { const found = findButton(child, customId); if (found) return found; }
    return null;
}
function extractImageUrl(msg) {
    const candidates = [];
    for (const attachment of (msg?.attachments?.values?.() || [])) if (attachment?.url) candidates.push(attachment.url);
    candidates.push(...collectStrings(msg?.components || []), ...collectStrings(msg?.embeds || []), String(msg?.content || ''));
    const isImageUrl = url => /\.(png|jpe?g|webp)(?:\?|$)/i.test(url) || /cdn\.discordapp\.com\/attachments\//i.test(url);
    // Prefer Markdown link destinations; the first URL may be only a displayed label without CDN query parameters.
    for (const candidate of candidates) {
        const targets = [...String(candidate).matchAll(/\]\((https?:\/\/[^)\s]+)\)/gi)].map(match => match[1].replace(/&amp;/g, '&'));
        for (const url of targets.reverse()) if (isImageUrl(url)) return url;
    }
    for (const candidate of candidates) for (const raw of (String(candidate).match(/https?:\/\/[^\s<>\])"']+/gi) || [])) {
        const url = raw.replace(/[),.;]+$/g, '').replace(/&amp;/g, '&');
        if (isImageUrl(url)) return url;
    }
    return null;
}
function parseReturnTime(text) { return cleanText(text).match(RETURN_TIME_PATTERN)?.[1]?.trim() || null; }

module.exports = function createHuntbot2Manager(state) {
    const handled = new Set(), timers = new Set();
    let pendingAction = null;
    const prefix = () => accountPrefix(state) + '🤖 Huntbot2: ';
    const settings = () => normalizeSettings(state.config?.settings?.huntbot2);
    const markHandled = msg => {
        if (!msg?.id) return false;
        if (handled.has(msg.id)) return true;
        handled.add(msg.id);
        if (handled.size > 1500) handled.delete(handled.values().next().value);
        return false;
    };
    const getChannel = async () => {
        const id = settings().channelId;
        if (!id || !state.client?.isReady()) return null;
        return state.client.channels.cache.get(id) || await state.client.channels.fetch(id).catch(() => null);
    };
    const sendCommand = async command => {
        const channel = await getChannel();
        if (!channel || typeof channel.send !== 'function') {
            log.error(prefix() + 'Channel ID belum diatur atau channel tidak dapat diakses.');
            return false;
        }
        try { await channel.send(command); log.info(prefix() + 'Terkirim: ' + command); return true; }
        catch (error) { log.error(prefix() + 'Gagal mengirim "' + command + '": ' + (error.message || error)); return false; }
    };
    const scheduleHunt = (delayMs = randomInt(2000, 3000)) => {
        const timer = setTimeout(async () => {
            timers.delete(timer);
            if (!settings().enabled) return;
            await sendCommand('lhb ' + settings().duration);
            pendingAction = null;
        }, delayMs);
        timers.add(timer);
    };
    const clickConfirm = async (msg, customId, label) => {
        const button = findButton(msg?.components || [], customId);
        if (!button || button.disabled === true) { log.warn(prefix() + 'Tombol konfirmasi ' + customId + ' tidak ditemukan/aktif.'); return false; }
        try {
            await msg.clickButton(customId);
            log.success(prefix() + 'Konfirmasi ' + label + ' diklik (' + customId + ').');
            scheduleHunt(randomInt(2000, 3000));
            return true;
        } catch (error) { log.error(prefix() + 'Gagal klik tombol ' + customId + ': ' + (error.message || error)); return false; }
    };
    return {
        async handle(msg) {
            const cfg = settings();
            if (!cfg.enabled || !msg || !msg.author || msg.author.id === state.client?.user?.id) return false;
            const text = getMessageText(msg), lower = text.toLowerCase();
            if (!text) return false;

            if (msg.channel?.type === 'DM' && lower.includes(DM_DONE_TEXT)) {
                if (markHandled(msg)) return false;
                await sendCommand('lucy hb');
                log.success(prefix() + 'DM selesai berburu terdeteksi; perintah lucy hb dikirim.');
                return true;
            }
            if (lower.includes('dzula, ini passwordmu')) {
                if (markHandled(msg)) return false;
                const imageUrl = extractImageUrl(msg);
                if (!imageUrl) { log.error(prefix() + 'Pesan password terdeteksi tetapi URL gambar tidak ditemukan.'); return false; }
                try {
                    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000, maxContentLength: 8 * 1024 * 1024 });
                    const password = TooEz.decodeBuffer(Buffer.from(response.data));
                    if (!password) { log.error(prefix() + 'Password dari gambar tidak berhasil dikenali oleh TooEz.'); return false; }
                    log.success(prefix() + 'Password gambar berhasil dibaca.');
                    await sendCommand('lhb ' + settings().duration + ' ' + password);
                    return true;
                } catch (error) { log.error(prefix() + 'Gagal mengambil/membaca gambar password: ' + (error.message || error)); return false; }
            }
            if (lower.includes('konfirmasi pengorbanan rank')) {
                if (markHandled(msg)) return false;
                if (cfg.sellAnimals) { log.info(prefix() + 'Mode jual aktif; konfirmasi sacrifice diabaikan.'); return false; }
                return clickConfirm(msg, 'sac_confirm', 'pengorbanan');
            }
            if (lower.includes('konfirmasi jual rank')) {
                if (markHandled(msg)) return false;
                if (!cfg.sellAnimals) { log.info(prefix() + 'Mode sacrifice aktif; konfirmasi jual diabaikan.'); return false; }
                return clickConfirm(msg, 'sell_confirm', 'penjualan');
            }
            if (lower.includes('beep boop. aku kembali')) {
                if (markHandled(msg)) return false;
                if (cfg.sellAnimals) {
                    pendingAction = 'sell';
                    if (!await sendCommand('lsell all')) pendingAction = null;
                    log.info(prefix() + 'Huntbot kembali; mode jual aktif, sacrifice dilewati.');
                } else {
                    pendingAction = 'sacrifice';
                    if (!await sendCommand('lsac all')) pendingAction = null;
                    log.info(prefix() + 'Huntbot kembali; mengirim lsac all.');
                }
                return true;
            }
            if (lower.includes('aku akan kembali dalam')) {
                if (markHandled(msg)) return false;
                log.info(prefix() + 'Waktu kembali: ' + (parseReturnTime(text) || 'tidak terdeteksi'));
                return true;
            }
            if (lower.includes('## dzula - huntbot') && lower.includes('saya akan berburu untukmu tuan')) {
                if (markHandled(msg)) return false;
                log.info(prefix() + 'Lucy Huntbot siap berburu.');
                return true;
            }
            if (lower.includes('## dzula - huntbot') && lower.includes('huntbot sedang berburu')) {
                if (markHandled(msg)) return false;
                log.info(prefix() + 'Huntbot sedang berburu.');
                return true;
            }
            return false;
        },
        stop() { for (const timer of timers) clearTimeout(timer); timers.clear(); handled.clear(); pendingAction = null; },
        getStatus() { return { settings: settings(), pendingAction, scheduledActions: timers.size }; }
    };
};
module.exports.normalizeSettings = normalizeSettings;
module.exports.parseReturnTime = parseReturnTime;
module.exports.extractImageUrl = extractImageUrl;
module.exports.findButton = findButton;
