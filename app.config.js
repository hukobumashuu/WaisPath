// app.config.js - WAISPATH Production-Ready Configuration
// Handles multiple environments and deployment scenarios

import "dotenv/config";

// Helper function to get environment-specific values
const getEnvironmentConfig = () => {
  const env = process.env.EXPO_PUBLIC_ENV || "development";
  const isProduction = env === "production";
  const isStaging = env === "staging";
  const isDevelopment = env === "development";

  return {
    env,
    isProduction,
    isStaging,
    isDevelopment,
    // Environment-specific app identifiers
    bundleIdentifier: isProduction
      ? "com.waispath.app"
      : isStaging
      ? "com.waispath.staging"
      : "com.waispath.dev",
    androidPackage: isProduction
      ? "com.waispath.app"
      : isStaging
      ? "com.waispath.staging"
      : "com.waispath.dev",
  };
};

const envConfig = getEnvironmentConfig();

// Validate critical environment variables
const validateConfig = () => {
  const required = [
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error("\n🔧 Please check your .env file");

    // In development, show helpful message but don't crash
    if (envConfig.isDevelopment) {
      console.error(
        "⚠️  App may not function correctly without these variables"
      );
    }
  } else {
    console.log(
      `✅ All required environment variables found for ${envConfig.env}`
    );
  }
};

// Run validation
validateConfig();

export default {
  expo: {
    // ========================================
    // BASIC APP CONFIGURATION
    // ========================================
    name: process.env.EXPO_PUBLIC_APP_NAME || "WAISPATH",
    slug: "waispath",
    version: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",

    // App icon and splash screen
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    // App description and metadata
    description:
      process.env.EXPO_PUBLIC_APP_DESCRIPTION ||
      "Intelligent accessibility navigation for persons with disabilities in Pasig City",

    // Asset bundling
    assetBundlePatterns: ["**/*"],

    // ========================================
    // iOS CONFIGURATION
    // ========================================
    ios: {
      supportsTablet: true,
      bundleIdentifier: envConfig.bundleIdentifier,

      // CRITICAL: iOS Google Maps configuration
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },

      // iOS permissions with accessibility-focused descriptions
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "WAISPATH uses your location to provide accessible navigation routes and identify nearby accessibility features for persons with disabilities.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "WAISPATH needs continuous location access to provide real-time accessibility guidance and proximity alerts for safe navigation.",
        NSCameraUsageDescription:
          "WAISPATH uses the camera to help you document accessibility barriers and contribute to improving accessibility data for the PWD community.",
        NSPhotoLibraryUsageDescription:
          "WAISPATH needs access to your photo library to attach images of accessibility features and obstacles to reports.",
        NSMicrophoneUsageDescription:
          "WAISPATH can use voice input for accessibility reports and navigation commands to improve app accessibility.",
        NSLocationAlwaysUsageDescription:
          "WAISPATH provides continuous accessibility guidance even when running in background.",

        // iOS accessibility features
        UIRequiredDeviceCapabilities: ["location-services"],
        UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],

        // Privacy and security
        ITSAppUsesNonExemptEncryption: false,
      },

      // iOS build configuration
      buildNumber: process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER || "1",

      // iOS deployment target
      deploymentTarget: "13.0",
    },

    // ========================================
    // ANDROID CONFIGURATION
    // ========================================
    android: {
      package: envConfig.androidPackage,
      versionCode: parseInt(
        process.env.EXPO_PUBLIC_ANDROID_VERSION_CODE || "1"
      ),

      // CRITICAL: Android Google Maps configuration
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },

      // Android permissions (accessibility-focused)
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION", // For continuous navigation
        "CAMERA",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
        "RECORD_AUDIO", // For voice commands/accessibility
        "VIBRATE", // For accessibility alerts
        "WAKE_LOCK", // For navigation screen-on
        "ACCESS_NETWORK_STATE",
        "INTERNET",
        "FOREGROUND_SERVICE", // For background navigation
        "FOREGROUND_SERVICE_LOCATION", // Android 14+
      ],

      // Android adaptive icon
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },

      // Android app bundle configuration
      allowBackup: false, // Security best practice

      // Target SDK for modern Android features
      compileSdkVersion: 34,
      targetSdkVersion: 34,
    },

    // ========================================
    // WEB CONFIGURATION (for PWA deployment)
    // ========================================
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",

      // PWA configuration for web accessibility
      config: {
        firebase: {
          apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        },
      },
    },

    // ========================================
    // EXPO PLUGINS CONFIGURATION
    // ========================================
    plugins: [
      // Location services with accessibility descriptions
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow WAISPATH to access your location for accessible navigation.",
          locationAlwaysPermission:
            "Allow WAISPATH to provide continuous accessibility guidance.",
          locationWhenInUsePermission:
            "Allow WAISPATH to show accessible routes near you.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],

      // Camera for accessibility documentation
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow WAISPATH to take photos of accessibility features and barriers.",
          microphonePermission:
            "Allow WAISPATH to record voice notes for accessibility reports.",
          recordAudioAndroid: true,
        },
      ],

      // File system for offline data and caching
      "expo-file-system",

      // Media library for photo management
      [
        "expo-media-library",
        {
          photosPermission:
            "Allow WAISPATH to save and access photos for accessibility reporting.",
          savePhotosPermission:
            "Allow WAISPATH to save accessibility documentation photos.",
        },
      ],

      // Development client for testing
      ...(envConfig.isDevelopment ? ["expo-dev-client"] : []),
    ],

    // ========================================
    // EXPO UPDATES & OTA CONFIGURATION
    // ========================================
    updates: {
      enabled: process.env.EXPO_PUBLIC_OTA_UPDATES_ENABLED === "true",
      checkAutomatically:
        process.env.EXPO_PUBLIC_OTA_CHECK_ON_LAUNCH || "ON_LOAD",
      fallbackToCacheTimeout: 0,
      url: envConfig.isProduction
        ? "https://u.expo.dev/your-production-project-id"
        : undefined,
    },

    // ========================================
    // RUNTIME VERSION & COMPATIBILITY
    // ========================================
    runtimeVersion: {
      policy: "sdkVersion",
    },

    // SDK version
    sdkVersion: "51.0.0",

    // ========================================
    // DEVELOPMENT & DEBUGGING
    // ========================================
    ...(envConfig.isDevelopment && {
      // Development-only settings
      scheme: "waispath-dev",
      debugSkipBundling: false,

      // Development server settings
      packagerOpts: {
        dev: true,
        minify: false,
      },
    }),

    // ========================================
    // PRODUCTION OPTIMIZATIONS
    // ========================================
    ...(envConfig.isProduction && {
      // Production-only settings
      scheme: "waispath",

      // Production optimizations
      packagerOpts: {
        dev: false,
        minify: true,
      },

      // Production metadata
      extra: {
        buildTimestamp: new Date().toISOString(),
        buildEnvironment: "production",
        version: process.env.EXPO_PUBLIC_APP_VERSION,
      },
    }),

    // ========================================
    // EXTRA METADATA FOR APP
    // ========================================
    extra: {
      // Environment information
      environment: envConfig.env,

      // Feature flags from environment
      features: {
        crowdsourcing: process.env.EXPO_PUBLIC_CROWDSOURCING_ENABLED === "true",
        voiceGuidance:
          process.env.EXPO_PUBLIC_VOICE_GUIDANCE_ENABLED === "true",
        offlineMode: process.env.EXPO_PUBLIC_OFFLINE_MODE_ENABLED === "true",
        betaFeatures: process.env.EXPO_PUBLIC_ENABLE_BETA_FEATURES === "true",
      },

      // PWD-specific configuration
      accessibility: {
        targetCity: process.env.EXPO_PUBLIC_TARGET_CITY || "Pasig",
        targetRegion: process.env.EXPO_PUBLIC_TARGET_REGION || "Philippines",
        defaultMobilityProfile:
          process.env.EXPO_PUBLIC_DEFAULT_MOBILITY_PROFILE || "wheelchair",
        proximityRadius: parseInt(
          process.env.EXPO_PUBLIC_PROXIMITY_DETECTION_RADIUS || "25"
        ),
      },

      // Build information
      buildInfo: {
        buildTime: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        expoEnv: process.env.EXPO_PUBLIC_ENV,
      },
    },
  },
};

// Log configuration summary (without exposing keys)
console.log(`\n🚀 WAISPATH Configuration Summary:`);
console.log(`   Environment: ${envConfig.env}`);
console.log(`   Bundle ID: ${envConfig.bundleIdentifier}`);
console.log(
  `   Google Maps: ${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? "✅" : "❌"}`
);
console.log(
  `   Firebase: ${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ? "✅" : "❌"}`
);
console.log(
  `   Features: Crowdsourcing=${process.env.EXPO_PUBLIC_CROWDSOURCING_ENABLED}, Voice=${process.env.EXPO_PUBLIC_VOICE_GUIDANCE_ENABLED}`
);
console.log("=".repeat(50));
