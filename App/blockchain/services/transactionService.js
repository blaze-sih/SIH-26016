/**
 * LRVS — Blockchain Transaction Service
 * Team BLAZE | SIH26016
 *
 * High-level transaction orchestration for the blockchain layer.
 * Wraps the low-level blockchainService.js with retry and logging.
 */

'use strict';

const { sha256Object, toBytes32 } = require('./hashService');

/**
 * Attempt a blockchain transaction with retries.
 * @param {Function} txFn        async function that performs the transaction
 * @param {number}   maxRetries  number of retry attempts (default 2)
 * @returns {Promise<*>}
 */
async function withRetry(txFn, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await txFn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Build a canonical transaction payload for logging/audit.
 * @param {string} type     Transaction type (e.g. 'DOCUMENT_HASH', 'APPROVAL')
 * @param {object} payload  Data to hash
 * @returns {{ payloadHash, type, timestamp }}
 */
function buildTxPayload(type, payload) {
  const payloadHash = sha256Object(payload);
  return {
    type,
    payloadHash,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { withRetry, buildTxPayload, toBytes32 };
