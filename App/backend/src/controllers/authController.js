/**
 * LRVS — Auth Controller
 * Team BLAZE | SIH26016
 *
 * Browser-first: ID + Password login, HTTP-only cookie, role-based redirect.
 * API clients still receive JSON with token.
 */

'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auditService = require('../services/auditService');
const { success, error } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { AUDIT_ACTIONS, ENTITY_TYPES, ROLES } = require('../utils/constants');

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      email: user.email || '',
      role: user.role,
      name: user.name,
      state: user.state || '',
      district: user.district || '',
    },
    process.env.JWT_SECRET || 'lrvs-dev-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function isBrowserRequest(req) {
  const accept = req.headers['accept'] || '';
  return accept.includes('text/html');
}

function getDashboardUrlForRole(role) {
  const map = {
    // Simplified roles (SIH 26016 login spec)
    [ROLES.USER]: '/user/dashboard',
    [ROLES.OFFICER]: '/officer/dashboard',
    // Granular roles
    [ROLES.SUPER_ADMIN]: '/dashboard/admin',
    [ROLES.CENTRAL_AUTHORITY]: '/dashboard/central',
    [ROLES.STATE_AUTHORITY]: '/dashboard/state',
    [ROLES.DISTRICT_AUTHORITY]: '/dashboard/district',
    [ROLES.VERIFICATION_OFFICER]: '/dashboard/verification',
    [ROLES.FINANCE_OFFICER]: '/dashboard/finance',
    [ROLES.PROJECT_OFFICER]: '/dashboard/project-officer',
    [ROLES.LAND_OWNER]: '/dashboard/land-owner',
    [ROLES.VIEWER]: '/dashboard/central',
  };
  return map[role] || '/dashboard/central';
}

// ── POST /api/auth/login (also handles browser form POST /login) ──────────────
async function login(req, res, next) {
  try {
    // Support field names: 'id', 'userId', 'email', and 'identifier'
    const rawId = (req.body.id || req.body.userId || req.body.email || req.body.identifier || '').trim();
    const { password } = req.body;

    if (!rawId || !password) {
      if (isBrowserRequest(req)) {
        return res.status(400).render('auth/login', {
          layout: false,
          error: 'ID and password are required.',
          formId: req.body.id || req.body.userId || req.body.email || '',
          id: req.body.id || req.body.userId || req.body.email || '',
        });
      }
      return res.status(400).json(error('ID and password are required.', { code: 'VALIDATION_ERROR' }, 400));
    }

    // Find by userId or email
    const user = await User.findOne({
      $or: [
        { userId: rawId.toUpperCase() },
        { email: rawId.toLowerCase() },
      ],
      isActive: true,
    }).select('+password');

    if (!user) {
      logger.warn('Login attempt with unknown credentials', { rawId });
      if (isBrowserRequest(req)) {
        return res.status(401).render('auth/login', {
          layout: false,
          error: 'Invalid ID or password.',
          formId: req.body.id || req.body.userId || req.body.email || '',
          id: req.body.id || req.body.userId || req.body.email || '',
        });
      }
      return res.status(401).json(error('Invalid credentials.', { code: 'INVALID_CREDENTIALS' }, 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn('Login failed: wrong password', { userId: user.userId });
      if (isBrowserRequest(req)) {
        return res.status(401).render('auth/login', {
          layout: false,
          error: 'Invalid ID or password.',
          formId: req.body.id || req.body.userId || req.body.email || '',
          id: req.body.id || req.body.userId || req.body.email || '',
        });
      }
      return res.status(401).json(error('Invalid credentials.', { code: 'INVALID_CREDENTIALS' }, 401));
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user);

    try {
      await auditService.log({
        action: AUDIT_ACTIONS.USER_LOGIN,
        entityType: ENTITY_TYPES.USER,
        entityId: user.userId,
        userId: user._id,
        userEmail: user.email || user.userId,
        role: user.role,
        metadata: { ip: req.ip },
        req,
      });
    } catch (auditErr) {
      logger.warn('Audit log failed on login (non-fatal)', { error: auditErr.message });
    }

    logger.info('User login successful', { userId: user.userId, role: user.role });

    setAuthCookie(res, token);

    // Browser request: redirect
    if (isBrowserRequest(req)) {
      return res.redirect(getDashboardUrlForRole(user.role));
    }

    // API request: return JSON
    return res.status(200).json(
      success('Login successful.', {
        token,
        user: user.toPublic(),
      })
    );
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
async function me(req, res, next) {
  try {
    return res.status(200).json(
      success('Current user', { user: req.user.toPublic() })
    );
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout (also handles browser POST /logout) ─────────────────
async function logout(req, res, next) {
  try {
    if (req.user) {
      try {
        await auditService.log({
          action: AUDIT_ACTIONS.USER_LOGOUT,
          entityType: ENTITY_TYPES.USER,
          entityId: req.user.userId,
          userId: req.user._id,
          userEmail: req.user.email || req.user.userId,
          role: req.user.role,
          req,
        });
      } catch (auditErr) {
        logger.warn('Audit log failed on logout (non-fatal)', { error: auditErr.message });
      }
    }

    // Clear cookie for browser
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });

    if (isBrowserRequest(req)) {
      return res.redirect('/login');
    }

    return res.status(200).json(success('Logged out successfully.'));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/users — Admin-only user provisioning ───────────────────────
async function createUser(req, res, next) {
  try {
    const { userId, name, email, password, role, department, state, district, phone } = req.body;

    if (!userId || !name || !password || !role) {
      return res.status(400).json(
        error('userId, name, password, and role are required.', { code: 'VALIDATION_ERROR' }, 400)
      );
    }

    const existing = await User.findOne({ userId: userId.toUpperCase() });
    if (existing) {
      return res.status(409).json(
        error('User ID already exists.', { code: 'DUPLICATE_USER_ID' }, 409)
      );
    }

    const user = await User.create({
      userId: userId.toUpperCase(),
      name,
      email: email || undefined,
      password,
      role,
      department,
      state,
      district,
      phone,
    });

    logger.info('User created by admin', {
      createdBy: req.user.userId,
      newUser: user.userId,
      role: user.role,
    });

    return res.status(201).json(
      success('User created successfully.', { user: user.toPublic() })
    );
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/register — API user registration ──────────────────────────
async function register(req, res, next) {
  try {
    const { name, email, password, role, department, state, district } = req.body;
    let userId = req.body.userId;

    if (!name || !password || !role) {
      return res.status(400).json(
        error('Name, password, and role are required.', { code: 'VALIDATION_ERROR' }, 400)
      );
    }

    if (email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json(
          error('Please provide a valid email.', { code: 'VALIDATION_ERROR' }, 400)
        );
      }
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(409).json(
          error('Email already registered.', { code: 'DUPLICATE_EMAIL' }, 409)
        );
      }
    }

    if (!userId) {
      const prefix = (role || 'USR').slice(0, 4).toUpperCase();
      userId = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
    }

    const user = await User.create({
      userId: userId.toUpperCase(),
      name,
      email: email ? email.toLowerCase() : undefined,
      password,
      role,
      department,
      state,
      district,
    });

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json(
      success('User registered successfully.', {
        token,
        user: user.toPublic(),
      }, 201)
    );
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json(
        error('User already exists.', { code: 'DUPLICATE_KEY' }, 409)
      );
    }
    next(err);
  }
}

module.exports = { login, me, logout, createUser, register };
