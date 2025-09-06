import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useSessions, useCreateSession, useCreateBatch, useSession } from '../hooks/useApi';
import BatchStatus from '../components/BatchStatus';
import ImageModal from '../components/ImageModal';
import type { GeneratedImage } from '../types';
import { getPreviewUrl } from '../config/api';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [batchSize, setBatchSize] = useState(2);
  const [showNewSessionInput, setShowNewSessionInput] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<GeneratedImage[]>([]);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  
  const { currentSession, setCurrentSession, isGenerating, setIsGenerating, setActiveBatchId } = useAppStore();
  const { data: sessions } = useSessions();
  const { data: sessionWithBatches } = useSession(currentSession?.id!);
  const createSessionMutation = useCreateSession();
  const createBatchMutation = useCreateBatch();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      setIsGenerating(true);
      
      let sessionToUse = currentSession;
      
      // Create a new session if none exists
      if (!sessionToUse) {
        const sessionName = showNewSessionInput && newSessionName.trim() 
          ? newSessionName.trim()
          : `Session ${new Date().toLocaleDateString()}`;
          
        const sessionResult = await createSessionMutation.mutateAsync(sessionName);
        sessionToUse = sessionResult.session;
        setCurrentSession(sessionToUse);
        
        // Clean up new session input
        if (showNewSessionInput) {
          setShowNewSessionInput(false);
          setNewSessionName('');
        }
      }

      // Create the batch
      const batchResult = await createBatchMutation.mutateAsync({
        sessionId: sessionToUse.id,
        request: {
          prompt: prompt.trim(),
          batchSize,
        },
      });

      setActiveBatchId(batchResult.batchId);
      
      // Don't clear the prompt - keep it for potential reuse
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to start generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const openImageModal = (images: GeneratedImage[], index: number) => {
    setModalImages(images);
    setModalInitialIndex(index);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Image Generator
          </h1>
          <p className="text-gray-600 mb-8">
            Generate beautiful images using Google's Nano Banana model
          </p>

          {/* Session Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session
            </label>
            <select
              value={showNewSessionInput ? 'new' : (currentSession?.id || '')}
              onChange={(e) => {
                if (e.target.value === 'new') {
                  setShowNewSessionInput(true);
                  setCurrentSession(null);
                } else {
                  setShowNewSessionInput(false);
                  const sessionId = Number(e.target.value);
                  const session = sessions?.find(s => s.id === sessionId) || null;
                  setCurrentSession(session);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a session</option>
              {sessions?.map(session => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.batchCount || 0} batches)
                </option>
              ))}
              <option value="new">+ Create new session</option>
            </select>
            
            {showNewSessionInput && (
              <div className="mt-3">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="Enter session name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Generation Form */}
          <div className="space-y-6">
            {/* Prompt Input */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Describe what you want to create
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A beautiful sunset over mountains, photorealistic, 4k"
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Batch Size Selector */}
            <div>
              <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700 mb-2">
                Number of images ({batchSize})
              </label>
              <input
                id="batchSize"
                type="range"
                min="1"
                max="8"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>4</span>
                <span>8</span>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
              {isGenerating ? 'Generating...' : 'Generate Images'}
            </button>
          </div>
        </div>

        {/* Batch Status */}
        <BatchStatus />

        {/* Recent Batches */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {currentSession ? `Recent Batches - ${currentSession.name}` : 'Recent Batches'}
          </h2>
          
          {!currentSession ? (
            <div className="text-gray-500 text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No session selected</h3>
              <p className="text-gray-500">Select or create a session to see your batches</p>
            </div>
          ) : !sessionWithBatches?.batches?.length ? (
            <div className="text-gray-500 text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No batches yet</h3>
              <p className="text-gray-500">Create your first batch above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessionWithBatches.batches.slice(0, 3).map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        batch.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        batch.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {batch.status}
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveBatchId(batch.id);
                        setPrompt(batch.prompt);
                        setBatchSize(batch.batch_size);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Status
                    </button>
                  </div>
                  
                  <p className="text-gray-900 text-sm mb-3 line-clamp-2">{batch.prompt}</p>
                  
                  {batch.images && batch.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {batch.images.slice(0, 4).map((image, index) => (
                        <img
                          key={image.id}
                          src={getPreviewUrl(image.preview_filename || image.filename)}
                          alt="Generated"
                          className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => openImageModal(batch.images, index)}
                        />
                      ))}
                      {batch.images.length > 4 && (
                        <div 
                          className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:bg-gray-200"
                          onClick={() => openImageModal(batch.images, 4)}
                        >
                          +{batch.images.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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