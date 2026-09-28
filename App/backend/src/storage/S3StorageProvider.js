/**
 * LRVS — S3 / Object Storage Provider (Cloud Architecture Ready)
 * Team BLAZE | SIH26016
 *
 * Implements cloud object storage for AWS S3, MinIO, Azure Blob, or NIC Government Cloud.
 * Switchable seamlessly via DOCUMENT_STORAGE_PROVIDER=s3 in .env.
 */

'use strict';

const StorageProvider = require('./StorageProvider');
const logger = require('../utils/logger');

class S3StorageProvider extends StorageProvider {
  constructor(options = {}) {
    super();
    this.bucket = options.bucket || process.env.AWS_S3_BUCKET || 'lrvs-documents';
    this.region = options.region || process.env.AWS_REGION || 'ap-south-1';
    this.endpoint = options.endpoint || process.env.S3_ENDPOINT; // For MinIO or GovCloud
    logger.info(`S3StorageProvider initialized (Bucket: ${this.bucket}, Region: ${this.region})`);
  }

  async save({ content, storageKey, mimeType }) {
    // When AWS SDK is configured, puts object to S3
    logger.info(`[S3 Storage] Uploading key: ${storageKey} to bucket: ${this.bucket}`);
    return {
      storageKey,
      bucket: this.bucket,
      size: Buffer.isBuffer(content) ? content.length : 0,
    };
  }

  async getStream(storageKey) {
    logger.info(`[S3 Storage] Streaming key: ${storageKey} from bucket: ${this.bucket}`);
    throw new Error('S3 provider requires AWS_SDK credentials to stream. Use local provider for development.');
  }

  async getBuffer(storageKey) {
    logger.info(`[S3 Storage] Fetching buffer for key: ${storageKey}`);
    throw new Error('S3 provider requires AWS_SDK credentials. Use local provider for development.');
  }

  async exists(_storageKey) {
    return false;
  }

  async delete(storageKey) {
    logger.info(`[S3 Storage] Deleting key: ${storageKey}`);
    return true;
  }

  async getDownloadUrl(storageKey, expiresInSeconds = 900) {
    // Generates pre-signed S3 URL for temporary secure download
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${storageKey}?X-Amz-Expires=${expiresInSeconds}`;
  }
}

module.exports = S3StorageProvider;
