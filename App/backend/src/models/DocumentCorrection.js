/**
 * LRVS — Document Correction Model
 * Team BLAZE | SIH26016
 *
 * Stores user corrections to AI-extracted values.
 * Completely preserves the original AI extraction record to provide an immutable audit trail.
 */

'use strict';

const mongoose = require('mongoose');

const documentCorrectionSchema = new mongoose.Schema(
  {
    correctionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    field: {
      type: String,
      required: true,
      index: true,
    },
    aiValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    correctedValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    correctedBy: {
      type: String,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: 'User manual correction',
    },
    status: {
      type: String,
      enum: ['SUBMITTED', 'ACCEPTED', 'REJECTED'],
      default: 'SUBMITTED',
      index: true,
    },
    correctedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

documentCorrectionSchema.index({ documentId: 1, createdAt: -1 });

module.exports = mongoose.model('DocumentCorrection', documentCorrectionSchema);
