// src/config/firebaseConfig.ts
// Secure Firebase Configuration with Validation

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Validates Firebase configuration from environment variables
 * Throws error if any required config is missing
 */
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
    console.error("🚨 Missing required Firebase environment variables:");
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error("");
    console.error(
      "Please check your .env file and ensure all Firebase config variables are set."
    );
    console.error("See .env.example for the required format.");

    throw new Error(
      `Missing Firebase configuration: ${missingVars.join(", ")}`
    );
  }

  // Additional validation: check if keys look valid
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY!;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!;

  if (!apiKey.startsWith("AIza")) {
    throw new Error("Invalid Firebase API key format");
  }

  if (projectId.length < 6) {
    throw new Error("Invalid Firebase project ID format");
  }

  return {
    apiKey,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  };
}

/**
 * Get validated Firebase configuration
 * Use this instead of directly accessing process.env
 */
export function getFirebaseConfig(): FirebaseConfig {
  try {
    return validateFirebaseConfig();
  } catch (error) {
    console.error("🚨 Firebase configuration error:", error);

    // In development, show helpful error
    if (__DEV__) {
      throw error;
    }

    // In production, fail gracefully
    throw new Error("Firebase configuration error. Please contact support.");
  }
}

/**
 * Check if Firebase is properly configured
 * Returns boolean instead of throwing
 */
export function isFirebaseConfigured(): boolean {
  try {
    validateFirebaseConfig();
    return true;
  } catch {
    return false;
  }
}

// Log configuration status (without exposing keys)
if (__DEV__) {
  if (isFirebaseConfigured()) {
    console.log("🔥 Firebase configuration: ✅ Valid");
  } else {
    console.log("🔥 Firebase configuration: ❌ Invalid or missing");
  }
}
