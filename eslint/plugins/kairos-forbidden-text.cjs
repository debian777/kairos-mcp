'use strict';

/**
 * Disallow specific env keys and removed MCP tool names anywhere in source
 * (case-insensitive: identifiers, strings, comments, etc.). Bearer token must
 * come from the shared config file ($XDG_CONFIG_HOME/kairos/config.json), not
 * KAIROS_BEARER_TOKEN in source.
 */
// Banned wording: drop obsolete code/shims; rephrase comments (older format, transitional, compat)—never strip useful docs just to silence a hit.
const KAIROS_FORBIDDEN_LEGACY_REFERENCE_NAMES = [
  'KAIROS_BEARER_TOKEN',
  'kairos_attest',
  'kairos_delete',
  'kairos_dump',
  'kairos_mint',
  'kairos_next',
  'kairos_search',
  'kairos_spaces',
  'legacy',
];

/** Multi-word phrases (case-insensitive); words may be separated by any whitespace in source. */
const KAIROS_FORBIDDEN_CASE_INSENSITIVE_PHRASES = [
  'backwards compatibility',
  'backward compatibility',
];

/** Exact markers (case-sensitive). */
const KAIROS_FORBIDDEN_CASE_SENSITIVE_MARKERS = ['KAIROS:BODY-START', 'KAIROS:BODY-END'];

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} canonical
 * @param {string} matched
 * @returns {string}
 */
function kairosForbiddenLegacyReferenceMessage(canonical, matched) {
  if (canonical === 'KAIROS_BEARER_TOKEN') {
    return `Disallowed legacy env key "${matched}" (same as ${canonical}, case-insensitive). Use the config file for tokens; authenticate (e.g. kairos login or OAuth PKCE) instead of embedding this in source.`;
  }
  if (canonical === 'legacy') {
    return `Disallowed prior-era wording (matched "${matched}", case-insensitive substring). AI: remove obsolete code paths, compatibility shims, and dual implementations—leave a single supported path. Reword identifiers and prose accordingly (e.g. older format, transitional, compat); do not delete useful documentation only to pass lint. Third-party APIs whose identifiers contain this substring: build the key or value at runtime (e.g. string concat) so the forbidden substring does not appear contiguously in source.`;
  }
  return `Disallowed legacy MCP tool name "${matched}" (same as ${canonical}, case-insensitive). Use the current MCP/HTTP tool names and API.`;
}

/**
 * @param {string} matched
 * @returns {string}
 */
function kairosForbiddenCaseSensitiveMarkerMessage(matched) {
  return `Disallowed marker "${matched}" must not appear in source (case-sensitive exact match).`;
}

/**
 * @param {string} matched
 * @param {string} canonicalPhrase
 * @returns {string}
 */
function kairosForbiddenPhraseMessage(matched, canonicalPhrase) {
  return `Disallowed phrasing (matched "${matched}", same as "${canonicalPhrase}", case-insensitive). AI: remove obsolete branches, compatibility shims, and dual code paths—one supported behavior only. Reword comments and strings to match; do not delete useful documentation only to pass lint.`;
}

/**
 * @param {string} matched
 * @returns {string}
 */
function kairosForbiddenStandaloneV10Message(matched) {
  return `Disallowed standalone version tag (matched "${matched}", case-insensitive). Use neutral wording (current protocol surface, adapter API). \`v10-*\` prefixes (e.g. module paths, test labels) are allowed; bare "v10" is not.`;
}

/** Full-source scan; keep this module outside matched lint globs or it would self-match list entries. */
const kairosForbiddenTextPlugin = {
  rules: {
    'no-forbidden-kairos-text': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow KAIROS_BEARER_TOKEN, kairos_* MCP names, prior-era wording "legacy" (case-insensitive substring), standalone "v10" (not v10-*), multi-word phrases (case-insensitive), and KAIROS:BODY-* markers (case-sensitive). Applied to src/, scripts/, tests/ (code), all **/*.md, and root context7.json. Fix by removing obsolete code/shims and rewording—do not strip useful comments only to pass lint.',
        },
        schema: [],
      },
      create(context) {
        const sourceCode = context.sourceCode;
        const text = sourceCode.getText();
        const seenAt = new Set();
        for (const canonical of KAIROS_FORBIDDEN_LEGACY_REFERENCE_NAMES) {
          if (canonical === 'legacy') {
            continue;
          }
          const re = new RegExp(
            `(?<![\\w])${escapeRegExp(canonical)}(?![\\w])`,
            'gi',
          );
          let m;
          while ((m = re.exec(text)) !== null) {
            const at = m.index;
            if (seenAt.has(at)) continue;
            seenAt.add(at);
            const start = sourceCode.getLocFromIndex(at);
            const end = sourceCode.getLocFromIndex(at + m[0].length);
            context.report({
              loc: { start, end },
              message: kairosForbiddenLegacyReferenceMessage(canonical, m[0]),
            });
          }
        }
        {
          const canonical = 'legacy';
          const re = /legacy/gi;
          let m;
          while ((m = re.exec(text)) !== null) {
            const at = m.index;
            if (seenAt.has(at)) continue;
            seenAt.add(at);
            const start = sourceCode.getLocFromIndex(at);
            const end = sourceCode.getLocFromIndex(at + m[0].length);
            context.report({
              loc: { start, end },
              message: kairosForbiddenLegacyReferenceMessage(canonical, m[0]),
            });
          }
        }
        {
          // Allow v10-* (paths, slugs); forbid bare v10 / V10 (punctuation or whitespace after).
          const re = /(?<![A-Za-z0-9_])v10(?!-)(?![A-Za-z0-9_])/gi;
          let m;
          while ((m = re.exec(text)) !== null) {
            const at = m.index;
            if (seenAt.has(at)) continue;
            seenAt.add(at);
            const start = sourceCode.getLocFromIndex(at);
            const end = sourceCode.getLocFromIndex(at + m[0].length);
            context.report({
              loc: { start, end },
              message: kairosForbiddenStandaloneV10Message(m[0]),
            });
          }
        }
        for (const phrase of KAIROS_FORBIDDEN_CASE_INSENSITIVE_PHRASES) {
          const pattern = phrase
            .trim()
            .split(/\s+/)
            .map((w) => escapeRegExp(w))
            .join('\\s+');
          const re = new RegExp(`(?<![\\w])${pattern}(?![\\w])`, 'gi');
          let m;
          while ((m = re.exec(text)) !== null) {
            const at = m.index;
            if (seenAt.has(at)) continue;
            seenAt.add(at);
            const start = sourceCode.getLocFromIndex(at);
            const end = sourceCode.getLocFromIndex(at + m[0].length);
            context.report({
              loc: { start, end },
              message: kairosForbiddenPhraseMessage(m[0], phrase),
            });
          }
        }
        for (const marker of KAIROS_FORBIDDEN_CASE_SENSITIVE_MARKERS) {
          const re = new RegExp(
            `(?<![\\w])${escapeRegExp(marker)}(?![\\w])`,
            'g',
          );
          let m;
          while ((m = re.exec(text)) !== null) {
            const at = m.index;
            if (seenAt.has(at)) continue;
            seenAt.add(at);
            const start = sourceCode.getLocFromIndex(at);
            const end = sourceCode.getLocFromIndex(at + m[0].length);
            context.report({
              loc: { start, end },
              message: kairosForbiddenCaseSensitiveMarkerMessage(m[0]),
            });
          }
        }
        return {};
      },
    },
  },
};

module.exports = { kairosForbiddenTextPlugin };
