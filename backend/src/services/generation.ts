import ReplicateService from './replicate';
import ImageService from './images';
import DatabaseService from './database';
import ReferenceImageService from './referenceImages';
import type { Batch } from '../types';

interface GenerationJob {
  batchId: number;
  predictionId: string;
  imageIndex: number;
  startTime: Date;
}

interface BatchProgress {
  batchId: number;
  totalImages: number;
  completed: number;
  failed: number;
  processing: number;
}

class GenerationService {
  private replicate: ReplicateService;
  private imageService: ImageService;
  private db: DatabaseService;
  private referenceImageService: ReferenceImageService;
  private activeJobs = new Map<string, GenerationJob>(); // predictionId -> job
  private maxConcurrency = 4; // Configurable max concurrent requests

  constructor(db: DatabaseService) {
    this.db = db;
    this.replicate = new ReplicateService();
    this.imageService = new ImageService(db);
    this.referenceImageService = new ReferenceImageService(db);
  }

  async startGeneration(batchId: number): Promise<void> {
    const jobs: GenerationJob[] = [];
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

      // Get reference image URLs from Replicate (handles expiration transparently)
      const referenceImageUrls = await this.referenceImageService.getReferenceImageUrls(batchId);
      console.log(`Found ${referenceImageUrls.length} reference image URLs for batch ${batchId}:`, referenceImageUrls);

      // Start individual generation requests for each image
      
      for (let i = 0; i < batch.batch_size; i++) {
        const predictionId = await this.replicate.generateImages({
          prompt: batch.prompt,
          numOutputs: 1, // Generate one image per prediction
          referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined
        });

        // Create database record for tracking
        this.db.createPredictionJob(batchId, predictionId, i);

        const job: GenerationJob = {
          batchId,
          predictionId,
          imageIndex: i,
          startTime: new Date()
        };

        jobs.push(job);
        this.activeJobs.set(predictionId, job);

        console.log(`Started prediction ${i + 1}/${batch.batch_size} for batch ${batchId}: ${predictionId}`);
      }

      // Start polling for completion of all jobs
      jobs.forEach(job => {
        this.pollForCompletion(job.predictionId);
      });
      
    } catch (error) {
      console.error(`Error starting generation for batch ${batchId}:`, error);
      this.db.updateBatchStatus(batchId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      // Clean up any created jobs on failure
      if (jobs && jobs.length > 0) {
        jobs.forEach((job: GenerationJob) => this.activeJobs.delete(job.predictionId));
      }
      throw error;
    }
  }

  private async pollForCompletion(predictionId: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 3000; // Poll every 3 seconds
    const startTime = Date.now();

    const job = this.activeJobs.get(predictionId);
    if (!job) {
      console.error(`No active job found for prediction ${predictionId}`);
      return;
    }

    try {
      while (Date.now() - startTime < maxWaitTime) {
        const result = await this.replicate.getGenerationStatus(predictionId);

        // Update database status
        console.log(`Received status from Replicate: "${result.status}" for prediction ${predictionId}`);
        this.db.updatePredictionJobStatus(predictionId, result.status, result.error);

        if (result.status === 'succeeded') {
          await this.handleJobSuccess(job, result.output || '');
          break;
        } else if (result.status === 'failed' || result.status === 'canceled' || result.status === 'aborted') {
          await this.handleJobFailure(job, result.error || 'Generation failed');
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
        await this.handleJobFailure(job, 'Generation timed out');
      }
    } catch (error) {
      console.error(`Error polling for prediction ${predictionId}:`, error);
      await this.handleJobFailure(job, error instanceof Error ? error.message : 'Polling error');
    } finally {
      this.activeJobs.delete(predictionId);
      
      // Check if batch is complete
      await this.checkBatchCompletion(job.batchId);
    }
  }

  private async handleJobSuccess(job: GenerationJob, imageUrl: string): Promise<void> {
    try {
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('No valid image URL found in output');
      }

      // Process and store the single image
      await this.imageService.processGeneratedImages([imageUrl], job.batchId, job.predictionId);
      
      console.log(`Successfully completed prediction ${job.predictionId} for batch ${job.batchId} (image ${job.imageIndex + 1})`);
    } catch (error) {
      console.error(`Error handling success for job ${job.predictionId}:`, error);
      await this.handleJobFailure(job, error instanceof Error ? error.message : 'Error processing result');
    }
  }

  private async handleJobFailure(job: GenerationJob, errorMessage: string): Promise<void> {
    console.error(`Prediction failed for ${job.predictionId}: ${errorMessage}`);
  }

  private async checkBatchCompletion(batchId: number): Promise<void> {
    const progress = await this.getBatchProgress(batchId);
    const total = progress.completed + progress.failed + progress.processing;
    
    if (progress.processing === 0) {
      // All jobs are done (either completed or failed)
      if (progress.completed > 0) {
        // At least some images succeeded
        this.db.updateBatchStatus(batchId, 'completed');
        console.log(`Batch ${batchId} completed: ${progress.completed}/${total} images successful, ${progress.failed} failed`);
      } else {
        // All jobs failed
        this.db.updateBatchStatus(batchId, 'failed', 'All image generations failed');
        console.log(`Batch ${batchId} failed: all ${progress.failed} image generations failed`);
      }
    }
  }

  private async getBatchProgress(batchId: number): Promise<BatchProgress> {
    const jobStatuses = this.db.getBatchJobProgress(batchId);
    const progress: BatchProgress = {
      batchId,
      totalImages: 0,
      completed: 0,
      failed: 0,
      processing: 0
    };

    for (const statusInfo of jobStatuses) {
      const count = (statusInfo as any).count || 0;
      const status = (statusInfo as any).status;
      progress.totalImages += count;
      if (status === 'succeeded') {
        progress.completed += count;
      } else if (status === 'failed' || status === 'canceled') {
        progress.failed += count;
      } else {
        progress.processing += count;
      }
    }

    return progress;
  }

  async cancelGeneration(batchId: number): Promise<void> {
    const activeBatchJobs = Array.from(this.activeJobs.values()).filter(job => job.batchId === batchId);
    
    if (activeBatchJobs.length === 0) {
      throw new Error(`No active generation found for batch ${batchId}`);
    }

    try {
      // Cancel all active jobs for this batch
      for (const job of activeBatchJobs) {
        await this.replicate.cancelGeneration(job.predictionId);
        this.db.updatePredictionJobStatus(job.predictionId, 'canceled');
        this.activeJobs.delete(job.predictionId);
      }
      
      this.db.updateBatchStatus(batchId, 'failed', 'Generation canceled by user');
      console.log(`Canceled ${activeBatchJobs.length} active jobs for batch ${batchId}`);
    } catch (error) {
      console.error(`Error canceling generation for batch ${batchId}:`, error);
      throw error;
    }
  }

  getActiveJobs(): GenerationJob[] {
    return Array.from(this.activeJobs.values());
  }

  isGenerationActive(batchId: number): boolean {
    return Array.from(this.activeJobs.values()).some(job => job.batchId === batchId);
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

    let progress: string | undefined;

    if (batch.status === 'processing') {
      try {
        const batchProgress = await this.getBatchProgress(batchId);
        const total = batchProgress.totalImages;
        const completed = batchProgress.completed;
        
        if (total > 0) {
          progress = `${completed}/${total} images completed`;
        }
      } catch (error) {
        console.error(`Error getting progress for batch ${batchId}:`, error);
      }
    }

    return {
      status: batch.status,
      progress,
      error: batch.error_message || undefined
    };
  }
}

export default GenerationService;