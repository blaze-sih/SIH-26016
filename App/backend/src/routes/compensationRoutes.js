/**
 * LRVS — Compensation Routes
 * Team BLAZE | SIH26016
 */

'use strict';

const express = require('express');
const router = express.Router();

const {
  getCompensation,
  createCompensation,
  approveCompensation,
  processPayment,
  getStats,
} = require('../controllers/compensationController');

const { authenticateUser } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

const FINANCE_ROLES = ['SUPER_ADMIN', 'CENTRAL_AUTHORITY', 'STATE_AUTHORITY', 'FINANCE_OFFICER'];
const APPROVER_ROLES = ['SUPER_ADMIN', 'CENTRAL_AUTHORITY', 'STATE_AUTHORITY', 'DISTRICT_AUTHORITY'];

router.use(authenticateUser);

// GET /api/compensation/stats
router.get('/stats', getStats);

// GET /api/compensation/:requestId
router.get('/:requestId', getCompensation);

// POST /api/compensation — create assessment
router.post(
  '/',
  authorizeRoles(...FINANCE_ROLES),
  validate(schemas.createCompensation),
  createCompensation
);

// POST /api/compensation/:id/approve
router.post(
  '/:id/approve',
  authorizeRoles(...APPROVER_ROLES),
  validate(schemas.approveCompensation),
  approveCompensation
);

// POST /api/compensation/:id/process-payment
router.post(
  '/:id/process-payment',
  authorizeRoles(...FINANCE_ROLES),
  processPayment
);

module.exports = router;
