// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBCTvglHKm9of6HWAzCVTiAy3p0Td0fSP0",
  authDomain: "dressifyclothing-77a5e.firebaseapp.com",
  projectId: "dressifyclothing-77a5e",
  storageBucket: "dressifyclothing-77a5e.firebasestorage.app",
  messagingSenderId: "207020417667",
  appId: "1:207020417667:web:3d8df44abcb3cc90b2b1b6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;
