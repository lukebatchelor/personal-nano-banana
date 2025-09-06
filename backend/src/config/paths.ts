// Path configuration for file storage
export const paths = {
  uploads: process.env.UPLOADS_DIR || 'uploads',
  generatedImages: {
    full: process.env.GENERATED_IMAGES_DIR ? `${process.env.GENERATED_IMAGES_DIR}/full` : 'generated/full',
    previews: process.env.GENERATED_IMAGES_DIR ? `${process.env.GENERATED_IMAGES_DIR}/previews` : 'generated/previews'
  },
  database: process.env.DATABASE_PATH || 'database.sqlite'
};

// Ensure directories exist
import { mkdirSync } from 'fs';

export function ensureDirectoriesExist() {
  try {
    mkdirSync(paths.uploads, { recursive: true });
    mkdirSync(paths.generatedImages.full, { recursive: true });
    mkdirSync(paths.generatedImages.previews, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}