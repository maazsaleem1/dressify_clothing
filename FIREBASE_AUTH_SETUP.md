# 🔐 Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for your admin panel.

---

## ✅ What's Already Done

1. ✅ Firebase Auth initialized in `firebase-config.js`
2. ✅ Login page created at `/login`
3. ✅ Authentication context created for state management
4. ✅ Protected routes implemented
5. ✅ Logout functionality added to Layout

---

## 🚀 Setup Steps

### Step 1: Enable Email/Password Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `dressifyclothing-77a5e`
3. Navigate to **Authentication** in the left sidebar
4. Click **Get Started** (if not already enabled)
5. Go to the **Sign-in method** tab
6. Click on **Email/Password**
7. Enable **Email/Password** (toggle ON)
8. Click **Save**

---

### Step 2: Create Admin User Account

#### Option A: Create User in Firebase Console (Recommended)

1. In Firebase Console → **Authentication** → **Users** tab
2. Click **Add user**
3. Enter your email address (e.g., `admin@dressify.com`)
4. Enter a secure password
5. Click **Add user**
6. **Save these credentials securely!**

#### Option B: Create User Programmatically (First Time Only)

You can create the first admin user by temporarily adding this code to your Login component, then remove it after creating the account:

```javascript
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase-config';

// Temporary function - remove after creating account
const createAdmin = async () => {
  try {
    await createUserWithEmailAndPassword(auth, 'your-email@example.com', 'your-secure-password');
    console.log('Admin user created!');
  } catch (error) {
    console.error('Error creating user:', error);
  }
};
```

---

### Step 3: Test the Login

1. Start your development server:
   ```powershell
   cd client
   npm run dev
   ```

2. Navigate to `http://localhost:5173/login`
3. Enter your email and password
4. You should be redirected to the dashboard upon successful login

---

## 🔒 Security Features

### What's Protected

- ✅ All admin panel routes require authentication
- ✅ Unauthenticated users are redirected to `/login`
- ✅ Session persists across page refreshes
- ✅ Automatic logout on authentication state change

### Route Protection

All routes are wrapped in `ProtectedRoute` component:
- `/` - Dashboard
- `/inventory` - Inventory Management
- `/brands-categories` - Brands & Categories
- `/customers` - Customers
- `/sales` - Sales & Credit
- `/production` - Production
- `/reports` - Reports
- `/slider` - Homepage Slider
- `/orders` - Orders
- `/reviews` - Reviews

---

## 📝 File Structure

```
client/src/
├── contexts/
│   └── AuthContext.jsx          # Authentication state management
├── components/
│   ├── ProtectedRoute.jsx       # Route protection component
│   └── Layout.jsx                # Updated with logout button
├── pages/
│   └── Login.jsx                 # Login page
├── firebase-config.js            # Updated with Firebase Auth
└── App.jsx                        # Updated with AuthProvider
```

---

## 🎯 Usage

### Login

1. User visits any protected route
2. Automatically redirected to `/login` if not authenticated
3. Enter email and password
4. Upon successful login, redirected to dashboard

### Logout

1. Click **Logout** button in the sidebar footer
2. Confirm logout
3. Redirected to `/login` page

### Check Authentication Status

```javascript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { currentUser, logout } = useAuth();
  
  // currentUser is null if not logged in
  // currentUser.email - user's email
  // logout() - function to sign out
};
```

---

## 🔧 Customization

### Change Login Page Styling

Edit `client/src/pages/Login.jsx` to customize:
- Colors
- Logo
- Layout
- Error messages

### Add More Authentication Methods

To add Google Sign-In or other providers:

1. Enable provider in Firebase Console
2. Update `AuthContext.jsx`:
   ```javascript
   import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
   
   const googleLogin = async () => {
     const provider = new GoogleAuthProvider();
     return await signInWithPopup(auth, provider);
   };
   ```

---

## 🚨 Important Security Notes

1. **Never commit credentials** - Keep your admin email/password secure
2. **Use strong passwords** - Minimum 8 characters, mix of letters, numbers, symbols
3. **Firestore Rules** - Update Firestore security rules to require authentication:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
4. **Deploy rules**:
   ```powershell
   firebase deploy --only firestore:rules
   ```

---

## 🐛 Troubleshooting

### "User not found" Error

- Make sure you've created the user in Firebase Console
- Check that Email/Password authentication is enabled

### "Invalid email" Error

- Verify email format is correct
- Check that the email exists in Firebase Authentication

### "Wrong password" Error

- Reset password in Firebase Console if needed
- Or create a new user account

### Redirect Loop

- Clear browser cache and cookies
- Check that `AuthContext` is properly wrapping your app

---

## ✅ Checklist

- [ ] Email/Password authentication enabled in Firebase Console
- [ ] Admin user account created
- [ ] Tested login functionality
- [ ] Tested logout functionality
- [ ] Verified routes are protected
- [ ] Updated Firestore security rules (optional but recommended)

---

## 📞 Support

If you encounter any issues:
1. Check browser console for errors
2. Verify Firebase Authentication is enabled
3. Ensure user account exists in Firebase Console
4. Check that all dependencies are installed

---

**Your admin panel is now secure! 🔒**
