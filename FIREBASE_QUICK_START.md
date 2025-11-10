# 🚀 Firebase Quick Start (5 Minutes)

Get your app running on Firebase quickly!

---

## Prerequisites

- Node.js installed ✓
- Firebase account (free)

---

## Step-by-Step Setup

### 1. Install Firebase CLI (1 minute)

```powershell
npm install -g firebase-tools
```

### 2. Login to Firebase (30 seconds)

```powershell
firebase login
```

### 3. Create Firebase Project (1 minute)

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it: `inventory-dashboard`
4. Click "Create project"
5. **Copy your Project ID** (you'll need this)

### 4. Initialize Firebase (1 minute)

```powershell
cd "C:\Users\Muhammad Almas\Documents\projects\inventory-dashboard"
firebase init
```

**Select:**
- ☑ Firestore
- ☑ Functions  
- ☑ Hosting

**Then:**
- Choose "Use an existing project" → Select your project
- Firestore rules: Press Enter (use default)
- Firestore indexes: Press Enter (use default)
- Functions language: JavaScript
- ESLint: No
- Install dependencies: Yes
- Public directory: `client/dist`
- Single-page app: Yes
- Overwrite index.html: No

### 5. Update Configuration (1 minute)

**Update `.firebaserc`:**
```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

**Update `client/.env`:**
```env
VITE_FIREBASE_FUNCTIONS_URL=http://localhost:5001/YOUR_PROJECT_ID/us-central1
```

**For production, create `client/.env.production`:**
```env
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net
```

### 6. Update API Import (30 seconds)

**Option A: Rename the file**
```powershell
cd client/src/services
del api.js
ren firebase-api.js api.js
cd ../../..
```

**Option B: Or update `firebase-api.js`** to use your project URL

### 7. Install Dependencies (1 minute)

```powershell
npm run install-all
```

### 8. Test Locally (Optional)

**Terminal 1 - Start Firebase Emulators:**
```powershell
firebase emulators:start
```

**Terminal 2 - Start Frontend:**
```powershell
cd client
npm run dev
```

Open: http://localhost:5173

### 9. Deploy to Firebase (2 minutes)

```powershell
# Build frontend
cd client
npm run build
cd ..

# Deploy everything
firebase deploy
```

**Your app will be live at:**
```
https://YOUR_PROJECT_ID.web.app
```

---

## 🎉 Done!

Your app is now hosted on Firebase with:
- ✅ Firestore database
- ✅ Cloud Functions backend
- ✅ Firebase Hosting frontend
- ✅ No server management needed!

---

## Quick Commands

```powershell
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# View logs
firebase functions:log

# Open Firebase Console
start https://console.firebase.google.com/project/YOUR_PROJECT_ID
```

---

## 💡 Tips

1. **Free Tier Limits:**
   - 50K Firestore reads/day
   - 20K writes/day
   - 125K function calls/month
   - Perfect for development!

2. **First Function Call:**
   - May take 5-10 seconds (cold start)
   - Subsequent calls are fast

3. **Update Functions:**
   - Make changes in `functions/index.js`
   - Run `firebase deploy --only functions`

4. **Update Frontend:**
   - Make changes in `client/src/`
   - Run `npm run build` then `firebase deploy --only hosting`

---

## 🔧 Troubleshooting

**Functions not working?**
```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

**Frontend not updating?**
```powershell
cd client
npm run build
cd ..
firebase deploy --only hosting
```

**Need to redeploy everything?**
```powershell
firebase deploy
```

---

## 📞 Need Help?

Check the detailed guide: `FIREBASE_SETUP.md`

---

**Enjoy your Firebase-powered Inventory Dashboard! 🎉**

