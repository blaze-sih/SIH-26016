/**
 * LRVS — Blockchain Adapter Tests
 * Team BLAZE | SIH26016
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.BLOCKCHAIN_MOCK = 'true';

const blockchainService = require('../src/services/blockchainService');

describe('Blockchain Service (Mock Mode)', () => {
  it('should return MOCK status', async () => {
    const status = await blockchainService.getStatus();
    expect(status).toBe('MOCK');
  });

  it('should register document hash in mock mode', async () => {
    const hash = 'a'.repeat(64);
    const result = await blockchainService.registerDocumentHash(hash, 'LRVS-TEST-001');
    expect(result).toHaveProperty('txHash');
    expect(result.txHash).toMatch(/^0xmock_/);
    expect(result.mock).toBe(true);
    expect(result).toHaveProperty('blockNumber', 0);
    expect(result).toHaveProperty('network', 'mock');
    expect(result).toHaveProperty('timestamp');
  });

  it('should register land record hash in mock mode', async () => {
    const hash = 'b'.repeat(64);
    const result = await blockchainService.registerLandRecordHash(hash, 'LRVS-TEST-002');
    expect(result.mock).toBe(true);
    expect(result.txHash).toMatch(/^0xmock_/);
  });

  it('should record verification in mock mode', async () => {
    const hash = 'c'.repeat(64);
    const result = await blockchainService.recordVerification(hash, 'LRVS-TEST-003');
    expect(result.mock).toBe(true);
  });

  it('should record approval in mock mode', async () => {
    const hash = 'd'.repeat(64);
    const result = await blockchainService.recordApproval(hash, 'LRVS-TEST-004', 'APPROVED');
    expect(result.mock).toBe(true);
  });

  it('should record compensation in mock mode', async () => {
    const hash = 'e'.repeat(64);
    const result = await blockchainService.recordCompensation(hash, 'LRVS-TEST-005', 500000);
    expect(result.mock).toBe(true);
  });

  it('should record possession in mock mode', async () => {
    const hash = 'f'.repeat(64);
    const result = await blockchainService.recordPossession(hash, 'LRVS-TEST-006');
    expect(result.mock).toBe(true);
  });

  it('mock tx hash should include part of the document hash', async () => {
    const hash = 'abcdef1234567890'.padEnd(64, '0');
    const result = await blockchainService.registerDocumentHash(hash, 'LRVS-TEST-007');
    expect(result.txHash).toContain('abcdef12345678');
  });
});

describe('Blockchain graceful degradation', () => {
  it('should not crash when blockchain is unavailable (mock=false, no rpc)', async () => {
    // Temporarily disable mock
    const originalMock = process.env.BLOCKCHAIN_MOCK;
    process.env.BLOCKCHAIN_MOCK = 'false';
    process.env.BLOCKCHAIN_RPC_URL = '';
    process.env.BLOCKCHAIN_PRIVATE_KEY = '';

    // Should degrade gracefully (return mock result or throw with non-crashing error)
    try {
      const hash = 'a'.repeat(64);
      const result = await blockchainService.registerDocumentHash(hash, 'LRVS-DEGRADE-001');
      // If it returns without throwing, it must be degraded mock
      if (result) {
        expect(result).toHaveProperty('txHash');
      }
    } catch (err) {
      // Error is acceptable — just should not crash the process
      expect(err.message).toBeDefined();
    }

    process.env.BLOCKCHAIN_MOCK = originalMock;
  });
});
