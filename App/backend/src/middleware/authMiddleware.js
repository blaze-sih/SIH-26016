/**
 * LRVS — Auth Middleware (JWT)
 * Team BLAZE | SIH26016
 *
 * Supports both:
 *   - HTTP-only cookie 'token' (browser EJS sessions)
 *   - Authorization: Bearer <token> (API clients)
 */

'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Extract JWT token from cookie or Authorization header.
 * Cookie takes precedence for browser requests.
 */
function extractToken(req) {
  // 1. HTTP-only cookie (browser)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  // 2. Authorization header (API clients)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1] || null;
  }
  return null;
}

function isBrowserRequest(req) {
  const accept = req.headers['accept'] || '';
  return accept.includes('text/html');
}

/**
 * Middleware: Verify JWT and attach req.user + res.locals.currentUser.
 * For browser requests: redirects to /login on auth failure.
 * For API requests: returns 401 JSON.
 */
async function authenticateUser(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      if (isBrowserRequest(req)) {
        return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
      }
      return res.status(401).json(
        error('Authentication required. Provide a valid Bearer token or login cookie.', {
          code: 'UNAUTHORIZED',
        }, 401)
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'lrvs-dev-secret-change-in-production');
    } catch (jwtErr) {
      const isExpired = jwtErr.name === 'TokenExpiredError';
      // Clear stale cookie
      res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });

      if (isBrowserRequest(req)) {
        return res.redirect('/login?reason=session_expired');
      }
      return res.status(401).json(
        error(
          isExpired ? 'Token has expired. Please log in again.' : 'Invalid token.',
          { code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' },
          401
        )
      );
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
      if (isBrowserRequest(req)) {
        return res.redirect('/login?reason=account_inactive');
      }
      return res.status(401).json(
        error('User account not found or deactivated.', { code: 'UNAUTHORIZED' }, 401)
      );
    }

    req.user = user;
    res.locals.currentUser = user; // Available in all EJS templates

    // Prevent browser bfcache from showing protected pages after logout
    if (isBrowserRequest(req)) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }

    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    next(err);
  }
}

/**
 * Optional auth — attaches user if token present but does NOT block unauthenticated requests.
 * Useful for pages that show different content based on login state.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'lrvs-dev-secret-change-in-production');
    } catch {
      return next(); // Invalid token, continue as guest
    }

    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) {
      req.user = user;
      res.locals.currentUser = user;
    }
    next();
  } catch (err) {
    next(); // Non-fatal
  }
}

module.exports = { authenticateUser, optionalAuth, extractToken };
