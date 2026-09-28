/**
 * LRVS — Standardized API Response Helpers
 * Team BLAZE | SIH26016
 *
 * Contract:
 *   success: { success: true,  message, data }
 *   error:   { success: false, message, error: { code, details } }
 */

'use strict';

/**
 * Build a success response object.
 * @param {string} message
 * @param {*} data
 * @returns {object}
 */
function success(message = 'Success', data = null) {
  const response = { success: true, message };
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  return response;
}

/**
 * Build an error response object.
 * @param {string} message
 * @param {{ code?: string, details?: * }} errPayload
 * @param {number} statusCode  (for HTTP status — not included in body)
 * @returns {object}
 */
function error(message = 'An error occurred', errPayload = {}, statusCode = 500) {
  return {
    success: false,
    message,
    error: {
      code: errPayload.code || httpCodeToString(statusCode),
      details: errPayload.details || null,
    },
  };
}

/**
 * Build a paginated success response.
 * @param {string} message
 * @param {Array}  items
 * @param {{ page, limit, total }} pagination
 * @returns {object}
 */
function paginated(message, items, { page, limit, total }) {
  return {
    success: true,
    message,
    data: items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Math.ceil(Number(total) / Number(limit)),
    },
  };
}

function httpCodeToString(code) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[code] || 'ERROR';
}

module.exports = { success, error, paginated };
