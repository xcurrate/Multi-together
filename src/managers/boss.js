const CONSTANTS = require('../constants');
const log = require('../../logger');
const { deepCopy, safeJsonStringify, removeInvisibleChars, accountPrefix } = require('../utils');

const isRuntimeActive = (state) => !!state.config?.botStatus?.running && !state.config?.botStatus?.paused && !state.hasActiveCaptcha;

function getNextResetInfo() {
    const now = new Date();
    
    // Buat representasi waktu sekarang di Pasifik
    const ptStr = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const ptDate = new Date(ptStr);
    
    // Set waktu target reset untuk hari ini di Pasifik menggunakan nilai dari CONSTANTS
    const targetPtDate = new Date(ptDate);
    targetPtDate.setHours(CONSTANTS.DAILY_RESET_HOUR, CONSTANTS.DAILY_RESET_MINUTE, 0, 0);
    
    // Jika waktu reset hari ini sudah lewat, maka reset selanjutnya adalah besok (+1 hari)
    if (ptDate.getTime() >= targetPtDate.getTime()) {
        targetPtDate.setDate(targetPtDate.getDate() + 1);
    }
    
    // Hitung selisih waktu (dalam milidetik)
    const diffMs = targetPtDate.getTime() - ptDate.getTime();
    
    // Hitung waktu reset di dunia nyata (waktu bot saat ini + selisih waktu)
    const nextResetRealDate = new Date(now.getTime() + diffMs);
    
    // Format menjadi jam WIB
    const timeWIB = nextResetRealDate.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Format waktu mundur
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { 
        wibTime: timeWIB, 
        countdown: `${diffHours}j ${diffMinutes}m` 
    };
}

module.exports = (state, configManager, telegramService) => ({
    canFight(msg) {
        if (!isRuntimeActive(state)) return false;
        if (state.stopBossHunt) return false;

        const { allowedGuilds } = configManager.getBossSettings();
        if (allowedGuilds.length > 0 && (!msg.guildId || !allowedGuilds.includes(msg.guildId))) {
            return false;
        }

        if (state.foughtBosses.has(msg.id)) return false;

        const now = Date.now();
        if (msg.guildId && state.bossCooldowns.has(msg.guildId)) {
            if (now - state.bossCooldowns.get(msg.guildId) < CONSTANTS.BOSS_COOLDOWN_MS) {
                return false;
            }
        }

        return true;
    },

    findButton(obj, targetId) {
        if (!obj || typeof obj !== 'object') return null;

        const id = obj.custom_id || obj.customId;
        if (id === targetId) return obj;

        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = this.findButton(item, targetId);
                if (found) return found;
            }
        } else {
            for (const key in obj) {
                if (['client', 'guild', 'channel', 'member'].includes(key)) continue;
                const found = this.findButton(obj[key], targetId);
                if (found) return found;
            }
        }
        return null;
    },

    async handle(msg) {
        const bossSettings = configManager.getBossSettings();
        if (!bossSettings.enabled) return;

        if (!this.canFight(msg)) return;
        if (!msg.components?.length) return;

        try {
            const rawComponents = deepCopy(msg.components);
            const compStr = safeJsonStringify(msg.components);
            const isAppear = compStr.includes("A Guild Boss Appeared");
            const isDefeated = compStr.includes("Guild Boss Defeated");

            if (isAppear && !isDefeated) {
                await this.handleBossAppear(msg, rawComponents);
            } else if (isDefeated) {
                this.handleBossDefeated(msg);
            }
        } catch (e) {
            log.error(`Handle Boss Error: ${e.message}`);
        }
    },

async handleBossAppear(msg, rawComponents) {
    if (state.bossRespawnTimers.has(msg.guildId)) {
        clearTimeout(state.bossRespawnTimers.get(msg.guildId));
        state.bossRespawnTimers.delete(msg.guildId);
    }

    const fightBtn = this.findButton(rawComponents, "guildboss_fight");
    if (fightBtn && fightBtn.disabled !== true) {
        const btnId = fightBtn.custom_id || fightBtn.customId;

        // Kita bungkus proses klik dan update state di dalam try...catch
        try {
            await msg.clickButton(btnId);
            
            // Kode di bawah ini hanya akan berjalan JIKA klik tombol berhasil
            log.success(`⚔️ ACTION: Fight Boss!`);

            state.foughtBosses.add(msg.id);
            state.bossCooldowns.set(msg.guildId, Date.now());

            if (state.foughtBosses.size > CONSTANTS.MAX_SET_SIZE) {
                state.foughtBosses.delete(state.foughtBosses.values().next().value);
            }

            const ticketTimer = setTimeout(() => {
                state.bossTicketCheckTimers?.delete(ticketTimer);
                this.checkTickets(msg.client);
            }, CONSTANTS.TICKET_CHECK_DELAY_MS);
            state.bossTicketCheckTimers = state.bossTicketCheckTimers || new Set();
            state.bossTicketCheckTimers.add(ticketTimer);
            
        } catch (error) {
            // Jika klik tombol gagal (misal karena verifikasi), error ditangkap di sini
            if (error.message && error.message.includes("Channel verification level is too high")) {
                // Asumsi kamu menggunakan 'log.error', sesuaikan dengan logger-mu (misal: console.error)
                log.error(`❌ Gagal Fight Boss: Level verifikasi server terlalu tinggi.`);
            } else {
                log.error(`❌ Gagal Fight Boss karena error lain: ${error.message || error}`);
            }
        }
    }
},

    handleBossDefeated(msg) {
        if (state.bossCooldowns.has(msg.guildId)) {
            state.bossCooldowns.delete(msg.guildId);
        }

        if (state.bossRespawnTimers.has(msg.guildId)) {
            clearTimeout(state.bossRespawnTimers.get(msg.guildId));
        }

        const guildName = msg.guild?.name || "Server";
        log.info(`💀 Boss Defeated di ${guildName}. Timer 4m 55s dimulai...`);

        const timer = setTimeout(() => {
            const alertMsg = `⚠️ <b>SIAP-SIAP!</b> ⚠️\nBoss di <b>${guildName}</b> muncul dalam <b>5 DETIK</b>!\nSiapkan jari! ⚔️`;
            telegramService.send(alertMsg);
            log.info(`🔔 Mengirim Notifikasi 5 Detik ke Telegram.`);
        }, CONSTANTS.BOSS_COOLDOWN_MS);

        state.bossRespawnTimers.set(msg.guildId, timer);
    },

async checkTickets(client) {

    // 🛑 Skenario baru: 
    // Jika sedang terkena captcha, maka BERHENTI (return).
    // Jika tidak ada captcha, proses akan LANJUT terus (walaupun bot sedang dipause).
    if (!isRuntimeActive(state)) return;

    try {
        const ticketChannelId = state.config.tiketandhb.channelId;
        const ticketChannel = client.channels.cache.get(ticketChannelId);
        
        if (!ticketChannel) {
            log.warn(`⚠️ Gagal akses Channel Tiket: ${ticketChannelId}`);
            return;
        }

        log.info(`${accountPrefix(state)}🕵️ Mengirim 'wboss ticket' ke Channel Khusus...`);
        await ticketChannel.send("wboss t");
        state.lastTicketCheck = Date.now();
        state.pendingBossTicketCheck = {
            channelId: ticketChannelId,
            requestedAt: state.lastTicketCheck
        };
    } catch (err) {
        log.error(`Error kirim cek tiket: ${err.message}`);
    }
},

    processTicketMessage(msg) {
        let fullContent = msg.content || '';
        
        if (msg.components && msg.components.length > 0) {
            fullContent += ' ' + safeJsonStringify(msg.components);
        }

        if (!isRuntimeActive(state)) return false;

        const cleanText = removeInvisibleChars(fullContent).toLowerCase();

        if (!cleanText.includes('boss ticket') && !cleanText.includes('ticket')) {
            return false;
        }

        const myName = (msg.guild?.members?.me?.displayName || state.client.user.username).toLowerCase();
        const myId = state.client?.user?.id;
        const pending = state.pendingBossTicketCheck;
        const hasExplicitOwner = cleanText.includes(myName) ||
            (myId && (cleanText.includes(`<@${myId}>`) || msg.mentions?.users?.has(myId)));
        const hasRecentOwnRequest = pending?.channelId === msg.channel.id &&
            Date.now() - pending.requestedAt <= 15000;
        const isAnonymousTicketReply = cleanText.includes('you ran out') ||
            cleanText.includes('currently have') ||
            cleanText.includes('**0**/3') ||
            cleanText.match(/\*\*(\d+)\*\*\/\*\*3\*\*/);
        const isMyTicket = hasExplicitOwner || (hasRecentOwnRequest && isAnonymousTicketReply);

        if (!isMyTicket) return false;
        state.pendingBossTicketCheck = null;

        if (cleanText.includes('ran out of') || 
            cleanText.includes('have **0**') || 
            cleanText.includes('**0**/3')) {
            
            // Panggil perhitungan waktu dinamis
            const resetInfo = getNextResetInfo();
            
            state.stopBossHunt = true;
            log.warn(`⛔ TIKET HABIS (0/3). Stop Hunt sampai ${resetInfo.wibTime} WIB (Waktu Mundur: ${resetInfo.countdown}).`);
            telegramService.sendTicketNotification(0, true);
            
        } else {
            const ticketMatch = cleanText.match(/\*\*(\d+)\*\*\/\*\*3\*\*/) || 
                               cleanText.match(/have \*\*(\d+)\*\*\/\*\*3\*\*/);
            
            if (ticketMatch) {
                const sisa = parseInt(ticketMatch[1]);
                log.info(`🎫 Tiket Terupdate: ${sisa}/3`);
                
                if (sisa > 0) {
                    state.stopBossHunt = false;
                    telegramService.sendTicketNotification(sisa);
                } else {
                    // Beri waktu dinamis juga jika match format (0/3) masuk lewat blok ini
                    const resetInfo = getNextResetInfo();
                    
                    state.stopBossHunt = true;
                    log.warn(`⛔ TIKET HABIS (${sisa}/3). Stop Hunt sampai ${resetInfo.wibTime} WIB (Waktu Mundur: ${resetInfo.countdown}).`);
                    telegramService.sendTicketNotification(0, true);
                }
            }
        }

        return true;
    },

    stop() {
        if (state.bossTicketCheckTimers) {
            for (const timer of state.bossTicketCheckTimers) clearTimeout(timer);
            state.bossTicketCheckTimers.clear();
        }

        if (state.bossRespawnTimers) {
            for (const timer of state.bossRespawnTimers.values()) clearTimeout(timer);
            state.bossRespawnTimers.clear();
        }

        state.pendingBossTicketCheck = null;
    }
    

    // processTicketMessage(msg) {
        // let fullContent = msg.content || '';
        
        // if (msg.components && msg.components.length > 0) {
            // fullContent += ' ' + safeJsonStringify(msg.components);
        // }

        // const cleanText = removeInvisibleChars(fullContent).toLowerCase();

        // if (!cleanText.includes('boss ticket') && !cleanText.includes('ticket')) {
            // return false;
        // }

        // const myName = (msg.guild?.members?.me?.displayName || state.client.user.username).toLowerCase();
        
        // const isMyTicket = 
            // cleanText.includes(myName) || 
            // cleanText.includes('you ran out') || 
            // cleanText.includes('currently have') ||
            // cleanText.includes('**0**/3') ||
            // cleanText.match(/\*\*(\d+)\*\*\/\*\*3\*\*/);

        // if (!isMyTicket) return false;

        // if (cleanText.includes('ran out of') || 
            // cleanText.includes('have **0**') || 
            // cleanText.includes('**0**/3')) {
            
            // state.stopBossHunt = true;
                    // log.warn(`⛔ TIKET HABIS (${sisa}/3). Stop Hunt sampai ${resetInfo.wibTime} WIB (Waktu Mundur: ${resetInfo.countdown}).`);
                    // telegramService.sendTicketNotification(0, true);
            
        // } else {
            // const ticketMatch = cleanText.match(/\*\*(\d+)\*\*\/\*\*3\*\*/) || 
                               // cleanText.match(/have \*\*(\d+)\*\*\/\*\*3\*\*/);
            
            // if (ticketMatch) {
                // const sisa = parseInt(ticketMatch[1]);
                // log.info(`🎫 Tiket Terupdate: ${sisa}/3`);
                
                // if (sisa > 0) {
                    // state.stopBossHunt = false;
                    // telegramService.sendTicketNotification(sisa);
                // } else {
                    // state.stopBossHunt = true;
                    // telegramService.sendTicketNotification(0, true);
                // }
            // }
        // }

        // return true;
    // }
    
});