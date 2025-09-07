import { Hono } from 'hono';
import type { Context } from 'hono';
import db from '../services/db';
import GenerationService from '../services/generation';
import ReferenceImageService from '../services/referenceImages';
import { fileUploadMiddleware } from '../middleware/fileUpload';
import { CreateBatchSchema, SessionIdParam, BatchIdParam } from '../validation/schemas';
import { paths } from '../config/paths';

// Define interface for uploaded file
interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
}

// Extend Hono's context to include uploadedFiles and parsedBody
declare module 'hono' {
  interface ContextVariableMap {
    uploadedFiles: UploadedFile[];
    parsedBody: Record<string, any>;
  }
}

const batches = new Hono();
const generationService = new GenerationService(db);
const referenceImageService = new ReferenceImageService(db);

// POST /api/sessions/:sessionId/batches - Create new generation batch
batches.post('/sessions/:sessionId/batches', fileUploadMiddleware, async (c) => {
  try {
    console.log('Starting batch creation...');
    
    // Validate session ID parameter
    const sessionParams = SessionIdParam.parse({ sessionId: c.req.param('sessionId') });

    // Check if session exists
    const session = db.getSession(sessionParams.sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // Get parsed body data from middleware
    const parsedBody = c.get('parsedBody');
    console.log('Parsed body from middleware:', parsedBody);
    
    // Validate request body
    const validatedData = CreateBatchSchema.parse(parsedBody);
    console.log('Validated data - prompt:', validatedData.prompt, 'batchSize:', validatedData.batchSize);

    // Create the batch
    const batch = db.createBatch(sessionParams.sessionId, validatedData.prompt, validatedData.batchSize);

    // Handle reference images (both new files and existing references)
    const uploadedFiles = c.get('uploadedFiles') || [];
    const existingReferenceImageIds = parsedBody.existingReferenceImageIds 
      ? JSON.parse(parsedBody.existingReferenceImageIds) 
      : [];
    
    console.log('Processing reference images:', {
      newFiles: uploadedFiles.length,
      existingIds: existingReferenceImageIds.length
    });
    
    // Process new uploaded files
    if (uploadedFiles.length > 0) {
      const fileUploads = [];
      
      for (const file of uploadedFiles) {
        const filePath = `${paths.uploads}/${file.filename}`;
        const bunFile = Bun.file(filePath);
        const buffer = await bunFile.arrayBuffer();
        
        // Use same flexible content type detection as upload route
        let contentType = bunFile.type;
        if (!contentType || contentType === 'application/octet-stream') {
          const ext = file.filename.toLowerCase();
          if (ext.endsWith('.png')) contentType = 'image/png';
          else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) contentType = 'image/jpeg';
          else if (ext.endsWith('.webp')) contentType = 'image/webp';
          else if (ext.endsWith('.gif')) contentType = 'image/gif';
          else contentType = 'image/jpeg';
        }
        
        fileUploads.push({
          filename: file.filename,
          originalName: file.originalName,
          buffer: Buffer.from(buffer),
          contentType
        });
      }

      // Process new reference images and get their IDs
      const referenceResults = await referenceImageService.processReferenceImages(fileUploads);
      
      // Add new reference images to batch
      for (let i = 0; i < referenceResults.length; i++) {
        const file = uploadedFiles[i];
        const result = referenceResults[i];
        if (file && result) {
          db.addReferenceImageToBatch(batch.id, file.filename, file.originalName, result.referenceImageId);
        }
      }
    }
    
    // Handle existing reference image IDs and ensure they have valid Replicate uploads
    if (existingReferenceImageIds.length > 0) {
      // Ensure existing reference images have valid Replicate uploads (re-upload if expired)
      const ensuredResults = await referenceImageService.ensureExistingReferenceImages(existingReferenceImageIds);
      
      for (const result of ensuredResults) {
        const refImage = db.getReferenceImage(result.referenceImageId);
        if (refImage) {
          db.addReferenceImageToBatch(batch.id, refImage.filename, refImage.original_name || refImage.filename, refImage.id);
          console.log(`Added existing reference image ${refImage.id} to batch ${batch.id}${result.isExpired ? ' (re-uploaded expired)' : ' (reused valid)'}`);
        }
      }
    }

    // Start the generation process
    try {
      await generationService.startGeneration(batch.id);
    } catch (error) {
      console.error('Error starting generation:', error);
      // The batch status will already be set to failed by the generation service
    }

    return c.json({ 
      batchId: batch.id, 
      status: 'pending' as const 
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('Error creating batch:', error);
    return c.json({ error: 'Failed to create batch' }, 500);
  }
});

// GET /api/batches/:batchId/status - Get batch status and results  
batches.get('/batches/:batchId/status', async (c) => {
  try {
    const params = BatchIdParam.parse({ batchId: c.req.param('batchId') });

    // Get detailed status from generation service
    const generationStatus = await generationService.getGenerationStatus(params.batchId);
    const images = db.getGeneratedImagesByBatch(params.batchId);

    const response: any = {
      status: generationStatus.status,
      ...(generationStatus.progress && { progress: generationStatus.progress })
    };

    if (generationStatus.status === 'completed' && images.length > 0) {
      response.images = images.map(image => ({
        id: image.id,
        url: `/api/images/${image.filename}`,
        previewUrl: image.preview_filename ? `/api/images/preview/${image.preview_filename}` : `/api/images/${image.filename}`
      }));
    }

    if (generationStatus.error) {
      response.error = generationStatus.error;
    }

    return c.json(response);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('Error fetching batch status:', error);
    return c.json({ error: 'Failed to fetch batch status' }, 500);
  }
});

export default batches;