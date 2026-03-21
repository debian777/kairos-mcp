'use strict';

const { NO_TEST_MOCKS_RULE, NO_AUTH_ENABLED_OVERRIDE_RULE } = require('./rules/shared-snippets.cjs');
const { markdownPlainTextParser } = require('./parsers/markdown-plain-text.cjs');
const { kairosForbiddenTextPlugin } = require('./plugins/kairos-forbidden-text.cjs');
const KAIROS_FORBIDDEN_TEXT_V10_GRANDFATHERED = require('./rules/forbidden-v10-grandfather.cjs');

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/**
 * @param {string} rootDir Absolute path to repository root (for tsconfigRootDir)
 * @returns {import('eslint').Linter.FlatConfig[]}
 */
function createFlatConfig(rootDir) {
  return [
    // -------------------------------------------------------------------------
    // 0. Global ignores
    // -------------------------------------------------------------------------
    {
      ignores: [
        'node_modules/**',
        '.venv/**',
        '**/.venv/**',
        'dist/**',
        '**/dist/**',
        'build/**',
        'coverage/**',
        'cache/**',
        '.cache/**',
        'helm/**',
        '.ai/**',
        '.git',
        '.git/**',
        '**/.git/**',
        '.turbo/**',
        '.next/**',
        'eslint.config.cjs',
        // Non-code files (embed-docs are re-included below for forbidden-string lint)
        '**/*.md',
        '!src/embed-docs/**/*.md',
        '**/*.json',
        '**/*.yaml',
        '**/*.yml',
        '**/*.tgz',
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif',
        '**/*.webp',
        '**/*.ico',
        '**/*.svg',
        '**/.DS_Store',
        '**/.env*',
        '**/.gitignore',
        '**/.cursorignore',
        '**/.npmignore',
        '**/.npmrc',
        '**/.dockerignore',
        'Dockerfile',
        'Dockerfile.dev',
        '**/Dockerfile*',
        '**/.kilocode/**',
        '**/.obsidian/**',
        '**/.vscode/**',
        '**/*.log',
        '**/tools.txt',
        '**/compose.yaml',
        '**/reports/**',
        '**/*.tf',
        '**/*.tfvars*',
        '**/*.hcl',
        '**/.terraform/**',
        '**/argocd/**',
        '**/.kilocodeignore',
        '**/*.disabled',
        '**/*.sh',
        '**/*.py',
        '**/__pycache__/**',
        '**/*.pyc',
        '**/.cursorrules',
        '**/.cursor/**',
        'docs/install/env.example.*.txt',
        '**/requirements.txt',
        '**/snapshots/**',
        '**/*.snapshot',
        'storybook-static/**',
        '.storybook/**',
        '**/*.html',
        '**/*.css',
        '**/*.tsbuildinfo',
        '**/*.woff2',
        '**/*.pack',
        '**/*.idx',
        '**/*.rev',
        '**/*.svg',
        'logo/**',
        'logos/**',
      ],
    },

    // -------------------------------------------------------------------------
    // 1. Global max-lines
    // -------------------------------------------------------------------------
    {
      files: ['**/*.*'],
      rules: {
        'max-lines': [
          'error',
          {
            max: 350,
            skipBlankLines: false,
            skipComments: false,
          },
        ],
      },
    },

    // -------------------------------------------------------------------------
    // 2a. Frontend (src/ui)
    // -------------------------------------------------------------------------
    {
      files: ['src/ui/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          tsconfigRootDir: rootDir,
          project: ['./tsconfig.ui.json'],
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: {
        'max-lines': [
          'error',
          { max: 350, skipBlankLines: false, skipComments: false },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { caughtErrorsIgnorePattern: '^_' },
        ],
        'no-console': 'off',
      },
    },

    {
      files: [
        'src/ui/pages/ProtocolEditPage.tsx',
        'src/ui/mockups/ProtocolUXMockupContent.tsx',
      ],
      rules: { 'max-lines': 'off' },
    },

    {
      files: ['eslint/flat-config.cjs'],
      rules: { 'max-lines': 'off' },
    },

    // -------------------------------------------------------------------------
    // 2b. Backend source + tests (excludes src/ui)
    // -------------------------------------------------------------------------
    {
      files: [
        'src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
        'tests/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
      ],
      ignores: ['src/ui/**'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          tsconfigRootDir: rootDir,
          project: ['./tsconfig.json', './tsconfig.tests.json'],
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: {
        'max-lines': [
          'error',
          {
            max: 350,
            skipBlankLines: false,
            skipComments: false,
          },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        ...NO_AUTH_ENABLED_OVERRIDE_RULE,
      },
    },

    // -------------------------------------------------------------------------
    // 3. Backend: no console, no test mocks
    // -------------------------------------------------------------------------
    {
      files: ['src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
      ignores: ['src/ui/**'],
      rules: {
        'no-console': 'error',
        ...NO_TEST_MOCKS_RULE,
      },
    },

    // -------------------------------------------------------------------------
    // 3c. Forbidden KAIROS strings
    // -------------------------------------------------------------------------
    {
      files: [
        'src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
        'scripts/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
        'tests/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
      ],
      ignores: ['src/ui/**', ...KAIROS_FORBIDDEN_TEXT_V10_GRANDFATHERED],
      plugins: {
        'kairos-forbidden-text': kairosForbiddenTextPlugin,
      },
      rules: {
        'kairos-forbidden-text/no-forbidden-kairos-text': 'error',
      },
    },

    // -------------------------------------------------------------------------
    // 3d. MCP embed-docs Markdown
    // -------------------------------------------------------------------------
    {
      files: ['src/embed-docs/**/*.md'],
      ignores: ['src/embed-docs/tools/export.md'],
      languageOptions: {
        parser: markdownPlainTextParser,
        parserOptions: {
          project: null,
        },
      },
      plugins: {
        'kairos-forbidden-text': kairosForbiddenTextPlugin,
      },
      rules: {
        'max-lines': 'off',
        'kairos-forbidden-text/no-forbidden-kairos-text': 'error',
      },
    },

    {
      files: ['src/embed-docs/tools/export.md'],
      languageOptions: {
        parser: markdownPlainTextParser,
        parserOptions: {
          project: null,
        },
      },
      plugins: {
        'kairos-forbidden-text': kairosForbiddenTextPlugin,
      },
      rules: {
        'max-lines': 'off',
        'kairos-forbidden-text/no-forbidden-kairos-text': 'off',
      },
    },

    // -------------------------------------------------------------------------
    // 4. Tests
    // -------------------------------------------------------------------------
    {
      files: ['tests/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
      ignores: ['tests/utils/**', 'tests/_new/**', 'tests/unit/**'],
      rules: {
        'no-console': 'off',
        ...NO_TEST_MOCKS_RULE,
      },
    },

    {
      files: ['tests/ui/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
      rules: {
        'no-restricted-properties': [
          'error',
          {
            object: 'jest',
            property: 'mock',
            message: 'Do not use jest.mock() outside unit tests',
          },
        ],
      },
    },

    // -------------------------------------------------------------------------
    // 5. Root configs & scripts (no TS project)
    // -------------------------------------------------------------------------
    {
      files: ['eslint.config.cjs'],
      languageOptions: {
        sourceType: 'script',
        ecmaVersion: 2022,
        parserOptions: {
          project: null,
        },
      },
      rules: NO_AUTH_ENABLED_OVERRIDE_RULE,
    },
    {
      files: ['jest.config.js'],
      languageOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
        parserOptions: {
          project: null,
        },
      },
      rules: NO_AUTH_ENABLED_OVERRIDE_RULE,
    },
    {
      files: ['knip.config.ts'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          project: null,
          sourceType: 'module',
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: NO_AUTH_ENABLED_OVERRIDE_RULE,
    },
    {
      files: ['scripts/**/*.{ts,cts,mts}'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          project: null,
          sourceType: 'module',
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        ...NO_AUTH_ENABLED_OVERRIDE_RULE,
      },
    },
    {
      files: ['scripts/**/*.{js,cjs,mjs}'],
      languageOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
        parserOptions: {
          project: null,
        },
      },
      rules: {
        ...NO_AUTH_ENABLED_OVERRIDE_RULE,
      },
    },
  ];
}

module.exports = { createFlatConfig };
