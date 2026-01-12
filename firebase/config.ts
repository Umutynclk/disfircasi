import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY !,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID !,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID !,
};

// Firebase'i sadece bir kez initialize et
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;
let analyticsInstance: Analytics | undefined;

const initializeFirebase = () => {
  // Sadece client-side'da çalış
  if (typeof window === 'undefined') {
    return;
  }

  // Zaten initialize edilmişse tekrar etme
  if (app) {
    return;
  }

  // Firebase app'i initialize et
  if (!getApps().length) {
    // Config boş değilse initialize et, yoksa demo config kullan
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = initializeApp(firebaseConfig);
    } else {
      // Demo mode - gerçek Firebase olmadan çalışabilir
      console.warn('Firebase config bulunamadı, demo mode aktif');
      return;
    }
  } else {
    app = getApps()[0];
  }

  // Servisleri initialize et
  if (app) {
    try {
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
      storageInstance = getStorage(app);
      // Analytics lazy initialize edilecek (getFirebaseAnalytics fonksiyonunda)
    } catch (error) {
      console.error('Firebase servisleri initialize edilemedi:', error);
    }
  }
};

// Analytics'i lazy initialize et (sadece gerektiğinde)
const initializeAnalytics = async () => {
  if (typeof window === 'undefined' || analyticsInstance || !app || !firebaseConfig.measurementId) {
    return;
  }

  try {
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  } catch (error) {
    console.warn('Analytics desteklenmiyor:', error);
  }
};

// Client-side'da initialize et
if (typeof window !== 'undefined') {
  initializeFirebase();
}

// Helper function - db instance döndürür veya hata fırlatır
export const getFirestoreDB = (): Firestore => {
  if (!dbInstance) {
    if (typeof window !== 'undefined') {
      initializeFirebase();
      if (dbInstance) return dbInstance;
    }
    throw new Error('Firestore is not initialized. Please check your Firebase configuration.');
  }
  return dbInstance;
};

// Helper function - auth instance döndürür veya hata fırlatır
export const getFirebaseAuth = (): Auth => {
  if (!authInstance) {
    if (typeof window !== 'undefined') {
      initializeFirebase();
      if (authInstance) return authInstance;
    }
    throw new Error('Firebase Auth is not initialized. Please check your Firebase configuration.');
  }
  return authInstance;
};

// Helper function - storage instance döndürür veya hata fırlatır
export const getFirebaseStorage = (): FirebaseStorage => {
  if (!storageInstance) {
    if (typeof window !== 'undefined') {
      initializeFirebase();
      if (storageInstance) return storageInstance;
    }
    throw new Error('Firebase Storage is not initialized. Please check your Firebase configuration.');
  }
  return storageInstance;
};

// Helper function - analytics instance döndürür (opsiyonel, sadece client-side)
// Promise döndürür çünkü async initialize edilir
export const getFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!analyticsInstance) {
    await initializeAnalytics();
  }
  
  return analyticsInstance || null;
};

// Direct exports - kullanımda null check yapılmalı veya helper functions kullanılmalı
// Demo mode için: Firebase config yoksa undefined olabilir, bu durumda try-catch kullanın
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
// Analytics için getFirebaseAnalytics() veya lib/firebase/analytics.ts'deki helper'ları kullanın

export default app;



