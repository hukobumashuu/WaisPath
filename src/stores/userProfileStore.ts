// src/stores/userProfileStore.ts
// FIXED: Auth-aware profile loading - Skip onboarding for authenticated users with cloud profiles

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserMobilityProfile, ObstacleType } from "../types";

// Optional Firebase - only import if we want to try cloud sync
let firebaseServices: any = null;
try {
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
  reloadProfileAfterLogin: () => Promise<void>;
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

// Complete defaults for each mobility device type
const DEVICE_DEFAULTS = {
  wheelchair: {
    maxRampSlope: 5,
    minPathWidth: 90,
    avoidStairs: true,
    avoidCrowds: true,
    preferShade: true,
    maxWalkingDistance: 800,
  },
  walker: {
    maxRampSlope: 7,
    minPathWidth: 75,
    avoidStairs: true,
    avoidCrowds: false,
    preferShade: true,
    maxWalkingDistance: 400,
  },
  cane: {
    maxRampSlope: 12,
    minPathWidth: 60,
    avoidStairs: false,
    avoidCrowds: false,
    preferShade: true,
    maxWalkingDistance: 600,
  },
  crutches: {
    maxRampSlope: 10,
    minPathWidth: 65,
    avoidStairs: false,
    avoidCrowds: true,
    preferShade: true,
    maxWalkingDistance: 300,
  },
  none: {
    maxRampSlope: 15,
    minPathWidth: 50,
    avoidStairs: false,
    avoidCrowds: false,
    preferShade: false,
    maxWalkingDistance: 1000,
  },
};

// Helper to check auth state
async function getAuthState(): Promise<{
  isAuthenticated: boolean;
  isAnonymous: boolean;
}> {
  try {
    const { getUnifiedFirebaseAuth } = await import("../config/firebaseConfig");
    const auth = await getUnifiedFirebaseAuth();

    return {
      isAuthenticated: !!auth.currentUser,
      isAnonymous: auth.currentUser?.isAnonymous || false,
    };
  } catch (error) {
    console.log("Cannot check auth state:", error);
    return { isAuthenticated: false, isAnonymous: true };
  }
}

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

  // Helper method for when user logs in (triggers profile reload)
  reloadProfileAfterLogin: async () => {
    console.log("🔄 Reloading profile after login...");
    await get().loadProfile();
  },

  // FIXED: Auth-aware profile loading
  loadProfile: async () => {
    const { setLoading, setSyncStatus } = get();

    try {
      setLoading(true);

      // STEP 1: Check if user is authenticated (not anonymous)
      const authState = await getAuthState();

      // STEP 2: For authenticated users, prioritize cloud profile
      if (
        authState.isAuthenticated &&
        !authState.isAnonymous &&
        firebaseServices
      ) {
        try {
          console.log("🔍 Checking cloud profile for authenticated user...");
          const cloudProfile = await firebaseServices.profile.getProfile();

          if (cloudProfile) {
            // Fix date objects
            if (cloudProfile.createdAt)
              cloudProfile.createdAt = new Date(cloudProfile.createdAt);
            if (cloudProfile.lastUpdated)
              cloudProfile.lastUpdated = new Date(cloudProfile.lastUpdated);

            set({
              profile: cloudProfile,
              isFirstTime: false, // FIXED: Skip onboarding for existing users
              syncStatus: "synced",
            });

            // Save to local storage for offline access
            await AsyncStorage.setItem(
              STORAGE_KEYS.PROFILE,
              JSON.stringify(cloudProfile)
            );
            await AsyncStorage.setItem(STORAGE_KEYS.FIRST_TIME, "false");

            console.log("☁️ Profile loaded from cloud (authenticated user)");
            return; // Exit early - profile found
          }
        } catch (cloudError) {
          console.log(
            "☁️ Cloud profile check failed, falling back to local:",
            cloudError
          );
        }
      }

      // STEP 3: Fallback to local storage (anonymous users or cloud failed)
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
        console.log("📭 No profile found anywhere - showing onboarding");
      }

      // STEP 4: Background cloud sync for registered users
      if (
        authState.isAuthenticated &&
        !authState.isAnonymous &&
        firebaseServices
      ) {
        get()
          .syncToCloud()
          .catch((error: any) => {
            console.log("Background cloud sync failed:", error.message);
            setSyncStatus("sync_failed");
          });
      }
    } catch (error: any) {
      console.error("❌ Failed to load profile:", error);
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

// Helper function with complete defaults
export const createProfileWithDefaults = (
  deviceType: UserMobilityProfile["type"],
  customPreferences?: Partial<UserMobilityProfile>
): UserMobilityProfile => {
  const defaults = DEVICE_DEFAULTS[deviceType] || DEVICE_DEFAULTS.none;
  const now = new Date();

  const profile = {
    id: `profile_${deviceType}_${Date.now()}`,
    type: deviceType,
    ...defaults,
    ...customPreferences,
    createdAt: now,
    lastUpdated: now,
  };

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
