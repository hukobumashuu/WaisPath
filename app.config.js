// app.config.js
// WAISPATH Expo Configuration with Environment Variables
// This file handles environment-based configuration for Firebase and other services

import "dotenv/config";

export default {
  expo: {
    name: process.env.EXPO_PUBLIC_APP_NAME || "WAISPATH",
    slug: "waispath",
    version: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.waispath.app",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.waispath.app",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow WAISPATH to use your location to provide accessible navigation routes in Pasig City.",
        },
      ],
    ],
    extra: {
      // Firebase Configuration
      firebase: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      },

      // Google Maps Configuration
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
        placesApiKey: process.env.GOOGLE_PLACES_API_KEY,
      },

      // App Settings
      app: {
        environment: process.env.EXPO_PUBLIC_ENV || "development",
        targetCity: process.env.EXPO_PUBLIC_TARGET_CITY || "Pasig",
        debugMode: process.env.EXPO_PUBLIC_DEBUG_MODE === "true",
        logLevel: process.env.EXPO_PUBLIC_LOG_LEVEL || "info",
      },

      // Development Settings
      development: {
        useFirebaseEmulator:
          process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === "true",
      },
    },
  },
};
