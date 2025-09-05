import { Hono } from 'hono';
import { fileUploadMiddleware } from '../middleware/fileUpload';

const upload = new Hono();

// POST /api/upload/reference - Handle reference image uploads
upload.post('/reference', fileUploadMiddleware, async (c) => {
  try {
    const uploadedFiles = c.get('uploadedFiles') || [];

    if (uploadedFiles.length === 0) {
      return c.json({ error: 'No files uploaded' }, 400);
    }

    const files = uploadedFiles.map((file: any) => ({
      id: file.id,
      filename: file.filename,
      originalName: file.originalName
    }));

    return c.json({ files });
  } catch (error) {
    console.error('Error handling file upload:', error);
    return c.json({ error: 'File upload failed' }, 500);
  }
});

export default upload;