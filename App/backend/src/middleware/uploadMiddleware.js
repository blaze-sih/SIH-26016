/**
 * LRVS — Multer Upload Middleware
 * Team BLAZE | SIH26016
 */

'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { error } = require('../utils/apiResponse');
const { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } = require('../utils/constants');

const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024;

// ── Ensure upload directory exists ────────────────────────────────────────────
const UPLOAD_DIR = path.join(
  __dirname,
  '../../../',
  process.env.UPLOAD_DIR || 'uploads',
  'documents'
);
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Disk storage ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// ── File filter ───────────────────────────────────────────────────────────────
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_MIME_TYPES.includes(mime) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error(
      `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
}

// ── Multer instance ───────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// ── Single file upload middleware ─────────────────────────────────────────────
const uploadSingle = (fieldName = 'document') =>
  (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json(
            error(
              `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 20}MB.`,
              { code: 'FILE_TOO_LARGE' },
              413
            )
          );
        }
        return res.status(400).json(
          error(err.message, { code: 'UPLOAD_ERROR' }, 400)
        );
      }

      if (err && err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json(
          error(err.message, { code: 'INVALID_FILE_TYPE' }, 400)
        );
      }

      next(err);
    });
  };

module.exports = { upload, uploadSingle, UPLOAD_DIR };
