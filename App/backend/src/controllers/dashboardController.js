/**
 * LRVS — Dashboard Controller
 * Team BLAZE | SIH26016
 */

'use strict';

const dashboardService = require('../services/dashboardService');
const { success } = require('../utils/apiResponse');

// ── GET /api/dashboard/summary ────────────────────────────────────────────────
async function getSummary(req, res, next) {
  try {
    const { state, district, projectId, dateFrom, dateTo } = req.query;
    const summary = await dashboardService.getSummary({ state, district, projectId, dateFrom, dateTo });
    return res.status(200).json(success('Dashboard summary retrieved.', { summary }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/dashboard/project-wise ──────────────────────────────────────────
async function getProjectWise(req, res, next) {
  try {
    const data = await dashboardService.getProjectWise();
    return res.status(200).json(success('Project-wise data retrieved.', { data }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/dashboard/state-wise ────────────────────────────────────────────
async function getStateWise(req, res, next) {
  try {
    const data = await dashboardService.getStateWise();
    return res.status(200).json(success('State-wise data retrieved.', { data }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/dashboard/district-wise ─────────────────────────────────────────
async function getDistrictWise(req, res, next) {
  try {
    const { state } = req.query;
    const data = await dashboardService.getDistrictWise(state);
    return res.status(200).json(success('District-wise data retrieved.', { data }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/dashboard/timeline ───────────────────────────────────────────────
async function getTimeline(req, res, next) {
  try {
    const { groupBy = 'month', dateFrom, dateTo } = req.query;
    const data = await dashboardService.getTimeline({ groupBy, dateFrom, dateTo });
    return res.status(200).json(success('Timeline data retrieved.', { data }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/dashboard/verification-activity ──────────────────────────────────
async function getVerificationActivity(req, res, next) {
  try {
    const { dateFrom, dateTo } = req.query;
    const data = await dashboardService.getVerificationActivity({ dateFrom, dateTo });
    return res.status(200).json(success('Verification activity retrieved.', { data }));
  } catch (err) {
    next(err);
  }
}

// ── GET /api/dashboard/request-distribution ───────────────────────────────────
async function getRequestDistribution(req, res, next) {
  try {
    const data = await dashboardService.getRequestDistribution();
    return res.status(200).json(success('Request distribution retrieved.', { data }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
  getProjectWise,
  getStateWise,
  getDistrictWise,
  getTimeline,
  getVerificationActivity,
  getRequestDistribution,
};
