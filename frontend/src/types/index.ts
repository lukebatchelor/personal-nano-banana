export interface Session {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  batchCount?: number;
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

export interface ReferenceImage {
  id: number;
  filename: string;
  originalName: string | null;
  url?: string;
}

export interface BatchWithImages extends Batch {
  images: GeneratedImage[];
  referenceImages: ReferenceImage[];
}

export interface SessionWithBatches extends Session {
  batches: BatchWithImages[];
}

export interface ExistingReferenceImage {
  id: number;
  filename: string;
  originalName: string | null;
  url: string;
}

export interface ReferenceImageState {
  newFiles: File[];
  existingReferences: ExistingReferenceImage[];
}

export interface BatchRequest {
  prompt: string;
  batchSize: number;
  newReferenceImages?: File[];
  existingReferenceImageIds?: number[];
}

export interface BatchStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: string;
  images?: Array<{
    id: number;
    url: string;
    previewUrl: string;
  }>;
  error?: string;
}