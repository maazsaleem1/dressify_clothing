// Cloudinary configuration and upload utility
// Note: For unsigned uploads, you need to create an unsigned upload preset in Cloudinary Dashboard
// Settings > Upload > Upload presets > Add upload preset (set signing mode to "Unsigned")
const CLOUDINARY_CONFIG = {
  cloudName: 'dayk0emgr',
  uploadPreset: 'upload pics', // Make sure this matches your Cloudinary preset name exactly
  folder: 'upload pics', // Default folder path in Cloudinary
  // Note: apiSecret is not used for unsigned uploads (security best practice)
};

/**
 * Upload image to Cloudinary using unsigned upload
 * @param {File} file - The image file to upload
 * @param {string} folder - Optional folder path (defaults to 'upload pics')
 * @returns {Promise<string>} - The secure URL of the uploaded image
 */
export const uploadImageToCloudinary = async (file, folder = 'upload pics') => {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', folder);
    // Note: cloud_name is part of the URL, not form data

    // Upload to Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload image');
    }

    const data = await response.json();
    return data.secure_url; // Return the secure URL
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary (if needed in future)
 * Note: This requires server-side implementation with API secret
 */
export const deleteImageFromCloudinary = async (publicId) => {
  // This would need to be implemented server-side for security
  return Promise.resolve();
};

export default {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  config: CLOUDINARY_CONFIG
};
