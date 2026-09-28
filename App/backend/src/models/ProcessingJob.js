/**
 * LRVS — ProcessingJob Model
 * Team BLAZE | SIH26016
 *
 * Tracks AI processing lifecycle for each document.
 * Supports polling for MVP; designed for queue integration later.
 */

'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { JOB_STATUS } = require('../utils/constants');

// ── Extracted field with confidence ──────────────────────────────────────────
const confidenceEntrySchema = new mongoose.Schema(
  {
    value: { type: mongoose.Schema.Types.Mixed },
    rawValue: { type: mongoose.Schema.Types.Mixed },      // Original AI output (Marathi/raw)
    normalizedValue: { type: mongoose.Schema.Types.Mixed }, // Normalized (e.g., Marathi → Arabic numerals)
    score: { type: Number, default: null },                // null if not provided by AI
    source: { type: String },                             // CONFIDENCE_SOURCES enum
  },
  { _id: false }
);

// ── Validation warning ────────────────────────────────────────────────────────
const validationWarningSchema = new mongoose.Schema(
  {
    field: String,
    type: String,    // e.g. VALIDATION_WARNING, MISSING_FIELD, TYPE_MISMATCH
    message: String,
  },
  { _id: false }
);

const processingJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    documentUUID: {
      type: String, // Document.documentId (UUID string)
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      default: 'AI_EXTRACTION',
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.UPLOADED,
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ── Timing ────────────────────────────────────────────────────────────────
    startedAt: { type: Date },
    completedAt: { type: Date },
    processingTimeMs: { type: Number },

    // ── Retry tracking ────────────────────────────────────────────────────────
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: { type: Date },
    error: { type: String },

    // ── AI Result ─────────────────────────────────────────────────────────────
    // Raw AI service response (full, preserved for audit)
    aiRawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Model metadata
    modelName: { type: String },
    modelVersion: { type: String },
    schemaVersion: { type: String },
    documentType: { type: String },
    language: { type: String, default: 'mr' },
    pagesProcessed: { type: Number },

    // Extracted structured data
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Confidence map: fieldName → confidenceEntrySchema
    fieldConfidence: {
      type: Map,
      of: confidenceEntrySchema,
      default: {},
    },
    overallConfidence: { type: Number, default: null },

    // Validation warnings from backend validation layer
    validationWarnings: [validationWarningSchema],

    // AI service reported errors/warnings
    aiWarnings: [{ type: String }],
    aiErrors: [{ type: String }],

    // ── Hashes for integrity ──────────────────────────────────────────────────
    aiResultHash: { type: String },  // SHA-256 of extractedData

    // ── Triggered by ─────────────────────────────────────────────────────────
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
processingJobSchema.index({ documentId: 1, status: 1 });
processingJobSchema.index({ requestId: 1, status: 1 });
processingJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ProcessingJob', processingJobSchema);
