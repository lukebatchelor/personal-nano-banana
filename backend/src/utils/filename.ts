import { randomUUID } from 'crypto';

/**
 * Generates a shorter filename with timestamp and UUID parts
 * Format: [timestamp]_[uuid_1]-[uuid-2].ext
 * Example: 1725596400_a1b2c3d4-e5f6g7h8.jpg
 */
export function generateFilename(extension: string = ''): string {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const uuid = randomUUID();
  
  // Split UUID and take first 8 and next 8 characters (removing hyphens)
  const cleanUuid = uuid.replace(/-/g, '');
  const uuid1 = cleanUuid.substring(0, 8);
  const uuid2 = cleanUuid.substring(8, 16);
  
  // Ensure extension starts with dot
  const ext = extension.startsWith('.') ? extension : extension ? `.${extension}` : '';
  
  return `${timestamp}_${uuid1}-${uuid2}${ext}`;
}

/**
 * Generates a filename from an existing filename, preserving extension
 */
export function generateFilenameFromOriginal(originalFilename: string): string {
  const extension = originalFilename.includes('.') 
    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
    : '';
  
  return generateFilename(extension);
}