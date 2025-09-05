import type { Session, SessionWithBatches, BatchRequest, BatchStatusResponse } from '../types';

const API_BASE = 'http://localhost:3000/api';

class ApiService {
  private async fetch(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Session endpoints
  async getSessions(): Promise<Session[]> {
    return this.fetch('/sessions');
  }

  async getSession(id: number): Promise<SessionWithBatches> {
    return this.fetch(`/sessions/${id}`);
  }

  async createSession(name: string): Promise<{ sessionId: number; session: Session }> {
    return this.fetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // Batch endpoints
  async createBatch(sessionId: number, request: BatchRequest): Promise<{ batchId: number; status: string }> {
    const formData = new FormData();
    formData.append('prompt', request.prompt);
    formData.append('batchSize', request.batchSize.toString());
    
    if (request.referenceImages) {
      request.referenceImages.forEach((file, index) => {
        formData.append(`referenceImage_${index}`, file);
      });
    }

    const response = await fetch(`${API_BASE}/sessions/${sessionId}/batches`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getBatchStatus(batchId: number): Promise<BatchStatusResponse> {
    return this.fetch(`/batches/${batchId}/status`);
  }

  // Image endpoints
  getImageUrl(filename: string): string {
    return `${API_BASE}/images/${filename}`;
  }

  getPreviewUrl(filename: string): string {
    return `${API_BASE}/images/preview/${filename}`;
  }
}

export const apiService = new ApiService();