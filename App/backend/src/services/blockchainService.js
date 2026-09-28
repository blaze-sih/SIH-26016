/**
 * LRVS — Blockchain Service Adapter
 * Team BLAZE | SIH26016
 *
 * Wraps ethers.js interactions with the three on-chain contracts:
 *   - LandRecord  (document + land record hashing)
 *   - Approval    (approval action anchoring)
 *   - Compensation (compensation amount anchoring)
 *
 * MOCK MODE:
 *   Set BLOCKCHAIN_MOCK=true in .env to bypass all RPC calls.
 *   All functions return a synthetic { txHash, blockNumber, network, timestamp, mock:true }
 *   object so the rest of the application works identically in dev/test.
 *
 * DEGRADED MODE:
 *   If BLOCKCHAIN_MOCK is not set but BLOCKCHAIN_RPC_URL or BLOCKCHAIN_PRIVATE_KEY
 *   are missing, the service logs a warning and falls back to mock results.
 */

'use strict';

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { hashObject } = require('../utils/hash');

// ── Contract ABIs (minimal — only functions we invoke) ────────────────────────

const LAND_RECORD_ABI = [
  'function registerDocument(bytes32 hash, string calldata requestId) external',
  'function registerLandRecord(bytes32 hash, string calldata requestId) external',
  'event DocumentRegistered(bytes32 indexed hash, string requestId, uint256 timestamp)',
  'event LandRecordRegistered(bytes32 indexed hash, string requestId, uint256 timestamp)',
];

const APPROVAL_ABI = [
  'function recordApproval(bytes32 hash, string calldata requestId, string calldata action) external',
  'event ApprovalRecorded(bytes32 indexed hash, string requestId, string action, uint256 timestamp)',
];

const COMPENSATION_ABI = [
  'function recordCompensation(bytes32 hash, string calldata requestId, uint256 amount) external',
  'event CompensationRecorded(bytes32 indexed hash, string requestId, uint256 amount, uint256 timestamp)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when BLOCKCHAIN_MOCK env var is the string 'true'.
 */
function isMockMode() {
  return process.env.BLOCKCHAIN_MOCK === 'true';
}

/**
 * Returns true when the required env vars are present for real RPC calls.
 */
function hasRequiredEnvVars() {
  return Boolean(process.env.BLOCKCHAIN_RPC_URL && process.env.BLOCKCHAIN_PRIVATE_KEY);
}

/**
 * Build a mock transaction result for a given hash string.
 *
 * @param {string} hash - hex hash string (with or without 0x prefix)
 * @returns {{ txHash: string, blockNumber: number, network: string, timestamp: Date, mock: boolean }}
 */
function getMockResult(hash) {
  const bare = hash.startsWith('0x') ? hash.slice(2) : hash;
  return {
    txHash: '0xmock_' + bare.slice(0, 16),
    blockNumber: 0,
    network: 'mock',
    timestamp: new Date(),
    mock: true,
  };
}

/**
 * Create a JsonRpcProvider connected to BLOCKCHAIN_RPC_URL.
 *
 * @returns {ethers.JsonRpcProvider}
 */
function getProvider() {
  return new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
}

/**
 * Create an ethers Wallet (signer) from BLOCKCHAIN_PRIVATE_KEY.
 *
 * @returns {ethers.Wallet}
 */
function getSigner() {
  return new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, getProvider());
}

/**
 * Instantiate an ethers Contract bound to the signer.
 *
 * @param {string} address
 * @param {string[]} abi
 * @returns {ethers.Contract}
 */
function getContract(address, abi) {
  return new ethers.Contract(address, abi, getSigner());
}

/**
 * Convert a plain hex string to a bytes32 value for ethers.js.
 * Pads or slices to 32 bytes as required.
 *
 * @param {string} hexHash - 64-char hex string (without 0x)
 * @returns {string} 0x-prefixed 32-byte hex
 */
function toBytes32(hexHash) {
  const stripped = hexHash.startsWith('0x') ? hexHash.slice(2) : hexHash;
  // Pad to 64 hex chars (32 bytes)
  const padded = stripped.padEnd(64, '0').slice(0, 64);
  return '0x' + padded;
}

/**
 * Decode a transaction receipt into a standard result object.
 *
 * @param {ethers.TransactionResponse} tx
 * @param {ethers.TransactionReceipt} receipt
 * @returns {{ txHash: string, blockNumber: number, network: string, timestamp: Date }}
 */
async function decodeReceipt(tx, receipt) {
  const provider = getProvider();
  const network = await provider.getNetwork();
  return {
    txHash: receipt.hash || tx.hash,
    blockNumber: receipt.blockNumber,
    network: network.name || String(network.chainId),
    timestamp: new Date(),
  };
}

// ── Service object ────────────────────────────────────────────────────────────

const blockchainService = {
  // ── Status check ───────────────────────────────────────────────────────────

  /**
   * Check blockchain connectivity.
   *
   * @returns {Promise<'MOCK'|'UP'>}
   * @throws {Error} if RPC is unreachable in non-mock mode
   */
  async getStatus() {
    if (isMockMode()) {
      return 'MOCK';
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.getStatus: missing env vars, reporting MOCK');
      return 'MOCK';
    }

    try {
      const provider = getProvider();
      await provider.getNetwork();
      return 'UP';
    } catch (err) {
      logger.error('blockchainService.getStatus: RPC unreachable', { error: err.message });
      throw err;
    }
  },

  // ── Document hash registration ─────────────────────────────────────────────

  /**
   * Register a document hash on-chain via LandRecord.registerDocument().
   *
   * @param {string} documentHash - hex hash string
   * @param {string} requestId    - acquisition request UUID
   * @returns {Promise<object>} transaction result
   */
  async registerDocumentHash(documentHash, requestId) {
    if (isMockMode()) {
      logger.debug('blockchainService.registerDocumentHash [MOCK]', { documentHash, requestId });
      return getMockResult(documentHash);
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.registerDocumentHash: missing env vars, using mock result');
      return getMockResult(documentHash);
    }

    try {
      const contract = getContract(process.env.LAND_RECORD_CONTRACT_ADDRESS, LAND_RECORD_ABI);
      const bytes32Hash = toBytes32(documentHash);

      logger.info('blockchainService.registerDocumentHash: sending tx', { documentHash, requestId });

      const tx = await contract.registerDocument(bytes32Hash, requestId);
      const receipt = await tx.wait();

      const result = await decodeReceipt(tx, receipt);

      logger.info('blockchainService.registerDocumentHash: confirmed', {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        requestId,
      });

      return result;
    } catch (err) {
      logger.error('blockchainService.registerDocumentHash: tx failed', {
        documentHash,
        requestId,
        error: err.message,
      });
      throw err;
    }
  },

  // ── Land record hash registration ──────────────────────────────────────────

  /**
   * Register a land record hash on-chain via LandRecord.registerLandRecord().
   *
   * @param {string} recordHash - hex hash string
   * @param {string} requestId  - acquisition request UUID
   * @returns {Promise<object>} transaction result
   */
  async registerLandRecordHash(recordHash, requestId) {
    if (isMockMode()) {
      logger.debug('blockchainService.registerLandRecordHash [MOCK]', { recordHash, requestId });
      return getMockResult(recordHash);
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.registerLandRecordHash: missing env vars, using mock result');
      return getMockResult(recordHash);
    }

    try {
      const contract = getContract(process.env.LAND_RECORD_CONTRACT_ADDRESS, LAND_RECORD_ABI);
      const bytes32Hash = toBytes32(recordHash);

      logger.info('blockchainService.registerLandRecordHash: sending tx', { recordHash, requestId });

      const tx = await contract.registerLandRecord(bytes32Hash, requestId);
      const receipt = await tx.wait();

      const result = await decodeReceipt(tx, receipt);

      logger.info('blockchainService.registerLandRecordHash: confirmed', {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        requestId,
      });

      return result;
    } catch (err) {
      logger.error('blockchainService.registerLandRecordHash: tx failed', {
        recordHash,
        requestId,
        error: err.message,
      });
      throw err;
    }
  },

  // ── Verification hash anchoring ────────────────────────────────────────────

  /**
   * Anchor a verification snapshot hash on-chain (reuses registerLandRecord).
   *
   * @param {string} verificationHash - hex hash string
   * @param {string} requestId        - acquisition request UUID
   * @returns {Promise<object>} transaction result
   */
  async recordVerification(verificationHash, requestId) {
    if (isMockMode()) {
      logger.debug('blockchainService.recordVerification [MOCK]', { verificationHash, requestId });
      return getMockResult(verificationHash);
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.recordVerification: missing env vars, using mock result');
      return getMockResult(verificationHash);
    }

    try {
      const contract = getContract(process.env.LAND_RECORD_CONTRACT_ADDRESS, LAND_RECORD_ABI);
      const bytes32Hash = toBytes32(verificationHash);

      logger.info('blockchainService.recordVerification: sending tx', { verificationHash, requestId });

      const tx = await contract.registerLandRecord(bytes32Hash, requestId);
      const receipt = await tx.wait();

      const result = await decodeReceipt(tx, receipt);

      logger.info('blockchainService.recordVerification: confirmed', {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        requestId,
      });

      return result;
    } catch (err) {
      logger.error('blockchainService.recordVerification: tx failed', {
        verificationHash,
        requestId,
        error: err.message,
      });
      throw err;
    }
  },

  // ── Approval anchoring ─────────────────────────────────────────────────────

  /**
   * Record an approval action hash on-chain via Approval.recordApproval().
   *
   * @param {string} approvalHash - hex hash string
   * @param {string} requestId    - acquisition request UUID
   * @param {string} action       - e.g. 'APPROVED' | 'REJECTED' | 'FORWARDED'
   * @returns {Promise<object>} transaction result
   */
  async recordApproval(approvalHash, requestId, action) {
    if (isMockMode()) {
      logger.debug('blockchainService.recordApproval [MOCK]', { approvalHash, requestId, action });
      return getMockResult(approvalHash);
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.recordApproval: missing env vars, using mock result');
      return getMockResult(approvalHash);
    }

    try {
      const contract = getContract(process.env.APPROVAL_CONTRACT_ADDRESS, APPROVAL_ABI);
      const bytes32Hash = toBytes32(approvalHash);

      logger.info('blockchainService.recordApproval: sending tx', { approvalHash, requestId, action });

      const tx = await contract.recordApproval(bytes32Hash, requestId, action);
      const receipt = await tx.wait();

      const result = await decodeReceipt(tx, receipt);

      logger.info('blockchainService.recordApproval: confirmed', {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        requestId,
        action,
      });

      return result;
    } catch (err) {
      logger.error('blockchainService.recordApproval: tx failed', {
        approvalHash,
        requestId,
        action,
        error: err.message,
      });
      throw err;
    }
  },

  // ── Compensation anchoring ─────────────────────────────────────────────────

  /**
   * Record a compensation hash and amount on-chain via Compensation.recordCompensation().
   *
   * @param {string}         compensationHash - hex hash string
   * @param {string}         requestId        - acquisition request UUID
   * @param {number|bigint}  amount           - compensation amount (in smallest unit / paise)
   * @returns {Promise<object>} transaction result
   */
  async recordCompensation(compensationHash, requestId, amount) {
    if (isMockMode()) {
      logger.debug('blockchainService.recordCompensation [MOCK]', {
        compensationHash,
        requestId,
        amount,
      });
      return getMockResult(compensationHash);
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.recordCompensation: missing env vars, using mock result');
      return getMockResult(compensationHash);
    }

    try {
      const contract = getContract(process.env.COMPENSATION_CONTRACT_ADDRESS, COMPENSATION_ABI);
      const bytes32Hash = toBytes32(compensationHash);
      const amountUint = BigInt(Math.round(Number(amount)));

      logger.info('blockchainService.recordCompensation: sending tx', {
        compensationHash,
        requestId,
        amount: amountUint.toString(),
      });

      const tx = await contract.recordCompensation(bytes32Hash, requestId, amountUint);
      const receipt = await tx.wait();

      const result = await decodeReceipt(tx, receipt);

      logger.info('blockchainService.recordCompensation: confirmed', {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        requestId,
      });

      return result;
    } catch (err) {
      logger.error('blockchainService.recordCompensation: tx failed', {
        compensationHash,
        requestId,
        amount,
        error: err.message,
      });
      throw err;
    }
  },

  // ── Possession anchoring ───────────────────────────────────────────────────

  /**
   * Anchor a possession event hash on-chain (reuses registerLandRecord).
   *
   * @param {string} possessionHash - hex hash string
   * @param {string} requestId      - acquisition request UUID
   * @returns {Promise<object>} transaction result
   */
  async recordPossession(possessionHash, requestId) {
    if (isMockMode()) {
      logger.debug('blockchainService.recordPossession [MOCK]', { possessionHash, requestId });
      return getMockResult(possessionHash);
    }

    if (!hasRequiredEnvVars()) {
      logger.warn('blockchainService.recordPossession: missing env vars, using mock result');
      return getMockResult(possessionHash);
    }

    try {
      const contract = getContract(process.env.LAND_RECORD_CONTRACT_ADDRESS, LAND_RECORD_ABI);
      const bytes32Hash = toBytes32(possessionHash);

      logger.info('blockchainService.recordPossession: sending tx', { possessionHash, requestId });

      const tx = await contract.registerLandRecord(bytes32Hash, requestId);
      const receipt = await tx.wait();

      const result = await decodeReceipt(tx, receipt);

      logger.info('blockchainService.recordPossession: confirmed', {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        requestId,
      });

      return result;
    } catch (err) {
      logger.error('blockchainService.recordPossession: tx failed', {
        possessionHash,
        requestId,
        error: err.message,
      });
      throw err;
    }
  },
};

// ── Expose helpers for unit testing ──────────────────────────────────────────
blockchainService._helpers = {
  getMockResult,
  getProvider,
  getSigner,
  getContract,
  toBytes32,
  isMockMode,
  hasRequiredEnvVars,
};

module.exports = blockchainService;
