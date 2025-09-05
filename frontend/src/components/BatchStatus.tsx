import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useBatchStatus } from '../hooks/useApi';
import { apiService } from '../services/api';

export default function BatchStatus() {
  const { activeBatchId, setActiveBatchId, setIsGenerating } = useAppStore();
  const { data: batchStatus, refetch } = useBatchStatus(activeBatchId);

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

  if (!activeBatchId || !batchStatus) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Generation Status</h3>
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
              <h3 className="text-sm font-medium text-red-800">Generation Failed</h3>
              <p className="text-sm text-red-700 mt-1">{batchStatus.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generated Images */}
      {batchStatus.images && batchStatus.images.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Generated Images</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {batchStatus.images.map((image) => (
              <div key={image.id} className="relative group cursor-pointer">
                <img
                  src={`http://localhost:3000${image.previewUrl}`}
                  alt="Generated image"
                  className="w-full aspect-square object-cover rounded-lg shadow-sm group-hover:shadow-md transition-shadow"
                  onClick={() => window.open(`http://localhost:3000${image.url}`, '_blank')}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}