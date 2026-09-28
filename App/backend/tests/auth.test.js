/**
 * LRVS — Auth Tests
 * Team BLAZE | SIH26016
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.BLOCKCHAIN_MOCK = 'true';

const request = require('supertest');
const { connect, disconnect, clearDatabase } = require('./setup');
const { app } = require('../src/app');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

afterEach(async () => {
  await clearDatabase();
});

const testUser = {
  name: 'Test Officer',
  email: 'officer@test.lrvs',
  password: 'SecurePass123!',
  role: 'VERIFICATION_OFFICER',
  department: 'Revenue',
  state: 'Maharashtra',
};

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('email', testUser.email);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('should not expose password in response', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('should reject duplicate email', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, password: '123' });
    expect(res.status).toBe(400);
  });

  it('should reject invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, role: 'HACKER' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(testUser);
  });

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('should reject unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@test.lrvs', password: testUser.password });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    token = res.body.data.token;
  });

  it('should return current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('RBAC — Role restrictions', () => {
  let viewerToken;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, email: 'viewer@test.lrvs', role: 'VIEWER' });
    viewerToken = res.body.data.token;
  });

  it('should deny VIEWER role from creating land records', async () => {
    const res = await request(app)
      .post('/api/land')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ district: 'Pune', state: 'Maharashtra' });
    expect(res.status).toBe(403);
  });
});
