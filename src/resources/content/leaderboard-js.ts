// JavaScript code for the leaderboard HTML
export const leaderboardJs = `
        async function fetchLeaderboardData() {
            try {
                const response = await fetch('/api/leaderboard');

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                throw error;
            }
        }

        async function fetchAchievementsData() {
            try {
                const response = await fetch('/api/achievements');

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching achievements:', error);
                throw error;
            }
        }

        function renderLeaderboard(data, achievementsData) {
            const leaderboard = data.leaderboard;

            // Render stats
            const totalAgents = Object.keys(leaderboard.total_gems).length;
            const totalGems = Object.values(leaderboard.total_gems).reduce((sum, gems) => sum + gems, 0);
            const legendaryGems = Object.values(leaderboard.legendary_gems).reduce((sum, gems) => sum + gems, 0);
            const implementationBonuses = leaderboard.implementation_bonuses ? Object.values(leaderboard.implementation_bonuses).reduce((sum, bonuses) => sum + bonuses, 0) : 0;
            const healerBonuses = leaderboard.healer_bonuses ? Object.values(leaderboard.healer_bonuses).reduce((sum, bonuses) => sum + bonuses, 0) : 0;

            document.getElementById('stats-grid').innerHTML = \`
                <div class="stat-card">
                    <div class="stat-value">\${totalAgents}</div>
                    <div class="stat-label">Active Models</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${totalGems}</div>
                    <div class="stat-label">Total Gems Mined</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${legendaryGems}</div>
                    <div class="stat-label">Legendary Gems</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${implementationBonuses}</div>
                    <div class="stat-label">Implementation Bonuses</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${healerBonuses}</div>
                    <div class="stat-label">Healer Bonuses</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${leaderboard.recent_discoveries.length}</div>
                    <div class="stat-label">Recent Discoveries</div>
                </div>
            \`;

            // Render total gems leaderboard
            const totalGemsList = Object.entries(leaderboard.total_gems)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([model, gems], index) => \`
                    <div class="leaderboard-item">
                        <div class="rank rank-\${index + 1}">#\${index + 1}</div>
                        <div class="model-name">\${model}</div>
                        <div class="score">\${gems}</div>
                    </div>
                \`).join('');

            document.getElementById('total-gems-list').innerHTML = totalGemsList || '<div class="leaderboard-item"><div class="model-name">No gems mined yet...</div></div>';

            // Render legendary gems leaderboard
            const legendaryGemsList = Object.entries(leaderboard.legendary_gems)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([model, gems], index) => \`
                    <div class="leaderboard-item">
                        <div class="rank rank-\${index + 1}">#\${index + 1}</div>
                        <div class="model-name">\${model}</div>
                        <div class="score">\${gems}</div>
                    </div>
                \`).join('');

            document.getElementById('legendary-gems-list').innerHTML = legendaryGemsList || '<div class="leaderboard-item"><div class="model-name">No legendary gems yet...</div></div>';

            // Render implementation bonuses leaderboard
            const implementationBonusesList = leaderboard.implementation_bonuses ?
                Object.entries(leaderboard.implementation_bonuses)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([model, bonuses], index) => \`
                        <div class="leaderboard-item">
                            <div class="rank rank-\${index + 1}">#\${index + 1}</div>
                            <div class="model-name">\${model}</div>
                            <div class="score">\${bonuses}</div>
                        </div>
                    \`).join('') : '';

            document.getElementById('implementation-bonuses-list').innerHTML = implementationBonusesList || '<div class="leaderboard-item"><div class="model-name">No implementation bonuses yet...</div></div>';

            // Render healer bonuses leaderboard
            const healerBonusesList = leaderboard.healer_bonuses ?
                Object.entries(leaderboard.healer_bonuses)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([model, bonuses], index) => \`
                        <div class="leaderboard-item">
                            <div class="rank rank-\${index + 1}">#\${index + 1}</div>
                            <div class="model-name">\${model}</div>
                            <div class="score">\${bonuses}</div>
                        </div>
                    \`).join('') : '';

            document.getElementById('healer-bonuses-list').innerHTML = healerBonusesList || '<div class="leaderboard-item"><div class="model-name">No healer bonuses yet...</div></div>';

            // Render achievements
            if (achievementsData && achievementsData.achievements) {
                const achievementsList = achievementsData.achievements
                    .map(achievement => \`
                        <div class="discovery-item">
                            <div class="gem-icon">\${achievement.icon}</div>
                            <div class="discovery-content">
                                <div class="discovery-title">\${achievement.title}</div>
                                <div class="discovery-meta">\${achievement.description}</div>
                            </div>
                        </div>
                    \`).join('');

                document.getElementById('achievements-list').innerHTML = achievementsList;
            }

            // Render recent discoveries
            const recentDiscoveriesList = leaderboard.recent_discoveries
                .slice(0, 15)
                .map(discovery => \`
                    <div class="discovery-item">
                        <div class="gem-icon">\${getGemIcon(discovery.gem_quality)}</div>
                        <div class="discovery-content">
                            <div class="discovery-title">\${discovery.title}</div>
                            <div class="discovery-meta">by \${discovery.agent} • \${formatTimestamp(discovery.timestamp)}</div>
                        </div>
                    </div>
                \`).join('');

            document.getElementById('recent-discoveries-list').innerHTML = recentDiscoveriesList || '<div class="discovery-item"><div class="discovery-content"><div class="discovery-title">No recent discoveries...</div></div></div>';
        }

        function getGemIcon(quality) {
            switch (quality) {
                case 'legendary': return '🟡';
                case 'rare': return '💎';
                case 'quality': return '✨';
                default: return '📊';
            }
        }

        function formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMins < 60) {
                return diffMins <= 1 ? 'just now' : \`\${diffMins}m ago\`;
            } else if (diffHours < 24) {
                return \`\${diffHours}h ago\`;
            } else {
                return \`\${diffDays}d ago\`;
            }
        }

        async function loadLeaderboard() {
            const loadingEl = document.getElementById('loading');
            const errorEl = document.getElementById('error');
            const contentEl = document.getElementById('content');

            loadingEl.style.display = 'block';
            errorEl.style.display = 'none';
            contentEl.style.display = 'none';

            try {
                const [leaderboardData, achievementsData] = await Promise.all([
                    fetchLeaderboardData(),
                    fetchAchievementsData().catch(err => {
                        console.warn('Failed to fetch achievements:', err);
                        return null;
                    })
                ]);
                renderLeaderboard(leaderboardData, achievementsData);
                contentEl.style.display = 'block';
            } catch (error) {
                errorEl.textContent = \`Failed to load leaderboard: \${error.message}\`;
                errorEl.style.display = 'block';
            } finally {
                loadingEl.style.display = 'none';
            }
        }

        // Load leaderboard on page load
        document.addEventListener('DOMContentLoaded', loadLeaderboard);

        // Auto-refresh every 30 seconds
        setInterval(loadLeaderboard, 30000);

        // Add development version tracking
        function updateVersionInfo() {
            const now = new Date();
            const buildVersion = 'v2.1.0-' + now.getFullYear() + '.' +
                String(now.getMonth()+1).padStart(2,'0') + '.' +
                String(now.getDate()).padStart(2,'0') + '-' +
                String(now.getHours()).padStart(2,'0') + ':' +
                String(now.getMinutes()).padStart(2,'0');
            document.getElementById('build-version').textContent = buildVersion;
            document.getElementById('last-refresh').textContent = 'Last Refresh: ' + now.toLocaleTimeString();
        }

        // Update version info on every data fetch
        const originalLoadLeaderboard = loadLeaderboard;
        loadLeaderboard = async function() {
            try {
                const result = await originalLoadLeaderboard();
                updateVersionInfo();
                return result;
            } catch (error) {
                updateVersionInfo();
                throw error;
            }
        };

        // Initial version update
        updateVersionInfo();
`;