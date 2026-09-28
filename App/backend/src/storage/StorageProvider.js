/**
 * LRVS — Storage Provider Interface (Abstract)
 * Team BLAZE | SIH26016
 *
 * Base class for all physical storage implementations (Local, S3, Azure, MinIO).
 * Enforces unified contract so switching providers requires zero changes elsewhere.
 */

'use strict';

class StorageProvider {
  /**
   * Save a file to storage.
   * @param {object} params
   * @param {Buffer|stream.Readable} [params.content] - File buffer or stream
   * @param {string} [params.filePath] - Temp file path to copy/move
   * @param {string} params.storageKey - Canonical storage path (e.g. documents/LAND-001/...)
   * @param {string} params.mimeType - File MIME type
   * @returns {Promise<{ storageKey: string, size: number }>}
   */
  async save(_params) {
    throw new Error('StorageProvider.save must be implemented by subclass');
  }

  /**
   * Get a readable stream for a stored file.
   * @param {string} storageKey
   * @returns {Promise<stream.Readable>}
   */
  async getStream(_storageKey) {
    throw new Error('StorageProvider.getStream must be implemented by subclass');
  }

  /**
   * Get the complete buffer for a stored file.
   * @param {string} storageKey
   * @returns {Promise<Buffer>}
   */
  async getBuffer(_storageKey) {
    throw new Error('StorageProvider.getBuffer must be implemented by subclass');
  }

  /**
   * Check if a file exists at the given storage key.
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async exists(_storageKey) {
    throw new Error('StorageProvider.exists must be implemented by subclass');
  }

  /**
   * Delete or archive a file from storage.
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async delete(_storageKey) {
    throw new Error('StorageProvider.delete must be implemented by subclass');
  }

  /**
   * Get secure download / access URL or path for a stored file.
   * @param {string} storageKey
   * @param {number} [expiresInSeconds]
   * @returns {Promise<string>}
   */
  async getDownloadUrl(_storageKey, _expiresInSeconds) {
    throw new Error('StorageProvider.getDownloadUrl must be implemented by subclass');
  }
}

module.exports = StorageProvider;
