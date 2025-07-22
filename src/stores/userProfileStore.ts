// src/stores/userProfileStore.ts
import { create } from "zustand";
import { UserMobilityProfile, ObstacleType } from "../types";

interface UserProfileState {
  profile: UserMobilityProfile | null;
  isFirstTime: boolean;

  // Actions
  setProfile: (profile: UserMobilityProfile) => void;
  updatePreferences: (preferences: Partial<UserMobilityProfile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
}

// Smart defaults for each mobility device type
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

  setProfile: (profile: UserMobilityProfile) => {
    set({ profile, isFirstTime: false });
  },

  updatePreferences: (preferences: Partial<UserMobilityProfile>) => {
    const currentProfile = get().profile;
    if (currentProfile) {
      set({
        profile: { ...currentProfile, ...preferences },
      });
    }
  },

  completeOnboarding: () => {
    set({ isFirstTime: false });
  },

  resetProfile: () => {
    set({ profile: null, isFirstTime: true });
  },
}));

// Helper function to create profile with smart defaults
export const createProfileWithDefaults = (
  deviceType: UserMobilityProfile["type"],
  customPreferences: Partial<UserMobilityProfile> = {}
): UserMobilityProfile => {
  const defaults = DEVICE_DEFAULTS[deviceType];

  return {
    id: `profile_${Date.now()}`, // Simple ID generation
    type: deviceType,
    ...defaults,
    ...customPreferences, // Override defaults with user choices
  };
};

// Helper function to get accessibility requirements for route planning
export const getAccessibilityRequirements = (profile: UserMobilityProfile) => {
  return {
    // Critical requirements (hard blocks)
    criticalRequirements: {
      maxSlope: profile.maxRampSlope,
      minWidth: profile.minPathWidth,
      canUseStairs: !profile.avoidStairs,
    },

    // Preferences (scoring factors)
    preferences: {
      preferShade: profile.preferShade,
      avoidCrowds: profile.avoidCrowds,
      maxDistance: profile.maxWalkingDistance,
    },

    // Filipino context considerations
    contextualNeeds: {
      weatherSensitive: profile.preferShade,
      restFrequency: profile.maxWalkingDistance < 500 ? "frequent" : "standard",
      surfaceStability: profile.type === "walker" || profile.type === "cane",
    },
  };
};

// Helper to determine if an obstacle blocks this user
export const isObstacleBlocking = (
  obstacle: { type: ObstacleType; severity: string },
  profile: UserMobilityProfile
): boolean => {
  const { type: obstacleType, severity } = obstacle;
  const { type: deviceType, avoidStairs, minPathWidth } = profile;

  // Hard blocks for specific combinations
  if (obstacleType === "stairs_no_ramp" && avoidStairs) {
    return true;
  }

  if (obstacleType === "narrow_passage" && deviceType === "wheelchair") {
    return true; // Assume narrow = less than wheelchair width
  }

  if (severity === "blocking") {
    return true; // Always blocking regardless of device
  }

  // High severity obstacles affect mobility aid users more
  if (
    severity === "high" &&
    (deviceType === "wheelchair" || deviceType === "walker")
  ) {
    return (
      obstacleType === "vendor_blocking" || obstacleType === "parked_vehicles"
    );
  }

  return false;
};
