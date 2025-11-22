// CSS styles for the leaderboard HTML
export const leaderboardCss = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .leaderboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }

        .leaderboard-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .leaderboard-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 30px 60px rgba(0,0,0,0.2);
        }

        .leaderboard-card h2 {
            font-size: 1.8rem;
            margin-bottom: 20px;
            color: #4a5568;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .leaderboard-card h2::before {
            content: '🏆';
            font-size: 1.5rem;
        }

        .leaderboard-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px 0;
            border-bottom: 1px solid #e2e8f0;
            transition: background-color 0.2s ease;
        }

        .leaderboard-item:hover {
            background-color: #f7fafc;
            border-radius: 8px;
            margin: 0 -10px;
            padding: 15px 10px;
        }

        .leaderboard-item:last-child {
            border-bottom: none;
        }

        .rank {
            font-size: 1.5rem;
            font-weight: bold;
            color: #4a5568;
            min-width: 40px;
        }

        .rank-1 { color: #ffd700; }
        .rank-2 { color: #c0c0c0; }
        .rank-3 { color: #cd7f32; }

        .model-name {
            flex: 1;
            font-weight: 600;
            color: #2d3748;
        }

        .score {
            font-size: 1.2rem;
            font-weight: bold;
            color: #38a169;
            background: #f0fff4;
            padding: 5px 12px;
            border-radius: 20px;
            border: 2px solid #9ae6b4;
        }

        .recent-discoveries {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .recent-discoveries h2 {
            font-size: 1.8rem;
            margin-bottom: 20px;
            color: #4a5568;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .recent-discoveries h2::before {
            content: '💎';
            font-size: 1.5rem;
        }

        .discovery-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .discovery-item:last-child {
            border-bottom: none;
        }

        .gem-icon {
            font-size: 1.5rem;
            min-width: 30px;
        }

        .discovery-content {
            flex: 1;
        }

        .discovery-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
        }

        .discovery-meta {
            font-size: 0.9rem;
            color: #718096;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: white;
            font-size: 1.2rem;
        }

        .error {
            background: #fed7d7;
            color: #c53030;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 1px solid #feb2b2;
        }

        .refresh-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            margin-top: 20px;
        }

        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.9);
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #38a169;
            margin-bottom: 5px;
        }

        .stat-label {
            color: #4a5568;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }

            .leaderboard-grid {
                grid-template-columns: 1fr;
            }

            .leaderboard-card {
                padding: 20px;
            }
        }
`;