import { z } from 'zod';

// Request schemas
export const CreateSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required').max(100, 'Session name too long')
});

export const CreateBatchSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  batchSize: z.coerce.number().int().min(1).max(8, 'Batch size must be between 1 and 8')
});

// URL parameter schemas
export const SessionIdParam = z.object({
  sessionId: z.coerce.number().int().positive('Invalid session ID')
});

export const BatchIdParam = z.object({
  batchId: z.coerce.number().int().positive('Invalid batch ID')
});

// Gallery query parameters
export const GalleryQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Image ID parameter
export const ImageIdParam = z.object({
  imageId: z.coerce.number().int().positive('Invalid image ID')
});

// Type exports for convenience
export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>;
export type CreateBatchRequest = z.infer<typeof CreateBatchSchema>;
export type SessionIdParams = z.infer<typeof SessionIdParam>;
export type BatchIdParams = z.infer<typeof BatchIdParam>;
export type GalleryQuery = z.infer<typeof GalleryQuerySchema>;
export type ImageIdParams = z.infer<typeof ImageIdParam>;