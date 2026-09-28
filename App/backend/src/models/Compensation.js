/**
 * LRVS — Compensation Model
 * Team BLAZE | SIH26016
 *
 * Mock/sandbox payment references for prototype.
 * Real banking integration is out of scope.
 */

'use strict';

const mongoose = require('mongoose');
const { COMPENSATION_STATUS } = require('../utils/constants');

const compensationSchema = new mongoose.Schema(
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
    ownerId: {
      type: String, // May not be a DB user (land owner)
    },
    ownerName: {
      type: String,
      trim: true,
    },

    // ── Amounts (stored as strings to avoid float issues) ─────────────────────
    assessedAmount: {
      type: Number,
      min: 0,
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },

    // ── Status ────────────────────────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: Object.values(COMPENSATION_STATUS),
      default: COMPENSATION_STATUS.ASSESSED,
      index: true,
    },

    // ── Mock Payment Reference ────────────────────────────────────────────────
    paymentReference: {
      type: String,
      comment: 'Mock/sandbox payment reference — not real banking',
    },
    paymentMode: {
      type: String,
      enum: ['RTGS', 'NEFT', 'DD', 'CHEQUE', 'MOCK'],
      default: 'MOCK',
    },
    paymentDate: { type: Date },
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String, select: false },
      ifscCode: { type: String },
    },

    // ── Officials ─────────────────────────────────────────────────────────────
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedByName: { type: String },
    approvedAt: { type: Date },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // ── Blockchain ────────────────────────────────────────────────────────────
    blockchainTxHash: { type: String },
    blockchainTimestamp: { type: Date },
    compensationHash: { type: String },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
compensationSchema.index({ requestId: 1, paymentStatus: 1 });

module.exports = mongoose.model('Compensation', compensationSchema);
