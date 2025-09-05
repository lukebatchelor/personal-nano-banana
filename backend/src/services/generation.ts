import ReplicateService from './replicate';
import ImageService from './images';
import DatabaseService from './database';
import type { Batch } from '../types';

interface GenerationJob {
  batchId: number;
  predictionId: string;
  startTime: Date;
}

class GenerationService {
  private replicate: ReplicateService;
  private imageService: ImageService;
  private db: DatabaseService;
  private activeJobs = new Map<number, GenerationJob>();

  constructor(db: DatabaseService) {
    this.db = db;
    this.replicate = new ReplicateService();
    this.imageService = new ImageService(db);
  }

  async startGeneration(batchId: number): Promise<void> {
    try {
      const batch = this.db.getBatch(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      if (batch.status !== 'pending') {
        throw new Error(`Batch ${batchId} is not in pending state`);
      }

      // Update batch status to processing
      this.db.updateBatchStatus(batchId, 'processing');

      // Get reference images if any
      const referenceImages = this.db.getReferenceImagesByBatch(batchId);
      const referenceImageUrls = referenceImages.map(img => 
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/images/${img.filename}`
      );

      // Start generation with Replicate
      const predictionId = await this.replicate.generateImages({
        prompt: batch.prompt,
        batchSize: batch.batch_size,
        referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined
      });

      // Track the job
      this.activeJobs.set(batchId, {
        batchId,
        predictionId,
        startTime: new Date()
      });

      // Start polling for completion in the background
      this.pollForCompletion(batchId, predictionId);
      
    } catch (error) {
      console.error(`Error starting generation for batch ${batchId}:`, error);
      this.db.updateBatchStatus(batchId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.activeJobs.delete(batchId);
      throw error;
    }
  }

  private async pollForCompletion(batchId: number, predictionId: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 3000; // Poll every 3 seconds
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < maxWaitTime) {
        const result = await this.replicate.getGenerationStatus(predictionId);

        if (result.status === 'succeeded') {
          await this.handleSuccess(batchId, result.output || []);
          break;
        } else if (result.status === 'failed' || result.status === 'canceled' || result.status === 'aborted') {
          await this.handleFailure(batchId, result.error || 'Generation failed');
          break;
        }

        // Continue polling if still processing
        if (result.status === 'processing' || result.status === 'starting') {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
      }

      // Handle timeout
      if (Date.now() - startTime >= maxWaitTime) {
        await this.handleFailure(batchId, 'Generation timed out');
      }
    } catch (error) {
      console.error(`Error polling for batch ${batchId}:`, error);
      await this.handleFailure(batchId, error instanceof Error ? error.message : 'Polling error');
    } finally {
      this.activeJobs.delete(batchId);
    }
  }

  private async handleSuccess(batchId: number, output: any): Promise<void> {
    try {
      let imageUrls: string[] = [];
      
      // Handle different output formats from Replicate
      if (Array.isArray(output)) {
        imageUrls = output;
      } else if (typeof output === 'string') {
        // Single string URL
        imageUrls = [output];
      } else if (output && typeof output === 'object') {
        // Could be an object with URLs or other structure
        if (output.images && Array.isArray(output.images)) {
          imageUrls = output.images;
        } else if (output.url) {
          imageUrls = [output.url];
        } else {
          console.warn('Unexpected output format:', output);
          imageUrls = [];
        }
      }

      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('No valid image URLs found in output');
      }

      // Process and store images
      const job = this.activeJobs.get(batchId);
      await this.imageService.processGeneratedImages(imageUrls, batchId, job?.predictionId);

      // Update batch status to completed
      this.db.updateBatchStatus(batchId, 'completed');
      
      console.log(`Successfully completed generation for batch ${batchId} with ${imageUrls.length} images`);
    } catch (error) {
      console.error(`Error handling success for batch ${batchId}:`, error);
      await this.handleFailure(batchId, error instanceof Error ? error.message : 'Error processing results');
    }
  }

  private async handleFailure(batchId: number, errorMessage: string): Promise<void> {
    this.db.updateBatchStatus(batchId, 'failed', errorMessage);
    console.error(`Generation failed for batch ${batchId}: ${errorMessage}`);
  }

  async cancelGeneration(batchId: number): Promise<void> {
    const job = this.activeJobs.get(batchId);
    if (!job) {
      throw new Error(`No active generation found for batch ${batchId}`);
    }

    try {
      await this.replicate.cancelGeneration(job.predictionId);
      this.db.updateBatchStatus(batchId, 'failed', 'Generation canceled by user');
      this.activeJobs.delete(batchId);
    } catch (error) {
      console.error(`Error canceling generation for batch ${batchId}:`, error);
      throw error;
    }
  }

  getActiveJobs(): GenerationJob[] {
    return Array.from(this.activeJobs.values());
  }

  isGenerationActive(batchId: number): boolean {
    return this.activeJobs.has(batchId);
  }

  async getGenerationStatus(batchId: number): Promise<{ 
    status: Batch['status']; 
    progress?: string; 
    error?: string;
    predictionId?: string;
  }> {
    const batch = this.db.getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const job = this.activeJobs.get(batchId);
    let progress: string | undefined;

    if (job && batch.status === 'processing') {
      try {
        const result = await this.replicate.getGenerationStatus(job.predictionId);
        progress = result.status;
      } catch (error) {
        console.error(`Error getting progress for batch ${batchId}:`, error);
      }
    }

    return {
      status: batch.status,
      progress,
      error: batch.error_message || undefined,
      predictionId: job?.predictionId
    };
  }
}

export default GenerationService;