// src/services/firebase.ts - FIXED AUTH CONFIGURATION
import { UserMobilityProfile, AccessibilityObstacle } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Mock Firebase service
class MockFirebaseService implements FirebaseService {
  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 500));
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
      return null;
    },

    deleteProfile: async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log("🔥 Mock: Profile deleted from cloud simulation");
    },
  };

  obstacle = {
    reportObstacle: async (): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }
      const id = `obstacle_${Date.now()}`;
      console.log("🔥 Mock: Obstacle reported to cloud simulation:", id);
      return id;
    },

    getObstaclesInArea: async (): Promise<AccessibilityObstacle[]> => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

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

// Real Firebase service with FIXED AUTH
class SimpleFirebaseService implements FirebaseService {
  private initialized = false;
  private app: any = null;
  private db: any = null;
  private auth: any = null;
  private currentUser: any = null;

  constructor() {
    console.log("🔥 SimpleFirebaseService created (not yet initialized)");
  }

  private async initializeFirebase() {
    if (this.initialized) {
      return;
    }

    try {
      console.log("🔥 Starting Firebase initialization...");

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
        console.log("🔥 Firebase app initialized");
      } else {
        this.app = getApps()[0];
        console.log("🔥 Using existing Firebase app");
      }

      // Initialize Firestore
      this.db = getFirestore(this.app);
      console.log("🔥 Firestore initialized");

      // Initialize Auth (simplified approach)
      this.auth = getAuth(this.app);
      console.log("🔥 Auth initialized");

      // Try anonymous sign in
      console.log("🔐 Attempting anonymous authentication...");
      const userCredential = await signInAnonymously(this.auth);
      this.currentUser = userCredential.user;
      console.log("🔥 Anonymous authentication successful");

      this.initialized = true;
      console.log("🔥 Firebase fully initialized and ready");
    } catch (error: any) {
      console.log("🔥 Firebase initialization failed:", error.message);
      console.log("🔥 Error code:", error.code);
      console.log("🔥 Full error:", error);
      throw error;
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeFirebase();
    }
  }

  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      await this.ensureInitialized();

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

      console.log("🔥 Profile saved to Firebase");
    },

    getProfile: async (): Promise<UserMobilityProfile | null> => {
      await this.ensureInitialized();

      const { doc, getDoc } = await import("firebase/firestore");

      const profileRef = doc(
        this.db,
        "userProfiles",
        this.currentUser?.uid || "anonymous"
      );
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        console.log("🔥 Profile retrieved from Firebase");
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

      console.log("🔥 No profile found in Firebase");
      return null;
    },

    deleteProfile: async (): Promise<void> => {
      await this.ensureInitialized();

      const { doc, setDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      const profileRef = doc(
        this.db,
        "userProfiles",
        this.currentUser?.uid || "anonymous"
      );
      await setDoc(
        profileRef,
        { deleted: true, deletedAt: serverTimestamp() },
        { merge: true }
      );

      console.log("🔥 Profile deleted from Firebase");
    },
  };

  obstacle = {
    reportObstacle: async (): Promise<string> => {
      throw new Error("Obstacle reporting not implemented yet");
    },

    getObstaclesInArea: async (): Promise<AccessibilityObstacle[]> => {
      throw new Error("Obstacle querying not implemented yet");
    },
  };
}

// Service factory
function createFirebaseService(): FirebaseService {
  // Try real Firebase - now with proper auth configuration
  const USE_REAL_FIREBASE = true; // Let's test the fixed version

  if (USE_REAL_FIREBASE) {
    console.log("🔥 Creating real Firebase service with fixed auth");
    return new SimpleFirebaseService();
  } else {
    console.log("🔥 Creating mock Firebase service (safe mode)");
    return new MockFirebaseService();
  }
}

export const firebaseServices = createFirebaseService();

export const checkFirebaseHealth = async (): Promise<
  "real" | "mock" | "failed"
> => {
  try {
    await firebaseServices.profile.getProfile();

    if (firebaseServices instanceof SimpleFirebaseService) {
      return "real";
    } else {
      return "mock";
    }
  } catch (error: any) {
    console.log("Firebase health check failed:", error.message);
    return "failed";
  }
};
