# 🚀 Firebase Deployment Guide

Complete guide for deploying your admin panel to Firebase.

---

## 📋 Prerequisites

1. ✅ Firebase CLI installed
2. ✅ Logged in to Firebase
3. ✅ Project initialized

---

## 🔧 Deployment Commands

### Option 1: Deploy Everything (Recommended)

```powershell
# Build the client first
cd client
npm run build
cd ..

# Deploy everything (hosting, firestore rules, indexes)
firebase deploy
```

### Option 2: Deploy Specific Services

#### Deploy Only Hosting (Frontend)
```powershell
# Build the client
cd client
npm run build
cd ..

# Deploy hosting only
firebase deploy --only hosting
```

#### Deploy Only Firestore Rules
```powershell
firebase deploy --only firestore:rules
```

#### Deploy Only Firestore Indexes
```powershell
firebase deploy --only firestore:indexes
```

#### Deploy Firestore Rules + Indexes
```powershell
firebase deploy --only firestore
```

#### Deploy Only Functions (if you have any)
```powershell
firebase deploy --only functions
```

---

## 📝 Step-by-Step Deployment

### Step 1: Build the Frontend

```powershell
cd client
npm run build
cd ..
```

This creates the production build in `client/dist/`

### Step 2: Deploy to Firebase

```powershell
firebase deploy
```

This will deploy:
- ✅ Hosting (your admin panel)
- ✅ Firestore security rules
- ✅ Firestore indexes
- ✅ Functions (if any)

### Step 3: Verify Deployment

After deployment, Firebase will show you the URL:
```
✔  Deploy complete!

Hosting URL: https://dressifyclothing-77a5e.web.app
```

---

## 🎯 Quick Deploy Script

Create a `deploy.ps1` file in the root directory:

```powershell
# deploy.ps1
Write-Host "Building client..." -ForegroundColor Cyan
cd client
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
cd ..

Write-Host "Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy

Write-Host "Deployment complete!" -ForegroundColor Green
```

Run it with:
```powershell
.\deploy.ps1
```

---

## 🔍 Check Deployment Status

```powershell
firebase hosting:channel:list
```

---

## 🌐 Your Live URLs

After deployment, your admin panel will be available at:

- **Primary URL**: `https://dressifyclothing-77a5e.web.app`
- **Alternative URL**: `https://dressifyclothing-77a5e.firebaseapp.com`

---

## ⚙️ Firebase Configuration

Your `firebase.json` is configured for:
- **Hosting**: `client/dist` directory
- **Firestore**: Rules and indexes from project root

---

## 🐛 Troubleshooting

### Firebase CLI Error: "require is not defined" (Node.js v22)

If you see this error:
```
ReferenceError: require is not defined
```

**Solution 1: Update Firebase CLI (Recommended)**
```powershell
npm install -g firebase-tools@latest
```

**Solution 2: Use npx (No global install needed)**
```powershell
# Build first
cd client
npm run build
cd ..

# Deploy using npx
npx firebase-tools deploy
```

**Solution 3: Use Node.js 18 or 20 (if you have nvm)**
```powershell
# Install nvm-windows first, then:
nvm install 20
nvm use 20
firebase deploy
```

**Solution 4: Deploy manually after build**
```powershell
# Step 1: Build
cd client
npm run build
cd ..

# Step 2: Deploy using npx (bypasses global install issues)
npx firebase-tools deploy --only hosting
```

### Build Fails
```powershell
# Clear node_modules and reinstall
cd client
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```

### Deployment Fails
```powershell
# Check Firebase login
firebase login

# Check project
firebase projects:list

# Use correct project
firebase use dressifyclothing-77a5e
```

### Hosting Not Updating
```powershell
# Clear cache and redeploy
firebase deploy --only hosting --force
```

---

## 📦 What Gets Deployed

1. **Hosting** (`client/dist/`)
   - Your React admin panel
   - All static assets
   - Production-optimized build

2. **Firestore Rules** (`firestore.rules`)
   - Security rules for database access

3. **Firestore Indexes** (`firestore.indexes.json`)
   - Custom indexes for queries

4. **Functions** (`functions/`)
   - Cloud Functions (if any)

---

## ✅ Pre-Deployment Checklist

- [ ] Build completes without errors
- [ ] All tests pass (if any)
- [ ] Environment variables set (if needed)
- [ ] Firebase project selected correctly
- [ ] Firestore rules reviewed
- [ ] Indexes are correct

---

## 🚀 Quick Command Reference

```powershell
# Build + Deploy Everything
cd client; npm run build; cd ..; firebase deploy

# Deploy Only Hosting
cd client; npm run build; cd ..; firebase deploy --only hosting

# Deploy Only Firestore
firebase deploy --only firestore

# Check Firebase Status
firebase projects:list
firebase use dressifyclothing-77a5e
```

---

## 📝 Notes

- Always build before deploying hosting
- Firestore rules and indexes can be deployed independently
- First deployment may take longer
- Subsequent deployments are faster (incremental)

---

**Your admin panel will be live after deployment! 🎉**
