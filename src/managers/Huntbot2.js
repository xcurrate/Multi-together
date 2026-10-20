const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const log = require('../../logger');
const { accountPrefix, sleep } = require('../utils');

const execFileAsync = promisify(execFile);
const PASSWORD_TRIGGER = /dzula,\s*ini passwordmu!/i;
const START_TRIGGER = /dzula\s*-\s*HuntBot|BEEP\.\s*BOOP\.\s*SAYA HUNTBOT/i;
const SACRIFICE_TRIGGER = /Konfirmasi Pengorbanan Rank[\s\S]*Kamu akan sacrifice/i;
const SELL_TRIGGER = /Konfirmasi Jual Rank/i;
const HUNTING_TRIGGER = /HUNTBOT sedang berburu!/i;
const RETURNING_TRIGGER = /AKU AKAN KEMBALI DALAM\s+(\d+)\s*([SMHD])/i;
const BACK_TRIGGER = /BEEP BOOP\.\s*AKU KEMBALI/i;
const DM_FINISHED_TRIGGER = /huntbot sudah selesai berburu hewan silahkan gunakan command lucy autohunt untuk mengambil hasilnya!/i;

function collectMessageText(msg) {
    const parts = [msg?.content || ''];
    for (const embed of msg?.embeds || []) {
        parts.push(embed.title, embed.description, embed.author?.name, embed.footer?.text);
        for (const field of embed.fields || []) parts.push(field.name, field.value);
    }
    try { parts.push(JSON.stringify((msg?.components || []).map(c => c.toJSON ? c.toJSON() : c))); } catch {}
    return parts.filter(Boolean).join('\n');
}

function extractImageUrl(msg) {
    const candidates = [];
    const text = collectMessageText(msg);
    const markdownUrls = text.match(/https?:\/\/[^\s<>()\]]+/gi) || [];
    candidates.push(...markdownUrls.map(url => url.replace(/[.,!?]+$/, '')));
    for (const attachment of msg?.attachments?.values?.() || []) {
        if (attachment?.url) candidates.push(attachment.url);
    }
    for (const embed of msg?.embeds || []) {
        if (embed?.url) candidates.push(embed.url);
        if (embed?.image?.url) candidates.push(embed.image.url);
        if (embed?.thumbnail?.url) candidates.push(embed.thumbnail.url);
    }
    return candidates.find(url => /^https?:\/\//i.test(url) && /\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url))
        || candidates.find(url => /^https?:\/\//i.test(url))
        || null;
}

function downloadBuffer(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Terlalu banyak redirect saat mengunduh gambar password'));
        const client = String(url).startsWith('https:') ? https : http;
        client.get(url, response => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                response.resume();
                const nextUrl = new URL(response.headers.location, url).toString();
                return resolve(downloadBuffer(nextUrl, redirects + 1));
            }
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error('Gagal mengunduh gambar password (HTTP ' + response.statusCode + ')'));
            }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

module.exports = (state, configManager) => {
    const runtime = { busy: false, timers: new Set(), lastMessageIds: new Set() };

    const getSettings = () => {
        const raw = state.config.settings?.huntbot2 || {};
        return {
            enabled: raw.enabled === true,
            channelId: String(raw.channelId || '').trim(),
            duration: String(raw.duration || '1D').trim().toUpperCase(),
            sellAnimals: raw.sellAnimals === true,
            delayMinMs: Math.max(2000, parseInt(raw.delayMinMs, 10) || 2500),
            delayMaxMs: Math.max(2000, parseInt(raw.delayMaxMs, 10) || 3000)
        };
    };

    const logPrefix = () => accountPrefix(state) + '[Huntbot2] ';
    const schedule = (fn, delayMs) => {
        const timer = setTimeout(async () => {
            runtime.timers.delete(timer);
            try { await fn(); } catch (error) { log.error(logPrefix() + error.message); }
        }, delayMs);
        runtime.timers.add(timer);
        return timer;
    };

    const sendCommand = async command => {
        const settings = getSettings();
        if (!settings.enabled) return false;
        if (!settings.channelId) {
            log.warn(logPrefix() + 'Channel ID belum dikonfigurasi.');
            return false;
        }
        const channel = state.client?.channels?.cache?.get(settings.channelId);
        if (!channel || typeof channel.send !== 'function') {
            log.warn(logPrefix() + 'Channel Lucy ' + settings.channelId + ' belum tersedia di cache.');
            return false;
        }
        await channel.send(command);
        log.info(logPrefix() + 'Command terkirim: ' + command);
        return true;
    };

    const clickButton = async (msg, customId) => {
        if (!msg || typeof msg.clickButton !== 'function') {
            log.warn(logPrefix() + 'Pesan tidak mendukung clickButton; custom_id=' + customId);
            return false;
        }
        await msg.clickButton(customId);
        log.success(logPrefix() + 'Tombol konfirmasi diklik: ' + customId);
        return true;
    };

    const solvePasswordImage = async url => {
        const solverPath = path.resolve(process.cwd(), 'TooEz.js');
        if (!fs.existsSync(solverPath)) {
            throw new Error('TooEz.js tidak ditemukan di root proyek. Tambahkan file TooEz.js yang digunakan untuk membaca gambar password.');
        }
        const image = await downloadBuffer(url);
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huntbot2-'));
        try {
            fs.writeFileSync(path.join(tempDir, 'L.png'), image);
            const result = await execFileAsync(process.execPath, [solverPath], {
                cwd: tempDir,
                timeout: 30000,
                maxBuffer: 1024 * 1024,
                env: { ...process.env, NODE_PATH: [path.join(process.cwd(), 'node_modules'), process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter) }
            });
            const password = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop();
            if (!password || /HASIL AKHIR/i.test(password)) throw new Error('TooEz.js tidak menghasilkan password dari gambar.');
            return password.replace(/\s+/g, '');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    };

    return {
        async handle(msg) {
            const settings = getSettings();
            if (!settings.enabled || !settings.channelId || !msg) return false;
            if (runtime.lastMessageIds.has(msg.id)) return false;
            if (msg.id) {
                runtime.lastMessageIds.add(msg.id);
                if (runtime.lastMessageIds.size > 300) runtime.lastMessageIds.delete(runtime.lastMessageIds.values().next().value);
            }

            const text = collectMessageText(msg);
            const isDm = msg.channel?.type === 'DM' || !msg.guildId && !msg.guild;
            const isConfiguredChannel = String(msg.channel?.id || msg.channelId || '') === settings.channelId;

            if (isDm && DM_FINISHED_TRIGGER.test(text)) {
                return sendCommand('lucy hb');
            }
            if (!isConfiguredChannel) return false;

            if (PASSWORD_TRIGGER.test(text)) {
                if (runtime.busy) return false;
                runtime.busy = true;
                try {
                    const imageUrl = extractImageUrl(msg);
                    if (!imageUrl) throw new Error('Trigger password terdeteksi tetapi URL gambar tidak ditemukan.');
                    log.info(logPrefix() + 'Mengunduh gambar password dari pesan komponen.');
                    const password = await solvePasswordImage(imageUrl);
                    log.success(logPrefix() + 'Password gambar berhasil dibaca oleh TooEz.js.');
                    return await sendCommand('lhb ' + settings.duration + ' ' + password);
                } catch (error) {
                    log.error(logPrefix() + 'Gagal membaca password: ' + error.message);
                    return false;
                } finally {
                    runtime.busy = false;
                }
            }

            if (SACRIFICE_TRIGGER.test(text)) {
                if (settings.sellAnimals) {
                    log.info(logPrefix() + 'Mode jual hewan aktif; konfirmasi sacrifice dilewati.');
                    return false;
                }
                return clickButton(msg, 'sac_confirm');
            }

            if (SELL_TRIGGER.test(text)) {
                if (!settings.sellAnimals) return false;
                const clicked = await clickButton(msg, 'sell_confirm');
                if (clicked) schedule(() => sendCommand('lhb ' + settings.duration), 2500);
                return clicked;
            }

            if (BACK_TRIGGER.test(text)) {
                return sendCommand(settings.sellAnimals ? 'lsell all' : 'lsac all');
            }

            if (RETURNING_TRIGGER.test(text)) {
                const match = text.match(RETURNING_TRIGGER);
                const amount = Number(match?.[1] || 0);
                const unit = String(match?.[2] || 'M').toUpperCase();
                const normalized = amount + unit;
                log.info(logPrefix() + 'Huntbot kembali dalam ' + normalized + '.');
                return true;
            }

            if (SACRIFICE_TRIGGER.test(text)) return false;
            if (HUNTING_TRIGGER.test(text) || START_TRIGGER.test(text)) {
                log.info(logPrefix() + 'Trigger Huntbot Lucy terdeteksi.');
                return true;
            }

            // Setelah sacrifice confirmation, mulai hunt lagi dengan jeda 2–3 detik.
            if (/sac_confirm/.test(text)) {
                const delay = settings.delayMinMs + Math.floor(Math.random() * (Math.max(settings.delayMinMs, settings.delayMaxMs) - settings.delayMinMs + 1));
                schedule(() => sendCommand('lhb ' + settings.duration), delay);
                return true;
            }
            return false;
        },

        stop() {
            for (const timer of runtime.timers) clearTimeout(timer);
            runtime.timers.clear();
            runtime.busy = false;
        },

        getSettings
    };
};
