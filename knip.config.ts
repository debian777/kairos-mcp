import type { KnipConfig } from 'knip';

const config: KnipConfig = {
    entry: [
        'src/index.ts',           // MCP server entry
        'src/cli/index.ts',       // CLI bin entry
        'src/metrics-server.ts',  // Standalone metrics server
        'scripts/**/*.{ts,mjs}',  // Build-time scripts
    ],
    project: [
        'src/**/*.ts',
        'scripts/**/*.{ts,mjs}',
    ],
    ignore: [
        'dist/**',
        'src/embed-docs/**',      // Generated at build time
    ],
    ignoreDependencies: [
        // Runtime tools used in scripts/shell, not imported directly
        'dotenv-cli',
        'pino-pretty',
        'concurrently',
    ],
    ignoreExportsUsedInFile: true,
};

export default config;
