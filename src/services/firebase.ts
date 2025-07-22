// src/services/firebase.ts
// Optional Firebase Service - Graceful Fallback Design
// If Firebase fails, app continues normally with local storage

import { UserMobilityProfile, AccessibilityObstacle } from "../types";

// Firebase service interface - all methods are optional/non-blocking
interface FirebaseService {
  profile: {
    saveProfile: (profile: UserMobilityProfile) => Promise<void>;
    getProfile: () => Promise<UserMobilityProfile | null>;
    deleteProfile: () => Promise<void>;
  };
  obstacle: {
    reportObstacle: (
      obstacle: Omit<AccessibilityObstacle, "id" | "reportedBy" | "reportedAt">
    ) => Promise<string>;
    getObstaclesInArea: (
      lat: number,
      lng: number,
      radiusKm: number
    ) => Promise<AccessibilityObstacle[]>;
  };
}

// Mock Firebase service that simulates cloud operations
// Replace this with real Firebase when compatibility issues are resolved
class MockFirebaseService implements FirebaseService {
  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate occasional failures (like real cloud services)
      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

      console.log("🔥 Mock: Profile saved to cloud simulation");
    },

    getProfile: async (): Promise<UserMobilityProfile | null> => {
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

      console.log("🔥 Mock: Profile loaded from cloud simulation");
      return null; // No cloud profile in mock
    },

    deleteProfile: async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log("🔥 Mock: Profile deleted from cloud simulation");
    },
  };

  obstacle = {
    reportObstacle: async (
      obstacle: Omit<AccessibilityObstacle, "id" | "reportedBy" | "reportedAt">
    ): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

      const id = `obstacle_${Date.now()}`;
      console.log("🔥 Mock: Obstacle reported to cloud simulation:", id);
      return id;
    },

    getObstaclesInArea: async (
      lat: number,
      lng: number,
      radiusKm: number
    ): Promise<AccessibilityObstacle[]> => {
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

      // Return mock obstacles for Pasig City area
      const mockObstacles: AccessibilityObstacle[] = [
        {
          id: "mock_1",
          location: { latitude: 14.5547, longitude: 121.0244 },
          type: "vendor_blocking",
          severity: "medium",
          description: "Sari-sari store blocking sidewalk during morning hours",
          reportedBy: "mock_user",
          reportedAt: new Date("2025-07-20"),
          verified: true,
          timePattern: "morning",
        },
        {
          id: "mock_2",
          location: { latitude: 14.5601, longitude: 121.0266 },
          type: "broken_pavement",
          severity: "high",
          description: "Large potholes making wheelchair passage difficult",
          reportedBy: "mock_user_2",
          reportedAt: new Date("2025-07-19"),
          verified: true,
        },
      ];

      console.log("🔥 Mock: Retrieved obstacles from cloud simulation");
      return mockObstacles;
    },
  };
}

// Simplified Firebase service - no auth persistence complexity
class SimpleFirebaseService implements FirebaseService {
  private initialized = false;
  private app: any = null;
  private db: any = null;
  private auth: any = null;
  private currentUser: any = null;

  constructor() {
    this.initializeFirebase().catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log("🔥 Simple Firebase initialization failed:", errorMessage);
    });
  }

  private async initializeFirebase() {
    try {
      // Dynamic import to prevent build errors if Firebase is incompatible
      const { initializeApp, getApps } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore");
      const { getAuth, signInAnonymously } = await import("firebase/auth");

      const firebaseConfig = {
        apiKey: "AIzaSyBAvNvI8osH2ghfaDLCz3awsI8tYA6R-0Y",
        authDomain: "waispath-24ae4.firebaseapp.com",
        projectId: "waispath-24ae4",
        storageBucket: "waispath-24ae4.firebasestorage.app",
        messagingSenderId: "1038593331835",
        appId: "1:1038593331835:android:20af68536f5a5f848908de",
      };

      if (getApps().length === 0) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApps()[0];
      }

      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Simple anonymous auth without persistence complexity
      try {
        const userCredential = await signInAnonymously(this.auth);
        this.currentUser = userCredential.user;
        console.log("🔥 Simple Firebase: Anonymous user created");
      } catch (authError: unknown) {
        const errorMsg =
          authError instanceof Error ? authError.message : "Unknown auth error";
        console.log(
          "🔥 Simple Firebase: Auth failed, continuing without:",
          errorMsg
        );
      }

      this.initialized = true;
      console.log("🔥 Simple Firebase initialized successfully");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown initialization error";
      console.log("🔥 Simple Firebase failed to initialize:", errorMessage);
      throw error;
    }
  }

  private async ensureAuth() {
    if (!this.currentUser && this.auth) {
      try {
        const { signInAnonymously } = await import("firebase/auth");
        const userCredential = await signInAnonymously(this.auth);
        this.currentUser = userCredential.user;
      } catch (error: unknown) {
        throw new Error("Authentication failed");
      }
    }
  }

  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      if (!this.initialized) {
        throw new Error("Firebase not initialized");
      }

      await this.ensureAuth();

      const { doc, setDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      const profileData = {
        ...profile,
        userId: this.currentUser?.uid || "anonymous",
        lastUpdated: serverTimestamp(),
        createdAt: profile.createdAt || serverTimestamp(),
      };

      const profileRef = doc(
        this.db,
        "userProfiles",
        this.currentUser?.uid || "anonymous"
      );
      await setDoc(profileRef, profileData, { merge: true });

      console.log("🔥 Simple Firebase: Profile saved");
    },

    getProfile: async (): Promise<UserMobilityProfile | null> => {
      if (!this.initialized) {
        throw new Error("Firebase not initialized");
      }

      await this.ensureAuth();

      const { doc, getDoc } = await import("firebase/firestore");

      const profileRef = doc(
        this.db,
        "userProfiles",
        this.currentUser?.uid || "anonymous"
      );
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        return {
          id: data.id,
          type: data.type,
          maxRampSlope: data.maxRampSlope,
          minPathWidth: data.minPathWidth,
          avoidStairs: data.avoidStairs,
          avoidCrowds: data.avoidCrowds,
          preferShade: data.preferShade,
          maxWalkingDistance: data.maxWalkingDistance,
          createdAt: data.createdAt?.toDate(),
          lastUpdated: data.lastUpdated?.toDate(),
        };
      }

      return null;
    },

    deleteProfile: async (): Promise<void> => {
      if (!this.initialized) {
        throw new Error("Firebase not initialized");
      }

      await this.ensureAuth();

      const { doc, setDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      if (this.currentUser) {
        const profileRef = doc(this.db, "userProfiles", this.currentUser.uid);
        await setDoc(
          profileRef,
          { deleted: true, deletedAt: serverTimestamp() },
          { merge: true }
        );
      }

      console.log("🔥 Simple Firebase: Profile deleted");
    },
  };

  obstacle = {
    reportObstacle: async (): Promise<string> => {
      throw new Error(
        "Obstacle reporting not implemented yet - using mock for now"
      );
    },

    getObstaclesInArea: async (): Promise<AccessibilityObstacle[]> => {
      throw new Error(
        "Obstacle querying not implemented yet - using mock for now"
      );
    },
  };
}

// Service factory - tries simple Firebase first, falls back to mock
function createFirebaseService(): FirebaseService {
  // OPTION 1: Use real Firebase (enable this to try real cloud storage)
  try {
    console.log("🔥 Attempting to use real Firebase service");
    return new SimpleFirebaseService();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log("🔥 Real Firebase failed, using mock service:", errorMessage);
    return new MockFirebaseService();
  }

  // OPTION 2: Use mock Firebase (currently enabled for reliability)
  /*
  console.log('🔥 Using mock Firebase service for reliable operation');
  return new MockFirebaseService();
  */
}

// Export the service instance
export const firebaseServices = createFirebaseService();

// Health check function
export const checkFirebaseHealth = async (): Promise<
  "real" | "mock" | "failed"
> => {
  try {
    await firebaseServices.profile.getProfile();
    return firebaseServices instanceof SimpleFirebaseService ? "real" : "mock";
  } catch (error: unknown) {
    return "failed";
  }
};
