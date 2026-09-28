/**
 * LRVS — Structured Logger (Winston)
 * Team BLAZE | SIH26016
 *
 * NEVER logs: passwords, JWT secrets, private keys, DB credentials.
 */

'use strict';

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf, colorize, errors, json } = format;

// ── Sensitive field filter ────────────────────────────────────────────────────
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'jwtSecret',
  'JWT_SECRET',
  'privateKey',
  'BLOCKCHAIN_PRIVATE_KEY',
  'token',
  'secret',
  'authorization',
  'Authorization',
]);

function sanitize(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitize(v, depth + 1));
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : sanitize(val, depth + 1);
  }
  return result;
}

// ── Development console format ────────────────────────────────────────────────
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n' + JSON.stringify(sanitize(meta), null, 2)
      : '';
    return `${ts} [${level}] ${message}${stack ? '\n' + stack : ''}${metaStr}`;
  })
);

// ── Production JSON format ────────────────────────────────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json({
    replacer: (key, value) =>
      SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value,
  })
);

const isDev = process.env.NODE_ENV !== 'production';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isDev ? devFormat : prodFormat,
  transports: [
    new transports.Console(),
    ...(isDev
      ? []
      : [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]),
  ],
  exceptionHandlers: [new transports.Console()],
  rejectionHandlers: [new transports.Console()],
});

// Add http stream for morgan
logger.http = (msg) => logger.log('http', msg);

module.exports = logger;
