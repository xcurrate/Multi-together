module.exports = function createScripts({ CONSTANTS, serializeForScript }) {
function getLogRefreshScript(profileOptions = [], viewingProfileId = '') {
        const profileOptionsJson = serializeForScript(profileOptions);
        const viewingProfileIdJson = serializeForScript(viewingProfileId || '');
        return `
        <script>
            (function() {
                let retryCount = 0;
                function parseLogLine(line) {
                    const match = String(line || '').match(/^(\[[^\]]+\])\s+(\[[^\]]+\])\s+(.*)$/);
                    if (!match) return { time: '', level: '', message: line || '' };
                    return { time: match[1], level: match[2], message: match[3] };
                }

                function renderLogs(lines) {
                    const logBox = document.getElementById('logBox');
                    if (!logBox) return;
                    if (!lines || !lines.length) {
                        logBox.innerHTML = '<div class="log-empty">✨ Belum ada log...</div>';
                        return;
                    }
                    logBox.innerHTML = lines.map(line => {
                        const item = parseLogLine(line);
                        return '<div class="log-line">' +
                            '<span class="log-time">' + escapeHtml(item.time) + '</span>' +
                            '<span class="log-level">' + escapeHtml(item.level) + '</span>' +
                            '<span class="log-message">' + escapeHtml(item.message) + '</span>' +
                        '</div>';
                    }).join('');
                    logBox.scrollTop = logBox.scrollHeight;
                }

                async function refreshLogs() {
                    try {
                        const res = await fetch('/logs', { cache: 'no-store', headers: { 'Accept': 'application/json' }});
                        if (!res.ok) throw new Error('HTTP Error');
                        const data = await res.json();
                        renderLogs(data.lines);
                        retryCount = 0;
                    } catch (err) {
                        retryCount++;
                        renderLogs([retryCount <= 3 ? '[--:--:--] [INFO] ⏳ Reconnecting...' : '[--:--:--] [WARN] 📡 Log service unavailable']);
                    }
                }

                function updateText(selector, text) {
                    const el = document.querySelector(selector);
                    if (el) el.textContent = text;
                }

                function renderCommandTypes(byType) {
                    const target = document.getElementById('commandTypes');
                    if (!target) return;
                    const entries = Object.entries(byType || {}).sort((a, b) => b[1] - a[1]);
                    target.innerHTML = entries.length
                        ? entries.map(([type, total]) => '<span class="pill">' + escapeHtml(type) + ': <strong>' + total + '</strong></span>').join('')
                        : '<span class="pill">Belum ada command</span>';
                }

                function renderRecentCommands(commands) {
                    const target = document.getElementById('recentCommands');
                    if (!target) return;
                    const entries = (commands || []).slice(-5).reverse();
                    target.innerHTML = entries.length
                        ? entries.map(item => '<div class="recent-item">' +
                            '<span class="recent-muted">' + escapeHtml(item.atFormatted || '-') + '</span>' +
                            '<strong>' + escapeHtml(item.type || 'Command') + '</strong>' +
                            '<span>' + escapeHtml(item.cmd || '-') + '</span>' +
                        '</div>').join('')
                        : '<div class="recent-item"><span class="recent-muted">Belum ada command terkirim sejak bot berjalan.</span></div>';
                }

                const viewingProfileId = ${viewingProfileIdJson};
                const profileQuery = viewingProfileId ? '?profileId=' + encodeURIComponent(viewingProfileId) : '';

                async function refreshStats() {
                    try {
                        const res = await fetch('/api/stats' + profileQuery, { cache: 'no-store', headers: { 'Accept': 'application/json' }});
                        if (!res.ok) throw new Error('HTTP Error');
                        const data = await res.json();
                        const lastCommand = data.commands.last ? data.commands.last.cmd + ' • ' + data.commands.last.type : 'Belum ada command terkirim';
                        updateText('[data-stat="commandTotal"]', data.commands.total);
                        updateText('[data-stat="lastCommand"]', lastCommand);
                        updateText('[data-stat="captchaSolved"]', data.captcha.solved + '/' + data.captcha.detected);
                        updateText('[data-stat="captchaStatus"]', data.captcha.active ? 'Aktif - butuh perhatian' : 'Aman, tidak aktif');
                        updateText('[data-stat="uptimeText"]', data.uptime.text);
                        updateText('[data-stat="startedAt"]', 'Start: ' + data.uptime.startedAt);
                        updateText('[data-stat="statusText"]', data.status.text);
                        updateText('[data-stat="statusNote"]', 'Channel aktif: ' + data.status.activeChannelId);
                        updateText('[data-stat="captchaSolvedOnly"]', data.captcha.solved);
                        updateText('[data-stat="captchaDetectedOnly"]', data.captcha.detected);
                        updateText('[data-stat="captchaLastSolved"]', 'Terakhir: ' + (data.captcha.lastSolvedAtFormatted || '-'));
                        updateText('[data-stat="captchaLastDetected"]', 'Terakhir: ' + (data.captcha.lastDetectedAtFormatted || '-'));
                        updateText('[data-stat="serviceFlags"]', 'Autosolver: ' + (data.status.autosolver ? 'ON' : 'OFF') + ' • Telegram: ' + (data.status.telegram ? 'ON' : 'OFF') + ' • Channel: ' + data.status.channelsTotal);
                        renderCommandTypes(data.commands.byType);
                        renderRecentCommands(data.commands.recent);
                    } catch (err) {
                        updateText('[data-stat="statusNote"]', 'Statistik belum bisa diperbarui');
                    }
                }

                refreshLogs(); setInterval(refreshLogs, ${CONSTANTS.LOG_REFRESH_INTERVAL_MS});
                refreshStats(); setInterval(refreshStats, 1000);
                
                // AUTO FETCH PROFILE SCRIPT
                async function fetchProfile() {
                    try {
                        const res = await fetch('/api/profile' + profileQuery);
                        const data = await res.json();
                        const profileBox = document.getElementById('userProfileBox');
                        
                        if (data.username) {
                            const name = data.global_name || data.username;
                            const avatarUrl = data.avatar 
                                ? \`https://cdn.discordapp.com/avatars/\${data.id}/\${data.avatar}.png?size=64\`
                                : \`https://cdn.discordapp.com/embed/avatars/0.png\`;
                                
                            profileBox.innerHTML = \`
                                <img src="\${avatarUrl}" alt="Avatar">
                                <div>
                                    <div style="color: var(--text); font-weight: bold; font-size: 14px;">\${name}</div>
                                    <div style="font-size: 11px; color: #8e9297;">@\${data.username} (\${data.id})</div>
                                </div>
                            \`;
                        } else {
                            profileBox.innerHTML = '❌ Gagal memuat data akun. (Cek token)';
                        }
                    } catch (err) {
                        document.getElementById('userProfileBox').innerHTML = '⚠️ Koneksi ke Discord API gagal.';
                    }
                }
                fetchProfile(); // Panggil saat halaman dimuat

                const profileOptions = ${profileOptionsJson};
                const profileSelect = document.getElementById('selectedProfile');
                const profilePreview = document.getElementById('selectedProfilePreview');

                function getProfilePreviewLabel(profile) {
                    if (!profile) return '';
                    if (profile.meta && profile.meta.username) return '@' + profile.meta.username;
                    return 'Profil ' + profile.id;
                }

                function updateProfilePreview() {
                    if (!profileSelect || !profilePreview) return;
                    const selected = profileOptions.find(profile => profile.id === profileSelect.value);
                    if (!selected) {
                        profilePreview.classList.remove('visible');
                        profilePreview.textContent = '';
                        return;
                    }

                    const label = getProfilePreviewLabel(selected);
                    profilePreview.innerHTML = '<span>👁️ Preview:</span> <strong>' + escapeHtml(label) + '</strong>' + (selected.isActive ? '<span>(Aktif)</span>' : '');
                    profilePreview.classList.add('visible');
                }

                function escapeHtml(value) {
                    return String(value || '')
                        .replace(/&/g, '&')
                        .replace(/</g, '<')
                        .replace(/>/g, '>')
                        .replace(/"/g, '"')
                        .replace(/'/g, '&#39;');
                }

                if (profileSelect) {
                    profileSelect.addEventListener('change', updateProfilePreview);
                    updateProfilePreview();
                }
            })();
            
            function toggleSettingsMenu(event) {
                const menu = document.getElementById('settingsMenu');
                const button = event.currentTarget;
                if (!menu || !button) return;
                const isOpen = menu.classList.toggle('open');
                button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            }

            function closeSettingsMenu() {
                const menu = document.getElementById('settingsMenu');
                const button = document.querySelector('.hamburger-btn');
                if (menu) menu.classList.remove('open');
                if (button) button.setAttribute('aria-expanded', 'false');
            }

            function switchTab(event, tabId) {
                const target = document.getElementById(tabId);
                if (!target) return;

                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.settings-menu-item').forEach(el => el.classList.remove('active'));
                target.classList.add('active');

                if (event && event.currentTarget) {
                    event.currentTarget.classList.add('active');
                    const label = event.currentTarget.getAttribute('data-menu-label') || event.currentTarget.textContent.trim();
                    const currentLabel = document.getElementById('settingsCurrentLabel');
                    if (currentLabel) currentLabel.textContent = label;
                }

                closeSettingsMenu();
            }

            document.addEventListener('click', function(event) {
                const nav = document.querySelector('.settings-nav');
                if (nav && !nav.contains(event.target)) closeSettingsMenu();
            });
        </script>
        `;
    }

    return { getLogRefreshScript };
};
