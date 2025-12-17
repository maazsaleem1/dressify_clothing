import React, { useState } from 'react';
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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to Cloudinary
      const uploadedUrl = await uploadImageToCloudinary(file, folder);

      // Update parent component
      onImageChange(uploadedUrl);
      setPreview(uploadedUrl);
    } catch (err) {
      setError(err.message || 'Failed to upload image');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange('');
    setError(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <div className="relative">
        {preview ? (
          <div className="relative group">
            <div className="w-full h-48 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                title="Remove image"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <label
            className={`
              flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer
              ${uploading
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-gray-100'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              transition-colors
            `}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || uploading}
            />
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
          </label>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {preview && !error && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <ImageIcon size={12} />
          Image uploaded successfully
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
