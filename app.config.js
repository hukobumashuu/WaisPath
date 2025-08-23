// app.config.js
// SIMPLIFIED: Just Google Maps API key configuration - NO EAS required

import "dotenv/config";

export default {
  expo: {
    name: "WAISPATH",
    slug: "waispath",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      // CRITICAL: iOS Google Maps API key configuration
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "WAISPATH needs location access to provide accessible navigation routes.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "WAISPATH needs location access to provide accessible navigation routes.",
        NSCameraUsageDescription:
          "WAISPATH needs camera access to take photos of accessibility obstacles.",
      },
    },
    android: {
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CAMERA",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
      ],
      // CRITICAL: Android Google Maps API key configuration
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
      package: "com.anonymous.waispath",
    },
    // REMOVED: All EAS and asset references that cause login prompts
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow WAISPATH to use your location.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow WAISPATH to access your camera.",
        },
      ],
    ],
  },
};
