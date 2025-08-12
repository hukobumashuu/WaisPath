// src/services/firebase.ts - ENHANCED WITH VALIDATION METHODS
// Complete Firebase service with atomic operations and validation analytics

import {
  UserMobilityProfile,
  AccessibilityObstacle,
  ObstacleType,
  UserLocation,
} from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseConfig } from "../config/firebaseConfig";

interface ValidationEvent {
  action: "confirmed" | "disputed" | "skipped";
  timestamp: string;
  location?: UserLocation | null;
  method: "proximity_prompt" | "manual" | "admin";
  userHash?: string; // For privacy
}

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
      photoBase64?: string;
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
    // NEW: Validation analytics methods
    recordPromptEvent: (
      obstacleId: string,
      eventData: ValidationEvent
    ) => Promise<void>;
    updateObstacleConfidence: (
      obstacleId: string,
      newConfidence: number
    ) => Promise<void>;
  };
}

// Enhanced Mock Firebase service with validation support
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
      upvotes: 3,
      downvotes: 0,
      status: "verified",
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
      upvotes: 5,
      downvotes: 1,
      status: "verified",
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

      // Add to mock data with validation fields
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
        upvotes: 0,
        downvotes: 0,
        status: "pending",
        reportsCount: 1, // NEW: Track total reports
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

      // Simulate atomic increment
      const obstacle = this.mockObstacles.find((o) => o.id === obstacleId);
      if (obstacle) {
        if (verification === "upvote") {
          obstacle.upvotes = (obstacle.upvotes || 0) + 1;
        } else {
          obstacle.downvotes = (obstacle.downvotes || 0) + 1;
        }
        obstacle.reportsCount = (obstacle.reportsCount || 1) + 1;
      }
    },

    // NEW: Mock validation analytics
    recordPromptEvent: async (
      obstacleId: string,
      eventData: ValidationEvent
    ): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log(
        `🔥 Mock: Recorded prompt event for ${obstacleId}:`,
        eventData.action
      );
    },

    updateObstacleConfidence: async (
      obstacleId: string,
      newConfidence: number
    ): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log(
        `🔥 Mock: Updated confidence for ${obstacleId}: ${newConfidence}`
      );
    },
  };
}

// ENHANCED Real Firebase service with atomic operations
class SimpleFirebaseService implements FirebaseService {
  private currentUser: any = null;
  private initialized = false;
  private db: any = null;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const { initializeApp } = await import("firebase/app");
      const { getFirestore, connectFirestoreEmulator } = await import(
        "firebase/firestore"
      );
      const { getAuth, signInAnonymously } = await import("firebase/auth");

      const config = getFirebaseConfig();
      const app = initializeApp(config);

      this.db = getFirestore(app);
      const auth = getAuth(app);

      // Connect to emulator in development
      if (__DEV__) {
        try {
          connectFirestoreEmulator(this.db, "localhost", 8080);
          console.log("🔥 Connected to Firestore emulator");
        } catch (error: any) {
          if (error.code !== "firestore/emulator-config-failed") {
            console.warn("Firestore emulator connection failed:", error);
          }
        }
      }

      // Anonymous authentication
      const userCredential = await signInAnonymously(auth);
      this.currentUser = userCredential.user;

      this.initialized = true;
      console.log("🔥 Firebase initialized successfully");
    } catch (error: any) {
      console.error("🔥 Firebase initialization failed:", error);
      throw new Error(`Firebase setup failed: ${error.message}`);
    }
  }

  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      await this.ensureInitialized();

      const { doc, setDoc } = await import("firebase/firestore");

      try {
        const profileDoc = doc(this.db, "profiles", this.currentUser.uid);
        await setDoc(profileDoc, {
          ...profile,
          userId: this.currentUser.uid,
          lastUpdated: new Date(),
        });

        console.log("✅ Profile saved to Firestore");
      } catch (error: any) {
        console.error("❌ Failed to save profile:", error);
        throw new Error(`Hindi ma-save ang profile: ${error.message}`);
      }
    },

    getProfile: async (): Promise<UserMobilityProfile | null> => {
      await this.ensureInitialized();

      const { doc, getDoc } = await import("firebase/firestore");

      try {
        const profileDoc = doc(this.db, "profiles", this.currentUser.uid);
        const docSnap = await getDoc(profileDoc);

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("✅ Profile loaded from Firestore");
          return data as UserMobilityProfile;
        } else {
          console.log("📝 No profile found in Firestore");
          return null;
        }
      } catch (error: any) {
        console.error("❌ Failed to load profile:", error);
        throw new Error(`Hindi ma-load ang profile: ${error.message}`);
      }
    },

    deleteProfile: async (): Promise<void> => {
      await this.ensureInitialized();

      const { doc, deleteDoc } = await import("firebase/firestore");

      try {
        const profileDoc = doc(this.db, "profiles", this.currentUser.uid);
        await deleteDoc(profileDoc);

        console.log("✅ Profile deleted from Firestore");
      } catch (error: any) {
        console.error("❌ Failed to delete profile:", error);
        throw new Error(`Hindi ma-delete ang profile: ${error.message}`);
      }
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
          photoBase64: obstacleData.photoBase64 || null,
          timePattern: obstacleData.timePattern || "permanent",
          reportedBy: this.currentUser?.uid || "anonymous",
          reportedAt: serverTimestamp(),
          verified: false,
          upvotes: 0,
          downvotes: 0,
          status: "pending",
          reportsCount: 1, // NEW: Initialize reports count

          // Additional metadata
          barangay: this.getBarangayFromCoordinates(obstacleData.location),
          deviceType: await this.getUserDeviceType(),
        };

        const docRef = await addDoc(
          collection(this.db, "obstacles"),
          obstacleDocument
        );

        console.log("✅ Obstacle reported successfully:", docRef.id);
        return obstacleId;
      } catch (error: any) {
        console.error("❌ Failed to report obstacle:", error);
        throw new Error(`Hindi ma-report ang obstacle: ${error.message}`);
      }
    },

    getObstaclesInArea: async (
      lat: number,
      lng: number,
      radiusKm: number
    ): Promise<AccessibilityObstacle[]> => {
      await this.ensureInitialized();

      const { collection, getDocs, query, where } = await import(
        "firebase/firestore"
      );

      try {
        console.log(
          `🗺️ Getting obstacles in area: ${lat}, ${lng} (${radiusKm}km radius)`
        );

        // Simple bounding box query (for basic implementation)
        const latRange = radiusKm / 111; // Rough conversion
        const lngRange = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("location.latitude", ">=", lat - latRange),
          where("location.latitude", "<=", lat + latRange)
        );

        const querySnapshot = await getDocs(obstaclesQuery);
        const obstacles: AccessibilityObstacle[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();

          // Filter by longitude and convert Firestore timestamp
          const lngDiff = Math.abs(data.location.longitude - lng);
          if (lngDiff <= lngRange) {
            obstacles.push({
              id: data.id || doc.id,
              location: data.location,
              type: data.type,
              severity: data.severity,
              description: data.description,
              reportedBy: data.reportedBy,
              reportedAt: data.reportedAt?.toDate() || new Date(),
              verified: data.verified,
              timePattern: data.timePattern,
              upvotes: data.upvotes || 0,
              downvotes: data.downvotes || 0,
              status: data.status || "pending",
              reportsCount: data.reportsCount || 1,
              photoBase64: data.photoBase64,
            });
          }
        });

        console.log(`✅ Found ${obstacles.length} obstacles in area`);
        return obstacles;
      } catch (error: any) {
        console.error("❌ Failed to get obstacles:", error);
        throw new Error(`Hindi makuha ang mga obstacles: ${error.message}`);
      }
    },

    // ENHANCED: Atomic increment with proper error handling
    verifyObstacle: async (
      obstacleId: string,
      verification: "upvote" | "downvote"
    ): Promise<void> => {
      await this.ensureInitialized();

      const {
        collection,
        query,
        where,
        getDocs,
        doc,
        updateDoc,
        increment,
        arrayUnion,
        serverTimestamp,
      } = await import("firebase/firestore");

      try {
        console.log(`🗳️ Recording ${verification} for obstacle ${obstacleId}`);

        // Find the obstacle document
        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (querySnapshot.empty) {
          throw new Error(`Obstacle ${obstacleId} not found`);
        }

        const obstacleDoc = querySnapshot.docs[0];
        const userId = this.currentUser?.uid || "anonymous";

        // ATOMIC INCREMENT: Update counts atomically to prevent race conditions
        await updateDoc(obstacleDoc.ref, {
          [verification === "upvote" ? "upvotes" : "downvotes"]: increment(1),
          [`${verification}dBy`]: arrayUnion(userId),
          reportsCount: increment(1), // NEW: Track total engagement
          lastVerifiedAt: serverTimestamp(),
        });

        console.log(`✅ ${verification} recorded for obstacle ${obstacleId}`);
      } catch (error: any) {
        console.error(`👍 Failed to ${verification} obstacle:`, error);
        throw new Error(
          `Hindi ma-${verification} ang obstacle: ${error.message}`
        );
      }
    },

    // NEW: Record validation prompt events for analytics
    recordPromptEvent: async (
      obstacleId: string,
      eventData: ValidationEvent
    ): Promise<void> => {
      await this.ensureInitialized();

      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      try {
        const eventDocument = {
          obstacleId,
          userId: this.currentUser?.uid || "anonymous",
          action: eventData.action,
          timestamp: serverTimestamp(),
          location: eventData.location || null,
          method: eventData.method,
          userHash: eventData.userHash || null,

          // Additional metadata
          deviceType: await this.getUserDeviceType(),
        };

        await addDoc(collection(this.db, "validation_events"), eventDocument);

        console.log(
          `✅ Validation event recorded: ${obstacleId} - ${eventData.action}`
        );
      } catch (error: any) {
        console.error("❌ Failed to record validation event:", error);
        // Don't throw - this is analytics, not critical path
      }
    },

    // NEW: Update obstacle confidence score
    updateObstacleConfidence: async (
      obstacleId: string,
      newConfidence: number
    ): Promise<void> => {
      await this.ensureInitialized();

      const { collection, query, where, getDocs, updateDoc, serverTimestamp } =
        await import("firebase/firestore");

      try {
        // Find the obstacle document
        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (querySnapshot.empty) {
          console.warn(
            `Obstacle ${obstacleId} not found for confidence update`
          );
          return;
        }

        const obstacleDoc = querySnapshot.docs[0];

        await updateDoc(obstacleDoc.ref, {
          confidenceScore: newConfidence,
          confidenceUpdatedAt: serverTimestamp(),
        });

        console.log(
          `✅ Confidence updated for obstacle ${obstacleId}: ${newConfidence}`
        );
      } catch (error: any) {
        console.error("❌ Failed to update obstacle confidence:", error);
        // Don't throw - this is background processing
      }
    },
  };

  /**
   * Helper: Determine barangay from coordinates (basic implementation)
   */
  private getBarangayFromCoordinates(location: UserLocation): string {
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

// Service factory with enhanced features
function createFirebaseService(): FirebaseService {
  const USE_REAL_FIREBASE = true;

  if (USE_REAL_FIREBASE) {
    console.log(
      "🔥 Creating ENHANCED Firebase service with validation analytics"
    );
    return new SimpleFirebaseService();
  } else {
    console.log("🔥 Creating enhanced mock Firebase service");
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
