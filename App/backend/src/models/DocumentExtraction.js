/**
 * LRVS — Document Extraction Model
 * Team BLAZE | SIH26016
 *
 * Stores structured data extracted by AI models independently of original document files.
 * Supports multiple extraction versions without modifying original documents.
 */

'use strict';

const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    unit: { type: String, default: null },
    confidence: { type: Number, min: 0, max: 1, default: 0.95 },
    isLowConfidence: { type: Boolean, default: false },
    suggestedCorrection: { type: String, default: null },
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
      page: Number,
    },
  },
  { _id: false }
);

const documentExtractionSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    extractionVersion: {
      type: Number,
      default: 1,
    },
    modelName: {
      type: String,
      default: 'lrvs-document-ocr-v2',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED',
      index: true,
    },
    fields: {
      ownerName: fieldSchema,
      surveyNumber: fieldSchema,
      village: fieldSchema,
      district: fieldSchema,
      landArea: fieldSchema,
      khatiyanNumber: fieldSchema,
      mutationNumber: fieldSchema,
    },
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

documentExtractionSchema.index({ documentId: 1, extractionVersion: -1 });

module.exports = mongoose.model('DocumentExtraction', documentExtractionSchema);
