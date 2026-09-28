/**
 * LRVS — Verification Routes
 * Team BLAZE | SIH26016
 */

'use strict';

const express = require('express');
const router = express.Router();

const {
  getQueue,
  getVerificationDetail,
  updateField,
  markVerified,
  markIncomplete,
} = require('../controllers/verificationController');

const { authenticateUser } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

const VERIFIER_ROLES = [
  'SUPER_ADMIN', 'CENTRAL_AUTHORITY', 'STATE_AUTHORITY', 'DISTRICT_AUTHORITY',
  'VERIFICATION_OFFICER',
];

router.use(authenticateUser);

// GET /api/verification/queue — data checker queue
router.get('/queue', authorizeRoles(...VERIFIER_ROLES), getQueue);

// GET /api/verification/:requestId — verification detail (PDF + AI data)
router.get('/:requestId', authorizeRoles(...VERIFIER_ROLES), getVerificationDetail);

// POST /api/verification/:requestId/update-field — human field correction
router.post(
  '/:requestId/update-field',
  authorizeRoles(...VERIFIER_ROLES),
  validate(schemas.updateField),
  updateField
);

// POST /api/verification/:requestId/verify — mark as verified
router.post(
  '/:requestId/verify',
  authorizeRoles(...VERIFIER_ROLES),
  validate(schemas.verify),
  markVerified
);

// POST /api/verification/:requestId/incomplete — mark as incomplete
router.post(
  '/:requestId/incomplete',
  authorizeRoles(...VERIFIER_ROLES),
  validate(schemas.markIncomplete),
  markIncomplete
);

module.exports = router;
