
// Main leaderboard HTML export - combines CSS, JS, and HTML template
import { leaderboardCss } from './leaderboard-css.js';
import { leaderboardJs } from './leaderboard-js.js';
import { leaderboardHtmlTemplate } from './leaderboard-html.js';

export const leaderboardHtml = leaderboardHtmlTemplate(leaderboardCss, leaderboardJs);