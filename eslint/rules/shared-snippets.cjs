'use strict';

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

/** Jest only (Vitest `tests/ui` uses `vi.mock` and must not be restricted). */
const NO_JEST_MOCK_OUTSIDE_UNIT_RULE = {
  'no-restricted-properties': [
    'error',
    {
      object: 'jest',
      property: 'mock',
      message: 'Do not use jest.mock() outside unit tests',
    },
  ],
};

/**
 * AUTH_ENABLED may only be set in .env* files (loaded by dotenv). Disallow
 * overriding it in code (process.env.AUTH_ENABLED = ...).
 */
const NO_AUTH_ENABLED_OVERRIDE_RULE = {
  'no-restricted-syntax': [
    'error',
    {
      selector:
        "AssignmentExpression[left.object.object.name='process'][left.object.property.name='env'][left.property.name='AUTH_ENABLED']",
      message: 'Do not override AUTH_ENABLED in code. Set it only in .env* files.',
    },
    {
      selector:
        "AssignmentExpression[left.object.object.name='process'][left.object.property.name='env'][left.property.value='AUTH_ENABLED']",
      message: 'Do not override AUTH_ENABLED in code. Set it only in .env* files.',
    },
  ],
};

module.exports = {
  NO_TEST_MOCKS_RULE,
  NO_JEST_MOCK_OUTSIDE_UNIT_RULE,
  NO_AUTH_ENABLED_OVERRIDE_RULE,
};
