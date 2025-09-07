import sharp from 'sharp';
import * as path from 'path';
import DatabaseService from './database';
import { generateFilename } from '../utils/filename';
import { paths } from '../config/paths';

interface ImageMetadata {
  width: number;
  height: number;
  fileSize: number;
}

interface ProcessedImage {
  filename: string;
  previewFilename: string;
  metadata: ImageMetadata;
}

class ImageService {
  private db: DatabaseService;
  private fullImageDir = paths.generatedImages.full;
  private previewImageDir = paths.generatedImages.previews;
  private maxPreviewWidth = 800;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  async downloadAndProcessImage(imageUrl: string, batchId: number, replicateId?: string): Promise<ProcessedImage> {
    try {
      // Download the image from Replicate
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // Generate unique filenames with same base name
      const baseFilename = generateFilename(''); // No extension
      const fullFilename = `${baseFilename}.jpg`;
      const previewFilename = `${baseFilename}_preview.webp`;
      
      // Get image metadata
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
      }

      // Save full resolution image
      const fullImagePath = path.join(this.fullImageDir, fullFilename);
      await image
        .jpeg({ quality: 95, progressive: true })
        .toFile(fullImagePath);

      // Create and save preview image
      const previewImagePath = path.join(this.previewImageDir, previewFilename);
      await image
        .resize({ width: this.maxPreviewWidth, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(previewImagePath);

      // Get file sizes
      const fullImageFile = Bun.file(fullImagePath);
      const fileSize = fullImageFile.size;

      const processedImage: ProcessedImage = {
        filename: fullFilename,
        previewFilename: previewFilename,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          fileSize
        }
      };

      // Store in database
      this.db.addGeneratedImage(
        batchId,
        fullFilename,
        previewFilename,
        {
          width: metadata.width,
          height: metadata.height,
          fileSize,
          replicateId
        }
      );

      return processedImage;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processGeneratedImages(imageUrls: string[], batchId: number, replicateId?: string): Promise<ProcessedImage[]> {
    const processedImages: ProcessedImage[] = [];
    
    for (const imageUrl of imageUrls) {
      try {
        const processedImage = await this.downloadAndProcessImage(imageUrl, batchId, replicateId);
        processedImages.push(processedImage);
      } catch (error) {
        console.error(`Error processing individual image ${imageUrl}:`, error);
        // Continue processing other images even if one fails
      }
    }

    return processedImages;
  }

  async createPreviewFromExisting(fullImagePath: string): Promise<string> {
    try {
      const baseFilename = generateFilename(''); // No extension
      const previewFilename = `${baseFilename}_preview.webp`;
      const previewImagePath = path.join(this.previewImageDir, previewFilename);

      await sharp(fullImagePath)
        .resize({ width: this.maxPreviewWidth, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(previewImagePath);

      return previewFilename;
    } catch (error) {
      console.error('Error creating preview:', error);
      throw new Error(`Failed to create preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
      }

      return {
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      console.error('Error getting image dimensions:', error);
      throw new Error(`Failed to get image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getImageMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }
}

export default ImageService;