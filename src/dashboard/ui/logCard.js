function getLogCard() {
        return `
        <div class="card">
            <div class="card-title">
                <label class="section-label">🧾 Log Dashboard</label>
                <span class="stat-note">Rapi, ringan, tanpa efek</span>
            </div>
            <div id="logBox" class="log-box"><div class="log-empty">(loading...)</div></div>
        </div>
        `;
    }

module.exports = getLogCard;
