/**
 * LRVS — Centralized Error Middleware
 * Team BLAZE | SIH26016
 */

'use strict';

const logger = require('../utils/logger');
const { error } = require('../utils/apiResponse');

/**
 * Express centralized error handler.
 * Must be registered LAST in the middleware chain.
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  // Default values
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details || null;

  // ── Mongoose validation errors ────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).reduce((acc, e) => {
      acc[e.path] = e.message;
      return acc;
    }, {});
  }

  // ── Mongoose CastError (invalid ObjectId) ─────────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── Mongoose duplicate key ────────────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}. This value already exists.`;
    details = err.keyValue;
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired.';
  }

  // ── Multer errors ─────────────────────────────────────────────────────────
  if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    message = err.message;
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload too large.';
  }

  // ── Axios / external service errors ───────────────────────────────────────
  if (err.isAxiosError) {
    const svcStatus = err.response?.status;
    if (svcStatus === 503 || !err.response) {
      statusCode = 502;
      code = 'SERVICE_UNAVAILABLE';
      message = 'External service is unavailable. Please try again.';
    } else {
      statusCode = 502;
      code = 'BAD_GATEWAY';
      message = 'External service returned an error.';
    }
  }

  // ── Status transition conflicts ───────────────────────────────────────────
  if (code === 'INVALID_STATUS_TRANSITION') {
    statusCode = 409;
  }

  // ── Log the error (never log sensitive data) ──────────────────────────────
  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    userId: req.user?._id,
    role: req.user?.role,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logPayload, stack: err.stack });
  } else {
    logger.warn(message, logPayload);
  }

  // ── Send response ─────────────────────────────────────────────────────────
  res.status(statusCode).json(
    error(message, { code, details }, statusCode)
  );
}

module.exports = errorMiddleware;
