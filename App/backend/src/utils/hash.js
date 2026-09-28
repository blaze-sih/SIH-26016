/**
 * LRVS — SHA-256 Hashing Utilities
 * Team BLAZE | SIH26016
 *
 * Used for:
 *   - Document file integrity hashing
 *   - AI result snapshot hashing
 *   - Verified result snapshot hashing
 *   - Blockchain anchor data
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Compute SHA-256 hash of a file at the given path.
 * Returns hex string.
 * @param {string} filePath  Absolute path to the file
 * @returns {Promise<string>}
 */
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Compute SHA-256 hash of a Buffer.
 * @param {Buffer} buffer
 * @returns {string} hex string
 */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA-256 hash of a JavaScript object (deterministic JSON).
 * Used for snapshotting AI output and verified results.
 * @param {object} obj
 * @returns {string} hex string
 */
function hashObject(obj) {
  const normalized = JSON.stringify(sortObjectKeys(obj));
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compute SHA-256 hash of a string.
 * @param {string} str
 * @returns {string} hex string
 */
function hashString(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Recursively sort object keys for deterministic hashing.
 * @param {*} obj
 * @returns {*}
 */
function sortObjectKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

/**
 * Verify that a file's SHA-256 matches an expected hash.
 * @param {string} filePath
 * @param {string} expectedHash  hex string
 * @returns {Promise<boolean>}
 */
async function verifyFileHash(filePath, expectedHash) {
  const actual = await hashFile(filePath);
  return actual === expectedHash;
}

module.exports = {
  hashFile,
  hashBuffer,
  hashObject,
  hashString,
  verifyFileHash,
};
