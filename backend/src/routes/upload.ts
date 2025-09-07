import { Hono } from 'hono';
import { fileUploadMiddleware } from '../middleware/fileUpload';
import ReferenceImageService from '../services/referenceImages';
import db from '../services/db';
import { paths } from '../config/paths';

const upload = new Hono();

// Initialize services
const referenceImageService = new ReferenceImageService(db);

// POST /api/upload/reference - Handle reference image uploads
upload.post('/reference', fileUploadMiddleware, async (c) => {
  try {
    const uploadedFiles = c.get('uploadedFiles') || [];

    if (uploadedFiles.length === 0) {
      return c.json({ error: 'No files uploaded' }, 400);
    }

    // Convert uploaded files to format expected by reference image service
    const fileUploads = [];
    
    for (const file of uploadedFiles) {
      // Read the uploaded file
      const filePath = `${paths.uploads}/${file.filename}`;
      const bunFile = Bun.file(filePath);
      const buffer = await bunFile.arrayBuffer();
      
      // Use Bun's built-in content type detection or fall back to extension-based detection
      let contentType = bunFile.type;
      if (!contentType || contentType === 'application/octet-stream') {
        const ext = file.filename.toLowerCase();
        if (ext.endsWith('.png')) contentType = 'image/png';
        else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (ext.endsWith('.webp')) contentType = 'image/webp';
        else if (ext.endsWith('.gif')) contentType = 'image/gif';
        else contentType = 'image/jpeg'; // default fallback
      }
      
      fileUploads.push({
        filename: file.filename,
        originalName: file.originalName,
        buffer: Buffer.from(buffer),
        contentType
      });
    }

    // Process reference images with deduplication and Replicate upload
    const results = await referenceImageService.processReferenceImages(fileUploads);

    const files = results.map((result, index) => {
      const file = uploadedFiles[index];
      if (!file) throw new Error(`Missing file at index ${index}`);
      
      return {
        id: file.id,
        filename: file.filename,
        originalName: file.originalName,
        referenceImageId: result.referenceImageId,
        replicateUrl: result.replicateUrl,
        wasExpired: result.isExpired
      };
    });

    return c.json({ files });
  } catch (error) {
    console.error('Error handling file upload:', error);
    return c.json({ error: 'File upload failed' }, 500);
  }
});

export default upload;