/**
 * LRVS — Compensation Controller
 * Team BLAZE | SIH26016
 */

'use strict';

const compensationService = require('../services/compensationService');
const blockchainService = require('../services/blockchainService');
const auditService = require('../services/auditService');
const landService = require('../services/landService');
const { success, error } = require('../utils/apiResponse');
const { AUDIT_ACTIONS, ENTITY_TYPES } = require('../utils/constants');
const logger = require('../utils/logger');

// ── GET /api/compensation/:requestId ─────────────────────────────────────────
async function getCompensation(req, res, next) {
  try {
    const compensation = await compensationService.getCompensation(req.params.requestId);
    return res.status(200).json(success('Compensation retrieved.', { compensation }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/compensation ────────────────────────────────────────────────────
async function createCompensation(req, res, next) {
  try {
    const { requestId, ownerName, assessedAmount, remarks } = req.body;

    const landRecord = await landService.getRecord(requestId);

    const compensation = await compensationService.createCompensation({
      requestId,
      landRecordId: landRecord._id,
      ownerName,
      assessedAmount,
      assessedBy: req.user._id,
      remarks,
    });

    await auditService.log({
      action: AUDIT_ACTIONS.COMPENSATION_ASSESSED,
      entityType: ENTITY_TYPES.COMPENSATION,
      entityId: compensation._id.toString(),
      requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      newState: { assessedAmount, paymentStatus: compensation.paymentStatus },
      req,
    });

    return res.status(201).json(success('Compensation assessed.', { compensation }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/compensation/:id/approve ────────────────────────────────────────
async function approveCompensation(req, res, next) {
  try {
    const { approvedAmount, remarks } = req.body;

    const compensation = await compensationService.approveCompensation(req.params.id, {
      approvedBy: req.user._id,
      approvedByName: req.user.name,
      approvedAmount,
      remarks,
    });

    // Blockchain anchor
    try {
      const bcResult = await blockchainService.recordCompensation(
        compensation.compensationHash,
        compensation.requestId,
        Math.floor(approvedAmount)
      );
      await compensation.updateOne({
        blockchainTxHash: bcResult.txHash,
        blockchainTimestamp: bcResult.timestamp,
      });
    } catch (bcErr) {
      logger.warn('Blockchain compensation recording failed (non-fatal)', { error: bcErr.message });
    }

    await auditService.log({
      action: AUDIT_ACTIONS.COMPENSATION_APPROVED,
      entityType: ENTITY_TYPES.COMPENSATION,
      entityId: compensation._id.toString(),
      requestId: compensation.requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      newState: { approvedAmount, paymentStatus: compensation.paymentStatus },
      req,
    });

    return res.status(200).json(success('Compensation approved.', { compensation }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/compensation/:id/process-payment ───────────────────────────────
async function processPayment(req, res, next) {
  try {
    const compensation = await compensationService.processPayment(req.params.id, {
      processedBy: req.user._id,
    });

    await auditService.log({
      action: AUDIT_ACTIONS.COMPENSATION_PAID,
      entityType: ENTITY_TYPES.COMPENSATION,
      entityId: compensation._id.toString(),
      requestId: compensation.requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      newState: {
        paymentStatus: compensation.paymentStatus,
        paymentReference: compensation.paymentReference,
      },
      req,
    });

    return res.status(200).json(
      success('Payment processed. (Mock/sandbox payment reference generated.)', { compensation })
    );
  } catch (err) {
    next(err);
  }
}

// ── GET /api/compensation/stats ───────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const stats = await compensationService.getCompensationStats();
    return res.status(200).json(success('Compensation stats retrieved.', { stats }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCompensation,
  createCompensation,
  approveCompensation,
  processPayment,
  getStats,
};
