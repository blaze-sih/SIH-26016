/**
 * LRVS — Document REST Routes
 * Team BLAZE | SIH26016
 *
 * Exposes clean, decoupled REST endpoints for document management:
 * POST   /api/documents                 - Upload new document
 * GET    /api/documents                 - List documents
 * GET    /api/documents/:documentId     - Metadata & details
 * GET    /api/documents/:documentId/file - Secure authenticated stream/download
 * POST   /api/documents/:documentId/process - AI extraction
 * GET    /api/documents/:documentId/extraction - Structured extraction fields
 * POST   /api/documents/:documentId/corrections - Submit field correction
 * GET    /api/documents/:documentId/history - Audit & version history
 * POST   /api/documents/:documentId/verify - Finalize verification
 * POST   /api/documents/:documentId/version - Upload replacement version
 */

'use strict';

const express = require('express');
const router = express.Router();

const {
  uploadDocument,
  listDocuments,
  getDocument,
  getDocumentFile,
  processWithAI,
  getExtraction,
  submitCorrection,
  getHistory,
  verifyDocument,
  uploadNewVersion,
  getDocumentsByRequest,
  getJobStatus,
} = require('../controllers/documentController');

const { authenticateUser } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

// All document routes require authentication
router.use(authenticateUser);

// ── Document Collections ──────────────────────────────────────────────────────

// GET /api/documents — List documents (supports query filters)
router.get('/', listDocuments);

// POST /api/documents — Upload new document (supports Land Owner & Officers)
router.post('/', uploadSingle('document'), uploadDocument);

// Backwards-compatible POST /api/documents/upload
router.post('/upload', uploadSingle('document'), uploadDocument);

// Backwards-compatible GET /api/documents/land/:requestId
router.get('/land/:requestId', getDocumentsByRequest);

// ── Specific Document Operations ──────────────────────────────────────────────

// GET /api/documents/:documentId — Document metadata & verification status
router.get('/:documentId', getDocument);

// GET /api/documents/:documentId/file — Stream file securely through backend
router.get('/:documentId/file', getDocumentFile);

// POST /api/documents/:documentId/process — Trigger AI extraction
router.post('/:documentId/process', processWithAI);
router.post('/:documentId/process-ai', processWithAI);

// GET /api/documents/:documentId/extraction — Get AI extracted fields & confidence
router.get('/:documentId/extraction', getExtraction);

// POST /api/documents/:documentId/corrections — Submit user correction
router.post('/:documentId/corrections', submitCorrection);

// GET /api/documents/:documentId/history — Audit & version history
router.get('/:documentId/history', getHistory);

// POST /api/documents/:documentId/verify — Finalize verification
router.post('/:documentId/verify', verifyDocument);

// POST /api/documents/:documentId/version — Upload replacement version
router.post('/:documentId/version', uploadSingle('document'), uploadNewVersion);

// Backwards-compatible GET /api/documents/:documentId/job-status
router.get('/:documentId/job-status', getJobStatus);

module.exports = router;
