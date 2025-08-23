// src/stores/userProfileStore.ts
// Hybrid User Profile Store - FIXED VERSION with all required fields

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

  // Actions
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

// FIXED: Complete defaults for each mobility device type
const DEVICE_DEFAULTS = {
  wheelchair: {
    maxRampSlope: 5,
    minPathWidth: 90,
    avoidStairs: true,
    avoidCrowds: true,
    preferShade: true,
    maxWalkingDistance: 800, // FIXED: Was missing!
  },
  walker: {
    maxRampSlope: 7,
    minPathWidth: 75,
    avoidStairs: true,
    avoidCrowds: false,
    preferShade: true,
    maxWalkingDistance: 400, // FIXED: Was missing!
  },
  cane: {
    maxRampSlope: 12,
    minPathWidth: 60,
    avoidStairs: false,
    avoidCrowds: false,
    preferShade: true,
    maxWalkingDistance: 600, // FIXED: Was missing!
  },
  crutches: {
    maxRampSlope: 10,
    minPathWidth: 65,
    avoidStairs: false,
    avoidCrowds: true,
    preferShade: true,
    maxWalkingDistance: 300, // FIXED: Was missing!
  },
  none: {
    maxRampSlope: 15,
    minPathWidth: 50,
    avoidStairs: false,
    avoidCrowds: false,
    preferShade: false,
    maxWalkingDistance: 1000, // FIXED: Was missing!
  },
};

export const useUserProfile = create<UserProfileState>((set, get) => ({
  profile: null,
  isFirstTime: true,
  isLoading: false,
  isSyncing: false,
  syncStatus: "local_only",
  lastSyncError: null,

  setProfile: (profile: UserMobilityProfile) => {
    set({ profile, isFirstTime: false });

    // Save locally immediately
    const { saveProfileLocally } = get();
    saveProfileLocally(profile).catch((error: any) => {
      console.warn("❌ Failed to save profile:", error.message);
    });

    // Try cloud sync in background
    const { syncToCloud } = get();
    syncToCloud().catch((error: any) => {
      console.log(
        "☁️ Cloud sync failed (continuing with local):",
        error.message
      );
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

      const { setProfile } = get();
      setProfile(updatedProfile);
    }
  },

  completeOnboarding: () => {
    set({ isFirstTime: false });
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

    Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.PROFILE),
      AsyncStorage.setItem(STORAGE_KEYS.FIRST_TIME, "true"),
    ]).catch((error: any) => {
      console.warn("Failed to clear local storage:", error);
    });

    if (firebaseServices) {
      firebaseServices.profile.deleteProfile().catch((error: any) => {
        console.log("Cloud delete skipped:", error.message);
      });
    }
  },

  loadProfile: async () => {
    const { setLoading, setSyncStatus } = get();

    try {
      setLoading(true);

      const [profileData, firstTimeData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.FIRST_TIME),
      ]);

      if (profileData) {
        const profile = JSON.parse(profileData);
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

      // Try cloud sync in background
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
      set({ lastSyncError: `Hindi ma-save ang profile: ${error.message}` });
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

// FIXED: Helper function with complete defaults
export const createProfileWithDefaults = (
  deviceType: UserMobilityProfile["type"],
  customPreferences?: Partial<UserMobilityProfile>
): UserMobilityProfile => {
  const defaults = DEVICE_DEFAULTS[deviceType] || DEVICE_DEFAULTS.none;
  const now = new Date();

  const profile = {
    id: `profile_${deviceType}_${Date.now()}`,
    type: deviceType,
    ...defaults, // This now includes maxWalkingDistance!
    ...customPreferences,
    createdAt: now,
    lastUpdated: now,
  };

  // Debug log to verify all fields are present
  console.log("🔍 Created profile with fields:", Object.keys(profile));
  console.log("🔍 maxWalkingDistance:", profile.maxWalkingDistance);

  return profile;
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
        profile.type === "wheelchair" ? "high_support" : "low_support",
    },
  };
};
