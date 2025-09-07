export const API_BASE_URL = (import.meta.env.MODE === 'production' ? '' : import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000');

export const getImageUrl = (filename: string): string => {
  return `${API_BASE_URL}/api/images/${filename}`;
};

export const getPreviewUrl = (filename: string): string => {
  return `${API_BASE_URL}/api/images/preview/${filename}`;
};

export const getReferenceImageUrl = (filename: string): string => {
  return `${API_BASE_URL}/api/images/reference/${filename}`;
};