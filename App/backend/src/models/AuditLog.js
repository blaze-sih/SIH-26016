/**
 * LRVS — AuditLog Model
 * Team BLAZE | SIH26016
 *
 * Append-only audit trail.
 * Application layer MUST NOT update or delete audit records.
 */

'use strict';

const mongoose = require('mongoose');
const { AUDIT_ACTIONS, ENTITY_TYPES } = require('../utils/constants');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: Object.values(ENTITY_TYPES),
      required: true,
      index: true,
    },
    entityId: {
      type: String, // flexible — ObjectId or UUID string
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      index: true,
    },

    // ── User context ──────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userEmail: { type: String },
    role: { type: String },

    // ── State snapshot ────────────────────────────────────────────────────────
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── Additional metadata ───────────────────────────────────────────────────
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Request context ───────────────────────────────────────────────────────
    ipAddress: { type: String },
    userAgent: { type: String },

    // ── Blockchain anchor ─────────────────────────────────────────────────────
    blockchainTxHash: { type: String },
    blockchainTimestamp: { type: Date },

    // ── Timestamp (explicit, for indexing) ───────────────────────────────────
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // Using explicit timestamp field for clarity
    // Prevent any updates or deletes at the schema level via hooks
    strict: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
auditLogSchema.index({ requestId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

// ── Prevent updates and deletes from application layer ────────────────────────
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error('AuditLog records are immutable. Updates are not allowed.');
});

auditLogSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany'], function () {
  throw new Error('AuditLog records are immutable. Deletes are not allowed.');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
