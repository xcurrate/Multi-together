const CONSTANTS = require('../constants');
const log = require('../../logger');
const { sleep, randomInt, removeInvisibleChars, accountPrefix } = require('../utils');

//const HUNTBOT_CHANNEL_ID = '1378917898063446156';

const RETURN_TIME_PATTERN = /I WILL BE BACK IN\s+([\d\sDHM]+)/i;
const SHORT_RETURN_TIME_PATTERN = /BACK IN\s+([\d\sDHM]+)/i;
const HUNTBOT_PROGRESS_PATTERN = /BEEP BOOP|I AM STILL HUNTING|I WILL BE BACK IN|\d+\.?\d*%\s*DONE|ANIMALS\s*CAPTURED/i;
const HUNTBOT_CHANNEL_RESPONSE_PATTERN = /BEEP BOOP|I AM STILL HUNTING|I WILL BE BACK IN|BACK IN|\d+\.?\d*%\s*DONE|ANIMALS\s*CAPTURED|YOU SPENT|Here is your password!|sold.*for a total of|sacrificed.*for a total of|You successfully upgraded/i;
const HUNTBOT_RESPONSE_WINDOW_MS = 2 * 60 * 1000;
const collectUrls = (value, out = []) => {
    if (!value || typeof value !== 'object') return out;
    if (typeof value.url === 'string' && /^https?:\/\//i.test(value.url)) out.push(value.url);
    if (Array.isArray(value)) value.forEach(item => collectUrls(item, out));
    else Object.values(value).forEach(item => collectUrls(item, out));
    return out;
};
const normalizeTriggerText = (value = '') => String(value)
    .replace(/<a?:[^>]+>/g, ' ')
    .replace(/[*_`#]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
const matchesConfiguredTrigger = (key, text, fallbackPattern) => {
    const trigger = state.config?.huntbot2?.messageTriggers?.[key];
    const configured = typeof trigger === 'string' ? trigger : trigger?.content;
    if (configured && normalizeTriggerText(text).includes(normalizeTriggerText(configured))) return true;
    return fallbackPattern.test(text);
};
const getMessageImageUrl = (msg) => {
    const candidates = [...collectUrls(msg.components || []), ...collectUrls(msg.embeds || []), ...collectUrls(msg.attachments || [])];
    return candidates.find(url => /\.(png|jpe?g|webp)(\?|$)/i.test(url) && /discordapp\.com|discord\.com/i.test(url))
        || candidates.find(url => /discordapp\.com|discord\.com/i.test(url)) || null;
};

const getMessageReferenceId = (msg = {}) => (
    msg.reference?.messageId ||
    msg.messageReference?.messageId ||
    msg.reference?.id ||
    msg.messageReference?.id ||
    null
);

const parseReturnTimeMs = (returnTime = '') => {
    const days = parseInt(String(returnTime).match(/(\d+)\s*D/i)?.[1] || '0', 10);
    const hours = parseInt(String(returnTime).match(/(\d+)\s*H/i)?.[1] || '0', 10);
    const minutes = parseInt(String(returnTime).match(/(\d+)\s*M/i)?.[1] || '0', 10);
    return ((days * 24 * 60) + (hours * 60) + minutes) * 60 * 1000;
};

const collectEmbedText = (embed = {}) => [
    embed.title,
    embed.description,
    embed.author?.name,
    embed.footer?.text,
    ...(embed.fields || []).flatMap(field => [field.name, field.value])
].filter(Boolean).join('\n');

module.exports = (state, huntbotState, configManager, commandSender, telegramService, captchaSolver) => ({

    // ============== MAIN ENTRY POINT ==============
    async processHuntBotMessage(msg) {
        if (state.config?.huntbot2?.enabled !== true) return false;
        const content = removeInvisibleChars(String(msg.content || ""));
        const embedsText = (msg.embeds || []).map(collectEmbedText).join("\n");
        const combinedText = removeInvisibleChars([content, embedsText].filter(Boolean).join("\n"));
        const isDm = msg.channel?.type === 'DM' || msg.channel?.type === 'GROUP_DM' || !msg.guild;
        if (isDm && matchesConfiguredTrigger('DM', combinedText, /huntbot sudah selesai berburu hewan/i)) {
            log.info(`${accountPrefix(state)}📬 DM Huntbot selesai diterima; mengirim lucy hb ke channel konfigurasi.`);
            await this.sendHuntBotCommand('lucy hb');
            return true;
        }
        if (matchesConfiguredTrigger('A', combinedText, /ini passwordmu/i)) {
            const imageUrl = getMessageImageUrl(msg);
            if (!imageUrl) {
                log.error(`${accountPrefix(state)}❌ Trigger A terdeteksi, tetapi URL gambar tidak ditemukan di komponen/attachment.`);
                telegramService?.send?.('⚠️ <b>Huntbot2:</b> trigger password diterima, tetapi URL gambar tidak ditemukan.');
            } else {
                log.warn(`${accountPrefix(state)}🔑 Trigger A: gambar password tersedia untuk dibaca manual: ${imageUrl}`);
                telegramService?.send?.(`🔑 <b>Huntbot2 — Password gambar</b>\nBuka gambar dan baca password secara manual, lalu kirim <code>lhb ${this.getConfiguredDuration()} [password]</code> ke channel Huntbot.\n${imageUrl}`);
            }
            return true;
        }

        if (msg.channel?.id !== state.config?.tiketandhb?.channelId) return false;
        if (matchesConfiguredTrigger('C', combinedText, /konfirmasi pengorbanan rank/i) && /kamu akan sacrifice/i.test(combinedText)) {
            if (state.config?.huntbot2?.sellAllAfterReturn === true) {
                log.info(`${accountPrefix(state)}ℹ️ Mode jual aktif; aksi sacrifice dilewati.`);
                return true;
            }
            const clicked = await this.clickComponentByCustomId(msg, 'sac_confirm');
            if (clicked) this.scheduleDelayedAction(() => this.startHunt(this.getConfiguredDuration()), 2500);
            return true;
        }
        if (matchesConfiguredTrigger('SELL', combinedText, /konfirmasi jual rank/i)) {
            if (state.config?.huntbot2?.sellAllAfterReturn !== true) return true;
            const clicked = await this.clickComponentByCustomId(msg, 'sell_confirm');
            if (clicked) this.scheduleDelayedAction(() => this.startHunt(this.getConfiguredDuration()), 2500);
            return true;
        }
        if (/BEEP BOOP\.?\s*AKU KEMBALI/i.test(combinedText)) {
            if (state.config?.huntbot2?.sellAllAfterReturn === true) {
                log.info(`${accountPrefix(state)}💰 Trigger F: mode jual aktif, mengirim lsell all.`);
                await this.sendHuntBotCommand('lsell all');
            } else {
                log.info(`${accountPrefix(state)}🔪 Trigger F: mengirim lsac all.`);
                await this.sendHuntBotCommand('lsac all');
            }
            return true;
        }
        const returnMatch = combinedText.match(/AKU AKAN KEMBALI DALAM\s+([\d\sDHM]+?)\s+DENGAN\s+([\d,]+)\s+HEWAN/i);
        if (returnMatch) {
            const returnTime = returnMatch[1].trim().replace(/\s+/g, '');
            const animals = returnMatch[2].replace(/,/g, '');
            const totalMs = parseReturnTimeMs(returnTime);
            const endTime = totalMs > 0 ? Date.now() + totalMs : null;
            const endLabel = endTime ? ` (perkiraan ${new Date(endTime).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB)` : '';
            log.info(`${accountPrefix(state)}⏳ Trigger E: Huntbot kembali dalam ${returnTime}, dengan ${animals} hewan${endLabel}.`);
            huntbotState.activeHunt = { ...(huntbotState.activeHunt || {}), returnTime, animals, startTime: Date.now(), endTime };
            return true;
        }
        if (/BEEP\. BOOP\. SAYA HUNTBOT\. SAYA AKAN BERBURU UNTUKMU TUAN/i.test(combinedText)) {
            log.info(`${accountPrefix(state)}🤖 Trigger B: Huntbot mengonfirmasi siap berburu.`);
            return true;
        }
        if (matchesConfiguredTrigger('D', combinedText, /HUNTBOT sedang berburu/i)) {
            log.info(`${accountPrefix(state)}🏹 Trigger D: Huntbot sedang berburu.`);
            return true;
        }
        const myName = this.getMyName(msg);
        if (msg.embeds && msg.embeds.length > 0) {
            for (const embed of msg.embeds) {
                const embedText = removeInvisibleChars(collectEmbedText(embed));
                const embedAuthorName = String(embed.author?.name || '').toLowerCase();
                if (this.isOwnHuntbotResponse(msg, embedText, myName) && (embedAuthorName.includes('huntbot') || HUNTBOT_PROGRESS_PATTERN.test(embedText))) return this.processEmbedMessage(msg, embed, myName);
            }
        }
        const isOwnResponse = this.isOwnHuntbotResponse(msg, content, myName);
        if (isOwnResponse && /Here is your password!/i.test(content)) return this.processPasswordMessage(msg);
        if (isOwnResponse && /YOU SPENT/i.test(content) && RETURN_TIME_PATTERN.test(content)) return this.processHuntStartedMessage(msg, content);
        return false;
    },

    getConfiguredDuration() {
        const config = state.config?.huntbot2 || {};
        return String(config.defaultDuration || config.staticVariables?.defaultDuration || '1D').trim().toUpperCase() || '1D';
    },

    async clickComponentByCustomId(msg, customId) {
        const components = (msg.components || []).flatMap(row => row.components || []);
        const button = components.find(component => component.customId === customId || component.custom_id === customId);
        if (!button) {
            log.warn(`${accountPrefix(state)}⚠️ Tombol ${customId} tidak ditemukan pada pesan konfirmasi.`);
            return false;
        }
        if (typeof msg.clickButton !== 'function') {
            log.error(`${accountPrefix(state)}❌ Library Discord tidak menyediakan clickButton(); tombol ${customId} tidak diklik.`);
            return false;
        }
        try {
            await msg.clickButton({ id: customId });
            log.info(`${accountPrefix(state)}✅ Tombol konfirmasi ${customId} diklik.`);
            return true;
        } catch (error) {
            log.error(`${accountPrefix(state)}❌ Gagal klik tombol ${customId}: ${error.message}`);
            return false;
        }
    },

    // ============== HELPER METHODS ==============
isPaused() {
    return !!state.config?.botStatus?.paused;
},

    shouldAbort(actionName = "") {
        if (state.rest?.active) {
            log.info(`${accountPrefix(state)}😴 HuntBot2 action '${actionName}' ditunda: sedang istirahat.`);
            return true;
        }
        if (state.config?.huntbot2?.enabled !== true) {
            log.warn(`${accountPrefix(state)}🛑 HuntBot2 action '${actionName}' dibatalkan: Huntbot2 OFF`);
            return true;
        }
        return false;
    },

    pruneTrackedCommands() {
        const now = Date.now();
        huntbotState.outgoingCommands = huntbotState.outgoingCommands || new Map();
        for (const [messageId, meta] of huntbotState.outgoingCommands.entries()) {
            if (!meta?.sentAt || now - meta.sentAt > HUNTBOT_RESPONSE_WINDOW_MS) {
                huntbotState.outgoingCommands.delete(messageId);
            }
        }
    },

    trackOutgoingCommand(sentMessage, cmd) {
        if (!sentMessage?.id) return false;
        huntbotState.outgoingCommands = huntbotState.outgoingCommands || new Map();
        huntbotState.outgoingCommands.set(sentMessage.id, {
            cmd,
            channelId: sentMessage.channel?.id || sentMessage.channelId || state.config.tiketandhb?.channelId,
            sentAt: sentMessage.createdTimestamp || Date.now()
        });
        this.pruneTrackedCommands();
        return true;
    },

    trackManualHuntbotCommand(msg) {
        const myId = state.client?.user?.id;
        const content = String(msg.content || '').trim();
        if (!myId || msg.author?.id !== myId) return false;
        if (msg.channel?.id !== state.config.tiketandhb?.channelId) return false;
        if (!/^whb(?:\s|$)/i.test(content)) return false;

        const tracked = this.trackOutgoingCommand(msg, content);
        if (tracked) {
            log.info(`${accountPrefix(state)}🧭 Manual HuntBot command tracked: ${content}`);
        }
        return tracked;
    },

    isOwnHuntbotResponse(msg, text = '', myName = this.getMyName(msg)) {
        const huntbotChannelId = state.config.tiketandhb?.channelId;
        if (msg.channel?.id !== huntbotChannelId) return false;

        const rawText = String(text || '');
        const normalizedText = rawText.toLowerCase();
        const myId = state.client?.user?.id;
        const containsMyName = myName && normalizedText.includes(String(myName).toLowerCase());
        const isMentioned = myId && (rawText.includes(`<@${myId}>`) || msg.mentions?.users?.has(myId));
        if (containsMyName || isMentioned) return true;

        // Balasan `whb 1d` saat HuntBot belum bisa dijemput sering berupa plain text
        // `I WILL BE BACK IN ...` tanpa nama akun. Karena tiap akun memakai channel
        // HuntBot/tiket khusus, teks HuntBot di channel config akun ini dianggap milik akun ini.
        const configuredTriggers = Array.isArray(state.config?.huntbot2?.messageTriggers) ? state.config.huntbot2.messageTriggers : [];
        if (HUNTBOT_CHANNEL_RESPONSE_PATTERN.test(rawText) || configuredTriggers.some(trigger => trigger && normalizedText.includes(String(trigger).toLowerCase()))) return true;

        this.pruneTrackedCommands();
        const referenceId = getMessageReferenceId(msg);
        if (!referenceId) return false;

        const commandMeta = huntbotState.outgoingCommands?.get(referenceId);
        if (!commandMeta) return false;
        if (commandMeta.channelId && commandMeta.channelId !== msg.channel.id) return false;

        return Date.now() - commandMeta.sentAt <= HUNTBOT_RESPONSE_WINDOW_MS;
    },



    getMyName(msg) {
        return msg.guild?.members?.me?.displayName || state.client.user.username;
    },

    // 7. HUNT BERJALAN (EMBED)
    processEmbedMessage(msg, embed, myName) {
        log.info(`${accountPrefix(state)}📊 HuntBot embed detected`);

        const embedText = removeInvisibleChars(collectEmbedText(embed));
        if (/BEEP BOOP|BACK IN|I WILL BE BACK IN/i.test(embedText)) {
            return this.processProgressEmbed(msg, embed, embedText);
        }

        if (embed.fields && embed.fields.length > 0) {
            for (const field of embed.fields) {
                if (field.value && /BEEP BOOP|BACK IN|I WILL BE BACK IN/i.test(field.value)) {
                    return this.processProgressEmbed(msg, embed, field.value);
                }
            }
        }
        
        return false;
    },

    // ============== PROCESS SACRIFICE ==============
    processSacrificeMessage(msg, content) {
        log.info(`${accountPrefix(state)}🔪 HuntBot sacrificed items`);
        
        const cleanContent = removeInvisibleChars(content);
        log.info(`${accountPrefix(state)}🔍 Clean Sacrifice: ${cleanContent}`);
        
        const essenceMatch = cleanContent.match(/total of.*?([\d,]+)/i);
        
        let essenceGained = 0;

        if (essenceMatch) {
            essenceGained = parseInt(essenceMatch[1].replace(/,/g, ''));
            log.info(`${accountPrefix(state)}🔍 Essence gained: ${essenceGained}`);
        } else {
            log.warn(`${accountPrefix(state)}❌ Could not extract essence from: ${cleanContent}`);
        }
        
        telegramService.send(
            `🔪 <b>Sacrifice Complete</b>\n` +
            `Essence gained: ${essenceGained.toLocaleString()}`
        );
        
// huntbot.js
if (huntbotState.autoMode) {
    // Ambil dari state.config (mengikuti pola loop.js yang sudah berhasil)
    const upgradeType = state.config?.huntbot2?.defaultUpgrade || "duration";

    log.info(`${accountPrefix(state)}🧭 HuntBot default upgrade dari config: ${upgradeType}`);

    this.scheduleDelayedAction(() => this.upgrade(upgradeType, "all"), 1000);
}

        
        return true;
    },

    // ============== PROCESS UPGRADE ==============
    processUpgradeText(msg, content) {
        log.info(`${accountPrefix(state)}⬆️ Processing upgrade text response`);
        
        const cleanContent = removeInvisibleChars(content);
        log.info(`${accountPrefix(state)}🔍 Clean Upgrade: ${cleanContent}`);
        
        let duration = null;
        let level = null;
        let progress = null;
        let essence = null;
        
        const essenceMatch = cleanContent.match(/total of.*?>\s*([\d,]+)/i);
        if (essenceMatch) {
            essence = parseInt(essenceMatch[1].replace(/,/g, ''));
            log.info(`${accountPrefix(state)}🔍 Essence used: ${essence}`);
        }
        
        const durationMatch = cleanContent.match(/duration:\s*([\d.]+H)\s*-\s*Lvl\s*(\d+)\s*\[(\d+)\/(\d+)\]/i);
        if (durationMatch) {
            duration = durationMatch[1];
            level = parseInt(durationMatch[2]);
            progress = `${durationMatch[3]}/${durationMatch[4]}`;
            log.info(`${accountPrefix(state)}🔍 Duration: ${duration}, Level: ${level}, Progress: ${progress}`);
        } else {
            log.warn(`${accountPrefix(state)}❌ Could not extract duration/level from upgrade`);
        }
        
        huntbotState.lastUpgradeLevel = { duration, level, progress, essence, raw: content };
        
        telegramService.send(
            `⬆️ <b>Upgrade Complete</b>\n` +
            `Duration: ${duration || 'N/A'}\n` +
            `Level: ${level || 'N/A'}\n` +
            `Essence: ${essence ? essence.toLocaleString() : 'N/A'}`
        );
        
        if (huntbotState.autoMode) {
            this.scheduleDelayedAction(() => this.startHunt("1D"), 1000);
        }
        
        return true;
    },

    // ============== PROCESS PROGRESS (EMBED) ==============
    processProgressEmbed(msg, embed, progressText, source = 'EMBED') {
        log.info(`${accountPrefix(state)}📊 HuntBot progress update (${source})`);
        
        const cleanText = removeInvisibleChars(progressText);
        log.info(`${accountPrefix(state)}🔍 Clean Progress: ${cleanText}`);
        
        let returnTime = null;
        
        const backInMatch = cleanText.match(SHORT_RETURN_TIME_PATTERN);
        if (backInMatch) {
            returnTime = backInMatch[1].trim();
        }
        
        const percentMatch = cleanText.match(/(\d+\.?\d*)%\s*DONE/i);
        const percentage = percentMatch ? parseFloat(percentMatch[1]) : null;
        
        const animalsMatch = cleanText.match(/(\d+)\s*ANIMALS\s*CAPTURED/i);
        const animals = animalsMatch ? parseInt(animalsMatch[1]) : null;
        
        log.info(`${accountPrefix(state)}📊 Extracted - Time: ${returnTime}, Percentage: ${percentage}%, Animals: ${animals}`);
        
        huntbotState.lastProgress = { percentage, animals, returnTime, raw: progressText };
        
        if (percentage !== null && percentage >= 90) {
            telegramService.send(
                `⚠️ <b>HuntBot Almost Done!</b>\n` +
                `${percentage}% complete\n` +
                `Animals: ${animals || 'unknown'}`
            );
        }
        
        if (returnTime) {
            huntbotState.activeHunt = huntbotState.activeHunt || {};
            huntbotState.activeHunt.returnTime = returnTime;
            
            const totalMs = parseReturnTimeMs(returnTime);
            
            if (totalMs > 0) {
                huntbotState.activeHunt.endTime = Date.now() + totalMs;
                
                const endTimeStr = new Date(huntbotState.activeHunt.endTime).toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                log.info(`${accountPrefix(state)}📊 End time updated: ${endTimeStr} WIB`);
                
                // FIX UTAMA: Pastikan monitoring menyala setelah membaca embed
                this.startMonitoring();
            }
        }
        
        return true;
    },

    // ============== PROCESS RETURN ==============
    processReturnMessage(msg, content) {
        log.info(`${accountPrefix(state)}🤖 HuntBot returned with animals!`);
        
        const cleanContent = removeInvisibleChars(content);
        
        const animalMatch = cleanContent.match(/WITH ([\d,]+) ANIMALS/i);
        const essenceMatch = cleanContent.match(/([\d,]+) ESSENCE/i);
        const expMatch = cleanContent.match(/([\d,]+) EXPERIENCE/i);
        
        const animals = animalMatch ? parseInt(animalMatch[1].replace(/,/g, '')) : 0;
        const essence = essenceMatch ? parseInt(essenceMatch[1].replace(/,/g, '')) : 0;
        const exp = expMatch ? parseInt(expMatch[1].replace(/,/g, '')) : 0;
        
        huntbotState.lastResponse = { animals, essence, exp };
        
        telegramService.send(
            `🤖 <b>HuntBot Returned!</b>\n` +
            `Animals: ${animals.toLocaleString()}\n` +
            `Essence: ${essence.toLocaleString()}\n` +
            `Experience: ${exp.toLocaleString()}`
        );
        
        if (huntbotState.autoMode) {
            const useSellAll = state.config?.huntbot2?.sellAllAfterReturn === true;
            if (useSellAll) {
                log.info(`${accountPrefix(state)}💰 Sell All setelah penjemputan aktif: mengirim wsell all lalu skip upgrade.`);
                this.scheduleDelayedAction(() => this.sellAll(), 1000);
            } else {
                this.scheduleDelayedAction(() => this.sacrificeAll(), 1000);
            }
        }
        
        return true;
    },

    // ============== PROCESS SELL ==============
    processSellMessage(msg, content) {
        log.info(`${accountPrefix(state)}💰 HuntBot sold items`);
        const cleanContent = removeInvisibleChars(content);
        const cowoncyMatch = cleanContent.match(/total of .*?([\d,]+)/i);
        const cowoncy = cowoncyMatch ? parseInt(cowoncyMatch[1].replace(/,/g, '')) : 0;
        
        telegramService.send(`💰 <b>Sale Complete</b>\nCowoncy gained: ${cowoncy.toLocaleString()}`);

        if (huntbotState.autoMode && state.config?.huntbot2?.sellAllAfterReturn === true) {
            const duration = (state.config?.huntbot2?.staticVariables?.defaultDuration || state.config?.huntbot2?.defaultDuration || CONSTANTS.HUNTBOT.DEFAULT_DURATION);
            log.info(`${accountPrefix(state)}🚀 Sell All selesai: skip wupg dan memulai HuntBot lagi (${duration}).`);
            this.scheduleDelayedAction(() => this.startHunt(duration), 1000);
        }

        return true;
    },

    processPasswordMessage(msg) {
        log.warn(`${accountPrefix(state)}⚠️ Pesan password format lama diabaikan; gunakan trigger komponen "ini passwordmu".`);
        return false;
    },

    // ============== PROCESS HUNT STARTED ==============
    processHuntStartedMessage(msg, content) {
        log.info(`${accountPrefix(state)}🚀 HuntBot started successfully`);
        
        const cleanContent = removeInvisibleChars(content);
        const spentMatch = cleanContent.match(/YOU SPENT ([\d,]+) COWONCY/i);
        const returnTimeMatch = cleanContent.match(RETURN_TIME_PATTERN);
        
        const spent = spentMatch ? parseInt(spentMatch[1].replace(/,/g, '')) : 0;
        const returnTime = returnTimeMatch ? returnTimeMatch[1].trim() : "unknown";
        
        log.info(`${accountPrefix(state)}⏳ I WILL BE BACK IN ${returnTime}`);
        
        huntbotState.activeHunt = {
            startTime: Date.now(),
            returnTime,
            spent,
            messageId: msg.id
        };
        
        if (returnTime !== "unknown") {
            const totalMs = parseReturnTimeMs(returnTime);
            if (totalMs > 0) {
                huntbotState.activeHunt.endTime = Date.now() + totalMs;
            }
        }
        
        telegramService.send(
            `🚀 <b>HuntBot Started!</b>\n` +
            `Spent: ${spent.toLocaleString()} cowoncy\n` +
            `Returns in: ${returnTime}`
        );
        
        this.startMonitoring();
        
        return true;
    },

    // ============== INITIALIZATION ==============
    init(options = {}) {
        log.info(`${accountPrefix(state)}⚙️ Initializing HuntBot Manager...`);
        const config = configManager.read() || {};
        
        // Memastikan loop menyala apapun kondisinya
        this.startMonitoring();
        
        // Mengecek apakah config.huntbot2 ada DAN autoMode-nya true (Struktur DeepSeek)
        const isAutoModeOn = (config.huntbot2 && config.huntbot2.autoMode === true) || 
                             config.autoHuntbot === true || 
                             huntbotState.autoMode === true;
        
        if (isAutoModeOn) {
            log.info(`${accountPrefix(state)}🤖 HuntBot Auto-start detected in config.`);
            huntbotState.autoMode = false; // Reset sementara agar startAutoMode bisa me-restart statusnya
            this.startAutoMode({
                skipInitialCheck: options.skipInitialCheck,
                allowPaused: options.skipInitialCheck === true
            });
        } else {
            log.warn(`${accountPrefix(state)}⚠️ Auto Mode terdeteksi OFF di config.json`);
        }
    },

    // ============== CUSTOM SENDER ==============
// HUNTBOT.JS

async sendHuntBotCommand(cmd) {
    if (this.shouldAbort(`sendHuntBotCommand(${cmd})`)) return;

    try {
        const huntbotChannelId = state.config.tiketandhb.channelId;
        const channel = state.client.channels.cache.get(huntbotChannelId);

        if (!channel) {
            log.error(`${accountPrefix(state)}❌ Channel HuntBot (${huntbotChannelId}) belum ter-cache atau ID salah!`);

            return;
        }

        await channel.sendTyping();
        await sleep(randomInt(500, 1000)); 
        
        // 2. Re-check setelah sleep, biar pause yang dinyalakan saat nunggu tetap kepake
        // Asumsi: shouldAbort adalah metode valid dari class/objek ini yang mengecek status pause bot.
        if (this.shouldAbort(`sendHuntBotCommand(${cmd}) post-sleep`)) return;

        const sentMessage = await channel.send(cmd);
        this.trackOutgoingCommand(sentMessage, cmd);
        log.info(`${accountPrefix(state)}💬 [HuntBot Channel] Terkirim: ${cmd}`);

    } catch (error) {
        log.error(`${accountPrefix(state)}❌ Gagal mengirim command HuntBot: ${error.message}`);
    }
},


    // ============== COMMAND METHODS ==============
async checkStatus() {
    if (this.shouldAbort('checkStatus')) return;
    await this.sendHuntBotCommand(CONSTANTS.HUNTBOT.COMMANDS.CHECK);
},


    async sellAll() {
        await this.sendHuntBotCommand('lsell all');
    },

    async sacrificeAll() {
        await this.sendHuntBotCommand('lsac all');
    },

    async upgrade(type = (state.config?.huntbot2?.staticVariables?.defaultUpgrade || state.config?.huntbot2?.defaultUpgrade || CONSTANTS.HUNTBOT.DEFAULT_UPGRADE), amount = "all") {
        const cmd = `${CONSTANTS.HUNTBOT.COMMANDS.UPGRADE} ${type} ${amount}`;
        await this.sendHuntBotCommand(cmd);
    },

    async startHunt(duration = (state.config?.huntbot2?.staticVariables?.defaultDuration || state.config?.huntbot2?.defaultDuration || CONSTANTS.HUNTBOT.DEFAULT_DURATION), password = "") {
        if (password) {
            huntbotState.activeHunt = null;
            huntbotState.notifiedSoon = false;
        }

        const cmd = password
            ? `lhb ${duration} ${password}`
            : `lhb ${duration}`;
        
        await this.sendHuntBotCommand(cmd);
    },

    // ============== AUTO MODE & MONITORING ==============
        // ============== AUTO MODE & MONITORING ==============
    startAutoMode(options = {}) {
        if (this.shouldAbort('startAutoMode', { allowPaused: options.allowPaused === true })) return;
        
        if (huntbotState.autoMode) return;
        huntbotState.autoMode = true;
        log.success(`${accountPrefix(state)}🤖 HuntBot Auto Mode ACTIVE`);
        telegramService.send("🤖 <b>HuntBot Auto Mode</b>\nStarting auto loop...");
        
        this.startMonitoring();
        if (!options.skipInitialCheck) {
            this.checkStatus();
        } else {
            log.info(`${accountPrefix(state)}🤖 Initial HuntBot check dilewati karena startup ready sequence yang mengirim whb.`);
        }
    },


    stopAutoMode(options = {}) {
        huntbotState.autoMode = false;
        
        // PENGAMAN: Pastikan objek loops ada
        huntbotState.loops = huntbotState.loops || {};

        if (huntbotState.loops.monitor) {
            clearInterval(huntbotState.loops.monitor);
            huntbotState.loops.monitor = null;
        }
        log.info(`${accountPrefix(state)}🤖 HuntBot Auto Mode STOPPED`);
        if (options.notify !== false) {
            telegramService.send("🤖 <b>HuntBot Auto Mode</b>\nLoop stopped.");
        }
    },

scheduleDelayedAction(fn, delayMs) {
    huntbotState.timeouts = huntbotState.timeouts || new Set();
    const timer = setTimeout(() => {
        huntbotState.timeouts.delete(timer);
        if (!this.shouldAbort('delayed HuntBot action')) fn();
    }, delayMs);
    huntbotState.timeouts.add(timer);
    return timer;
},

startMonitoring() {
    huntbotState.loops = huntbotState.loops || {};

    if (huntbotState.loops.monitor) {
        clearInterval(huntbotState.loops.monitor);
    }
    log.info(`${accountPrefix(state)}⏱️ Mesin monitoring waktu HuntBot diaktifkan.`);

    huntbotState.loops.monitor = setInterval(() => {


        this.checkActiveHunt();
    }, 60000);
},

checkActiveHunt() {
    if (state.rest?.active) return;
    if (!huntbotState.activeHunt?.endTime) return;
        
        const now = Date.now();
        const timeLeft = huntbotState.activeHunt.endTime - now;
        
        // Notif 5 menit sebelum selesai (H-5)
        if (timeLeft > 0 && timeLeft <= 5 * 60 * 1000 && !huntbotState.notifiedSoon) {
            huntbotState.notifiedSoon = true;
            log.info(`${accountPrefix(state)}⏰ Waktu sisa < 5 menit. Mengirim notifikasi Telegram...`);
            telegramService.send(`⏰ <b>HuntBot Returning Soon!</b>\nLess than 5 minutes remaining!`);
        }
        
        // Auto check saat waktu habis (Bot menjemput secara otomatis)
        if (timeLeft <= 0) {
            log.info(`${accountPrefix(state)}⏰ Waktu HuntBot telah habis!`);
            
            // Reset status agar tidak dikirim berulang kali
            huntbotState.notifiedSoon = false;
            huntbotState.activeHunt = null; 
            
            if (huntbotState.autoMode) {
                log.info(`${accountPrefix(state)}🚀 Auto-Mode ON: Menjemput HuntBot dengan command whb...`);
                this.checkStatus();
            } else {
                log.warn(`${accountPrefix(state)}⚠️ Auto-Mode OFF: Huntbot Selesai, menunggu aksi manual.`);
                telegramService.send(`⏰ <b>HuntBot Selesai!</b>\nSilakan kirim 'whb' secara manual untuk menjemput.`);
            }
        }
    },

    stop(options = {}) {
        this.stopAutoMode(options);
        if (huntbotState.timeouts) {
            for (const timer of huntbotState.timeouts) clearTimeout(timer);
            huntbotState.timeouts.clear();
        }
        huntbotState.activeHunt = null;
    },

    getStatus() {
        return {
            autoMode: huntbotState.autoMode,
            activeHunt: huntbotState.activeHunt,
            lastUpgrade: huntbotState.lastUpgradeLevel,
            lastProgress: huntbotState.lastProgress,
        };
    }
});
