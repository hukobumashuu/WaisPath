// src/config/firebaseConfig.ts
// FIREBASE CONFIG - FIXED: Waits for initial auth state before resolving
// Prevents race conditions between Firebase restoration and app startup

import AsyncStorage from "@react-native-async-storage/async-storage";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function validateFirebaseConfig(): FirebaseConfig {
  // Hardcoded config as fallback (same approach as your Google Maps API key)
  const hardcodedConfig = {
    apiKey: "AIzaSyCWXKiwkXZh8DRql14JBs9aN6icBe1MHxg",
    authDomain: "waispath-4dbf1.firebaseapp.com",
    projectId: "waispath-4dbf1",
    storageBucket: "waispath-4dbf1.firebasestorage.app",
    messagingSenderId: "483457985900",
    appId: "1:483457985900:android:2916f46dac322a430d5749",
  };

  // Try environment variables first, fall back to hardcoded
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || hardcodedConfig.apiKey,
    authDomain:
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      hardcodedConfig.authDomain,
    projectId:
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || hardcodedConfig.projectId,
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      hardcodedConfig.storageBucket,
    messagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      hardcodedConfig.messagingSenderId,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || hardcodedConfig.appId,
  };
}

// SINGLETONS - shared across the app
let globalFirebaseApp: any = null;
let globalFirebaseAuth: any = null;
let globalFirebaseDb: any = null;
let initializationPromise: Promise<void> | null = null;

// NEW: Helper to wait for initial auth state restoration
function waitForInitialAuthState(
  authInstance: any,
  timeoutMs = 5000
): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("Auth init: timeout waiting for initial auth state");
        resolve();
      }
    }, timeoutMs);

    try {
      const unsubscribe = authInstance.onAuthStateChanged((user: any) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            unsubscribe();
          } catch (e) {}
          console.log("Auth init: initial onAuthStateChanged fired", {
            uid: user?.uid,
            isAnonymous: user?.isAnonymous,
            email: user?.email,
          });
          resolve();
        }
      });
    } catch (e) {
      console.warn("Auth init: onAuthStateChanged not available or threw", e);
      clearTimeout(timer);
      resolve();
    }
  });
}

async function initializeFirebaseOnce(): Promise<void> {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (globalFirebaseApp && globalFirebaseAuth && globalFirebaseDb) return;

    try {
      console.log("🔥 Initializing Firebase (unified)");
      const { initializeApp, getApps } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore");

      // init app
      const existingApps = getApps();
      if (existingApps.length > 0) {
        globalFirebaseApp = existingApps[0];
        console.log("Using existing Firebase app instance");
      } else {
        const config = validateFirebaseConfig();
        globalFirebaseApp = initializeApp(config);
        console.log("Firebase app initialized");
      }

      // init firestore
      globalFirebaseDb = getFirestore(globalFirebaseApp);

      // Try 1: React Native specific entrypoint (preferred)
      try {
        console.log(
          "Attempting auth init using 'firebase/auth/react-native' (preferred)..."
        );
        const rnAuth = await import("firebase/auth/react-native");
        const { initializeAuth, getReactNativePersistence } = rnAuth as any;

        if (
          typeof initializeAuth === "function" &&
          typeof getReactNativePersistence === "function"
        ) {
          const persistence = getReactNativePersistence(AsyncStorage);
          globalFirebaseAuth = initializeAuth(globalFirebaseApp, {
            persistence,
          });
          console.log(
            "✅ Firebase Auth initialized WITH AsyncStorage persistence (react-native entrypoint)"
          );

          // NEW: Wait for initial auth state before resolving
          await waitForInitialAuthState(globalFirebaseAuth);
          return;
        } else {
          console.warn(
            "react-native auth entrypoint imported but required functions missing."
          );
        }
      } catch (rnErr) {
        console.warn(
          "'firebase/auth/react-native' not available or failed:",
          rnErr
        );
      }

      // Try 2: Main firebase/auth (may not expose RN persistence)
      try {
        console.log("Attempting auth init using 'firebase/auth' (fallback)...");
        const authMain = await import("firebase/auth");
        const initializeAuth = (authMain as any).initializeAuth;
        const getReactNativePersistence = (authMain as any)
          .getReactNativePersistence;
        const getAuth = (authMain as any).getAuth;

        if (
          typeof getReactNativePersistence === "function" &&
          typeof initializeAuth === "function"
        ) {
          const persistence = getReactNativePersistence(AsyncStorage);
          globalFirebaseAuth = initializeAuth(globalFirebaseApp, {
            persistence,
          });
          console.log(
            "✅ Firebase Auth initialized WITH AsyncStorage persistence (firebase/auth)"
          );

          // NEW: Wait for initial auth state before resolving
          await waitForInitialAuthState(globalFirebaseAuth);
          return;
        }

        if (typeof getAuth === "function") {
          globalFirebaseAuth = getAuth(globalFirebaseApp);
          console.log("⚠️ Firebase Auth initialized (memory-only via getAuth)");

          // NEW: Still wait for initial state even in memory-only mode
          await waitForInitialAuthState(globalFirebaseAuth);
          return;
        }

        console.warn(
          "Fallback 'firebase/auth' did not provide usable API for persistence."
        );
      } catch (fallbackErr) {
        console.warn("Fallback 'firebase/auth' attempt failed:", fallbackErr);
      }

      // Final fallback: try initializeAuth without persistence
      try {
        console.log(
          "Final fallback: attempt initializeAuth() or getAuth() (memory-only)..."
        );
        const authMain2 = await import("firebase/auth");
        if (typeof (authMain2 as any).initializeAuth === "function") {
          globalFirebaseAuth = (authMain2 as any).initializeAuth(
            globalFirebaseApp
          );
          console.log(
            "⚠️ Firebase Auth initialized via initializeAuth() (memory-only)"
          );

          // NEW: Wait for initial auth state
          await waitForInitialAuthState(globalFirebaseAuth);
          return;
        }

        if (typeof (authMain2 as any).getAuth === "function") {
          globalFirebaseAuth = (authMain2 as any).getAuth(globalFirebaseApp);
          console.log(
            "⚠️ Firebase Auth initialized via getAuth() (memory-only)"
          );

          // NEW: Wait for initial auth state
          await waitForInitialAuthState(globalFirebaseAuth);
          return;
        }

        throw new Error(
          "No usable auth initialization function found in 'firebase/auth'."
        );
      } catch (finalErr) {
        console.error(
          "Unable to initialize Firebase Auth (final fallback failed):",
          finalErr
        );
        throw finalErr;
      }
    } catch (err) {
      console.error("❌ Firebase initialization failed:", err);
      throw err;
    }
  })();

  return initializationPromise;
}

export async function getUnifiedFirebaseAuth() {
  await initializeFirebaseOnce();
  return globalFirebaseAuth;
}

export async function getUnifiedFirebaseApp() {
  await initializeFirebaseOnce();
  return globalFirebaseApp;
}

export async function getUnifiedFirebaseDb() {
  await initializeFirebaseOnce();
  return globalFirebaseDb;
}

export function getFirebaseConfig(): FirebaseConfig {
  return validateFirebaseConfig();
}

export function isFirebaseConfigured(): boolean {
  try {
    validateFirebaseConfig();
    return true;
  } catch {
    return false;
  }
}

export function clearFirebaseInstances(): void {
  globalFirebaseApp = null;
  globalFirebaseAuth = null;
  globalFirebaseDb = null;
  initializationPromise = null;
  console.log("🧹 Firebase instances cleared");
}

if (__DEV__) {
  console.log(
    "🔥 Firebase configuration:",
    isFirebaseConfigured() ? "✅ Valid" : "❌ Invalid"
  );
}
