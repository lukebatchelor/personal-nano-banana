import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useBatchStatus } from '../hooks/useApi';
import { apiService } from '../services/api';
import ImageModal from './ImageModal';
import type { GeneratedImage } from '../types';
import { API_BASE_URL } from '../config/api';

export default function BatchStatus() {
  const { activeBatchId, setActiveBatchId, setIsGenerating } = useAppStore();
  const { data: batchStatus, refetch } = useBatchStatus(activeBatchId);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<GeneratedImage[]>([]);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);

  useEffect(() => {
    if (!activeBatchId || !batchStatus) return;

    if (batchStatus.status === 'completed' || batchStatus.status === 'failed') {
      setIsGenerating(false);
      return;
    }

    // Poll for updates every 2 seconds for pending/processing batches
    const interval = setInterval(() => {
      refetch();
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatchId, batchStatus, refetch, setIsGenerating]);

  const openImageModal = (index: number) => {
    if (!batchStatus?.images) return;
    
    // Convert BatchStatusResponse images to GeneratedImage format for modal
    const modalImagesData: GeneratedImage[] = batchStatus.images.map((img, idx) => ({
      id: img.id,
      batch_id: activeBatchId!,
      filename: img.url.split('/').pop() || '',
      preview_filename: img.previewUrl.split('/').pop() || null,
      width: null,
      height: null,
      file_size: null,
      replicate_id: null,
      created_at: new Date().toISOString()
    }));
    
    setModalImages(modalImagesData);
    setModalInitialIndex(index);
    setModalOpen(true);
  };

  if (!activeBatchId || !batchStatus) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Batch Status</h3>
        <button
          onClick={() => setActiveBatchId(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          batchStatus.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          batchStatus.status === 'processing' ? 'bg-blue-100 text-blue-800' :
          batchStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {batchStatus.status.charAt(0).toUpperCase() + batchStatus.status.slice(1)}
        </div>
        
        {batchStatus.status === 'processing' && (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            <span className="text-sm">{batchStatus.progress || 'Processing...'}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {batchStatus.status === 'failed' && batchStatus.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Batch Failed</h3>
              <p className="text-sm text-red-700 mt-1">{batchStatus.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generated Images */}
      {batchStatus.images && batchStatus.images.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Generated Images</h4>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {batchStatus.images.map((image, index) => (
              <div key={image.id} className="flex-shrink-0 cursor-pointer">
                <img
                  src={`${API_BASE_URL}${image.previewUrl}`}
                  alt="Generated image"
                  className="w-32 h-32 object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  onClick={() => openImageModal(index)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={modalImages}
        initialIndex={modalInitialIndex}
      />
    </div>
  );
}