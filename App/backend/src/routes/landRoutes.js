/**
 * LRVS — Land Routes
 * Team BLAZE | SIH26016
 */

'use strict';

const express = require('express');
const router = express.Router();

const {
  createRecord,
  getRequests,
  getRecord,
  getLocation,
  getMapData,
  updateRecord,
  submitRecord,
  getAuditTrail,
} = require('../controllers/landController');

const { authenticateUser } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

const OFFICER_ROLES = [
  'SUPER_ADMIN', 'CENTRAL_AUTHORITY', 'STATE_AUTHORITY', 'DISTRICT_AUTHORITY',
  'VERIFICATION_OFFICER', 'FINANCE_OFFICER', 'PROJECT_OFFICER',
];

// All land routes require authentication
router.use(authenticateUser);

// GET /api/land/map — GIS map data
router.get('/map', getMapData);

// GET /api/land/requests — paginated list
router.get('/requests', getRequests);

// POST /api/land — create new land record
router.post(
  '/',
  authorizeRoles(...OFFICER_ROLES),
  validate(schemas.createLandRecord),
  createRecord
);

// GET /api/land/:requestId — get single record
router.get('/:requestId', getRecord);

// PATCH /api/land/:requestId — update record
router.patch(
  '/:requestId',
  authorizeRoles(...OFFICER_ROLES),
  validate(schemas.updateLandRecord),
  updateRecord
);

// POST /api/land/:requestId/submit — submit for processing
router.post(
  '/:requestId/submit',
  authorizeRoles(...OFFICER_ROLES),
  submitRecord
);

// GET /api/land/:requestId/location — GIS location detail
router.get('/:requestId/location', getLocation);

// GET /api/land/:requestId/audit — audit trail for a record
router.get('/:requestId/audit', getAuditTrail);

module.exports = router;
