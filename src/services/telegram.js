const https = require('https');
const log = require('../../logger');
const { accountPrefix } = require('../utils');

module.exports = (state) => ({
    send: (text) => {
        const { token, chatId } = state.config.settings?.telegram || {};
        if (!token || !chatId) return;

        const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}&parse_mode=HTML`;
        https.get(url).on('error', (e) => log.error(`${accountPrefix(state)}Telegram error: ${e.message}`));
    },

    sendTicketNotification: (tickets, isOutOfTickets = false) => {
        const telegram = module.exports(state);
        if (isOutOfTickets) {
            telegram.send(
                `⛔ <b>TICKET HABIS!</b>\n` +
                `Bot berhenti berburu boss sampai reset jam 15:00 WIB.\n` +
                `Tiket: 0/3`
            );
        } else {
            telegram.send(
                `🎫 <b>Update Tiket Boss</b>\n` +
                `Sisa tiket: <b>${tickets}/3</b>`
            );
        }
    }
});