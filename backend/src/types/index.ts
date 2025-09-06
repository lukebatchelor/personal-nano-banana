export interface Session {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: number;
  session_id: number;
  prompt: string;
  batch_size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface ReferenceImage {
  id: number;
  filename: string;
  original_name: string | null;
  file_hash_sha256: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

export interface UploadedReferenceImage {
  id: number;
  reference_image_id: number;
  replicate_file_id: string;
  replicate_expires_at: string | null;
  uploaded_at: string;
  replicate_metadata: string | null;
}

export interface BatchReferenceImage {
  id: number;
  batch_id: number;
  filename: string;
  original_name: string | null;
  reference_image_id: number | null;
}

export interface GeneratedImage {
  id: number;
  batch_id: number;
  filename: string;
  preview_filename: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  replicate_id: string | null;
  created_at: string;
}

export interface BatchReferenceImageResponse {
  id: number;
  filename: string;
  originalName: string | null;
  url: string;
}

export interface BatchWithImages extends Batch {
  images: GeneratedImage[];
  referenceImages: BatchReferenceImageResponse[];
}

export interface SessionWithBatches extends Session {
  batches: BatchWithImages[];
}

export interface BatchRequest {
  prompt: string;
  batchSize: number;
  referenceImages: File[];
}

export interface ReplicateFileResponse {
  id: string;
  name: string;
  content_type: string;
  size: number;
  checksums: {
    sha256: string;
    md5: string;
  };
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string;
  urls: {
    get: string;
  };
}

export interface BatchResponse {
  batchId: number;
  status: 'pending';
}

export interface BatchStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images?: Array<{
    id: number;
    url: string;
    previewUrl: string;
  }>;
  error?: string;
}

export interface ImageGalleryItem {
  id: number;
  url: string;
  previewUrl: string;
  sessionName: string;
  batchId: number;
  prompt: string;
}

export interface ImageGalleryResponse {
  images: ImageGalleryItem[];
  hasMore: boolean;
}