# 🔥 Firebase Setup Guide

This guide will help you set up Firebase for your Inventory Management Dashboard.

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `inventory-dashboard` (or your choice)
4. Disable Google Analytics (optional)
5. Click **"Create project"**

---

## Step 2: Install Firebase CLI

```powershell
npm install -g firebase-tools
```

Verify installation:
```powershell
firebase --version
```

---

## Step 3: Login to Firebase

```powershell
firebase login
```

This will open your browser for authentication.

---

## Step 4: Initialize Firebase in Your Project

```powershell
cd "C:\Users\Muhammad Almas\Documents\projects\inventory-dashboard"
firebase init
```

### During initialization, select:

1. **Which Firebase features?**
   - ☑ Firestore
   - ☑ Functions
   - ☑ Hosting

2. **Use an existing project?**
   - Select your project from the list

3. **Firestore Rules:**
   - Use default file: `firestore.rules` ✓

4. **Firestore Indexes:**
   - Use default file: `firestore.indexes.json` ✓

5. **Functions setup:**
   - Language: **JavaScript**
   - Use ESLint: **No**
   - Install dependencies: **Yes**

6. **Hosting setup:**
   - Public directory: `client/dist`
   - Single-page app: **Yes**
   - Set up automatic builds: **No**
   - Overwrite index.html: **No**

---

## Step 5: Get Your Firebase Config

1. Go to Firebase Console → Project Settings
2. Scroll down to "Your apps"
3. Click **"Web"** icon (</>)
4. Register app name: `inventory-dashboard-web`
5. Copy the **firebaseConfig** object

---

## Step 6: Update Frontend Configuration

Create `client/src/firebase-config.js`:

```javascript
// Replace with your Firebase config
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Update `client/.env`:

```env
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net
```

For local development:
```env
VITE_FIREBASE_FUNCTIONS_URL=http://localhost:5001/YOUR_PROJECT_ID/us-central1
```

---

## Step 7: Update API Service

Replace the import in all page files:

**Change from:**
```javascript
import { getBrands, ... } from '../services/api';
```

**To:**
```javascript
import { getBrands, ... } from '../services/firebase-api';
```

Or simply rename `firebase-api.js` to `api.js` to replace the old one.

---

## Step 8: Install Functions Dependencies

```powershell
cd functions
npm install
cd ..
```

---

## Step 9: Test Locally (Optional)

### Start Firebase Emulators:

```powershell
firebase emulators:start
```

This starts:
- Firestore Emulator: http://localhost:8080
- Functions Emulator: http://localhost:5001

### Build and serve frontend:

```powershell
cd client
npm run build
npm run preview
cd ..
```

---

## Step 10: Deploy to Firebase

### Deploy Functions:

```powershell
firebase deploy --only functions
```

### Build Frontend:

```powershell
cd client
npm run build
cd ..
```

### Deploy Hosting:

```powershell
firebase deploy --only hosting
```

### Deploy Everything:

```powershell
firebase deploy
```

---

## Step 11: Update Frontend URL

After deployment, Firebase will give you a hosting URL like:
```
https://YOUR_PROJECT_ID.web.app
```

Update `client/.env.production`:

```env
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net
```

---

## Step 12: Access Your App

Your app will be live at:
```
https://YOUR_PROJECT_ID.web.app
```

Or your custom domain if configured.

---

## 📝 Quick Commands Reference

```powershell
# Login to Firebase
firebase login

# Initialize project
firebase init

# Start local emulators
firebase emulators:start

# Deploy functions only
firebase deploy --only functions

# Deploy hosting only
firebase deploy --only hosting

# Deploy everything
firebase deploy

# View logs
firebase functions:log

# Open Firebase Console
firebase open
```

---

## 🔧 Troubleshooting

### Error: "Firebase CLI not found"
```powershell
npm install -g firebase-tools
```

### Error: "Not authorized"
```powershell
firebase login --reauth
```

### Error: "Functions deployment failed"
- Check `functions/package.json` has correct dependencies
- Run `cd functions && npm install && cd ..`
- Try deploying individual functions

### Error: "CORS issues"
- CORS is already configured in functions
- Make sure you're calling the correct function URLs

### Functions are slow
- First call is always slow (cold start)
- Subsequent calls are faster
- Consider upgrading to Blaze plan for better performance

---

## 💰 Firebase Pricing

### Free Tier (Spark Plan)
- **Firestore**: 1GB storage, 50K reads/day, 20K writes/day
- **Functions**: 125K invocations/month, 40K GB-seconds
- **Hosting**: 10GB storage, 360MB/day transfer

### Paid Tier (Blaze Plan)
- Pay as you go
- Free tier included
- Recommended for production

**Your app should work fine on the free tier for development and small-scale production!**

---

## 🎯 Post-Deployment Checklist

- [ ] Firebase project created
- [ ] Firebase CLI installed
- [ ] Project initialized
- [ ] Functions deployed
- [ ] Frontend built and deployed
- [ ] Environment variables updated
- [ ] App accessible via Firebase URL
- [ ] Firestore rules configured
- [ ] Test all features work

---

## 🔐 Security (Important!)

### Update Firestore Rules for Production

Edit `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Add authentication
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Then deploy:
```powershell
firebase deploy --only firestore:rules
```

---

## 🚀 Next Steps

1. **Add Authentication** (Firebase Auth)
2. **Set up custom domain** (Firebase Hosting)
3. **Enable backup** (Firestore backup)
4. **Monitor usage** (Firebase Console)
5. **Set up alerts** (Budget alerts)

---

## 📞 Support

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Status](https://status.firebase.google.com/)

---

**Your Inventory Dashboard is now ready for Firebase! 🎉**

No need for separate backend hosting - everything runs on Firebase!

