/**
 * LRVS — Blockchain Hash Service
 * Team BLAZE | SIH26016
 *
 * Shared hash utilities for the blockchain layer.
 */

'use strict';

const crypto = require('crypto');

/**
 * Compute SHA-256 hash of a string or buffer, return hex string.
 * @param {string|Buffer} data
 * @returns {string}
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Compute SHA-256 of a JSON object (deterministic).
 * @param {object} obj
 * @returns {string}
 */
function sha256Object(obj) {
  const str = JSON.stringify(sortObjectKeys(obj));
  return sha256(str);
}

/**
 * Convert a hex string to bytes32 (for Solidity contract calls).
 * Pads or truncates to 32 bytes.
 * @param {string} hexStr  hex string (with or without 0x prefix)
 * @returns {string}  0x-prefixed 64-char hex string
 */
function toBytes32(hexStr) {
  const clean = hexStr.replace(/^0x/, '').slice(0, 64).padEnd(64, '0');
  return '0x' + clean;
}

/**
 * Recursively sort object keys for deterministic hashing.
 */
function sortObjectKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

module.exports = { sha256, sha256Object, toBytes32 };
