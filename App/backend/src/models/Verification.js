/**
 * LRVS — Verification Model
 * Team BLAZE | SIH26016
 *
 * Human-in-the-loop verification record.
 * Original AI output is NEVER overwritten — field changes are tracked.
 */

'use strict';

const mongoose = require('mongoose');
const { VERIFICATION_STATUS } = require('../utils/constants');

// ── Field change record ───────────────────────────────────────────────────────
const fieldChangeSchema = new mongoose.Schema(
  {
    fieldPath: { type: String, required: true }, // e.g. "district", "owners.0.name"
    originalAiValue: { type: mongoose.Schema.Types.Mixed },
    verifiedValue: { type: mongoose.Schema.Types.Mixed },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const verificationSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      index: true,
    },
    landRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LandRecord',
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    processingJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProcessingJob',
    },

    // ── Snapshots ─────────────────────────────────────────────────────────────
    // Original AI-extracted data — IMMUTABLE after save
    aiSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    aiSnapshotHash: {
      type: String, // SHA-256 of aiSnapshot
    },

    // Human-verified final data (starts as copy of aiSnapshot)
    verifiedSnapshot: {
      type: mongoose.Schema.Types.Mixed,
    },
    verifiedSnapshotHash: {
      type: String, // SHA-256 of verifiedSnapshot
    },

    // ── Field-level changes ───────────────────────────────────────────────────
    fieldChanges: [fieldChangeSchema],

    // ── Verification decision ─────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING,
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedByName: { type: String },
    verifiedAt: { type: Date },
    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // ── Unresolved warnings at time of submission ─────────────────────────────
    unresolvedWarnings: [
      {
        field: String,
        type: String,
        message: String,
        _id: false,
      },
    ],

    // ── Blockchain ────────────────────────────────────────────────────────────
    blockchainTxHash: { type: String },
    blockchainTimestamp: { type: Date },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
verificationSchema.index({ requestId: 1, status: 1 });
verificationSchema.index({ landRecordId: 1, status: 1 });
verificationSchema.index({ verifiedBy: 1, verifiedAt: -1 });
verificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Verification', verificationSchema);
