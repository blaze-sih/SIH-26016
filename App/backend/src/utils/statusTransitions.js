/**
 * LRVS — Status Transition State Machine
 * Team BLAZE | SIH26016
 *
 * Enforces valid lifecycle transitions for land acquisition records.
 * No API client can arbitrarily jump between statuses.
 */

'use strict';

const { ACQUISITION_STATUS } = require('./constants');

const S = ACQUISITION_STATUS;

/**
 * Map of: currentStatus → Set of valid next statuses
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [S.DRAFT]: new Set([S.SUBMITTED]),

  [S.SUBMITTED]: new Set([S.AI_PROCESSING, S.DRAFT]),

  [S.AI_PROCESSING]: new Set([S.AI_PROCESSED, S.AI_FAILED]),

  [S.AI_PROCESSED]: new Set([S.PENDING_VERIFICATION]),

  [S.AI_FAILED]: new Set([S.AI_PROCESSING, S.PENDING_VERIFICATION]),

  [S.PENDING_VERIFICATION]: new Set([S.VERIFIED, S.VERIFICATION_INCOMPLETE]),

  [S.VERIFICATION_INCOMPLETE]: new Set([S.PENDING_VERIFICATION, S.REJECTED]),

  [S.VERIFIED]: new Set([S.PENDING_APPROVAL]),

  [S.PENDING_APPROVAL]: new Set([S.APPROVED, S.REJECTED]),

  [S.APPROVED]: new Set([S.COMPENSATION_PENDING]),

  [S.REJECTED]: new Set([S.DRAFT]),

  [S.COMPENSATION_PENDING]: new Set([S.COMPENSATION_APPROVED, S.REJECTED]),

  [S.COMPENSATION_APPROVED]: new Set([S.COMPENSATION_PAID]),

  [S.COMPENSATION_PAID]: new Set([S.POSSESSION_PENDING]),

  [S.POSSESSION_PENDING]: new Set([S.POSSESSION_COMPLETED]),

  [S.POSSESSION_COMPLETED]: new Set([S.CLOSED]),

  [S.CLOSED]: new Set(),
});

/**
 * Check whether transitioning from `fromStatus` to `toStatus` is valid.
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
function isValidTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.has(toStatus);
}

/**
 * Get the set of statuses that can be reached from `currentStatus`.
 * @param {string} currentStatus
 * @returns {string[]}
 */
function getAllowedNextStatuses(currentStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return allowed ? [...allowed] : [];
}

/**
 * Assert a transition is valid; throw a structured error if not.
 * @param {string} fromStatus
 * @param {string} toStatus
 * @throws {{ statusCode: number, code: string, message: string }}
 */
function assertValidTransition(fromStatus, toStatus) {
  if (!isValidTransition(fromStatus, toStatus)) {
    const err = new Error(
      `Invalid status transition: ${fromStatus} → ${toStatus}. ` +
        `Allowed from ${fromStatus}: [${getAllowedNextStatuses(fromStatus).join(', ') || 'none'}]`
    );
    err.statusCode = 409;
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }
}

module.exports = {
  ALLOWED_TRANSITIONS,
  isValidTransition,
  getAllowedNextStatuses,
  assertValidTransition,
};
