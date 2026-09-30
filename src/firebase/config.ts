import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: "AIzaSyDNhi_6l-X9qoBXnFzMQEQcZLNpDjET8Pc",
  authDomain: "the-shade-store-2335e.firebaseapp.com",
  projectId: "the-shade-store-2335e",
  storageBucket: "the-shade-store-2335e.firebasestorage.app",
  messagingSenderId: "457319925727",
  appId: "1:457319925727:web:e8ae022b9169b2933d666a",
  measurementId: "G-XBLK7SW84G"
};

// Initialize Firebase safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Analytics conditionally if supported in environment
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  }).catch(() => {
    // Ignore analytics unsupported error in non-standard browser contexts
  });
}
