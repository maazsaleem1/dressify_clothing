import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadImageToCloudinary } from '../services/cloudinary';

const ImageUpload = ({
  imageUrl,
  onImageChange,
  label = 'Upload Image',
  folder = 'upload pics',
  disabled = false,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(imageUrl || null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const uploadingRef = useRef(false);

  useEffect(() => {
    // Don't overwrite local preview while an upload is in progress
    if (uploadingRef.current) return;
    setPreview(imageUrl || null);
  }, [imageUrl]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    // Allow selecting the same file again later
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }

    const previousPreview = preview;
    setError(null);
    setUploading(true);
    uploadingRef.current = true;

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);

      const uploadedUrl = await uploadImageToCloudinary(file, folder);
      onImageChange(uploadedUrl);
      setPreview(uploadedUrl);
    } catch (err) {
      setError(err.message || 'Failed to upload image');
      setPreview(previousPreview);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange('');
    setError(null);
  };

  const openFilePicker = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      <div className="relative">
        {preview ? (
          <div className="relative group">
            <div className="w-full h-48 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                key={typeof preview === 'string' ? preview.slice(0, 120) : 'preview'}
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            {!disabled && (
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="bg-white text-gray-800 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg hover:bg-gray-100 transition-colors"
                  title="Change image"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Change'}
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                  title="Remove image"
                  disabled={uploading}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="text-sm text-gray-600 mt-2">Uploading...</span>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled || uploading}
            className={`
              flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg
              ${uploading
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-gray-100'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              transition-colors
            `}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </span>
              </div>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {preview && !error && !uploading && typeof preview === 'string' && preview.startsWith('http') && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <ImageIcon size={12} />
          Image ready to save
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
