/**
 * LRVS — Compensation Service
 * Team BLAZE | SIH26016
 *
 * Manages the full compensation lifecycle for land acquisition:
 * Assessment -> Approval -> Payment (mock/sandbox).
 * Real banking integration is out of scope for this prototype.
 */

'use strict';

const Compensation = require('../models/Compensation');
const LandRecord = require('../models/LandRecord');
const { COMPENSATION_STATUS, ACQUISITION_STATUS } = require('../utils/constants');
const { hashObject } = require('../utils/hash');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch a LandRecord by _id and throw 404 if not found.
 * @param {string|mongoose.Types.ObjectId} landRecordId
 * @returns {Promise<mongoose.Document>}
 */
async function _requireLandRecord(landRecordId) {
  const record = await LandRecord.findById(landRecordId);
  if (!record) {
    const err = new Error(`LandRecord not found: ${landRecordId}`);
    err.statusCode = 404;
    err.code = 'LAND_RECORD_NOT_FOUND';
    throw err;
  }
  return record;
}

/**
 * Transition a LandRecord's acquisitionStatus for compensation stages.
 * Warns if the source status is unexpected but proceeds unless already at target.
 *
 * @param {mongoose.Document} landRecord
 * @param {string} newStatus
 * @param {object} [opts]
 * @param {string|mongoose.Types.ObjectId} [opts.changedBy]
 * @param {string} [opts.remarks]
 */
async function _transitionLandRecord(landRecord, newStatus, { changedBy, remarks } = {}) {
  if (landRecord.acquisitionStatus === newStatus) {
    logger.warn('[compensationService] LandRecord already at target status, skipping', {
      landRecordId: landRecord._id,
      status: newStatus,
    });
    return;
  }

  const expectedSources = {
    [ACQUISITION_STATUS.COMPENSATION_PENDING]: ACQUISITION_STATUS.APPROVED,
    [ACQUISITION_STATUS.COMPENSATION_APPROVED]: ACQUISITION_STATUS.COMPENSATION_PENDING,
    [ACQUISITION_STATUS.COMPENSATION_PAID]: ACQUISITION_STATUS.COMPENSATION_APPROVED,
  };

  const expectedSource = expectedSources[newStatus];
  if (expectedSource && landRecord.acquisitionStatus !== expectedSource) {
    logger.warn('[compensationService] Unexpected source status for transition', {
      landRecordId: landRecord._id,
      current: landRecord.acquisitionStatus,
      target: newStatus,
      expected: expectedSource,
    });
  }

  landRecord.acquisitionStatus = newStatus;
  landRecord.statusHistory.push({
    status: newStatus,
    changedBy: changedBy || undefined,
    changedAt: new Date(),
    remarks: remarks || `Transitioned to ${newStatus}`,
  });

  await landRecord.save();
}

// ── Service Functions ─────────────────────────────────────────────────────────

/**
 * Create a new Compensation record after a LandRecord has been approved.
 *
 * @param {object} opts
 * @param {string} opts.requestId
 * @param {string|mongoose.Types.ObjectId} opts.landRecordId
 * @param {string} [opts.ownerName]
 * @param {number} opts.assessedAmount
 * @param {string|mongoose.Types.ObjectId} [opts.assessedBy]  User _id
 * @param {string} [opts.remarks]
 * @returns {Promise<object>}
 */
async function createCompensation({ requestId, landRecordId, ownerName, assessedAmount, assessedBy, remarks }) {
  try {
    const landRecord = await _requireLandRecord(landRecordId);

    const compensation = new Compensation({
      requestId,
      landRecordId,
      ownerName: ownerName || null,
      assessedAmount,
      assessedBy: assessedBy || undefined,
      remarks: remarks || '',
      paymentStatus: COMPENSATION_STATUS.ASSESSED,
      currency: 'INR',
    });

    await compensation.save();

    // Transition: APPROVED -> COMPENSATION_PENDING
    await _transitionLandRecord(landRecord, ACQUISITION_STATUS.COMPENSATION_PENDING, {
      changedBy: assessedBy,
      remarks: `Compensation assessed: INR ${assessedAmount}`,
    });

    logger.info('[compensationService.createCompensation] Compensation created', {
      compensationId: compensation._id,
      requestId,
      assessedAmount,
    });

    return compensation.toObject();
  } catch (err) {
    logger.error('[compensationService.createCompensation] Error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Fetch a single Compensation by requestId (most recent).
 *
 * @param {string} requestId
 * @returns {Promise<object>}
 * @throws {{ statusCode: 404 }} if not found
 */
async function getCompensation(requestId) {
  try {
    const compensation = await Compensation.findOne({ requestId })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'name email')
      .populate('assessedBy', 'name email')
      .populate('processedBy', 'name email')
      .lean();

    if (!compensation) {
      const err = new Error(`Compensation not found for requestId: ${requestId}`);
      err.statusCode = 404;
      err.code = 'COMPENSATION_NOT_FOUND';
      throw err;
    }

    return compensation;
  } catch (err) {
    logger.error('[compensationService.getCompensation] Error', {
      requestId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Fetch all Compensation records for a given LandRecord.
 *
 * @param {string|mongoose.Types.ObjectId} landRecordId
 * @returns {Promise<object[]>}
 */
async function getCompensationsByLandRecord(landRecordId) {
  try {
    const compensations = await Compensation.find({ landRecordId })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'name email')
      .populate('assessedBy', 'name email')
      .populate('processedBy', 'name email')
      .lean();

    return compensations;
  } catch (err) {
    logger.error('[compensationService.getCompensationsByLandRecord] Error', {
      landRecordId: String(landRecordId),
      error: err.message,
    });
    throw err;
  }
}

/**
 * Approve an assessed/under-review compensation and update LandRecord status.
 *
 * @param {string|mongoose.Types.ObjectId} compensationId
 * @param {object} opts
 * @param {string|mongoose.Types.ObjectId} opts.approvedBy
 * @param {string} opts.approvedByName
 * @param {number} opts.approvedAmount
 * @param {string} [opts.remarks]
 * @returns {Promise<object>}
 */
async function approveCompensation(compensationId, { approvedBy, approvedByName, approvedAmount, remarks }) {
  try {
    const compensation = await Compensation.findById(compensationId);
    if (!compensation) {
      const err = new Error(`Compensation not found: ${compensationId}`);
      err.statusCode = 404;
      err.code = 'COMPENSATION_NOT_FOUND';
      throw err;
    }

    const allowedStatuses = [COMPENSATION_STATUS.ASSESSED, COMPENSATION_STATUS.UNDER_REVIEW];
    if (!allowedStatuses.includes(compensation.paymentStatus)) {
      const err = new Error(
        `Compensation ${compensationId} cannot be approved from status: ${compensation.paymentStatus}`
      );
      err.statusCode = 409;
      err.code = 'INVALID_COMPENSATION_STATUS';
      throw err;
    }

    const now = new Date();

    const compensationHash = hashObject({
      compensationId: compensation._id.toString(),
      requestId: compensation.requestId,
      approvedAmount,
      approvedBy: approvedBy ? approvedBy.toString() : null,
      action: 'APPROVED',
      timestamp: now.toISOString(),
    });

    compensation.paymentStatus = COMPENSATION_STATUS.APPROVED;
    compensation.approvedBy = approvedBy;
    compensation.approvedByName = approvedByName;
    compensation.approvedAt = now;
    compensation.approvedAmount = approvedAmount;
    compensation.remarks = remarks || compensation.remarks;
    compensation.compensationHash = compensationHash;

    await compensation.save();

    // Transition: COMPENSATION_PENDING -> COMPENSATION_APPROVED
    const landRecord = await _requireLandRecord(compensation.landRecordId);
    await _transitionLandRecord(landRecord, ACQUISITION_STATUS.COMPENSATION_APPROVED, {
      changedBy: approvedBy,
      remarks: `Compensation approved: INR ${approvedAmount}`,
    });

    logger.info('[compensationService.approveCompensation] Compensation approved', {
      compensationId,
      requestId: compensation.requestId,
      approvedAmount,
    });

    return compensation.toObject();
  } catch (err) {
    logger.error('[compensationService.approveCompensation] Error', {
      compensationId: String(compensationId),
      error: err.message,
    });
    throw err;
  }
}

/**
 * Process (mock) payment for an approved compensation.
 *
 * @param {string|mongoose.Types.ObjectId} compensationId
 * @param {object} opts
 * @param {string|mongoose.Types.ObjectId} opts.processedBy  User _id
 * @returns {Promise<object>}
 */
async function processPayment(compensationId, { processedBy }) {
  try {
    const compensation = await Compensation.findById(compensationId);
    if (!compensation) {
      const err = new Error(`Compensation not found: ${compensationId}`);
      err.statusCode = 404;
      err.code = 'COMPENSATION_NOT_FOUND';
      throw err;
    }

    if (compensation.paymentStatus !== COMPENSATION_STATUS.APPROVED) {
      const err = new Error(
        `Compensation ${compensationId} must be APPROVED before payment (current: ${compensation.paymentStatus})`
      );
      err.statusCode = 409;
      err.code = 'INVALID_COMPENSATION_STATUS';
      throw err;
    }

    // Generate mock sandbox payment reference
    const paymentReference = `MOCK-PAY-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const now = new Date();

    compensation.paymentStatus = COMPENSATION_STATUS.PAID;
    compensation.paymentReference = paymentReference;
    compensation.paymentDate = now;
    compensation.paymentMode = 'MOCK';
    compensation.processedBy = processedBy;

    await compensation.save();

    // Transition: COMPENSATION_APPROVED -> COMPENSATION_PAID
    const landRecord = await _requireLandRecord(compensation.landRecordId);
    await _transitionLandRecord(landRecord, ACQUISITION_STATUS.COMPENSATION_PAID, {
      changedBy: processedBy,
      remarks: `Mock payment processed: ${paymentReference}`,
    });

    logger.info('[compensationService.processPayment] Payment processed', {
      compensationId,
      requestId: compensation.requestId,
      paymentReference,
    });

    return compensation.toObject();
  } catch (err) {
    logger.error('[compensationService.processPayment] Error', {
      compensationId: String(compensationId),
      error: err.message,
    });
    throw err;
  }
}

/**
 * Aggregate compensation statistics across all records.
 *
 * @returns {Promise<{
 *   assessed: number,
 *   underReview: number,
 *   approved: number,
 *   paid: number,
 *   rejected: number,
 *   totalApprovedAmount: number,
 *   totalPaidAmount: number
 * }>}
 */
async function getCompensationStats() {
  try {
    const [statusCounts, amountAgg] = await Promise.all([
      Compensation.aggregate([
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
          },
        },
      ]),
      Compensation.aggregate([
        {
          $facet: {
            totalApproved: [
              {
                $match: {
                  paymentStatus: {
                    $in: [COMPENSATION_STATUS.APPROVED, COMPENSATION_STATUS.PAID],
                  },
                },
              },
              { $group: { _id: null, total: { $sum: '$approvedAmount' } } },
            ],
            totalPaid: [
              { $match: { paymentStatus: COMPENSATION_STATUS.PAID } },
              { $group: { _id: null, total: { $sum: '$approvedAmount' } } },
            ],
          },
        },
      ]),
    ]);

    const stats = {
      assessed: 0,
      underReview: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
      totalApprovedAmount: 0,
      totalPaidAmount: 0,
    };

    const statusKeyMap = {
      [COMPENSATION_STATUS.ASSESSED]: 'assessed',
      [COMPENSATION_STATUS.UNDER_REVIEW]: 'underReview',
      [COMPENSATION_STATUS.APPROVED]: 'approved',
      [COMPENSATION_STATUS.PAID]: 'paid',
      [COMPENSATION_STATUS.REJECTED]: 'rejected',
    };

    for (const row of statusCounts) {
      const key = statusKeyMap[row._id];
      if (key) stats[key] = row.count;
    }

    const facet = amountAgg[0] || {};
    stats.totalApprovedAmount =
      facet.totalApproved && facet.totalApproved[0] ? facet.totalApproved[0].total || 0 : 0;
    stats.totalPaidAmount =
      facet.totalPaid && facet.totalPaid[0] ? facet.totalPaid[0].total || 0 : 0;

    logger.debug('[compensationService.getCompensationStats] Stats computed', stats);
    return stats;
  } catch (err) {
    logger.error('[compensationService.getCompensationStats] Error', { error: err.message });
    throw err;
  }
}

module.exports = {
  createCompensation,
  getCompensation,
  getCompensationsByLandRecord,
  approveCompensation,
  processPayment,
  getCompensationStats,
};
