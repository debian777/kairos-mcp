// eslint.config.cjs

// -----------------------------------------------------------------------------
// Shared rule snippets
// -----------------------------------------------------------------------------

/**
 * Disallow jest.mock() / vi.mock() outside of unit tests.
 */
const NO_TEST_MOCKS_RULE = {
  'no-restricted-properties': [
    'error',
    {
      object: 'jest',
      property: 'mock',
      message: 'Do not use jest.mock() outside unit tests',
    },
    {
      object: 'vi',
      property: 'mock',
      message: 'Do not use vi.mock() outside unit tests',
    },
  ],
};

// TypeScript support
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // ---------------------------------------------------------------------------
  // 0. Global ignores
  //    (applies to all subsequent configs)
  // ---------------------------------------------------------------------------
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'cache/**',
      '.ai/**',
      '.git/**',
      '.turbo/**',
      '.next/**',
      // Keep ESLint from trying to lint its own config by default
      'eslint.config.cjs',
      // Non-code files
      '**/*.md',
      '**/*.json',
      '**/*.yaml',
      '**/*.yml',
      '**/.DS_Store',
      '**/.env*',
      '**/.gitignore',
      '**/.npmignore',
      '**/.dockerignore',
      '**/.kilocode/**',
      '**/.obsidian/**',
      '**/.vscode/**',
      '**/*.log',
      '**/tools.txt',
      '**/compose.yaml',
      '**/reports/**',
      '**/.kilocodeignore',
      '**/*.disabled',
      '**/*.sh',
      '**/.cursorrules',
      'env.example.txt',
      '**/snapshots/**',
      '**/*.snapshot'
    ],
  },

  // ---------------------------------------------------------------------------
  // 1. Global max-lines rule for ALL files (not only TS/JS)
  //
  //    ESLint cannot natively do:
  //      - warn at >300 lines AND
  //      - error at >500 lines
  //    for the same rule; the last config wins for a given file.
  //
  //    This config:
  //      - warns when a file exceeds 300 lines (including comments/blanks).
  //    You can make CI treat these warnings as errors once they cross 500+
  //    by post-processing ESLint output if you want a hard 500-line gate.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 2. Base TypeScript / JavaScript config for source + tests
  //    (TS-aware parsing, project-aware, TS no-unused-vars)
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}', 'tests/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Ensure ESLint/TS can resolve the tsconfigs correctly
        tsconfigRootDir: __dirname,
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
          // argsIgnorePattern: '^_',
          // varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Add more global TS/JS rules here as needed
      // e.g. '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // 3. Source files: strict (no console, no jest/vi mocks)
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    rules: {
      'no-console': 'error',
      ...NO_TEST_MOCKS_RULE,
    },
  },

  // ---------------------------------------------------------------------------
  // 4. Test files: console allowed, mocks still restricted by NO_TEST_MOCKS_RULE
  //    - Some subtrees are ignored completely (legacy/new experiments)
  // ---------------------------------------------------------------------------
  {
    files: ['tests/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    ignores: ['tests/utils/**', 'tests/_new/**', 'tests/unit/**'],
    rules: {
      'no-console': 'off',
      ...NO_TEST_MOCKS_RULE,
    },
  },

  // ---------------------------------------------------------------------------
  // 5. Node-style config & scripts (no TS project linking)
  //
  //    This avoids the “parserOptions.project file not found” error for:
  //      - eslint.config.cjs (if you *do* lint it directly)
  //      - jest.config.js
  //      - JS/TS scripts under scripts/**
  //
  //    These are treated as plain Node scripts with standard JS parsing, and
  //    deliberately do NOT use the TS project to keep things simple.
  // ---------------------------------------------------------------------------
  {
    files: [
      'eslint.config.cjs',
    ],
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 2022,
      parserOptions: {
        project: null,
      },
    },
  },
  {
    files: [
      'jest.config.js',
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      parserOptions: {
        project: null,
      },
    },
  },
  {
    files: [
      'scripts/**/*.{ts,cts,mts}',
    ],
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
    },
  },
  {
    files: [
      'scripts/**/*.{js,cjs,mjs}',
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      parserOptions: {
        project: null,
      },
    },
  },
];