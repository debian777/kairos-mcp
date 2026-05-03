/**
 * Jest stub for the `uuid` package (see jest.config.js moduleNameMapper).
 * Must be CommonJS: transitive CJS (e.g. dockerode → uuid) uses require().
 */
'use strict';

const crypto = require('crypto');

function v4() {
  return '00000000-0000-0000-0000-000000000004';
}

/** RFC 4122 v5-like UUID from name+namespace so distinct inputs never collide (tenant space ids). */
function v5(name, namespace) {
  const hash = crypto.createHash('sha1').update(String(namespace) + '\0' + String(name)).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

module.exports = { v4, v5 };
