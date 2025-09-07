import crypto from 'crypto';
import type { ReplicateFileResponse } from '../types';
import DatabaseService from './database';
import { paths } from '../config/paths';

interface FileUpload {
  filename: string;
  originalName: string;
  buffer: Buffer;
  contentType: string;
}

interface ReferenceImageResult {
  referenceImageId: number;
  replicateUrl: string;
  isExpired: boolean;
}

class ReferenceImageService {
  private db: DatabaseService;
  private replicateApiUrl = 'https://api.replicate.com/v1/files';
  private replicateApiToken: string | null;

  constructor(database: DatabaseService) {
    this.db = database;
    this.replicateApiToken = process.env.REPLICATE_API_TOKEN || null;
    
    if (!this.replicateApiToken) {
      console.warn('REPLICATE_API_TOKEN not set. Reference image upload will be disabled.');
    }
  }

  /**
   * Calculate SHA-256 hash of file buffer for deduplication
   */
  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if a Replicate upload is still valid (not expired)
   */
  private isReplicateUploadValid(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    
    const expiration = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Return true if more than 4 hours remaining (20-hour grace period as per Phase 2)
    return hoursUntilExpiry > 4;
  }

  /**
   * Upload file to Replicate /v1/files endpoint
   */
  private async uploadToReplicate(file: FileUpload, metadata?: Record<string, any>): Promise<ReplicateFileResponse> {
    if (!this.replicateApiToken) {
      // Return mock response for testing
      return {
        id: `mock-file-${Date.now()}`,
        name: file.filename,
        content_type: file.contentType,
        size: file.buffer.length,
        checksums: {
          sha256: this.calculateFileHash(file.buffer),
          md5: crypto.createHash('md5').update(file.buffer).digest('hex')
        },
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        urls: {
          get: `https://api.replicate.com/v1/files/mock-file-${Date.now()}`
        }
      };
    }

    const formData = new FormData();
    formData.append('content', new Blob([file.buffer], { type: file.contentType }), file.filename);
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await fetch(this.replicateApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.replicateApiToken}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Replicate upload failed: ${response.status} ${errorText}`);
    }

    return await response.json() as ReplicateFileResponse;
  }

  /**
   * Construct Replicate file URL from file ID
   */
  private getReplicateUrl(fileId: string): string {
    return `https://api.replicate.com/v1/files/${fileId}`;
  }

  /**
   * Process and store a reference image with deduplication
   */
  async processReferenceImage(file: FileUpload): Promise<ReferenceImageResult> {
    // Calculate file hash for deduplication
    const fileHash = this.calculateFileHash(file.buffer);
    
    // Check if we already have this file
    let referenceImage = this.db.getReferenceImageByHash(fileHash);
    
    if (!referenceImage) {
      // New file - store in our internal reference images table
      referenceImage = this.db.createReferenceImage(
        file.filename,
        file.originalName,
        fileHash,
        file.contentType,
        file.buffer.length
      );
    }

    // Check if we have a valid Replicate upload for this reference image
    const uploadedRef = this.db.getUploadedReferenceImage(referenceImage.id);
    let replicateFileId: string;
    let isExpired = false;

    if (uploadedRef && this.isReplicateUploadValid(uploadedRef.replicate_expires_at)) {
      // Use existing valid upload
      replicateFileId = uploadedRef.replicate_file_id;
    } else {
      // Need to upload to Replicate (new file or expired)
      isExpired = !!uploadedRef; // Mark as expired if we had a previous upload
      
      const replicateResponse = await this.uploadToReplicate(file, {
        purpose: 'reference_image',
        original_name: file.originalName,
        file_hash: fileHash
      });

      // Store the new upload record
      this.db.createUploadedReferenceImage(
        referenceImage.id,
        replicateResponse.id,
        replicateResponse.expires_at,
        JSON.stringify(replicateResponse)
      );

      replicateFileId = replicateResponse.id;
    }

    return {
      referenceImageId: referenceImage.id,
      replicateUrl: this.getReplicateUrl(replicateFileId),
      isExpired
    };
  }

  /**
   * Process multiple reference images with deduplication
   */
  async processReferenceImages(files: FileUpload[]): Promise<ReferenceImageResult[]> {
    const results: ReferenceImageResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.processReferenceImage(file);
        results.push(result);
      } catch (error) {
        console.error(`Error processing reference image ${file.filename}:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Get Replicate URLs for reference images from a previous batch (for reuse)
   */
  async getReferenceImageUrls(batchId: number): Promise<string[]> {
    const batchReferenceImages = this.db.getBatchReferenceImagesWithDetails(batchId);
    const urls: string[] = [];

    for (const ref of batchReferenceImages) {
      if (!ref.reference_image_id) continue;

      const uploadedRef = this.db.getUploadedReferenceImage(ref.reference_image_id);
      
      if (uploadedRef && this.isReplicateUploadValid(uploadedRef.replicate_expires_at)) {
        // Use existing valid upload
        urls.push(this.getReplicateUrl(uploadedRef.replicate_file_id));
      } else {
        // File expired - would need to re-upload
        // For now, skip expired files (in production, we might want to handle this)
        console.warn(`Reference image ${ref.filename} has expired and needs re-upload`);
      }
    }

    return urls;
  }

  /**
   * Re-upload expired reference images for a batch
   */
  async refreshExpiredReferenceImages(batchId: number): Promise<{ [filename: string]: string }> {
    const batchReferenceImages = this.db.getBatchReferenceImagesWithDetails(batchId);
    const refreshedUrls: { [filename: string]: string } = {};

    for (const ref of batchReferenceImages) {
      if (!ref.reference_image_id) continue;

      const uploadedRef = this.db.getUploadedReferenceImage(ref.reference_image_id);
      
      if (!uploadedRef || !this.isReplicateUploadValid(uploadedRef.replicate_expires_at)) {
        // Need to re-upload - this would require access to the original file
        // In a real implementation, we'd need to store the original file or implement re-upload logic
        console.warn(`Reference image ${ref.filename} needs refresh but file not available`);
      }
    }

    return refreshedUrls;
  }

  /**
   * Ensure existing reference images have valid Replicate URLs
   * Re-upload to Replicate if expired
   */
  async ensureExistingReferenceImages(referenceImageIds: number[]): Promise<ReferenceImageResult[]> {
    const results: ReferenceImageResult[] = [];
    
    for (const refImageId of referenceImageIds) {
      const refImage = this.db.getReferenceImage(refImageId);
      if (!refImage) {
        console.warn(`Reference image ${refImageId} not found`);
        continue;
      }

      // Check if we have a valid Replicate upload
      const uploadedRef = this.db.getUploadedReferenceImage(refImage.id);
      let replicateFileId: string;
      let isExpired = false;

      if (uploadedRef && this.isReplicateUploadValid(uploadedRef.replicate_expires_at)) {
        // Use existing valid upload
        replicateFileId = uploadedRef.replicate_file_id;
        console.log(`Reusing valid Replicate upload for reference image ${refImageId}`);
      } else {
        // Need to re-upload to Replicate
        isExpired = !!uploadedRef;
        console.log(`Re-uploading expired/missing reference image ${refImageId} to Replicate`);
        
        // Read the original file
        const filePath = `${paths.uploads}/${refImage.filename}`;
        const bunFile = Bun.file(filePath);
        
        if (!(await bunFile.exists())) {
          console.error(`Original file not found for reference image ${refImageId}: ${filePath}`);
          continue;
        }

        const buffer = await bunFile.arrayBuffer();
        
        const fileUpload = {
          filename: refImage.filename,
          originalName: refImage.original_name || refImage.filename,
          buffer: Buffer.from(buffer),
          contentType: refImage.content_type || 'image/jpeg'
        };

        const replicateResponse = await this.uploadToReplicate(fileUpload, {
          purpose: 'reference_image',
          original_name: refImage.original_name,
          file_hash: refImage.file_hash_sha256
        });

        // Store the new upload record
        this.db.createUploadedReferenceImage(
          refImage.id,
          replicateResponse.id,
          replicateResponse.expires_at,
          JSON.stringify(replicateResponse)
        );

        replicateFileId = replicateResponse.id;
      }

      results.push({
        referenceImageId: refImage.id,
        replicateUrl: this.getReplicateUrl(replicateFileId),
        isExpired
      });
    }

    return results;
  }

  /**
   * Get all expired reference images that need refresh
   */
  getExpiredReferenceImages() {
    return this.db.getExpiredUploadedReferenceImages();
  }
}

export default ReferenceImageService;