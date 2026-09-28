/**
 * LRVS — Health Endpoint Tests
 * Team BLAZE | SIH26016
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.BLOCKCHAIN_MOCK = 'true';
process.env.AI_SERVICE_URL = 'http://localhost:9999'; // non-existent, for fallback tests

const request = require('supertest');
const { connect, disconnect } = require('./setup');
const { app } = require('../src/app');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

describe('GET /api/health', () => {
  it('should return 200 with service info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('service', 'lrvs-backend');
    expect(res.body.data).toHaveProperty('database');
  });
});

describe('GET /api/system/status', () => {
  it('should return system status with all service indicators', async () => {
    const res = await request(app).get('/api/system/status');
    expect([200, 207, 503]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('backend', 'UP');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('aiService');
    expect(res.body.data).toHaveProperty('blockchain');
    expect(res.body.data).toHaveProperty('storage');
  });
});

describe('404 handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
