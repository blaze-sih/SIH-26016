/**
 * LRVS — Role-Based Access Control Middleware
 * Team BLAZE | SIH26016
 */

'use strict';

const { error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

function isBrowserRequest(req) {
  const accept = req.headers['accept'] || '';
  return accept.includes('text/html');
}

/**
 * Middleware factory: authorize only specific roles.
 * @param {...string} roles  Allowed roles
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/admin', authenticateUser, authorizeRoles('SUPER_ADMIN'), handler)
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      if (isBrowserRequest(req)) {
        return res.redirect('/login');
      }
      return res.status(401).json(
        error('Authentication required.', { code: 'UNAUTHORIZED' }, 401)
      );
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Access denied', {
        userId: req.user.userId,
        role: req.user.role,
        required: roles,
        path: req.path,
      });

      if (isBrowserRequest(req)) {
        return res.status(403).render('errors/403', {
          currentUser: req.user,
          requiredRoles: roles,
          title: 'Access Denied',
        });
      }
      return res.status(403).json(
        error(
          `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}.`,
          {
            code: 'FORBIDDEN',
            details: {
              required: roles,
              actual: req.user.role,
            },
          },
          403
        )
      );
    }

    next();
  };
}

/**
 * Middleware: allow access only to the resource owner OR specified roles.
 * @param {Function} getOwnerId  Function(req) → owner's userId string
 * @param {...string} roles      Admin roles that bypass ownership check
 */
function authorizeOwnerOrRoles(getOwnerId, ...roles) {
  return (req, res, next) => {
    if (!req.user) {
      if (isBrowserRequest(req)) {
        return res.redirect('/login');
      }
      return res.status(401).json(error('Authentication required.', { code: 'UNAUTHORIZED' }, 401));
    }

    // Admin roles bypass
    if (roles.includes(req.user.role)) return next();

    // Owner check
    const ownerId = getOwnerId(req);
    if (req.user.userId === ownerId || req.user._id.toString() === ownerId) {
      return next();
    }

    if (isBrowserRequest(req)) {
      return res.status(403).render('errors/403', {
        currentUser: req.user,
        title: 'Access Denied',
      });
    }
    return res.status(403).json(
      error('Access denied. You do not have permission to access this resource.', {
        code: 'FORBIDDEN',
      }, 403)
    );
  };
}

module.exports = { authorizeRoles, authorizeOwnerOrRoles };
