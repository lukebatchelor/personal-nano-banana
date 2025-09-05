import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [batchSize, setBatchSize] = useState(2);

  const handleGenerate = () => {
    console.log('Generate:', { prompt, batchSize });
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
              disabled={!prompt.trim()}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Generate Images
            </button>
          </div>
        </div>

        {/* Recent Batches Placeholder */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Generations</h2>
          <div className="text-gray-500 text-center py-8">
            No recent generations yet. Create your first batch above!
          </div>
        </div>
      </div>
    </div>
  );
}