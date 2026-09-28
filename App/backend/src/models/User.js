/**
 * LRVS — User Model
 * Team BLAZE | SIH26016
 *
 * userId is the primary login identifier (e.g. DIST-001).
 * Email is optional contact information — NOT used for login.
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALL_ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple null values
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Never returned by default
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      required: [true, 'Role is required'],
      index: true,
    },
    department: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, state: 1 });
userSchema.index({ userId: 1, isActive: 1 });

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

// ── Instance method: compare password ────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: safe public representation ───────────────────────────────
userSchema.methods.toPublic = function () {
  return {
    userId: this.userId,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    state: this.state,
    district: this.district,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
