/**
 * LRVS — Document Controller (Decoupled Architecture)
 * Team BLAZE | SIH26016
 *
 * REST APIs for Document Storage, AI Extraction, and Correction Workflows:
 * POST   /api/documents               - Upload document
 * GET    /api/documents                - List documents
 * GET    /api/documents/:documentId    - Get document metadata & details
 * GET    /api/documents/:documentId/file - Secure download/preview
 * POST   /api/documents/:documentId/process - Trigger AI extraction
 * GET    /api/documents/:documentId/extraction - Get extracted data
 * POST   /api/documents/:documentId/corrections - Submit user correction
 * GET    /api/documents/:documentId/history - Get audit / correction history
 * POST   /api/documents/:documentId/verify - Finalize verification
 * POST   /api/documents/:documentId/version - Upload replacement version
 */

'use strict';

const documentService = require('../services/documentService');
const DocumentExtraction = require('../models/DocumentExtraction');
const DocumentCorrection = require('../models/DocumentCorrection');
const { success, error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ── POST /api/documents (Upload Document) ────────────────────────────────────
async function uploadDocument(req, res, next) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json(error('No file provided for document upload.', { code: 'NO_FILE' }, 400));
    }

    const {
      ownerId = req.user?.userId || 'LAND-001',
      landParcelId = 'PARCEL-142-3',
      acquisitionRequestId = req.body.requestId || 'LA-2026-0245',
      documentType = '7_12_EXTRACT',
      sourceType = 'USER_UPLOAD',
      description,
      autoProcess = 'true',
    } = req.body;

    const doc = await documentService.saveDocument({
      file,
      ownerId,
      landParcelId,
      acquisitionRequestId,
      documentType,
      sourceType,
      uploadedBy: req.user?.userId || ownerId,
      uploadedByName: req.user?.name || 'Ramesh Patil',
      description,
      autoProcessAI: autoProcess !== 'false',
      req,
    });

    return res.status(201).json(
      success('Document uploaded and stored successfully.', {
        document: doc,
        documentId: doc.documentId,
        storageKey: doc.storageKey,
        fileHash: doc.fileHash,
        status: doc.processingStatus,
      }, 201)
    );
  } catch (err) {
    logger.error('uploadDocument error', { error: err.message });
    next(err);
  }
}

// ── GET /api/documents (List Documents) ──────────────────────────────────────
async function listDocuments(req, res, next) {
  try {
    const filter = {
      ownerId: req.query.ownerId,
      landParcelId: req.query.landParcelId,
      acquisitionRequestId: req.query.acquisitionRequestId || req.query.requestId,
      documentType: req.query.documentType,
      processingStatus: req.query.status || req.query.processingStatus,
    };

    const docs = await documentService.listDocuments(filter, req.user);
    return res.json(success('Documents retrieved successfully.', { documents: docs, count: docs.length }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/documents/:documentId (Metadata & Verification Details) ─────────
async function getDocument(req, res, next) {
  try {
    const { documentId } = req.params;
    const doc = await documentService.getDocument(documentId, req.user);
    return res.json(success('Document metadata retrieved successfully.', { document: doc }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/documents/:documentId/file (Secure File Stream) ─────────────────
async function getDocumentFile(req, res, next) {
  try {
    const { documentId } = req.params;
    const versionNumber = req.query.version ? parseInt(req.query.version, 10) : undefined;

    const fileData = await documentService.getDocumentFileStream(documentId, req.user, versionNumber);

    res.setHeader('Content-Type', fileData.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileData.originalFileName}"`);
    if (fileData.fileSize) {
      res.setHeader('Content-Length', fileData.fileSize);
    }

    fileData.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/documents/:documentId/process (Trigger AI Extraction) ───────────
async function processWithAI(req, res, next) {
  try {
    const { documentId } = req.params;
    const extraction = await documentService.processAIDocument(documentId);
    return res.json(
      success('AI extraction processed successfully.', {
        documentId,
        extraction,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ── GET /api/documents/:documentId/extraction ─────────────────────────────────
async function getExtraction(req, res, next) {
  try {
    const { documentId } = req.params;
    // Verify access
    await documentService.getDocument(documentId, req.user);

    const extraction = await DocumentExtraction.findOne({ documentId }).sort({ createdAt: -1 });
    if (!extraction) {
      return res.status(404).json(error('No AI extraction record found for this document.', { code: 'NOT_FOUND' }, 404));
    }

    return res.json(success('AI extraction retrieved successfully.', { extraction }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/documents/:documentId/corrections (Submit User Correction) ──────
async function submitCorrection(req, res, next) {
  try {
    const { documentId } = req.params;
    const { field, correctedValue, reason } = req.body;

    if (!field || correctedValue === undefined) {
      return res.status(400).json(error('Field name and correctedValue are required.', { code: 'VALIDATION_ERROR' }, 400));
    }

    const correction = await documentService.submitCorrection(documentId, {
      field,
      correctedValue,
      reason,
      correctedBy: req.user?.userId || req.user?.name || 'LAND-001',
    });

    return res.status(201).json(
      success('Correction submitted successfully and logged to audit trail.', { correction }, 201)
    );
  } catch (err) {
    next(err);
  }
}

// ── GET /api/documents/:documentId/history (Correction & Version History) ─────
async function getHistory(req, res, next) {
  try {
    const { documentId } = req.params;
    const doc = await documentService.getDocument(documentId, req.user);
    const corrections = await DocumentCorrection.find({ documentId }).sort({ createdAt: -1 });

    return res.json(
      success('Document history retrieved successfully.', {
        documentId,
        currentVersion: doc.currentVersion,
        versions: doc.versions || [],
        corrections,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ── POST /api/documents/:documentId/verify (Finalize Verification) ────────────
async function verifyDocument(req, res, next) {
  try {
    const { documentId } = req.params;
    const { remarks, overrideFields } = req.body;

    const doc = await documentService.verifyDocument(documentId, {
      verifiedBy: req.user?.name || req.user?.userId || 'Verification Officer',
      remarks,
      overrideFields,
    });

    return res.json(
      success('Document verified successfully and final values established.', {
        documentId: doc.documentId,
        verificationStatus: doc.verificationStatus,
        processingStatus: doc.processingStatus,
        verifiedData: doc.verifiedData,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ── POST /api/documents/:documentId/version (Upload Replacement Version) ──────
async function uploadNewVersion(req, res, next) {
  try {
    const { documentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json(error('No replacement file provided.', { code: 'NO_FILE' }, 400));
    }

    const doc = await documentService.uploadReplacementVersion(
      documentId,
      file,
      {
        uploadedBy: req.user?.userId || req.user?.name || 'LAND-001',
        changeReason: req.body.changeReason || 'Replacement document upload',
      },
      req
    );

    return res.status(201).json(
      success(`Replacement version ${doc.currentVersion} uploaded successfully. Previous versions remain preserved.`, {
        documentId: doc.documentId,
        version: doc.currentVersion,
        storageKey: doc.storageKey,
        fileHash: doc.fileHash,
      }, 201)
    );
  } catch (err) {
    next(err);
  }
}

// ── GET /api/documents/land/:requestId (Backwards compatibility) ──────────────
async function getDocumentsByRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const docs = await documentService.listDocuments({ acquisitionRequestId: requestId }, req.user);
    return res.json(success('Documents retrieved successfully.', { documents: docs, count: docs.length }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/documents/:documentId/job-status (Backwards compatibility) ───────
async function getJobStatus(req, res, next) {
  try {
    const { documentId } = req.params;
    const doc = await documentService.getDocument(documentId, req.user);
    return res.json(
      success('Job status retrieved.', {
        job: {
          status: doc.aiProcessingStatus === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
          documentId: doc.documentId,
          processingStatus: doc.processingStatus,
        },
      })
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
