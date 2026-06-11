module.exports = function createSavedResponse({ CONSTANTS }) {
function getSavedResponse() {
        return `
        <!DOCTYPE html><html><head><meta http-equiv="refresh" content="${CONSTANTS.REDIRECT_DELAY_SECONDS};url=/" />
        <style>body { background: #0f0f13; color: white; text-align: center; padding-top: 50px; font-family: 'Segoe UI', sans-serif;}
        .success { color: #3ba55c; font-size: 48px; margin-bottom: 20px;} .msg { color: #dcddde; font-size: 18px;} .dt { color: #72767d; font-size: 14px; margin-top: 10px;}</style>
        </head><body><div class="success">✅</div><div class="msg">Configuration Processed!</div><div class="dt">Redirecting to dashboard...</div></body></html>
        `;
    }

    return getSavedResponse;
};
