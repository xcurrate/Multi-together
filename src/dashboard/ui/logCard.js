function getLogCard() {
        return `
        <div class="card">
            <div class="card-title">
                <label class="section-label">🧾 Log Dashboard</label>
                <span class="stat-note">Berwarna, auto-scroll hanya saat di bawah</span>
            </div>
            <div id="logBox" class="log-box"><div class="log-empty">(loading...)</div></div>
        </div>
        `;
    }

module.exports = getLogCard;
