# Deployment Guide

This guide will help you deploy your Inventory Dashboard to Firebase.

## Prerequisites

1. **Firebase CLI installed**: If not installed, run:
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Login**: Make sure you're logged in:
   ```bash
   firebase login
   ```

3. **Verify Firebase Project**: Check your project is set correctly:
   ```bash
   firebase projects:list
   ```

## Deployment Steps

### Step 1: Build the Client Application

First, build the React app for production:

```bash
cd client
npm run build
```

This will create a `dist` folder in the `client` directory with optimized production files.

### Step 2: Deploy Firestore Indexes (Important!)

Before deploying, make sure all Firestore indexes are created:

```bash
firebase deploy --only firestore:indexes
```

**Note**: If you see errors about missing indexes, Firebase will provide a link to create them in the Firebase Console. Click the link and create the indexes, then retry.

### Step 3: Deploy Firestore Rules

Deploy your Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

### Step 4: Deploy Hosting (Frontend)

Deploy your React app to Firebase Hosting:

```bash
firebase deploy --only hosting
```

Or use the npm script from the root:

```bash
npm run firebase:deploy:hosting
```

### Step 5: Deploy Cloud Functions (Optional)

If you want to deploy email notification functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

**Note**: Before deploying functions, you need to configure email credentials:
```bash
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password" email.admin="admin@example.com"
```

## Quick Deploy (All at Once)

To deploy everything at once:

```bash
# From project root
npm run build
firebase deploy
```

This will deploy:
- Firestore indexes
- Firestore rules
- Hosting
- Functions (if configured)

## Post-Deployment

After deployment:

1. **Check your site**: Visit your Firebase Hosting URL (shown in the deployment output)
2. **Verify Firestore**: Check that indexes are building in Firebase Console
3. **Test functionality**: Test all features to ensure everything works

## Troubleshooting

### Build Errors
- Make sure all dependencies are installed: `cd client && npm install`
- Check for TypeScript/ESLint errors

### Firestore Index Errors
- If indexes are missing, Firebase will provide a link to create them
- Wait for indexes to finish building before testing queries

### Hosting Not Updating
- Clear browser cache
- Check Firebase Console > Hosting for deployment status

### Functions Not Working
- Verify email credentials are configured
- Check function logs: `firebase functions:log`

## Environment Variables

If you need environment variables for the client app, create a `.env` file in the `client` directory:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
```

Then rebuild: `cd client && npm run build`

## Firebase Console Links

- **Project Dashboard**: https://console.firebase.google.com/project/dressifyclothing-77a5e
- **Hosting**: https://console.firebase.google.com/project/dressifyclothing-77a5e/hosting
- **Firestore**: https://console.firebase.google.com/project/dressifyclothing-77a5e/firestore
- **Functions**: https://console.firebase.google.com/project/dressifyclothing-77a5e/functions
