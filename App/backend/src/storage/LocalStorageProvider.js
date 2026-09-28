/**
 * LRVS — Local Storage Provider
 * Team BLAZE | SIH26016
 *
 * Implements physical storage on the local server filesystem.
 * Path structure:
 * storage/documents/{landOwnerId}/{landParcelId}/{documentId}/v{version}/{filename}
 */

'use strict';

const fs = require('fs');
const path = require('path');
const StorageProvider = require('./StorageProvider');
const logger = require('../utils/logger');

class LocalStorageProvider extends StorageProvider {
  /**
   * @param {object} [options]
   * @param {string} [options.baseDir] - Root directory for documents (default: storage/documents)
   */
  constructor(options = {}) {
    super();
    const configPath = options.baseDir || process.env.DOCUMENT_STORAGE_PATH || 'storage/documents';
    this.baseDir = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    // Ensure base directory exists synchronously on startup
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    logger.info(`LocalStorageProvider initialized with root: ${this.baseDir}`);
  }

  /**
   * Safely resolve storage key to an absolute path within baseDir to prevent traversal attacks.
   */
  _resolvePath(storageKey) {
    // Strip leading slashes
    let cleanKey = storageKey.replace(/^[/\\]+/, '');
    let targetPath = path.resolve(this.baseDir, cleanKey);

    // If file doesn't exist, check alternative locations
    if (!fs.existsSync(targetPath)) {
      if (cleanKey.startsWith('documents/')) {
        const withoutPrefix = path.resolve(this.baseDir, cleanKey.replace(/^documents[/\\]/, ''));
        if (fs.existsSync(withoutPrefix)) {
          return withoutPrefix;
        }
      }
      const parentPrefixed = path.resolve(this.baseDir, '..', cleanKey);
      if (fs.existsSync(parentPrefixed)) {
        return parentPrefixed;
      }
    }

    // Verify targetPath is inside baseDir or its parent storage folder
    const storageRoot = path.resolve(this.baseDir, '..');
    if (!targetPath.startsWith(storageRoot)) {
      throw new Error(`Security Violation: Storage key resolves outside storage directory (${storageKey})`);
    }
    return targetPath;
  }

  /**
   * Save file content (buffer, stream, or temp file path) to storage.
   */
  async save({ content, filePath, storageKey }) {
    const targetPath = this._resolvePath(storageKey);
    const targetDir = path.dirname(targetPath);

    await fs.promises.mkdir(targetDir, { recursive: true });

    if (filePath) {
      // Copy or move from multer temp file
      await fs.promises.copyFile(filePath, targetPath);
    } else if (Buffer.isBuffer(content)) {
      await fs.promises.writeFile(targetPath, content);
    } else if (content && typeof content.pipe === 'function') {
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(targetPath);
        content.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
      });
    } else {
      throw new Error('LocalStorageProvider.save requires content (Buffer/Stream) or filePath');
    }

    const stats = await fs.promises.stat(targetPath);
    return {
      storageKey,
      size: stats.size,
      localPath: targetPath,
    };
  }

  /**
   * Get readable stream for downloading / viewing.
   */
  async getStream(storageKey) {
    const targetPath = this._resolvePath(storageKey);
    if (!fs.existsSync(targetPath)) {
      const err = new Error(`File not found in storage: ${storageKey}`);
      err.code = 'ENOENT';
      err.statusCode = 404;
      throw err;
    }
    return fs.createReadStream(targetPath);
  }

  /**
   * Get buffer for processing / hash verification.
   */
  async getBuffer(storageKey) {
    const targetPath = this._resolvePath(storageKey);
    return fs.promises.readFile(targetPath);
  }

  /**
   * Check if file exists.
   */
  async exists(storageKey) {
    try {
      const targetPath = this._resolvePath(storageKey);
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file.
   */
  async delete(storageKey) {
    try {
      const targetPath = this._resolvePath(storageKey);
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        return true;
      }
      return false;
    } catch (err) {
      logger.error('LocalStorageProvider.delete error', { storageKey, error: err.message });
      throw err;
    }
  }

  /**
   * Returns null for local storage because files are served securely via backend controller.
   */
  async getDownloadUrl(storageKey) {
    return `/api/documents/file-stream?key=${encodeURIComponent(storageKey)}`;
  }
}

module.exports = LocalStorageProvider;
