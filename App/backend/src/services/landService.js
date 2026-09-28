/**
 * LRVS — Land Record Service
 * Team BLAZE | SIH26016
 *
 * Handles all CRUD operations, status transitions, dashboard aggregation,
 * and GIS/map data retrieval for LandRecord documents.
 */

'use strict';

const mongoose = require('mongoose');
const LandRecord = require('../models/LandRecord');
const { ACQUISITION_STATUS } = require('../utils/constants');
const { assertValidTransition } = require('../utils/statusTransitions');
const { hashObject } = require('../utils/hash');
const logger = require('../utils/logger');

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

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Create a new LandRecord.
 * @param {object} data   - Record fields
 * @param {string} userId - ObjectId string of the creating user
 * @returns {Promise<LandRecord>}
 */
async function createLandRecord(data, userId) {
  try {
    const recordData = { ...data, createdBy: userId };

    // Normalise GeoJSON if lat/lng supplied
    if (
      data.location &&
      data.location.latitude != null &&
      data.location.longitude != null
    ) {
      recordData.location = {
        ...data.location,
        type: 'Point',
        coordinates: [data.location.longitude, data.location.latitude],
      };
    }

    const record = new LandRecord(recordData);
    await record.save();

    logger.info(`LandRecord created: ${record.requestId} by user ${userId}`);
    return record;
  } catch (err) {
    logger.error('landService.createLandRecord error', { error: err.message });
    throw err;
  }
}

/**
 * Retrieve a paginated, filtered list of land records.
 * @param {object} params - Query parameters
 * @returns {Promise<{ records: LandRecord[], total: number, page: number, limit: number }>}
 */
async function getRequests({
  page = 1,
  limit = 10,
  status,
  district,
  state,
  search,
  assignedOfficer,
  dateFrom,
  dateTo,
  sortBy = 'createdAt',
  sortOrder = 'desc',
} = {}) {
  try {
    const filter = {};

    if (status) {
      filter.acquisitionStatus = status;
    }

    if (district) {
      filter.district = { $regex: district, $options: 'i' };
    }

    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { requestId: searchRegex },
        { registrationNumber: searchRegex },
        { surveyNumber: searchRegex },
        { 'owners.name': searchRegex },
      ];
    }

    if (assignedOfficer) {
      filter.assignedOfficer = new mongoose.Types.ObjectId(assignedOfficer);
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (parsedPage - 1) * parsedLimit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [records, total] = await Promise.all([
      LandRecord.find(filter)
        .populate('assignedOfficer', 'name email role')
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parsedLimit)
        .lean({ virtuals: true }),
      LandRecord.countDocuments(filter),
    ]);

    return { records, total, page: parsedPage, limit: parsedLimit };
  } catch (err) {
    logger.error('landService.getRequests error', { error: err.message });
    throw err;
  }
}

/**
 * Fetch a single record by its requestId string.
 * @param {string} requestId
 * @returns {Promise<LandRecord>}
 */
async function getRecord(requestId) {
  try {
    const record = await LandRecord.findOne({ requestId })
      .populate('assignedOfficer', 'name email role')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!record) {
      throw createNotFoundError(`Land record '${requestId}' not found`);
    }

    return record;
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw err;
    logger.error('landService.getRecord error', { requestId, error: err.message });
    throw err;
  }
}

/**
 * Fetch a single record by MongoDB _id.
 * @param {string} id - MongoDB ObjectId string
 * @returns {Promise<LandRecord>}
 */
async function getRecordById(id) {
  try {
    const record = await LandRecord.findById(id)
      .populate('assignedOfficer', 'name email role')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!record) {
      throw createNotFoundError(`Land record with id '${id}' not found`);
    }

    return record;
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw err;
    logger.error('landService.getRecordById error', { id, error: err.message });
    throw err;
  }
}

/**
 * Update allowed fields on an existing land record.
 * @param {string} requestId
 * @param {object} data   - Fields to update
 * @param {string} userId - ObjectId string of the updating user
 * @returns {Promise<LandRecord>}
 */
async function updateRecord(requestId, data, userId) {
  try {
    const record = await LandRecord.findOne({ requestId });
    if (!record) {
      throw createNotFoundError(`Land record '${requestId}' not found`);
    }

    // Allowed top-level fields for direct update
    const allowedFields = [
      'projectId', 'projectName', 'registrationNumber', 'surveyNumber',
      'subDivision', 'khataNumber', 'state', 'district', 'taluka',
      'village', 'villageCode', 'owners', 'occupancyClass', 'area',
      'assessment', 'encumbrances', 'lastMutationNumber', 'landType',
      'landUse', 'acquisitionPurpose', 'acquisitionAuthority',
      'proposedAcquisitionDate', 'currentAuthority', 'assignedOfficer',
      'assignedOfficerName', 'primaryDocumentId', 'affectedFamilies',
      'displacedFamilies', 'compensationStatus', 'possessionStatus', 'rrStatus',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        record[field] = data[field];
      }
    }

    // Update GeoJSON location if provided
    if (data.location) {
      const loc = data.location;
      if (loc.latitude != null && loc.longitude != null) {
        record.location = {
          ...loc,
          type: 'Point',
          coordinates: [loc.longitude, loc.latitude],
        };
      } else {
        record.location = loc;
      }
    }

    record.updatedBy = userId;
    await record.save();

    logger.info(`LandRecord updated: ${requestId} by user ${userId}`);
    return record;
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw err;
    logger.error('landService.updateRecord error', { requestId, error: err.message });
    throw err;
  }
}

/**
 * Transition a record's acquisitionStatus through the state machine.
 * @param {string} requestId
 * @param {string} toStatus  - Target ACQUISITION_STATUS value
 * @param {string} userId
 * @param {string} [remarks]
 * @returns {Promise<LandRecord>}
 */
async function transitionStatus(requestId, toStatus, userId, remarks) {
  try {
    const record = await LandRecord.findOne({ requestId });
    if (!record) {
      throw createNotFoundError(`Land record '${requestId}' not found`);
    }

    const fromStatus = record.acquisitionStatus;

    // Throws 409 if transition is invalid
    assertValidTransition(fromStatus, toStatus);

    record.statusHistory.push({
      status: toStatus,
      changedBy: userId,
      remarks: remarks || null,
    });

    record.acquisitionStatus = toStatus;
    record.updatedBy = userId;

    await record.save();

    logger.info(
      `LandRecord ${requestId} transitioned: ${fromStatus} → ${toStatus} by ${userId}`
    );

    return record;
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'INVALID_STATUS_TRANSITION') throw err;
    logger.error('landService.transitionStatus error', { requestId, toStatus, error: err.message });
    throw err;
  }
}

/**
 * Return aggregate dashboard summary metrics.
 * @param {object} [filters={}] - Optional pre-filter (e.g. { district, state })
 * @returns {Promise<object>}
 */
async function getDashboardSummary(filters = {}) {
  try {
    const matchStage = {};

    if (filters.district) {
      matchStage.district = { $regex: filters.district, $options: 'i' };
    }
    if (filters.state) {
      matchStage.state = { $regex: filters.state, $options: 'i' };
    }
    if (filters.assignedOfficer) {
      matchStage.assignedOfficer = new mongoose.Types.ObjectId(filters.assignedOfficer);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$acquisitionStatus',
          count: { $sum: 1 },
          totalLandArea: { $sum: { $ifNull: ['$area.totalNumeric', 0] } },
          sumAffectedFamilies: { $sum: { $ifNull: ['$affectedFamilies', 0] } },
          sumDisplacedFamilies: { $sum: { $ifNull: ['$displacedFamilies', 0] } },
        },
      },
    ];

    const results = await LandRecord.aggregate(pipeline);

    // Initialise counters
    const byStatus = {};
    let total = 0;
    let totalLandProposed = 0;
    let totalLandAcquired = 0;
    let affectedFamilies = 0;
    let displacedFamilies = 0;

    for (const row of results) {
      byStatus[row._id] = row.count;
      total += row.count;
      totalLandProposed += row.totalLandArea;
      affectedFamilies += row.sumAffectedFamilies;
      displacedFamilies += row.sumDisplacedFamilies;

      // Treat POSSESSION_COMPLETED and CLOSED as fully acquired
      if (
        row._id === ACQUISITION_STATUS.POSSESSION_COMPLETED ||
        row._id === ACQUISITION_STATUS.CLOSED
      ) {
        totalLandAcquired += row.totalLandArea;
      }
    }

    // Convenience shorthand counters
    const pendingRequests =
      (byStatus[ACQUISITION_STATUS.SUBMITTED] || 0) +
      (byStatus[ACQUISITION_STATUS.DRAFT] || 0);

    const inReview =
      (byStatus[ACQUISITION_STATUS.AI_PROCESSING] || 0) +
      (byStatus[ACQUISITION_STATUS.AI_PROCESSED] || 0) +
      (byStatus[ACQUISITION_STATUS.PENDING_VERIFICATION] || 0) +
      (byStatus[ACQUISITION_STATUS.VERIFICATION_INCOMPLETE] || 0) +
      (byStatus[ACQUISITION_STATUS.VERIFIED] || 0) +
      (byStatus[ACQUISITION_STATUS.PENDING_APPROVAL] || 0);

    const approved =
      (byStatus[ACQUISITION_STATUS.APPROVED] || 0) +
      (byStatus[ACQUISITION_STATUS.COMPENSATION_PENDING] || 0) +
      (byStatus[ACQUISITION_STATUS.COMPENSATION_APPROVED] || 0) +
      (byStatus[ACQUISITION_STATUS.COMPENSATION_PAID] || 0) +
      (byStatus[ACQUISITION_STATUS.POSSESSION_PENDING] || 0) +
      (byStatus[ACQUISITION_STATUS.POSSESSION_COMPLETED] || 0) +
      (byStatus[ACQUISITION_STATUS.CLOSED] || 0);

    const rejected = byStatus[ACQUISITION_STATUS.REJECTED] || 0;

    return {
      pendingRequests,
      inReview,
      approved,
      rejected,
      total,
      totalLandProposed,
      totalLandAcquired,
      affectedFamilies,
      displacedFamilies,
      byStatus,
    };
  } catch (err) {
    logger.error('landService.getDashboardSummary error', { error: err.message });
    throw err;
  }
}

/**
 * Return lightweight GIS-ready records for map rendering.
 * @param {object} params
 * @param {string} [params.district]
 * @param {string} [params.state]
 * @param {string} [params.status]
 * @returns {Promise<Array<object>>}
 */
async function getMapData({ district, state, status } = {}) {
  try {
    const filter = {
      'location.coordinates': { $exists: true, $ne: [] },
    };

    if (district) filter.district = { $regex: district, $options: 'i' };
    if (state) filter.state = { $regex: state, $options: 'i' };
    if (status) filter.acquisitionStatus = status;

    const records = await LandRecord.find(filter)
      .select('requestId location district village acquisitionStatus owners')
      .lean({ virtuals: true });

    return records.map((r) => ({
      requestId: r.requestId,
      location: r.location,
      district: r.district,
      village: r.village,
      acquisitionStatus: r.acquisitionStatus,
      primaryOwnerName:
        r.owners && r.owners.length > 0
          ? r.owners[0].name || r.owners[0].rawName || null
          : null,
    }));
  } catch (err) {
    logger.error('landService.getMapData error', { error: err.message });
    throw err;
  }
}

module.exports = {
  createLandRecord,
  getRequests,
  getRecord,
  getRecordById,
  updateRecord,
  transitionStatus,
  getDashboardSummary,
  getMapData,
};
