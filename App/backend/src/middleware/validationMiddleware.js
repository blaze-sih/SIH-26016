/**
 * LRVS — Joi Request Validation Middleware
 * Team BLAZE | SIH26016
 */

'use strict';

const Joi = require('joi');
const { error } = require('../utils/apiResponse');
const { ALL_ROLES, DOCUMENT_TYPES } = require('../utils/constants');

// ── Validator factory ─────────────────────────────────────────────────────────
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const { error: validationError } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (validationError) {
      const details = validationError.details.reduce((acc, d) => {
        acc[d.path.join('.')] = d.message.replace(/['"]/g, '');
        return acc;
      }, {});

      return res.status(400).json(
        error('Validation failed', { code: 'VALIDATION_ERROR', details }, 400)
      );
    }

    next();
  };
}

// ── Auth schemas ──────────────────────────────────────────────────────────────

// Admin-only user creation schema
const createUserSchema = Joi.object({
  userId: Joi.string().min(2).max(50).required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email({ tlds: { allow: false } }).optional().allow('', null),
  password: Joi.string().min(6).max(100).required(),
  role: Joi.string().valid(...ALL_ROLES).required(),
  department: Joi.string().max(200).optional().allow('', null),
  state: Joi.string().max(100).optional().allow('', null),
  district: Joi.string().max(100).optional().allow('', null),
  phone: Joi.string().max(20).optional().allow('', null),
});

// Browser/API login schema — accepts 'id' or 'userId' field
const loginSchema = Joi.object({
  id: Joi.string().optional(),
  userId: Joi.string().optional(),
  password: Joi.string().required(),
}).or('id', 'userId');

// ── Land record schemas ───────────────────────────────────────────────────────
const ownerSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  fatherName: Joi.string().max(200).optional(),
  address: Joi.string().max(500).optional(),
  share: Joi.string().max(50).optional(),
  contactNumber: Joi.string().max(20).optional(),
});

const areaSchema = Joi.object({
  unit: Joi.string().max(50).optional(),
  total: Joi.string().max(50).optional(),
  cultivable: Joi.string().max(50).optional(),
  uncultivable: Joi.string().max(50).optional(),
});

const createLandRecordSchema = Joi.object({
  projectId: Joi.string().max(100).optional(),
  projectName: Joi.string().max(200).optional(),
  registrationNumber: Joi.string().max(100).optional(),
  surveyNumber: Joi.string().max(100).optional(),
  subDivision: Joi.string().max(100).optional(),
  khataNumber: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  district: Joi.string().max(100).optional(),
  taluka: Joi.string().max(100).optional(),
  village: Joi.string().max(200).optional(),
  villageCode: Joi.string().max(20).optional(),
  owners: Joi.array().items(ownerSchema).optional(),
  occupancyClass: Joi.string().max(100).optional(),
  area: areaSchema.optional(),
  assessment: Joi.string().max(200).optional(),
  encumbrances: Joi.string().allow(null, '').optional(),
  lastMutationNumber: Joi.string().max(100).optional(),
  landType: Joi.string().max(100).optional(),
  acquisitionPurpose: Joi.string().max(500).optional(),
  acquisitionAuthority: Joi.string().max(200).optional(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
  }).optional(),
  affectedFamilies: Joi.number().min(0).optional(),
  displacedFamilies: Joi.number().min(0).optional(),
});

const updateLandRecordSchema = createLandRecordSchema.fork(
  Object.keys(createLandRecordSchema.describe().keys),
  (schema) => schema.optional()
);

// ── Document upload schema ────────────────────────────────────────────────────
const uploadDocumentSchema = Joi.object({
  documentType: Joi.string().valid(...Object.values(DOCUMENT_TYPES)).required(),
  description: Joi.string().max(500).optional(),
});

// ── Verification schemas ──────────────────────────────────────────────────────
const verifySchema = Joi.object({
  remarks: Joi.string().max(1000).optional(),
});

const markIncompleteSchema = Joi.object({
  remarks: Joi.string().min(1).max(1000).required(),
});

const updateFieldSchema = Joi.object({
  fieldPath: Joi.string().required(),
  verifiedValue: Joi.any().required(),
  reason: Joi.string().max(500).optional(),
});

// ── Approval schemas ──────────────────────────────────────────────────────────
const approveSchema = Joi.object({
  remarks: Joi.string().max(2000).optional(),
});

const rejectSchema = Joi.object({
  remarks: Joi.string().min(1).max(2000).required(),
});

const forwardSchema = Joi.object({
  forwardedTo: Joi.string().required(),
  forwardedToAuthority: Joi.string().optional(),
  remarks: Joi.string().max(2000).optional(),
});

// ── Compensation schemas ──────────────────────────────────────────────────────
const createCompensationSchema = Joi.object({
  ownerName: Joi.string().max(200).optional(),
  assessedAmount: Joi.number().min(0).required(),
  remarks: Joi.string().max(2000).optional(),
});

const approveCompensationSchema = Joi.object({
  approvedAmount: Joi.number().min(0).required(),
  remarks: Joi.string().max(2000).optional(),
});

module.exports = {
  validate,
  schemas: {
    register: createUserSchema,    // kept as 'register' for backward compat
    createUser: createUserSchema,
    login: loginSchema,
    createLandRecord: createLandRecordSchema,
    updateLandRecord: updateLandRecordSchema,
    uploadDocument: uploadDocumentSchema,
    verify: verifySchema,
    markIncomplete: markIncompleteSchema,
    updateField: updateFieldSchema,
    approve: approveSchema,
    reject: rejectSchema,
    forward: forwardSchema,
    createCompensation: createCompensationSchema,
    approveCompensation: approveCompensationSchema,
  },
};
