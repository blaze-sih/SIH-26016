/**
 * LRVS — Land Record Controller
 * Team BLAZE | SIH26016
 */

'use strict';

const landService = require('../services/landService');
const auditService = require('../services/auditService');
const blockchainService = require('../services/blockchainService');
const { hashObject } = require('../utils/hash');
const { success, error, paginated } = require('../utils/apiResponse');
const { AUDIT_ACTIONS, ENTITY_TYPES, PAGINATION } = require('../utils/constants');
const logger = require('../utils/logger');

// ── POST /api/land ────────────────────────────────────────────────────────────
async function createRecord(req, res, next) {
  try {
    const record = await landService.createLandRecord(req.body, req.user._id);

    await auditService.log({
      action: AUDIT_ACTIONS.LAND_RECORD_CREATED,
      entityType: ENTITY_TYPES.LAND_RECORD,
      entityId: record.requestId,
      requestId: record.requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      newState: { requestId: record.requestId, acquisitionStatus: record.acquisitionStatus },
      req,
    });

    logger.info('Land record created', { requestId: record.requestId, by: req.user.userId });

    return res.status(201).json(success('Land record created successfully.', { record }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/land/requests ────────────────────────────────────────────────────
async function getRequests(req, res, next) {
  try {
    const {
      page = PAGINATION.DEFAULT_PAGE,
      limit = PAGINATION.DEFAULT_LIMIT,
      status,
      district,
      state,
      search,
      assignedOfficer,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await landService.getRequests({
      page: Number(page),
      limit: Math.min(Number(limit), PAGINATION.MAX_LIMIT),
      status,
      district,
      state,
      search,
      assignedOfficer,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    });

    return res.status(200).json(
      paginated('Land requests retrieved.', result.records, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ── GET /api/land/map ─────────────────────────────────────────────────────────
async function getMapData(req, res, next) {
  try {
    const { district, state, status } = req.query;
    const data = await landService.getMapData({ district, state, status });
    return res.status(200).json(success('Map data retrieved.', { markers: data }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/land/:requestId ──────────────────────────────────────────────────
async function getRecord(req, res, next) {
  try {
    const record = await landService.getRecord(req.params.requestId);
    return res.status(200).json(success('Land record retrieved.', { record }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/land/:requestId/location ─────────────────────────────────────────
async function getLocation(req, res, next) {
  try {
    const record = await landService.getRecord(req.params.requestId);
    const location = record.location?.coordinates
      ? {
          latitude: record.location.latitude,
          longitude: record.location.longitude,
          coordinates: record.location.coordinates,
          type: 'Point',
        }
      : null;

    return res.status(200).json(
      success('Location data retrieved.', {
        requestId: record.requestId,
        location,
        district: record.district,
        village: record.village,
        taluka: record.taluka,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/land/:requestId ────────────────────────────────────────────────
async function updateRecord(req, res, next) {
  try {
    const record = await landService.getRecord(req.params.requestId);
    const previousState = { acquisitionStatus: record.acquisitionStatus };

    const updated = await landService.updateRecord(req.params.requestId, req.body, req.user._id);

    await auditService.log({
      action: AUDIT_ACTIONS.LAND_RECORD_UPDATED,
      entityType: ENTITY_TYPES.LAND_RECORD,
      entityId: updated.requestId,
      requestId: updated.requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      previousState,
      newState: { updatedFields: Object.keys(req.body) },
      req,
    });

    return res.status(200).json(success('Land record updated.', { record: updated }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/land/:requestId/submit ─────────────────────────────────────────
async function submitRecord(req, res, next) {
  try {
    const { remarks } = req.body;
    const record = await landService.transitionStatus(
      req.params.requestId,
      'SUBMITTED',
      req.user._id,
      remarks
    );

    await auditService.log({
      action: AUDIT_ACTIONS.LAND_RECORD_STATUS_CHANGED,
      entityType: ENTITY_TYPES.LAND_RECORD,
      entityId: record.requestId,
      requestId: record.requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      previousState: { status: 'DRAFT' },
      newState: { status: 'SUBMITTED' },
      req,
    });

    return res.status(200).json(success('Record submitted for processing.', { record }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/land/:requestId/audit ────────────────────────────────────────────
async function getAuditTrail(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await auditService.getAuditTrail(req.params.requestId, {
      page: Number(page),
      limit: Number(limit),
    });
    return res.status(200).json(
      paginated('Audit trail retrieved.', result.logs, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      })
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRecord,
  getRequests,
  getRecord,
  getLocation,
  getMapData,
  updateRecord,
  submitRecord,
  getAuditTrail,
};
