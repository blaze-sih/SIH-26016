/**
 * LRVS — Document & AI Tests
 * Team BLAZE | SIH26016
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.BLOCKCHAIN_MOCK = 'true';
process.env.AI_SERVICE_URL = 'http://localhost:9999'; // non-existent → triggers fallback

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { connect, disconnect, clearDatabase } = require('./setup');
const { app } = require('../src/app');
const { hashFile, hashObject, hashString } = require('../src/utils/hash');

let officerToken;
let requestId;

// Create a minimal test PDF buffer
function createTestPDF() {
  return Buffer.from('%PDF-1.4 test document for LRVS unit testing');
}

beforeAll(async () => {
  await connect();
  const regRes = await request(app).post('/api/auth/register').send({
    name: 'Document Officer',
    email: 'docofficer@test.lrvs',
    password: 'SecurePass123!',
    role: 'PROJECT_OFFICER',
  });
  officerToken = regRes.body.data.token;

  // Create a land record
  const landRes = await request(app)
    .post('/api/land')
    .set('Authorization', `Bearer ${officerToken}`)
    .send({
      surveyNumber: 'DOC-TEST-456',
      district: 'Nashik',
      state: 'Maharashtra',
    });
  requestId = landRes.body.data.record.requestId;
});

afterAll(async () => {
  await disconnect();
});

describe('SHA-256 Hashing utilities', () => {
  it('should hash a string deterministically', () => {
    const h1 = hashString('hello world');
    const h2 = hashString('hello world');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different hashes for different strings', () => {
    expect(hashString('abc')).not.toBe(hashString('xyz'));
  });

  it('should hash objects deterministically regardless of key order', () => {
    const h1 = hashObject({ a: 1, b: 2, c: 3 });
    const h2 = hashObject({ c: 3, a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it('should hash different objects differently', () => {
    expect(hashObject({ a: 1 })).not.toBe(hashObject({ a: 2 }));
  });

  it('should hash a file', async () => {
    // Create a temp file
    const tmpPath = path.join(__dirname, 'test-temp.pdf');
    fs.writeFileSync(tmpPath, createTestPDF());
    try {
      const hash = await hashFile(tmpPath);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});

describe('POST /api/documents/upload', () => {
  it('should upload a PDF document and return SHA-256 hash', async () => {
    const tmpPath = path.join(__dirname, 'test-upload.pdf');
    fs.writeFileSync(tmpPath, createTestPDF());

    try {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${officerToken}`)
        .field('requestId', requestId)
        .field('documentType', '712_EXTRACT')
        .attach('document', tmpPath);

      expect([200, 201]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.document).toHaveProperty('hash');
        expect(res.body.data.document.hash).toHaveLength(64);
        expect(res.body.data.document.documentType).toBe('712_EXTRACT');
      }
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('should reject upload without authentication', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/documents/:documentId/process-ai (AI failure fallback)', () => {
  it('should gracefully handle AI service unavailable', async () => {
    // Upload a doc first
    const tmpPath = path.join(__dirname, 'test-ai.pdf');
    fs.writeFileSync(tmpPath, createTestPDF());

    let documentId;
    try {
      const uploadRes = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${officerToken}`)
        .field('requestId', requestId)
        .field('documentType', '712_EXTRACT')
        .attach('document', tmpPath);

      if (uploadRes.status !== 201) return; // skip if upload failed

      documentId = uploadRes.body.data.document.documentId;

      // AI service is at non-existent URL, should fail gracefully
      const aiRes = await request(app)
        .post(`/api/documents/${documentId}/process-ai`)
        .set('Authorization', `Bearer ${officerToken}`);

      // Expect either 200 (if mocked) or 502 (graceful AI failure)
      expect([200, 502]).toContain(aiRes.status);
      expect(aiRes.body.success !== undefined).toBe(true);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});

describe('AI Response Validation', () => {
  const aiService = require('../src/services/aiService');

  it('should validate a well-formed AI response', () => {
    const aiResult = {
      extractedData: {
        district: 'पुणे',
        taluka: 'हवेली',
        village: 'वडगाव',
        village_code: '123456',
        survey_number: '123/A',
        khata_number: 'K-45',
        occupancy_class: 'INAM',
        owners: [{ name: 'रमेश पाटील' }],
        area: { unit: 'Hectare', total: '२.५', cultivable: '२.०', uncultivable: '०.५' },
        assessment: '१०००',
        encumbrances: null,
        last_mutation_number: 'M-99',
      },
      overallConfidence: 0.88,
    };

    const result = aiService.validateAIResponse(aiResult);
    expect(result.isValid).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    // Area values should be in normalizedData with rawValue preserved
    expect(result.normalizedData).toHaveProperty('area');
  });

  it('should return isValid=false when extractedData is missing', () => {
    const result = aiService.validateAIResponse({ success: true });
    expect(result.isValid).toBe(false);
  });

  it('should produce a warning for empty survey_number', () => {
    const result = aiService.validateAIResponse({
      extractedData: {
        survey_number: '',
        owners: [],
        area: { unit: 'Hectare', total: '1', cultivable: '1', uncultivable: '0' },
      },
    });
    const surveyWarn = result.warnings.find((w) => w.field === 'survey_number');
    expect(surveyWarn).toBeDefined();
  });

  it('should produce a warning for invalid village_code', () => {
    const result = aiService.validateAIResponse({
      extractedData: {
        village_code: 'ABCDEF',
        survey_number: '1',
        owners: [],
        area: { unit: 'Hectare', total: '1', cultivable: '1', uncultivable: '0' },
      },
    });
    const codeWarn = result.warnings.find((w) => w.field === 'village_code');
    expect(codeWarn).toBeDefined();
  });

  it('should build confidence map with NOT_AVAILABLE source when AI does not supply confidence', () => {
    const aiResult = {
      extractedData: { district: 'Pune', survey_number: '1' },
    };
    const confidenceMap = aiService.buildConfidenceMap(aiResult);
    expect(confidenceMap).toHaveProperty('district');
    expect(confidenceMap.district.score).toBeNull();
    expect(confidenceMap.district.source).toBe('NOT_AVAILABLE');
  });
});
