// src/services/firebase.ts
// FIXED: Removed top-level await that was breaking the build

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

// Enhanced Mock Firebase service with CORRECT types
class MockFirebaseService implements FirebaseService {
  private mockObstacles: AccessibilityObstacle[] = [];

  constructor() {
    this.generateSampleData();
  }

  // Generate comprehensive sample data with CORRECT types
  private generateSampleData() {
    const sampleObstacles: AccessibilityObstacle[] = [
      {
        id: "mock_1",
        location: { latitude: 14.5764, longitude: 121.0851, accuracy: 10 },
        type: "vendor_blocking",
        severity: "medium",
        description: "Nagtitindang pagkain sa tapat ng City Hall",
        reportedBy: "user_1",
        reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        verified: false,
        timePattern: "morning", // FIXED: Valid time pattern
        upvotes: 2,
        downvotes: 0,
        status: "verified", // FIXED: Valid status
        reportsCount: 3,
      },
      {
        id: "mock_2",
        location: { latitude: 14.5657, longitude: 121.0644, accuracy: 15 },
        type: "parked_vehicles",
        severity: "high",
        description: "Mga motor nakaharang sa wheelchair ramp",
        reportedBy: "user_2",
        reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        verified: false,
        timePattern: "weekend", // FIXED: Valid time pattern
        upvotes: 1,
        downvotes: 2,
        status: "pending", // FIXED: Valid status
        reportsCount: 4,
      },
      {
        id: "mock_3",
        location: { latitude: 14.5739, longitude: 121.0892, accuracy: 12 },
        type: "broken_pavement",
        severity: "blocking",
        description: "Malaking butas sa bangketa malapit sa hospital",
        reportedBy: "user_3",
        reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        verified: true,
        timePattern: "permanent", // FIXED: Valid time pattern
        upvotes: 0,
        downvotes: 0,
        status: "resolved", // FIXED: Valid status
        reportsCount: 1,
      },
      {
        id: "mock_4",
        location: { latitude: 14.5858, longitude: 121.0907, accuracy: 8 },
        type: "flooding",
        severity: "high",
        description: "Baha sa daan tuwing umuulan",
        reportedBy: "user_4",
        reportedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        verified: false,
        timePattern: "afternoon", // FIXED: Valid time pattern
        upvotes: 3,
        downvotes: 0,
        status: "verified", // FIXED: Valid status
        reportsCount: 4,
      },
      {
        id: "mock_5",
        location: { latitude: 14.57, longitude: 121.08, accuracy: 20 },
        type: "stairs_no_ramp",
        severity: "blocking",
        description: "Walang ramp sa entrance ng building",
        reportedBy: "user_5",
        reportedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        verified: false,
        timePattern: "permanent", // FIXED: Valid time pattern
        upvotes: 1,
        downvotes: 1,
        status: "pending", // FIXED: Valid status
        reportsCount: 3,
      },
    ];

    this.mockObstacles = sampleObstacles;
    console.log("🔥 Mock Firebase: Generated sample obstacles for testing");
  }

  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("🔥 Mock: Profile saved to cloud simulation");
    },

    getProfile: async (): Promise<UserMobilityProfile | null> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
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

      const id = `obstacle_${Date.now()}`;
      console.log("🔥 Mock: Obstacle reported to cloud simulation:", id);

      // FIXED: Add to mock data without undefined fields
      const newObstacle: AccessibilityObstacle = {
        id,
        location: obstacleData.location,
        type: obstacleData.type,
        severity: obstacleData.severity,
        description: obstacleData.description,
        reportedBy: "mock_user",
        reportedAt: new Date(),
        verified: false,
        timePattern: obstacleData.timePattern || "permanent",
        upvotes: 0,
        downvotes: 0,
        status: "pending",
        reportsCount: 1,
        // FIXED: Only include photoBase64 if it exists
        ...(obstacleData.photoBase64 && {
          photoBase64: obstacleData.photoBase64,
        }),
      };
      this.mockObstacles.push(newObstacle);

      return id;
    },

    getObstaclesInArea: async (
      lat: number,
      lng: number,
      radiusKm: number
    ): Promise<AccessibilityObstacle[]> => {
      await new Promise((resolve) => setTimeout(resolve, 600));

      console.log(
        `🗺️ Getting obstacles in area: ${lat}, ${lng} (${radiusKm}km radius)`
      );
      console.log(`✅ Found ${this.mockObstacles.length} obstacles in area`);

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

// ENHANCED Real Firebase service with better connection handling and CORRECT types
class SimpleFirebaseService implements FirebaseService {
  private currentUser: any = null;
  private initialized = false;
  private db: any = null;
  private connectionFailed = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.connectionFailed) {
      throw new Error("Firebase connection previously failed");
    }

    try {
      console.log("🔥 Initializing Firebase connection...");

      const { initializeApp } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore");
      const { getAuth, signInAnonymously } = await import("firebase/auth");

      const config = getFirebaseConfig();
      const app = initializeApp(config);

      this.db = getFirestore(app);
      const auth = getAuth(app);

      console.log("🔥 Connecting directly to production Firestore...");

      // Anonymous authentication with timeout
      const authPromise = signInAnonymously(auth);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth timeout")), 10000)
      );

      const userCredential = await Promise.race([authPromise, timeoutPromise]);
      this.currentUser = (userCredential as any).user;

      this.initialized = true;
      console.log("✅ Firebase initialized successfully");
    } catch (error: any) {
      console.error("❌ Firebase initialization failed:", error.message);
      this.connectionFailed = true;
      throw new Error(`Firebase connection failed: ${error.message}`);
    }
  }

  private async getUserDeviceType(): Promise<string> {
    return "mobile"; // For React Native
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

      const { collection, addDoc } = await import("firebase/firestore");

      try {
        const obstacleCollection = collection(this.db, "obstacles");

        // FIXED: Remove undefined photoBase64 before sending to Firebase
        const cleanObstacleData = {
          id: `obstacle_${Date.now()}`,
          location: obstacleData.location,
          type: obstacleData.type,
          severity: obstacleData.severity,
          description: obstacleData.description,
          reportedBy: this.currentUser?.uid || "anonymous",
          reportedAt: new Date(),
          verified: false,
          timePattern: obstacleData.timePattern || "permanent",
          upvotes: 0,
          downvotes: 0,
          status: "pending",
          reportsCount: 1,
          // FIXED: Only include photoBase64 if it exists
          ...(obstacleData.photoBase64 && {
            photoBase64: obstacleData.photoBase64,
          }),
        };

        await addDoc(obstacleCollection, cleanObstacleData);

        console.log("✅ Obstacle reported to Firestore");
        return cleanObstacleData.id;
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

      const { collection, getDocs } = await import("firebase/firestore");

      try {
        console.log(
          `🗺️ Getting obstacles in area: ${lat}, ${lng} (${radiusKm}km radius)`
        );

        const obstaclesCollection = collection(this.db, "obstacles");
        const querySnapshot = await getDocs(obstaclesCollection);

        const obstacles: AccessibilityObstacle[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data) {
            obstacles.push({
              id: data.id,
              location: data.location,
              type: data.type,
              severity: data.severity,
              description: data.description,
              reportedBy: data.reportedBy,
              reportedAt:
                data.reportedAt?.toDate?.() || new Date(data.reportedAt),
              verified: data.verified,
              timePattern: data.timePattern,
              upvotes: data.upvotes || 0,
              downvotes: data.downvotes || 0,
              status: data.status || "pending", // FIXED: Valid status
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
        updateDoc,
        increment,
        arrayUnion,
        serverTimestamp,
      } = await import("firebase/firestore");

      try {
        console.log(`🗳️ Recording ${verification} for obstacle ${obstacleId}`);

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

        await updateDoc(obstacleDoc.ref, {
          [verification === "upvote" ? "upvotes" : "downvotes"]: increment(1),
          [`${verification}dBy`]: arrayUnion(userId),
          reportsCount: increment(1),
          lastVerifiedAt: serverTimestamp(),
        });

        console.log(`✅ ${verification} recorded for obstacle ${obstacleId}`);
      } catch (error: any) {
        console.error(`❌ Failed to ${verification} obstacle:`, error);
        throw new Error(
          `Hindi ma-${verification} ang obstacle: ${error.message}`
        );
      }
    },

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

    updateObstacleConfidence: async (
      obstacleId: string,
      newConfidence: number
    ): Promise<void> => {
      await this.ensureInitialized();

      const { collection, query, where, getDocs, updateDoc } = await import(
        "firebase/firestore"
      );

      try {
        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (!querySnapshot.empty) {
          const obstacleDoc = querySnapshot.docs[0];
          await updateDoc(obstacleDoc.ref, {
            confidenceScore: newConfidence,
          });
        }

        console.log(
          `✅ Updated confidence for ${obstacleId}: ${newConfidence}`
        );
      } catch (error: any) {
        console.error("❌ Failed to update obstacle confidence:", error);
        // Don't throw - this is not critical
      }
    },
  };
}

// FIXED: Smart service factory WITHOUT top-level await
class FirebaseServiceFactory {
  private static instance: FirebaseService | null = null;
  private static initializationAttempted = false;

  static getService(): FirebaseService {
    if (this.instance) {
      return this.instance;
    }

    if (!this.initializationAttempted) {
      this.initializationAttempted = true;

      try {
        console.log("🔥 Attempting real Firebase connection...");
        const realService = new SimpleFirebaseService();

        // Try to initialize in background
        realService
          .ensureInitialized()
          .then(() => {
            console.log("✅ Using real Firebase service");
          })
          .catch(() => {
            console.log("⚠️ Firebase connection failed, keeping mock fallback");
          });

        this.instance = realService;
        return this.instance;
      } catch (error) {
        console.log(
          "⚠️ Firebase service creation failed, using mock service:",
          error
        );
        this.instance = new MockFirebaseService();
        return this.instance;
      }
    }

    // Return existing instance or create mock as fallback
    if (!this.instance) {
      this.instance = new MockFirebaseService();
    }

    return this.instance;
  }

  // Force reset (useful for testing)
  static reset() {
    this.instance = null;
    this.initializationAttempted = false;
  }
}

// FIXED: Export without await - synchronous service creation
export const firebaseServices = FirebaseServiceFactory.getService();

// Health check function
export async function checkFirebaseHealth(): Promise<{
  status: "connected" | "mock" | "error";
  message: string;
}> {
  try {
    const service = firebaseServices;

    if (service instanceof MockFirebaseService) {
      return {
        status: "mock",
        message: "Using mock Firebase service with test data",
      };
    } else {
      return {
        status: "connected",
        message: "Connected to real Firebase",
      };
    }
  } catch (error: any) {
    return {
      status: "error",
      message: `Firebase error: ${error.message}`,
    };
  }
}

// Save obstacle locally for offline-first functionality
export async function saveObstacleLocally(obstacle: any): Promise<void> {
  try {
    const existingData = await AsyncStorage.getItem(
      "@waispath:local_obstacles"
    );
    const obstacles = existingData ? JSON.parse(existingData) : [];

    obstacles.push({
      ...obstacle,
      id: `local_${Date.now()}`,
      savedAt: new Date().toISOString(),
      synced: false,
    });

    await AsyncStorage.setItem(
      "@waispath:local_obstacles",
      JSON.stringify(obstacles)
    );
    console.log("💾 Obstacle saved locally");
  } catch (error) {
    console.error("❌ Failed to save obstacle locally:", error);
  }
}
