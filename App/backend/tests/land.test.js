/**
 * LRVS — Land Record Tests
 * Team BLAZE | SIH26016
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.BLOCKCHAIN_MOCK = 'true';

const request = require('supertest');
const { connect, disconnect, clearDatabase } = require('./setup');
const { app } = require('../src/app');

let officerToken;
let requestId;

beforeAll(async () => {
  await connect();
  // Register and login as officer
  const regRes = await request(app).post('/api/auth/register').send({
    name: 'Land Officer',
    email: 'landofficer@test.lrvs',
    password: 'SecurePass123!',
    role: 'PROJECT_OFFICER',
    state: 'Maharashtra',
    district: 'Pune',
  });
  officerToken = regRes.body.data.token;
});

afterAll(async () => {
  await disconnect();
});

afterEach(async () => {
  // Only clear land records between tests
  const mongoose = require('mongoose');
  const collections = mongoose.connection.collections;
  if (collections.landrecords) await collections.landrecords.deleteMany({});
  if (collections.auditlogs) await collections.auditlogs.deleteMany({});
});

const sampleRecord = {
  surveyNumber: '123/A',
  district: 'Pune',
  taluka: 'Haveli',
  village: 'Wadgaon',
  state: 'Maharashtra',
  acquisitionPurpose: 'Road widening project',
  owners: [{ name: 'Ramesh Patil', fatherName: 'Govind Patil' }],
  area: { unit: 'Hectare', total: '2.5', cultivable: '2.0', uncultivable: '0.5' },
};

describe('POST /api/land', () => {
  it('should create a land record', async () => {
    const res = await request(app)
      .post('/api/land')
      .set('Authorization', `Bearer ${officerToken}`)
      .send(sampleRecord);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record).toHaveProperty('requestId');
    expect(res.body.data.record.acquisitionStatus).toBe('DRAFT');
    requestId = res.body.data.record.requestId;
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/land').send(sampleRecord);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/land/requests', () => {
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/land')
      .set('Authorization', `Bearer ${officerToken}`)
      .send(sampleRecord);
    requestId = res.body.data.record.requestId;
  });

  it('should return paginated list', async () => {
    const res = await request(app)
      .get('/api/land/requests')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('should support status filter', async () => {
    const res = await request(app)
      .get('/api/land/requests?status=DRAFT')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((record) => {
      expect(record.acquisitionStatus).toBe('DRAFT');
    });
  });
});

describe('GET /api/land/:requestId', () => {
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/land')
      .set('Authorization', `Bearer ${officerToken}`)
      .send(sampleRecord);
    requestId = res.body.data.record.requestId;
  });

  it('should return a specific record', async () => {
    const res = await request(app)
      .get(`/api/land/${requestId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.record.requestId).toBe(requestId);
  });

  it('should return 404 for unknown requestId', async () => {
    const res = await request(app)
      .get('/api/land/LRVS-NONEXISTENT-9999')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/land/:requestId', () => {
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/land')
      .set('Authorization', `Bearer ${officerToken}`)
      .send(sampleRecord);
    requestId = res.body.data.record.requestId;
  });

  it('should update a record', async () => {
    const res = await request(app)
      .patch(`/api/land/${requestId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ village: 'Kothrud', taluka: 'Haveli' });
    expect(res.status).toBe(200);
    expect(res.body.data.record.village).toBe('Kothrud');
  });
});

describe('Status transition validation', () => {
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/land')
      .set('Authorization', `Bearer ${officerToken}`)
      .send(sampleRecord);
    requestId = res.body.data.record.requestId;
  });

  it('should allow DRAFT -> SUBMITTED transition', async () => {
    const res = await request(app)
      .post(`/api/land/${requestId}/submit`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.record.acquisitionStatus).toBe('SUBMITTED');
  });

  it('should reject invalid status transition via statusTransitions', () => {
    const { isValidTransition } = require('../src/utils/statusTransitions');
    expect(isValidTransition('DRAFT', 'APPROVED')).toBe(false);
    expect(isValidTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(isValidTransition('VERIFIED', 'PENDING_APPROVAL')).toBe(true);
    expect(isValidTransition('CLOSED', 'DRAFT')).toBe(false);
  });
});

describe('GET /api/land/map', () => {
  it('should return map data', async () => {
    const res = await request(app)
      .get('/api/land/map')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('markers');
    expect(Array.isArray(res.body.data.markers)).toBe(true);
  });
});
