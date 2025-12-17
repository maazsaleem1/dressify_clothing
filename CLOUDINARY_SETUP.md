# Cloudinary Image Upload Setup Guide

## ✅ Integration Complete!

Image upload functionality has been successfully integrated into all sections:
- ✅ **Inventory** - Product images
- ✅ **Brands** - Brand logos/images
- ✅ **Categories** - Category images

## 🔧 Cloudinary Configuration Steps

### Step 1: Get Your Cloudinary Cloud Name

1. Log in to your [Cloudinary Dashboard](https://cloudinary.com/console)
2. Your cloud name is visible in the dashboard URL or in Settings
3. Example: If your dashboard URL is `https://cloudinary.com/console/c/dressifyclothing`, then `dressifyclothing` is your cloud name

### Step 2: Create Unsigned Upload Preset

1. Go to **Settings** > **Upload** > **Upload presets**
2. Click **Add upload preset**
3. Configure:
   - **Preset name**: `upload_pics` (must match exactly)
   - **Signing mode**: Select **"Unsigned"**
   - **Folder**: `upload pics` (optional, but recommended)
   - **Allowed formats**: Select image formats (jpg, png, gif, webp)
   - **Max file size**: Set to 10MB or your preference
4. Click **Save**

### Step 3: Update Cloudinary Config

Edit `client/src/services/cloudinary.js`:

```javascript
const CLOUDINARY_CONFIG = {
  cloudName: 'YOUR_CLOUD_NAME', // Replace with your actual cloud name
  uploadPreset: 'upload_pics', // Must match the preset name you created
  folder: 'upload pics', // Default folder
  apiKey: '459797886341311',
};
```

**Important**: Replace `YOUR_CLOUD_NAME` with your actual Cloudinary cloud name.

## 📁 Folder Structure in Cloudinary

Images will be organized in the following folders:
- `upload pics/inventory` - Product images
- `upload pics/brands` - Brand images
- `upload pics/categories` - Category images

## 🎯 How It Works

1. **Upload**: When a user selects an image, it's automatically uploaded to Cloudinary
2. **Storage**: The secure URL is stored in Firestore with the document
3. **Display**: Images are displayed in listings and forms

## 🔍 Testing

1. Go to **Inventory** > **Add Stock**
2. Fill in the form and click on the image upload area
3. Select an image file
4. Wait for upload to complete (you'll see a preview)
5. Save the item
6. The image should now appear in the inventory list

## ⚠️ Troubleshooting

### Upload fails with "Invalid upload preset"
- Make sure the preset name in Cloudinary matches `upload_pics` exactly
- Ensure the preset is set to "Unsigned" mode

### Upload fails with "Invalid cloud name"
- Update the `cloudName` in `client/src/services/cloudinary.js` with your actual cloud name

### Images not displaying
- Check browser console for errors
- Verify the image URL is stored correctly in Firestore
- Ensure the image URL is accessible (check in browser)

## 📝 Notes

- **API Secret**: Not needed for unsigned uploads (security best practice)
- **File Size**: Maximum 10MB per image (configurable in upload preset)
- **Supported Formats**: JPG, PNG, GIF, WebP (configurable in upload preset)
- **Storage**: All images are stored in your Cloudinary account

## 🔐 Security

- Unsigned uploads are safe for client-side use
- The upload preset can be restricted to specific folders
- You can set additional restrictions in the upload preset settings
