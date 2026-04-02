/**
 * Jest stub for the `uuid` package (see jest.config.js moduleNameMapper).
 * Must be CommonJS: transitive CJS (e.g. dockerode → uuid) uses require().
 */
'use strict';

function v4() {
  return '00000000-0000-0000-0000-000000000004';
}

function v5(name, namespace) {
  void name;
  void namespace;
  return '00000000-0000-0000-0000-000000000005';
}

module.exports = { v4, v5 };
