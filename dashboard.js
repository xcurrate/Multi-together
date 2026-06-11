const createDashboardApp = require('./src/dashboard/app');

function start() {
    const { app, port } = createDashboardApp();

    try {
        console.log(`[DASHBOARD] Starting server on port ${port} (0.0.0.0)...`);
        app.listen(port, '0.0.0.0', () => {
            console.log(`[DASHBOARD] ✅ Running on http://0.0.0.0:${port}`);
            console.log(`[DASHBOARD] 🌐 Access from external: http://PerkasaHost:${port}`);
        });
    } catch (error) {
        console.error('[DASHBOARD] ❌ Failed to start:', error.message);
    }
}

module.exports = start;
