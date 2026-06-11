module.exports = function createDashboardStatsCard({ escapeHtml, statsService }) {
function getDashboardStatsCard(snapshot) {
        const commandTypes = Object.entries(snapshot.commands.byType || {})
            .sort((a, b) => b[1] - a[1])
            .map(([type, total]) => `<span class="pill">${escapeHtml(type)}: <strong>${total}</strong></span>`)
            .join('') || '<span class="pill">Belum ada command</span>';

        const recentCommands = (snapshot.commands.recent || []).slice(-5).reverse()
            .map(item => `
                <div class="recent-item">
                    <span class="recent-muted">${escapeHtml(statsService.formatTime(item.at))}</span>
                    <strong>${escapeHtml(item.type || 'Command')}</strong>
                    <span>${escapeHtml(item.cmd || '-')}</span>
                </div>
            `)
            .join('') || '<div class="recent-item"><span class="recent-muted">Belum ada command terkirim sejak bot berjalan.</span></div>';

        const lastCommand = snapshot.commands.last
            ? `${snapshot.commands.last.cmd} • ${snapshot.commands.last.type}`
            : 'Belum ada command terkirim';

        return `
        <div class="dashboard-grid" id="statsGrid">
            <div class="stat-card">
                <div class="stat-label">Captcha</div>
                <div class="stat-value" data-stat="captchaSolved">${snapshot.captcha.solved}/${snapshot.captcha.detected}</div>
                <div class="stat-note" data-stat="captchaStatus">${snapshot.captcha.active ? 'Aktif - butuh perhatian' : 'Aman, tidak aktif'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Uptime</div>
                <div class="stat-value" data-stat="uptimeText">${escapeHtml(snapshot.uptime.text)}</div>
                <div class="stat-note" data-stat="startedAt">Start: ${escapeHtml(snapshot.uptime.startedAt)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Status Info</div>
                <div class="stat-value" data-stat="statusText" style="font-size: 18px;">${escapeHtml(snapshot.status.text)}</div>
                <div class="stat-note" data-stat="statusNote">Channel aktif: ${escapeHtml(snapshot.status.activeChannelId)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Command</div>
                <div class="stat-value" data-stat="commandTotal">${snapshot.commands.total}</div>
                <div class="stat-note" data-stat="lastCommand">${escapeHtml(lastCommand)}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">
                <label class="section-label">📊 Statistik Command per Tipe</label>
                <a class="btn btn-secondary" style="width:auto; padding: 9px 12px;" href="/export-config">⬇ Export Config</a>
            </div>
            <div id="commandTypes" class="pill-list">${commandTypes}</div>
            <div class="divider"></div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="stat-label">Captcha terselesaikan</div>
                    <div class="stat-value" data-stat="captchaSolvedOnly" style="font-size: 20px;">${snapshot.captcha.solved}</div>
                    <div class="stat-note" data-stat="captchaLastSolved">Terakhir: ${escapeHtml(statsService.formatTime(snapshot.captcha.lastSolvedAt))}</div>
                </div>
                <div class="info-item">
                    <div class="stat-label">Captcha terdeteksi</div>
                    <div class="stat-value" data-stat="captchaDetectedOnly" style="font-size: 20px;">${snapshot.captcha.detected}</div>
                    <div class="stat-note" data-stat="captchaLastDetected">Terakhir: ${escapeHtml(statsService.formatTime(snapshot.captcha.lastDetectedAt))}</div>
                </div>
                <div class="info-item">
                    <div class="stat-label">Status layanan</div>
                    <div class="stat-note" data-stat="serviceFlags">Autosolver: ${snapshot.status.autosolver ? 'ON' : 'OFF'} • Telegram: ${snapshot.status.telegram ? 'ON' : 'OFF'} • Channel: ${snapshot.status.channelsTotal}</div>
                </div>
            </div>
            <div class="divider"></div>
            <label class="section-label">Command terbaru</label>
            <div id="recentCommands" class="recent-list">${recentCommands}</div>
        </div>
        `;
    }

    return getDashboardStatsCard;
};
