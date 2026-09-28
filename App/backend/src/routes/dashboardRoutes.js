/**
 * LRVS — Dashboard Routes
 * Team BLAZE | SIH26016
 */

'use strict';

const express = require('express');
const router = express.Router();

const {
  getSummary,
  getProjectWise,
  getStateWise,
  getDistrictWise,
  getTimeline,
  getVerificationActivity,
  getRequestDistribution,
} = require('../controllers/dashboardController');

const { authenticateUser } = require('../middleware/authMiddleware');

router.use(authenticateUser);

// GET /api/dashboard/summary
router.get('/summary', getSummary);

// GET /api/dashboard/project-wise
router.get('/project-wise', getProjectWise);

// GET /api/dashboard/state-wise
router.get('/state-wise', getStateWise);

// GET /api/dashboard/district-wise
router.get('/district-wise', getDistrictWise);

// GET /api/dashboard/timeline
router.get('/timeline', getTimeline);

// GET /api/dashboard/verification-activity
router.get('/verification-activity', getVerificationActivity);

// GET /api/dashboard/request-distribution
router.get('/request-distribution', getRequestDistribution);

module.exports = router;
