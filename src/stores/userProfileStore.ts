// src/stores/userProfileStore.ts
// Hybrid User Profile Store - Local AsyncStorage + Optional Firebase
// Maintains 100% backward compatibility with existing onboarding flow

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserMobilityProfile, ObstacleType } from "../types";

// Optional Firebase - only import if we want to try cloud sync
let firebaseServices: any = null;
try {
  // Dynamically import Firebase services - if it fails, we continue without it
  import("../services/firebase")
    .then((module) => {
      firebaseServices = module.firebaseServices;
      console.log("🔥 Firebase services loaded for optional sync");
    })
    .catch((error) => {
      console.log("📱 Running in local-only mode (Firebase unavailable)");
    });
} catch (error) {
  console.log("📱 Firebase not available, using local storage only");
}

interface UserProfileState {
  profile: UserMobilityProfile | null;
  isFirstTime: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  syncStatus: "local_only" | "synced" | "sync_pending" | "sync_failed";
  lastSyncError: string | null;

  // Actions (unchanged from original - perfect backward compatibility)
  setProfile: (profile: UserMobilityProfile) => void;
  updatePreferences: (preferences: Partial<UserMobilityProfile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;

  // Hybrid storage actions
  loadProfile: () => Promise<void>;
  saveProfileLocally: (profile: UserMobilityProfile) => Promise<void>;
  syncToCloud: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncStatus: (status: UserProfileState["syncStatus"]) => void;
}

// Local storage keys
const STORAGE_KEYS = {
  PROFILE: "@waispath:userProfile",
  FIRST_TIME: "@waispath:isFirstTime",
  LAST_SYNC: "@waispath:lastSync",
};

// Smart defaults for each mobility device type (unchanged from original)
const DEVICE_DEFAULTS = {
  wheelchair: {
    maxRampSlope: 5, // Conservative slope for wheelchair users
    minPathWidth: 90, // 90cm for wheelchair + buffer
    avoidStairs: true,
    avoidCrowds: true, // Harder to navigate crowds
    preferShade: true,
    maxWalkingDistance: 800, // meters before rest needed
  },
  walker: {
    maxRampSlope: 7, // Gentle slopes for stability
    minPathWidth: 75, // Walker width + buffer
    avoidStairs: true,
    avoidCrowds: false,
    preferShade: true,
    maxWalkingDistance: 400, // Shorter distances for walker users
  },
  cane: {
    maxRampSlope: 12, // Can handle steeper slopes
    minPathWidth: 60, // Standard sidewalk width
    avoidStairs: false, // Can use stairs if needed
    avoidCrowds: false,
    preferShade: true, // Still important in PH heat
    maxWalkingDistance: 600,
  },
  crutches: {
    maxRampSlope: 10,
    minPathWidth: 65, // Crutches need a bit more space
    avoidStairs: false, // Can handle stairs
    avoidCrowds: true, // Harder to balance in crowds
    preferShade: true,
    maxWalkingDistance: 300, // Crutches are tiring
  },
  none: {
    maxRampSlope: 15, // Can handle standard slopes
    minPathWidth: 50, // Just body width
    avoidStairs: false,
    avoidCrowds: false,
    preferShade: false, // Optional preference
    maxWalkingDistance: 1000, // Longer walking capability
  },
};

export const useUserProfile = create<UserProfileState>((set, get) => ({
  profile: null,
  isFirstTime: true,
  isLoading: false,
  isSyncing: false,
  syncStatus: "local_only",
  lastSyncError: null,

  // Original actions - ZERO CHANGES for backward compatibility
  setProfile: (profile: UserMobilityProfile) => {
    set({ profile, isFirstTime: false });

    // Save locally immediately (non-blocking)
    const { saveProfileLocally } = get();
    saveProfileLocally(profile).catch((error: any) => {
      console.warn("Local save failed:", error);
    });

    // Try cloud sync in background (optional, non-blocking)
    const { syncToCloud } = get();
    syncToCloud().catch((error: any) => {
      console.log("Background cloud sync skipped:", error.message);
      set({ syncStatus: "sync_pending" });
    });
  },

  updatePreferences: (preferences: Partial<UserMobilityProfile>) => {
    const currentProfile = get().profile;
    if (currentProfile) {
      const updatedProfile = {
        ...currentProfile,
        ...preferences,
        lastUpdated: new Date(),
      };

      // Use setProfile to trigger all the same logic
      const { setProfile } = get();
      setProfile(updatedProfile);
    }
  },

  completeOnboarding: () => {
    set({ isFirstTime: false });

    // Save onboarding completion locally
    AsyncStorage.setItem(STORAGE_KEYS.FIRST_TIME, "false").catch(
      (error: any) => {
        console.warn("Failed to save onboarding status:", error);
      }
    );
  },

  resetProfile: () => {
    set({
      profile: null,
      isFirstTime: true,
      syncStatus: "local_only",
      lastSyncError: null,
    });

    // Clear local storage
    Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.PROFILE),
      AsyncStorage.setItem(STORAGE_KEYS.FIRST_TIME, "true"),
    ]).catch((error: any) => {
      console.warn("Failed to clear local storage:", error);
    });

    // Try to delete from cloud (optional)
    if (firebaseServices) {
      firebaseServices.profile.deleteProfile().catch((error: any) => {
        console.log("Cloud delete skipped:", error.message);
      });
    }
  },

  // Hybrid storage implementation
  loadProfile: async () => {
    const { setLoading, setSyncStatus } = get();

    try {
      setLoading(true);

      // 1. Load from local storage first (always works)
      const [profileData, firstTimeData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.FIRST_TIME),
      ]);

      if (profileData) {
        const profile = JSON.parse(profileData);
        // Convert date strings back to Date objects
        if (profile.createdAt) profile.createdAt = new Date(profile.createdAt);
        if (profile.lastUpdated)
          profile.lastUpdated = new Date(profile.lastUpdated);

        set({
          profile,
          isFirstTime: firstTimeData !== "false",
          syncStatus: "local_only",
        });

        console.log("📱 Profile loaded from local storage");
      } else {
        set({ isFirstTime: true });
        console.log("📭 No local profile found");
      }

      // 2. Try to sync with cloud in background (optional)
      if (firebaseServices) {
        get()
          .syncToCloud()
          .catch((error: any) => {
            console.log("Background cloud sync failed:", error.message);
            setSyncStatus("sync_failed");
          });
      }
    } catch (error: any) {
      console.error("❌ Failed to load profile from local storage:", error);
      set({ isFirstTime: true });
    } finally {
      setLoading(false);
    }
  },

  saveProfileLocally: async (profile: UserMobilityProfile) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      console.log("💾 Profile saved to local storage");
    } catch (error: any) {
      console.error("❌ Failed to save profile locally:", error);
      throw error;
    }
  },

  syncToCloud: async () => {
    const { profile, setSyncing, setSyncStatus } = get();

    if (!profile || !firebaseServices) {
      console.log("☁️ Cloud sync skipped (no profile or Firebase unavailable)");
      return;
    }

    try {
      setSyncing(true);
      setSyncStatus("sync_pending");

      await firebaseServices.profile.saveProfile(profile);

      setSyncStatus("synced");
      console.log("☁️ Profile synced to cloud");

      // Update last sync timestamp
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_SYNC,
        new Date().toISOString()
      );
    } catch (error: any) {
      console.log(
        "☁️ Cloud sync failed (continuing with local):",
        error.message
      );
      setSyncStatus("sync_failed");
      set({ lastSyncError: "Cloud sync failed - data saved locally" });
    } finally {
      setSyncing(false);
    }
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setSyncing: (syncing: boolean) => {
    set({ isSyncing: syncing });
  },

  setSyncStatus: (status: UserProfileState["syncStatus"]) => {
    set({ syncStatus: status });
  },
}));

// Helper functions (unchanged from original - perfect compatibility)
export const createProfileWithDefaults = (
  deviceType: UserMobilityProfile["type"],
  customPreferences?: Partial<UserMobilityProfile>
): UserMobilityProfile => {
  const defaults = DEVICE_DEFAULTS[deviceType];
  const now = new Date();

  return {
    id: `profile_${deviceType}_${Date.now()}`,
    type: deviceType,
    ...defaults,
    ...customPreferences,
    createdAt: now,
    lastUpdated: now,
  };
};

export const getAccessibilityRequirements = (profile: UserMobilityProfile) => {
  return {
    criticalRequirements: {
      maxSlope: profile.maxRampSlope,
      minWidth: profile.minPathWidth,
      avoidStairs: profile.avoidStairs,
      avoidCrowds: profile.avoidCrowds,
    },
    preferences: {
      preferShade: profile.preferShade,
      maxDistance: profile.maxWalkingDistance,
    },
    contextualNeeds: {
      deviceType: profile.type,
      mobilityLevel:
        profile.type === "wheelchair"
          ? "high_support"
          : profile.type === "walker"
          ? "medium_support"
          : "low_support",
    },
  };
};

export const isObstacleBlocking = (
  obstacle: {
    type: ObstacleType;
    severity: "low" | "medium" | "high" | "blocking";
  },
  profile: UserMobilityProfile
): boolean => {
  // Always blocking obstacles
  if (obstacle.severity === "blocking") return true;

  // Device-specific blocking conditions
  const isWheelchairUser = profile.type === "wheelchair";
  const isWalkerUser = profile.type === "walker";

  switch (obstacle.type) {
    case "stairs_no_ramp":
      return profile.avoidStairs;

    case "narrow_passage":
      return (
        obstacle.severity === "high" ||
        (isWheelchairUser && obstacle.severity === "medium")
      );

    case "vendor_blocking":
      return profile.avoidCrowds && obstacle.severity !== "low";

    case "broken_pavement":
      return (isWheelchairUser || isWalkerUser) && obstacle.severity !== "low";

    case "flooding":
      return obstacle.severity !== "low"; // Everyone avoids significant flooding

    default:
      return obstacle.severity === "high";
  }
};

// Auto-initialize profile store with local loading
let isInitialized = false;
export const getInitializedProfileStore = () => {
  if (!isInitialized) {
    const store = useUserProfile.getState();
    store.loadProfile().catch((error: any) => {
      console.warn("Failed to auto-load profile:", error);
    });
    isInitialized = true;
  }
  return useUserProfile;
};
