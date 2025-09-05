import { Hono } from 'hono';
import DatabaseService from '../services/database';
import * as path from 'path';

const images = new Hono();
const db = new DatabaseService();

// GET /api/images/:filename - Serve full resolution images
images.get('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join('generated', 'full', filename);
    
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Set appropriate headers
    c.header('Content-Type', 'image/jpeg'); // Default to JPEG, should be dynamic based on file type
    c.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    return c.body(await file.arrayBuffer());
  } catch (error) {
    console.error('Error serving image:', error);
    return c.json({ error: 'Failed to serve image' }, 500);
  }
});

// GET /api/images/preview/:filename - Serve preview images
images.get('/preview/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join('generated', 'previews', filename);
    
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      // Fallback to full resolution if preview doesn't exist
      return c.redirect(`/api/images/${filename}`);
    }

    // Set appropriate headers for WebP previews
    c.header('Content-Type', 'image/webp');
    c.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    return c.body(await file.arrayBuffer());
  } catch (error) {
    console.error('Error serving preview image:', error);
    return c.json({ error: 'Failed to serve preview image' }, 500);
  }
});

// GET /api/images - Get all images for gallery
images.get('/', async (c) => {
  try {
    const offset = parseInt(c.req.query('offset') || '0');
    const limit = parseInt(c.req.query('limit') || '20');

    if (offset < 0 || limit < 1 || limit > 100) {
      return c.json({ error: 'Invalid offset or limit parameters' }, 400);
    }

    const allImages = db.getAllImages(offset, limit + 1); // Get one extra to check if there are more
    const totalImages = db.getImageCount();
    
    const hasMore = allImages.length > limit;
    const images = allImages.slice(0, limit); // Remove the extra image if it exists

    const galleryItems = images.map((image: any) => ({
      id: image.id,
      url: `/api/images/${image.filename}`,
      previewUrl: image.preview_filename ? `/api/images/preview/${image.preview_filename}` : `/api/images/${image.filename}`,
      sessionName: image.session_name,
      batchId: image.batch_id,
      prompt: image.prompt
    }));

    return c.json({
      images: galleryItems,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    return c.json({ error: 'Failed to fetch images' }, 500);
  }
});

// GET /api/images/:imageId/download - Download image with proper headers
images.get('/:imageId/download', async (c) => {
  try {
    const imageId = parseInt(c.req.param('imageId'));
    
    if (isNaN(imageId)) {
      return c.json({ error: 'Invalid image ID' }, 400);
    }

    // Get image info from database
    const imageInfo = db.getGeneratedImagesByBatch(0).find(img => img.id === imageId);
    
    if (!imageInfo) {
      return c.json({ error: 'Image not found' }, 404);
    }

    const filePath = path.join('generated', 'full', imageInfo.filename);
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return c.json({ error: 'Image file not found' }, 404);
    }

    // Set download headers
    c.header('Content-Type', 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${imageInfo.filename}"`);
    
    return c.body(await file.arrayBuffer());
  } catch (error) {
    console.error('Error downloading image:', error);
    return c.json({ error: 'Failed to download image' }, 500);
  }
});

export default images;