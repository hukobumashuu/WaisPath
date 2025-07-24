// src/services/firebase.ts - BASE64 PHOTO STORAGE (FREE!)
// Firestore-only solution with compressed Base64 images

import {
  UserMobilityProfile,
  AccessibilityObstacle,
  ObstacleType,
  UserLocation,
} from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseConfig } from "../config/firebaseConfig";

interface FirebaseService {
  profile: {
    saveProfile: (profile: UserMobilityProfile) => Promise<void>;
    getProfile: () => Promise<UserMobilityProfile | null>;
    deleteProfile: () => Promise<void>;
  };
  obstacle: {
    reportObstacle: (obstacle: {
      location: UserLocation;
      type: ObstacleType;
      severity: "low" | "medium" | "high" | "blocking";
      description: string;
      photoBase64?: string; // Changed from photoUri to photoBase64
      timePattern?:
        | "permanent"
        | "morning"
        | "afternoon"
        | "evening"
        | "weekend";
    }) => Promise<string>;
    getObstaclesInArea: (
      lat: number,
      lng: number,
      radiusKm: number
    ) => Promise<AccessibilityObstacle[]>;
    verifyObstacle: (
      obstacleId: string,
      verification: "upvote" | "downvote"
    ) => Promise<void>;
  };
}

// Enhanced Mock Firebase service (for development/testing)
class MockFirebaseService implements FirebaseService {
  private mockObstacles: AccessibilityObstacle[] = [
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
    reportObstacle: async (obstacleData: any): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

      const id = `obstacle_${Date.now()}`;
      console.log("🔥 Mock: Obstacle reported to cloud simulation:", id);

      // Add to mock data
      const newObstacle: AccessibilityObstacle = {
        id,
        location: obstacleData.location,
        type: obstacleData.type,
        severity: obstacleData.severity,
        description: obstacleData.description,
        reportedBy: "mock_user",
        reportedAt: new Date(),
        verified: false,
        timePattern: obstacleData.timePattern,
      };
      this.mockObstacles.push(newObstacle);

      return id;
    },

    getObstaclesInArea: async (): Promise<AccessibilityObstacle[]> => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (Math.random() < 0.1) {
        throw new Error("Simulated network failure");
      }

      console.log("🔥 Mock: Retrieved obstacles from cloud simulation");
      return this.mockObstacles;
    },

    verifyObstacle: async (
      obstacleId: string,
      verification: "upvote" | "downvote"
    ): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log(`🔥 Mock: ${verification} for obstacle ${obstacleId}`);
    },
  };
}

// Real Firebase service with PHOTO STORAGE + OBSTACLE REPORTING
class SimpleFirebaseService implements FirebaseService {
  private initialized = false;
  private app: any = null;
  private db: any = null;
  private storage: any = null;
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

      const firebaseConfig = getFirebaseConfig();

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

      // Initialize Auth (simple, no persistence needed)
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

  /**
   * Convert image URI to Base64 string for Firestore storage
   * This replaces Firebase Storage for cost-free photo storage
   */
  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      console.log("📸 Converting image to Base64 for Firestore storage...");

      const response = await fetch(imageUri);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove data:image/jpeg;base64, prefix to save space
          const base64Data = base64String.split(",")[1];
          console.log(
            `📸 Base64 conversion complete: ${(
              base64Data.length / 1024
            ).toFixed(1)}KB`
          );
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error: any) {
      console.error("📸 Base64 conversion failed:", error);
      throw new Error(`Hindi ma-convert ang larawan: ${error.message}`);
    }
  }

  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      await this.ensureInitialized();

      const { doc, setDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      // Clean profile data - remove undefined values that cause Firestore errors
      const cleanProfile = {
        id: profile.id || `profile_${Date.now()}`,
        type: profile.type || "none",
        maxRampSlope: profile.maxRampSlope || 5,
        minPathWidth: profile.minPathWidth || 90,
        avoidStairs:
          profile.avoidStairs !== undefined ? profile.avoidStairs : true,
        avoidCrowds:
          profile.avoidCrowds !== undefined ? profile.avoidCrowds : false,
        preferShade:
          profile.preferShade !== undefined ? profile.preferShade : true,
        maxWalkingDistance: profile.maxWalkingDistance || 500,
        userId: this.currentUser?.uid || "anonymous",
        createdAt: profile.createdAt || serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };

      const profileRef = doc(
        this.db,
        "userProfiles",
        this.currentUser?.uid || "anonymous"
      );

      await setDoc(profileRef, cleanProfile, { merge: true });
      console.log("🔥 Profile saved to Firebase (cleaned data)");
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
    reportObstacle: async (obstacleData: {
      location: UserLocation;
      type: ObstacleType;
      severity: "low" | "medium" | "high" | "blocking";
      description: string;
      photoBase64?: string;
      timePattern?:
        | "permanent"
        | "morning"
        | "afternoon"
        | "evening"
        | "weekend";
    }): Promise<string> => {
      await this.ensureInitialized();

      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      try {
        console.log(
          "🚧 Reporting obstacle to Firestore (with Base64 photo)..."
        );

        // Generate obstacle ID
        const obstacleId = `obstacle_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Create clean obstacle document (no undefined values)
        const obstacleDocument = {
          id: obstacleId,
          location: {
            latitude: obstacleData.location.latitude,
            longitude: obstacleData.location.longitude,
            accuracy: obstacleData.location.accuracy || null,
          },
          type: obstacleData.type,
          severity: obstacleData.severity,
          description: obstacleData.description || "No description provided",
          photoBase64: obstacleData.photoBase64 || null, // Base64 string or null
          timePattern: obstacleData.timePattern || "permanent",
          reportedBy: this.currentUser?.uid || "anonymous",
          reportedAt: serverTimestamp(),
          verified: false,
          upvotes: 0,
          downvotes: 0,
          status: "pending",

          // Additional metadata
          barangay: this.getBarangayFromCoordinates(obstacleData.location),
          deviceType: await this.getUserDeviceType(),
        };

        // Save to Firestore
        const obstaclesRef = collection(this.db, "obstacles");
        const docRef = await addDoc(obstaclesRef, obstacleDocument);

        console.log(
          "✅ Obstacle reported successfully to Firestore:",
          docRef.id
        );
        return obstacleId;
      } catch (error: any) {
        console.error("🚧 Obstacle reporting failed:", error);
        throw new Error(`Hindi ma-report ang obstacle: ${error.message}`);
      }
    },

    getObstaclesInArea: async (
      lat: number,
      lng: number,
      radiusKm: number
    ): Promise<AccessibilityObstacle[]> => {
      await this.ensureInitialized();

      const { collection, query, where, getDocs, orderBy, limit } =
        await import("firebase/firestore");

      try {
        console.log(
          `🔍 Searching for obstacles near ${lat}, ${lng} (${radiusKm}km radius)`
        );

        // Simple bounding box query (more complex geo queries need GeoFirestore)
        const latDelta = radiusKm / 111; // Rough conversion: 1 degree ≈ 111km
        const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

        const obstaclesRef = collection(this.db, "obstacles");
        const q = query(
          obstaclesRef,
          where("location.latitude", ">=", lat - latDelta),
          where("location.latitude", "<=", lat + latDelta),
          orderBy("reportedAt", "desc"),
          limit(50) // Limit for performance
        );

        const querySnapshot = await getDocs(q);
        const obstacles: AccessibilityObstacle[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();

          // Additional longitude filtering (since Firestore can only order by one field)
          const lngDiff = Math.abs(data.location.longitude - lng);
          if (lngDiff <= lngDelta) {
            obstacles.push({
              id: data.id,
              location: data.location,
              type: data.type,
              severity: data.severity,
              description: data.description,
              reportedBy: data.reportedBy,
              reportedAt: data.reportedAt?.toDate() || new Date(),
              verified: data.verified || false,
              timePattern: data.timePattern,
            });
          }
        });

        console.log(`🔍 Found ${obstacles.length} obstacles in area`);
        return obstacles;
      } catch (error: any) {
        console.error("🔍 Failed to fetch obstacles:", error);
        throw new Error(`Hindi makuha ang mga obstacle: ${error.message}`);
      }
    },

    verifyObstacle: async (
      obstacleId: string,
      verification: "upvote" | "downvote"
    ): Promise<void> => {
      await this.ensureInitialized();

      const { doc, updateDoc, increment, arrayUnion } = await import(
        "firebase/firestore"
      );

      try {
        console.log(`👍 ${verification} obstacle ${obstacleId}`);

        const obstacleRef = doc(this.db, "obstacles", obstacleId);
        const userId = this.currentUser?.uid || "anonymous";

        await updateDoc(obstacleRef, {
          [verification === "upvote" ? "upvotes" : "downvotes"]: increment(1),
          [`${verification}dBy`]: arrayUnion(userId),
          lastVerifiedAt: new Date(),
        });

        console.log(`✅ ${verification} recorded for obstacle ${obstacleId}`);
      } catch (error: any) {
        console.error(`👍 Failed to ${verification} obstacle:`, error);
        throw new Error(
          `Hindi ma-${verification} ang obstacle: ${error.message}`
        );
      }
    },
  };

  /**
   * Helper: Determine barangay from coordinates (basic implementation)
   * In production, this would use a proper geocoding service
   */
  private getBarangayFromCoordinates(location: UserLocation): string {
    // Rough mapping for major Pasig areas
    const { latitude, longitude } = location;

    if (
      latitude >= 14.55 &&
      latitude <= 14.57 &&
      longitude >= 121.02 &&
      longitude <= 121.04
    ) {
      return "Kapitolyo";
    } else if (
      latitude >= 14.57 &&
      latitude <= 14.59 &&
      longitude >= 121.04 &&
      longitude <= 121.06
    ) {
      return "Ortigas Center";
    } else if (
      latitude >= 14.53 &&
      latitude <= 14.55 &&
      longitude >= 121.0 &&
      longitude <= 121.02
    ) {
      return "Pinagbuhatan";
    }

    return "Pasig City"; // Default
  }

  /**
   * Helper: Get user's device type from profile
   */
  private async getUserDeviceType(): Promise<string> {
    try {
      const profile = await this.profile.getProfile();
      return profile?.type || "unknown";
    } catch {
      return "unknown";
    }
  }
}

// Service factory
function createFirebaseService(): FirebaseService {
  // Use real Firebase with enhanced obstacle reporting
  const USE_REAL_FIREBASE = true;

  if (USE_REAL_FIREBASE) {
    console.log("🔥 Creating real Firebase service with obstacle reporting");
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

// Local storage helpers for offline-first approach
export const saveObstacleLocally = async (obstacleData: any): Promise<void> => {
  try {
    const existingObstacles = await AsyncStorage.getItem(
      "@waispath:pending_obstacles"
    );
    const obstacles = existingObstacles ? JSON.parse(existingObstacles) : [];
    obstacles.push({
      ...obstacleData,
      localId: Date.now().toString(),
      savedAt: new Date().toISOString(),
      synced: false,
    });
    await AsyncStorage.setItem(
      "@waispath:pending_obstacles",
      JSON.stringify(obstacles)
    );
    console.log("📱 Obstacle saved locally for later sync");
  } catch (error) {
    console.error("📱 Failed to save obstacle locally:", error);
  }
};

export const syncPendingObstacles = async (): Promise<void> => {
  try {
    const pendingObstacles = await AsyncStorage.getItem(
      "@waispath:pending_obstacles"
    );
    if (!pendingObstacles) return;

    const obstacles = JSON.parse(pendingObstacles);
    const unsynced = obstacles.filter((o: any) => !o.synced);

    for (const obstacle of unsynced) {
      try {
        await firebaseServices.obstacle.reportObstacle(obstacle);
        obstacle.synced = true;
        console.log("☁️ Synced obstacle:", obstacle.localId);
      } catch (error) {
        console.log("☁️ Failed to sync obstacle:", obstacle.localId);
      }
    }

    // Save updated sync status
    await AsyncStorage.setItem(
      "@waispath:pending_obstacles",
      JSON.stringify(obstacles)
    );
  } catch (error) {
    console.error("☁️ Failed to sync pending obstacles:", error);
  }
};
