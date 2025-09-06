import { useState, useRef, useEffect } from 'react';
import type { ReferenceImageState } from '../types';

interface ReferenceImageUploadProps {
  onImagesChange: (state: ReferenceImageState) => void;
  initialState?: ReferenceImageState;
  disabled?: boolean;
}

export default function ReferenceImageUpload({ onImagesChange, initialState, disabled = false }: ReferenceImageUploadProps) {
  const [imageState, setImageState] = useState<ReferenceImageState>(
    initialState || { newFiles: [], existingReferences: [] }
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update state when initialState changes (for "Use this batch" functionality)
  useEffect(() => {
    if (initialState) {
      setImageState(initialState);
    }
  }, [initialState]);

  // Notify parent of changes
  useEffect(() => {
    onImagesChange(imageState);
  }, [imageState, onImagesChange]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB max
      return isValidType && isValidSize;
    });

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Please upload only image files under 10MB.');
    }

    setImageState(prev => ({
      ...prev,
      newFiles: [...prev.newFiles, ...validFiles]
    }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const removeNewFile = (index: number) => {
    setImageState(prev => ({
      ...prev,
      newFiles: prev.newFiles.filter((_, i) => i !== index)
    }));
  };

  const removeExistingRef = (index: number) => {
    setImageState(prev => ({
      ...prev,
      existingReferences: prev.existingReferences.filter((_, i) => i !== index)
    }));
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Reference Images (Optional)
      </label>
      
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={!disabled ? openFileDialog : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PNG, JPG, WebP up to 10MB each
          </p>
        </div>
      </div>

      {/* Selected Images Preview */}
      {(imageState.newFiles.length > 0 || imageState.existingReferences.length > 0) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Selected Images ({imageState.newFiles.length + imageState.existingReferences.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Existing Reference Images */}
            {imageState.existingReferences.map((ref, index) => (
              <div key={`existing-${ref.id}`} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={ref.url}
                    alt={ref.originalName || ref.filename}
                    className="w-full h-full object-cover"
                  />
                  {/* Existing Reference Indicator */}
                  <div className="absolute top-2 left-2 bg-green-500 text-white rounded px-2 py-1 text-xs font-medium">
                    Reused
                  </div>
                </div>
                
                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeExistingRef(index);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={disabled}
                >
                  ×
                </button>
                
                {/* File Name */}
                <p className="text-xs text-gray-500 mt-1 truncate" title={ref.originalName || ref.filename}>
                  {ref.originalName || ref.filename}
                </p>
              </div>
            ))}
            
            {/* New File Uploads */}
            {imageState.newFiles.map((file, index) => (
              <div key={`new-${index}`} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    onLoad={(e) => {
                      // Clean up object URL to prevent memory leaks
                      URL.revokeObjectURL((e.target as HTMLImageElement).src);
                    }}
                  />
                  {/* New File Indicator */}
                  <div className="absolute top-2 left-2 bg-blue-500 text-white rounded px-2 py-1 text-xs font-medium">
                    New
                  </div>
                </div>
                
                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNewFile(index);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={disabled}
                >
                  ×
                </button>
                
                {/* File Name */}
                <p className="text-xs text-gray-500 mt-1 truncate" title={file.name}>
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        Reference images help guide the AI generation. Upload images that represent the style, composition, or elements you want in your generated images.
      </p>
    </div>
  );
}