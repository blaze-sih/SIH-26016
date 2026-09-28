/**
 * LRVS — Document Storage Service (Unified Facade)
 * Team BLAZE | SIH26016
 *
 * Provides a clean abstraction layer over physical document storage.
 * Completely decouples file storage from controllers, views, and database models.
 *
 * Methods:
 * - upload()
 * - get()
 * - getStream()
 * - exists()
 * - delete()
 * - getDownloadUrl()
 * - computeHash()
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const LocalStorageProvider = require('../storage/LocalStorageProvider');
const S3StorageProvider = require('../storage/S3StorageProvider');
const logger = require('../utils/logger');

class DocumentStorageService {
  constructor() {
    const providerType = (process.env.DOCUMENT_STORAGE_PROVIDER || 'local').toLowerCase();
    this.providerType = providerType;

    switch (providerType) {
      case 's3':
      case 'minio':
      case 'azure':
        this.provider = new S3StorageProvider();
        break;
      case 'local':
      default:
        this.provider = new LocalStorageProvider({
          baseDir: process.env.DOCUMENT_STORAGE_PATH || 'storage/documents',
        });
        break;
    }

    logger.info(`DocumentStorageService initialized with provider: ${this.providerType}`);
  }

  /**
   * Generates standardized canonical storage key.
   * Format:
   * documents/{landOwnerId}/{landParcelId}/{documentId}/v{version}/{filename}
   */
  generateStorageKey({ landOwnerId, landParcelId, documentId, version = 1, filename }) {
    const cleanOwner = (landOwnerId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanParcel = (landParcelId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanDocId = (documentId || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExt = path.extname(filename || 'document.pdf') || '.pdf';
    const safeName = 'original' + safeExt;

    return `documents/${cleanOwner}/${cleanParcel}/${cleanDocId}/v${version}/${safeName}`;
  }

  /**
   * Upload and persist document file to configured storage.
   */
  async upload({
    content,
    filePath,
    landOwnerId,
    landParcelId,
    documentId,
    version = 1,
    filename,
    mimeType,
  }) {
    const storageKey = this.generateStorageKey({
      landOwnerId,
      landParcelId,
      documentId,
      version,
      filename,
    });

    const result = await this.provider.save({
      content,
      filePath,
      storageKey,
      mimeType,
    });

    return {
      storageKey,
      storageProvider: this.providerType,
      size: result.size,
      localPath: result.localPath,
    };
  }

  /**
   * Get file stream for secure authenticated download / preview.
   */
  async getStream(storageKey) {
    return this.provider.getStream(storageKey);
  }

  /**
   * Get file buffer for analysis / preview generation.
   */
  async get(storageKey) {
    return this.provider.getBuffer(storageKey);
  }

  /**
   * Check if file exists in storage.
   */
  async exists(storageKey) {
    return this.provider.exists(storageKey);
  }

  /**
   * Delete or archive file from storage.
   */
  async delete(storageKey) {
    return this.provider.delete(storageKey);
  }

  /**
   * Get secure download URL.
   */
  async getDownloadUrl(storageKey, expiresIn = 900) {
    return this.provider.getDownloadUrl(storageKey, expiresIn);
  }

  /**
   * Compute SHA-256 cryptographic hash of file.
   * @param {Buffer|string} input - Buffer or file path
   * @returns {Promise<string>} e.g. "sha256:abc123..."
   */
  async computeHash(input) {
    if (Buffer.isBuffer(input)) {
      const hash = crypto.createHash('sha256').update(input).digest('hex');
      return `sha256:${hash}`;
    }

    if (typeof input === 'string') {
      return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(input);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
        stream.on('error', reject);
      });
    }

    throw new Error('computeHash requires Buffer or file path string');
  }
}

// Export singleton instance
module.exports = new DocumentStorageService();
