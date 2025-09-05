import { Hono } from 'hono';
import DatabaseService from '../services/database';
import GenerationService from '../services/generation';
import { fileUploadMiddleware } from '../middleware/fileUpload';

const batches = new Hono();
const db = new DatabaseService();
const generationService = new GenerationService(db);

// POST /api/sessions/:sessionId/batches - Create new generation batch
batches.post('/sessions/:sessionId/batches', fileUploadMiddleware, async (c) => {
  try {
    const sessionId = parseInt(c.req.param('sessionId'));
    
    if (isNaN(sessionId)) {
      return c.json({ error: 'Invalid session ID' }, 400);
    }

    // Check if session exists
    const session = db.getSession(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const body = await c.req.json();
    const { prompt, batchSize } = body;

    if (!prompt || typeof prompt !== 'string') {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    if (!batchSize || typeof batchSize !== 'number' || batchSize < 1 || batchSize > 8) {
      return c.json({ error: 'Batch size must be between 1 and 8' }, 400);
    }

    // Create the batch
    const batch = db.createBatch(sessionId, prompt, batchSize);

    // Handle uploaded reference images if any
    const uploadedFiles = c.get('uploadedFiles') || [];
    for (const file of uploadedFiles) {
      db.addReferenceImage(batch.id, file.filename, file.originalName);
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
  } catch (error) {
    console.error('Error creating batch:', error);
    return c.json({ error: 'Failed to create batch' }, 500);
  }
});

// GET /api/batches/:batchId/status - Get batch status and results
batches.get('/:batchId/status', async (c) => {
  try {
    const batchId = parseInt(c.req.param('batchId'));
    
    if (isNaN(batchId)) {
      return c.json({ error: 'Invalid batch ID' }, 400);
    }

    // Get detailed status from generation service
    const generationStatus = await generationService.getGenerationStatus(batchId);
    const images = db.getGeneratedImagesByBatch(batchId);

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
  } catch (error) {
    console.error('Error fetching batch status:', error);
    return c.json({ error: 'Failed to fetch batch status' }, 500);
  }
});

export default batches;