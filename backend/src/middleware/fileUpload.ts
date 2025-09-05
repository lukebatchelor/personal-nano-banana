import { Context, Next } from 'hono';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const UPLOAD_DIR = 'uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const fileUploadMiddleware = async (c: Context, next: Next) => {
  if (c.req.method !== 'POST' || !c.req.header('content-type')?.includes('multipart/form-data')) {
    await next();
    return;
  }

  try {
    const body = await c.req.parseBody();
    const files: File[] = [];
    const uploadedFiles: { id: string; filename: string; originalName: string }[] = [];

    // Process uploaded files
    for (const [key, value] of Object.entries(body)) {
      if (value instanceof File) {
        // Validate file type
        if (!ALLOWED_TYPES.includes(value.type)) {
          return c.json({ error: `Invalid file type: ${value.type}` }, 400);
        }

        // Validate file size
        if (value.size > MAX_FILE_SIZE) {
          return c.json({ error: `File too large: ${value.size} bytes` }, 400);
        }

        // Generate unique filename
        const ext = path.extname(value.name);
        const filename = `${randomUUID()}${ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        // Save file
        const arrayBuffer = await value.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));

        uploadedFiles.push({
          id: randomUUID(),
          filename,
          originalName: value.name
        });
      }
    }

    // Add uploaded files to context
    c.set('uploadedFiles', uploadedFiles);
    
    await next();
  } catch (error) {
    console.error('File upload error:', error);
    return c.json({ error: 'File upload failed' }, 500);
  }
};