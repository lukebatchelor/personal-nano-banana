import Replicate from 'replicate';

interface GenerationRequest {
  prompt: string;
  batchSize: number;
  referenceImageUrls?: string[];
}

interface GenerationResult {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'aborted';
  output?: string[];
  error?: string;
}

class ReplicateService {
  private replicate: Replicate;
  private modelVersion = 'google/nano-banana';

  constructor() {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    
    if (!apiToken) {
      console.warn('REPLICATE_API_TOKEN not set. Replicate features will be disabled.');
      // Create a mock replicate instance for testing
      this.replicate = null as any;
      return;
    }

    this.replicate = new Replicate({
      auth: apiToken
    });
  }

  async generateImages(request: GenerationRequest): Promise<string> {
    if (!this.replicate) {
      // Return a mock prediction ID for testing
      return `mock-prediction-${Date.now()}`;
    }

    try {
      const prediction = await this.replicate.predictions.create({
        model: this.modelVersion,
        input: {
          prompt: request.prompt,
          num_outputs: request.batchSize,
          ...(request.referenceImageUrls && request.referenceImageUrls.length > 0 && {
            reference_images: request.referenceImageUrls
          })
        }
      });

      return prediction.id;
    } catch (error) {
      console.error('Error starting Replicate prediction:', error);
      throw new Error(`Failed to start image generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGenerationStatus(predictionId: string): Promise<GenerationResult> {
    if (!this.replicate) {
      // Return a mock completed status for testing
      return {
        id: predictionId,
        status: 'succeeded',
        output: [
          'https://via.placeholder.com/512x512/FF6B6B/FFFFFF?text=Mock+Image+1',
          'https://via.placeholder.com/512x512/4ECDC4/FFFFFF?text=Mock+Image+2'
        ]
      };
    }

    try {
      const prediction = await this.replicate.predictions.get(predictionId);
      
      return {
        id: prediction.id,
        status: prediction.status,
        output: prediction.output as string[] | undefined,
        error: prediction.error as string | undefined
      };
    } catch (error) {
      console.error('Error fetching prediction status:', error);
      throw new Error(`Failed to get generation status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async waitForCompletion(predictionId: string, maxWaitTime = 300000): Promise<GenerationResult> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getGenerationStatus(predictionId);
      
      if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Generation timed out');
  }

  async cancelGeneration(predictionId: string): Promise<void> {
    try {
      await this.replicate.predictions.cancel(predictionId);
    } catch (error) {
      console.error('Error canceling prediction:', error);
      throw new Error(`Failed to cancel generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default ReplicateService;