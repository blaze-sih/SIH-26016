/**
 * LRVS — Verification Service
 * Team BLAZE | SIH26016
 *
 * Human-in-the-loop verification workflow.
 * AI snapshots are IMMUTABLE — all human corrections are recorded as
 * individual field-change audit entries, and a separate verifiedSnapshot
 * is maintained alongside the original aiSnapshot.
 */

'use strict';

const Verification = require('../models/Verification');
const LandRecord = require('../models/LandRecord');
const Document = require('../models/Document');
const ProcessingJob = require('../models/ProcessingJob');
const { VERIFICATION_STATUS, ACQUISITION_STATUS } = require('../utils/constants');
const { assertValidTransition } = require('../utils/statusTransitions');
const { hashObject } = require('../utils/hash');
const logger = require('../utils/logger');

// landService is imported here (not at top-level require cycle risk)
// It is intentionally imported lazily inside functions that need it to
// avoid potential circular-dependency issues at module load time.
const landService = require('./landService');

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Creates a structured 404 AppError.
 * @param {string} msg
 * @returns {Error}
 */
function createNotFoundError(msg) {
  const e = new Error(msg);
  e.statusCode = 404;
  e.code = 'NOT_FOUND';
  return e;
}

/**
 * Read a value from a nested object using a dot-notation path.
 * e.g. getNestedValue({ a: { b: 1 } }, 'a.b') → 1
 * Supports array index notation: 'owners.0.name'
 *
 * @param {object} obj
 * @param {string} dotPath
 * @returns {*}
 */
function getNestedValue(obj, dotPath) {
  if (obj == null || !dotPath) return undefined;
  const parts = dotPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set a value on a nested object using a dot-notation path.
 * Intermediate objects/arrays are created as needed.
 * e.g. setNestedValue(obj, 'owners.0.name', 'Ravi')
 *
 * @param {object} obj
 * @param {string} dotPath
 * @param {*} value
 */
function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    // Determine if the next key is an array index
    if (current[part] == null) {
      current[part] = isNaN(Number(nextPart)) ? {} : [];
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Deep-clone a plain object/array (no Mongoose documents).
 * @param {*} obj
 * @returns {*}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Return a paginated verification queue.
 *
 * By default returns PENDING and INCOMPLETE verifications.
 * Supports filtering by documentType, search text, date range, and
 * AI confidence tier.
 *
 * @param {object} params
 * @returns {Promise<{ verifications: Verification[], total: number, page: number, limit: number }>}
 */
async function getQueue({
  page = 1,
  limit = 10,
  status,
  documentType,
  search,
  dateFrom,
  dateTo,
  confidence,
} = {}) {
  try {
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (parsedPage - 1) * parsedLimit;

    // Base status filter — default to active queue items
    const statusFilter = status
      ? [status]
      : [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.INCOMPLETE];

    const filter = { status: { $in: statusFilter } };

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Build the base query with full population
    let query = Verification.find(filter)
      .populate('landRecordId', 'requestId surveyNumber district village acquisitionStatus')
      .populate('documentId', 'documentType originalName aiStatus storedName')
      .populate('processingJobId', 'overallConfidence validationWarnings')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    let verifications = await query.lean({ virtuals: true });

    // ── Post-population filters ───────────────────────────────────────────────
    // These filters operate on populated sub-documents so are applied in JS.

    if (documentType) {
      verifications = verifications.filter(
        (v) => v.documentId && v.documentId.documentType === documentType
      );
    }

    if (search) {
      const re = new RegExp(search, 'i');
      verifications = verifications.filter((v) => {
        const lr = v.landRecordId;
        if (!lr) return false;
        return (
          re.test(lr.requestId || '') ||
          re.test(lr.surveyNumber || '') ||
          re.test(lr.district || '')
        );
      });
    }

    if (confidence) {
      verifications = verifications.filter((v) => {
        const score =
          v.processingJobId ? v.processingJobId.overallConfidence : null;
        if (score == null) return false;
        if (confidence === 'HIGH') return score >= 0.8;
        if (confidence === 'MEDIUM') return score >= 0.5 && score < 0.8;
        if (confidence === 'LOW') return score < 0.5;
        return true;
      });
    }

    // Re-count total accurately when post-filters applied
    // For efficiency, total is from DB when no post-filters; otherwise use filtered array length
    const hasPostFilters = !!(documentType || search || confidence);
    let total;

    if (hasPostFilters) {
      // Count after post-filtering — note: for large datasets a proper aggregation
      // pipeline would be more efficient; this covers the MVP case.
      total = verifications.length;
      // Since we already applied skip/limit before post-filter, we need to re-run
      // without skip/limit to get accurate total when post-filters are active.
      // Only do this expensive path when filters are present.
      const allForCount = await Verification.find(filter)
        .populate('landRecordId', 'requestId surveyNumber district')
        .populate('documentId', 'documentType originalName aiStatus')
        .populate('processingJobId', 'overallConfidence')
        .lean();

      let filtered = allForCount;
      if (documentType) {
        filtered = filtered.filter(
          (v) => v.documentId && v.documentId.documentType === documentType
        );
      }
      if (search) {
        const re = new RegExp(search, 'i');
        filtered = filtered.filter((v) => {
          const lr = v.landRecordId;
          if (!lr) return false;
          return (
            re.test(lr.requestId || '') ||
            re.test(lr.surveyNumber || '') ||
            re.test(lr.district || '')
          );
        });
      }
      if (confidence) {
        filtered = filtered.filter((v) => {
          const score = v.processingJobId ? v.processingJobId.overallConfidence : null;
          if (score == null) return false;
          if (confidence === 'HIGH') return score >= 0.8;
          if (confidence === 'MEDIUM') return score >= 0.5 && score < 0.8;
          if (confidence === 'LOW') return score < 0.5;
          return true;
        });
      }
      total = filtered.length;
      // Apply pagination to the filtered set
      verifications = filtered.slice(skip, skip + parsedLimit);
    } else {
      total = await Verification.countDocuments(filter);
    }

    return { verifications, total, page: parsedPage, limit: parsedLimit };
  } catch (err) {
    logger.error('verificationService.getQueue error', { error: err.message });
    throw err;
  }
}

/**
 * Retrieve full verification detail for a given requestId.
 *
 * @param {string} requestId
 * @returns {Promise<object>} Combined { verification, landRecord, document, processingJob, documentUrl }
 */
async function getVerificationDetail(requestId) {
  try {
    const verification = await Verification.findOne({ requestId })
      .populate('landRecordId')
      .populate('documentId')
      .populate('processingJobId')
      .populate('verifiedBy', 'name email role')
      .lean({ virtuals: true });

    if (!verification) {
      throw createNotFoundError(
        `Verification for request '${requestId}' not found`
      );
    }

    const landRecord = verification.landRecordId || null;
    const document = verification.documentId || null;
    const processingJob = verification.processingJobId || null;

    const documentUrl = document && document.storedName
      ? `/uploads/documents/${document.storedName}`
      : null;

    // Attach url virtual manually (lean loses virtuals from sub-docs)
    if (document) {
      document.url = documentUrl;
    }

    return {
      verification,
      landRecord,
      document,
      processingJob,
      documentUrl,
    };
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw err;
    logger.error('verificationService.getVerificationDetail error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Create a new Verification record for a land record + document.
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string|mongoose.Types.ObjectId} params.landRecordId
 * @param {string|mongoose.Types.ObjectId} params.documentId
 * @param {string|mongoose.Types.ObjectId} [params.processingJobId]
 * @param {object} params.aiSnapshot - Full AI extraction result
 * @returns {Promise<Verification>}
 */
async function createVerification({
  requestId,
  landRecordId,
  documentId,
  processingJobId,
  aiSnapshot,
}) {
  try {
    const aiSnapshotHash = hashObject(aiSnapshot);
    const verifiedSnapshot = deepClone(aiSnapshot);

    const verification = new Verification({
      requestId,
      landRecordId,
      documentId,
      processingJobId: processingJobId || null,
      aiSnapshot,
      aiSnapshotHash,
      verifiedSnapshot,
      verifiedSnapshotHash: aiSnapshotHash, // starts identical to AI snapshot
      status: VERIFICATION_STATUS.PENDING,
      fieldChanges: [],
    });

    await verification.save();

    logger.info(`Verification created for request ${requestId}`);
    return verification;
  } catch (err) {
    logger.error('verificationService.createVerification error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Record a single field correction by a human officer.
 * Updates verifiedSnapshot in-place and appends to the fieldChanges audit trail.
 *
 * @param {string} requestId
 * @param {object} params
 * @param {string} params.fieldPath       - Dot-notation path into the snapshot
 * @param {*}      params.verifiedValue   - New human-corrected value
 * @param {string} [params.reason]        - Optional reason for change
 * @param {string|mongoose.Types.ObjectId} params.changedBy
 * @param {string} [params.changedByName]
 * @returns {Promise<Verification>}
 */
async function updateField(
  requestId,
  { fieldPath, verifiedValue, reason, changedBy, changedByName }
) {
  try {
    const verification = await Verification.findOne({
      requestId,
      status: { $in: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.INCOMPLETE] },
    });

    if (!verification) {
      throw createNotFoundError(
        `Active verification for request '${requestId}' not found`
      );
    }

    // Capture original AI value at this field path
    const originalAiValue = getNestedValue(verification.aiSnapshot, fieldPath);

    // Append immutable audit entry
    verification.fieldChanges.push({
      fieldPath,
      originalAiValue,
      verifiedValue,
      changedBy,
      changedByName: changedByName || null,
      changedAt: new Date(),
      reason: reason || null,
    });

    // Apply correction to the mutable verified snapshot
    // Work on a plain-object copy, then reassign to trigger Mongoose change detection
    const snapshotCopy = deepClone(verification.verifiedSnapshot || {});
    setNestedValue(snapshotCopy, fieldPath, verifiedValue);
    verification.verifiedSnapshot = snapshotCopy;
    verification.verifiedSnapshotHash = hashObject(snapshotCopy);

    // Mark the Mixed field as modified so Mongoose saves it
    verification.markModified('verifiedSnapshot');

    await verification.save();

    logger.info(
      `Verification field updated: ${requestId} / ${fieldPath} by ${changedBy}`
    );

    return verification;
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw err;
    logger.error('verificationService.updateField error', {
      requestId,
      fieldPath,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Mark a verification as VERIFIED and transition the land record accordingly.
 *
 * @param {string} requestId
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.verifiedBy
 * @param {string} [params.verifiedByName]
 * @param {string} [params.remarks]
 * @returns {Promise<Verification>}
 */
async function markVerified(requestId, { verifiedBy, verifiedByName, remarks }) {
  try {
    const verification = await Verification.findOne({
      requestId,
      status: { $in: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.INCOMPLETE] },
    });

    if (!verification) {
      throw createNotFoundError(
        `Active verification for request '${requestId}' not found`
      );
    }

    verification.status = VERIFICATION_STATUS.VERIFIED;
    verification.verifiedBy = verifiedBy;
    verification.verifiedByName = verifiedByName || null;
    verification.verifiedAt = new Date();
    verification.remarks = remarks || null;

    // Recompute final hash of the verified snapshot
    if (verification.verifiedSnapshot) {
      verification.verifiedSnapshotHash = hashObject(verification.verifiedSnapshot);
    }

    await verification.save();

    // Transition land record: PENDING_VERIFICATION → VERIFIED
    await landService.transitionStatus(
      requestId,
      ACQUISITION_STATUS.VERIFIED,
      verifiedBy,
      remarks || 'Verification completed by officer'
    );

    logger.info(`Verification marked VERIFIED for request ${requestId} by ${verifiedBy}`);
    return verification;
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'INVALID_STATUS_TRANSITION') throw err;
    logger.error('verificationService.markVerified error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Mark a verification as INCOMPLETE (needs further officer action).
 * Transitions the land record to VERIFICATION_INCOMPLETE.
 *
 * @param {string} requestId
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.verifiedBy
 * @param {string} [params.verifiedByName]
 * @param {string} [params.remarks]
 * @returns {Promise<Verification>}
 */
async function markIncomplete(
  requestId,
  { verifiedBy, verifiedByName, remarks }
) {
  try {
    const verification = await Verification.findOne({
      requestId,
      status: { $in: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.INCOMPLETE] },
    });

    if (!verification) {
      throw createNotFoundError(
        `Active verification for request '${requestId}' not found`
      );
    }

    verification.status = VERIFICATION_STATUS.INCOMPLETE;
    verification.verifiedBy = verifiedBy;
    verification.verifiedByName = verifiedByName || null;
    verification.remarks = remarks || null;

    await verification.save();

    // Transition land record: PENDING_VERIFICATION → VERIFICATION_INCOMPLETE
    await landService.transitionStatus(
      requestId,
      ACQUISITION_STATUS.VERIFICATION_INCOMPLETE,
      verifiedBy,
      remarks || 'Verification marked incomplete by officer'
    );

    logger.info(
      `Verification marked INCOMPLETE for request ${requestId} by ${verifiedBy}`
    );
    return verification;
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'INVALID_STATUS_TRANSITION') throw err;
    logger.error('verificationService.markIncomplete error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Reject a verification and transition the land record to REJECTED.
 *
 * @param {string} requestId
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.verifiedBy
 * @param {string} [params.remarks]
 * @returns {Promise<Verification>}
 */
async function markRejected(requestId, { verifiedBy, remarks }) {
  try {
    const verification = await Verification.findOne({ requestId });

    if (!verification) {
      throw createNotFoundError(
        `Verification for request '${requestId}' not found`
      );
    }

    verification.status = VERIFICATION_STATUS.REJECTED;
    verification.verifiedBy = verifiedBy;
    verification.verifiedAt = new Date();
    verification.remarks = remarks || null;

    await verification.save();

    // Transition land record to REJECTED
    await landService.transitionStatus(
      requestId,
      ACQUISITION_STATUS.REJECTED,
      verifiedBy,
      remarks || 'Verification rejected by officer'
    );

    logger.info(
      `Verification REJECTED for request ${requestId} by ${verifiedBy}`
    );
    return verification;
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'INVALID_STATUS_TRANSITION') throw err;
    logger.error('verificationService.markRejected error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  getQueue,
  getVerificationDetail,
  createVerification,
  updateField,
  markVerified,
  markIncomplete,
  markRejected,
};
