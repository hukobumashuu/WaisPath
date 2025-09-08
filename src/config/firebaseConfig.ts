// src/config/firebaseConfig.ts
// FIREBASE CONFIG - Prefer 'firebase/auth/react-native' for persistence,
// fall back gracefully to memory-only auth if persistence cannot be established.

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
  const requiredEnvVars = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingVars.join(", ")}`
    );
  }

  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  };
}

// SINGLETONS - shared across the app
let globalFirebaseApp: any = null;
let globalFirebaseAuth: any = null;
let globalFirebaseDb: any = null;
let initializationPromise: Promise<void> | null = null;

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
        const config = getFirebaseConfig();
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
          return;
        } else {
          console.warn(
            "react-native auth entrypoint imported but required functions missing."
          );
        }
      } catch (rnErr) {
        // non-fatal: log and continue to fallback
        console.warn(
          "'firebase/auth/react-native' not available or failed:",
          rnErr
        );
      }

      // Try 2: Main firebase/auth (may not expose RN persistence) - safe guard
      try {
        console.log("Attempting auth init using 'firebase/auth' (fallback)...");
        const authMain = await import("firebase/auth");
        // some sdk builds may provide these functions as named exports
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
          return;
        }

        if (typeof getAuth === "function") {
          globalFirebaseAuth = getAuth(globalFirebaseApp);
          console.log("⚠️ Firebase Auth initialized (memory-only via getAuth)");
          return;
        }

        console.warn(
          "Fallback 'firebase/auth' did not provide usable API for persistence."
        );
      } catch (fallbackErr) {
        console.warn("Fallback 'firebase/auth' attempt failed:", fallbackErr);
      }

      // Final fallback: try initializeAuth without persistence or getAuth one last time
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
          return;
        }

        if (typeof (authMain2 as any).getAuth === "function") {
          globalFirebaseAuth = (authMain2 as any).getAuth(globalFirebaseApp);
          console.log(
            "⚠️ Firebase Auth initialized via getAuth() (memory-only)"
          );
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
