/**
 * LRVS — Approval Routes
 * Team BLAZE | SIH26016
 */

'use strict';

const express = require('express');
const router = express.Router();

const {
  getQueue,
  getStats,
  getApproval,
  approve,
  reject,
  forward,
} = require('../controllers/approvalController');

const { authenticateUser } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

const APPROVER_ROLES = [
  'SUPER_ADMIN', 'CENTRAL_AUTHORITY', 'STATE_AUTHORITY', 'DISTRICT_AUTHORITY',
];

router.use(authenticateUser);

// GET /api/approvals/queue
router.get('/queue', authorizeRoles(...APPROVER_ROLES), getQueue);

// GET /api/approvals/stats
router.get('/stats', authorizeRoles(...APPROVER_ROLES), getStats);

// GET /api/approvals/:id
router.get('/:id', authorizeRoles(...APPROVER_ROLES), getApproval);

// POST /api/approvals/:id/approve
router.post(
  '/:id/approve',
  authorizeRoles(...APPROVER_ROLES),
  validate(schemas.approve),
  approve
);

// POST /api/approvals/:id/reject
router.post(
  '/:id/reject',
  authorizeRoles(...APPROVER_ROLES),
  validate(schemas.reject),
  reject
);

// POST /api/approvals/:id/forward
router.post(
  '/:id/forward',
  authorizeRoles(...APPROVER_ROLES),
  validate(schemas.forward),
  forward
);

module.exports = router;
