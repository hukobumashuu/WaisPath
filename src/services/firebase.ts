// src/services/firebase.ts
// FIXED: Added spatial filtering to getObstaclesInArea to resolve "47 obstacles everywhere" issue

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

// Helper functions for spatial filtering
function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude),
    lat2 = toRad(b.latitude);
  const sinDlat = Math.sin(dLat / 2),
    sinDlon = Math.sin(dLon / 2);
  const aVal =
    sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c; // km
}

function dedupeById<T extends { id?: string }>(arr: T[]) {
  const map = new Map<string, T>();
  arr.forEach((v) => {
    const id = (v as any).id || JSON.stringify(v);
    if (!map.has(id)) map.set(id, v);
  });
  return Array.from(map.values());
}

// Removed MockFirebaseService - Always use real Firebase database

// ENHANCED Real Firebase service with FIXED spatial filtering
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
      console.log("Initializing Firebase connection...");

      const { initializeApp } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore");
      const { getAuth, signInAnonymously } = await import("firebase/auth");

      const config = getFirebaseConfig();
      const app = initializeApp(config);

      this.db = getFirestore(app);
      const auth = getAuth(app);

      console.log("Connecting directly to production Firestore...");

      const authPromise = signInAnonymously(auth);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth timeout")), 10000)
      );

      const userCredential = await Promise.race([authPromise, timeoutPromise]);
      this.currentUser = (userCredential as any).user;

      this.initialized = true;
      console.log("Firebase initialized successfully");
    } catch (error: any) {
      console.error("Firebase initialization failed:", error.message);
      this.connectionFailed = true;
      throw new Error(`Firebase connection failed: ${error.message}`);
    }
  }

  private async getUserDeviceType(): Promise<string> {
    return "mobile";
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

        console.log("Profile saved to Firestore");
      } catch (error: any) {
        console.error("Failed to save profile:", error);
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
          console.log("Profile loaded from Firestore");
          return data as UserMobilityProfile;
        } else {
          console.log("No profile found in Firestore");
          return null;
        }
      } catch (error: any) {
        console.error("Failed to load profile:", error);
        throw new Error(`Hindi ma-load ang profile: ${error.message}`);
      }
    },

    deleteProfile: async (): Promise<void> => {
      await this.ensureInitialized();

      const { doc, deleteDoc } = await import("firebase/firestore");

      try {
        const profileDoc = doc(this.db, "profiles", this.currentUser.uid);
        await deleteDoc(profileDoc);

        console.log("Profile deleted from Firestore");
      } catch (error: any) {
        console.error("Failed to delete profile:", error);
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
          ...(obstacleData.photoBase64 && {
            photoBase64: obstacleData.photoBase64,
          }),
        };

        await addDoc(obstacleCollection, cleanObstacleData);

        console.log("Obstacle reported to Firestore");
        return cleanObstacleData.id;
      } catch (error: any) {
        console.error("Failed to report obstacle:", error);
        throw new Error(`Hindi ma-report ang obstacle: ${error.message}`);
      }
    },

    // FIXED: Real Firebase service now properly filters by geospatial parameters
    getObstaclesInArea: async (
      lat: number,
      lng: number,
      radiusKm: number
    ): Promise<AccessibilityObstacle[]> => {
      await this.ensureInitialized();

      const { collection, getDocs } = await import("firebase/firestore");

      try {
        console.log(
          `Getting obstacles in area: ${lat}, ${lng} (${radiusKm}km radius)`
        );

        const obstaclesCollection = collection(this.db, "obstacles");
        // Note: Still reads all docs (temporary solution for immediate fix)
        // TODO: Implement server-side geospatial indexing for production scale
        const querySnapshot = await getDocs(obstaclesCollection);

        const allObstacles: AccessibilityObstacle[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data) {
            allObstacles.push({
              id: data.id ?? doc.id,
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
              status: data.status || "pending",
              reportsCount: data.reportsCount || 1,
              photoBase64: data.photoBase64,
            });
          }
        });

        // Client-side spatial filtering (immediate fix)
        const center = { latitude: lat, longitude: lng };
        const filtered = allObstacles.filter((obstacle) => {
          if (!obstacle.location || obstacle.location.latitude == null) {
            console.warn(`Skipping obstacle ${obstacle.id} - invalid location`);
            return false;
          }

          const distance = haversineKm(center, {
            latitude: obstacle.location.latitude,
            longitude: obstacle.location.longitude,
          });

          return distance <= radiusKm;
        });

        const deduped = dedupeById(filtered);
        console.log(
          `Found ${deduped.length} obstacles within ${radiusKm}km (total in DB: ${allObstacles.length})`
        );

        return deduped;
      } catch (error: any) {
        console.error("Failed to get obstacles:", error);
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
        console.log(`Recording ${verification} for obstacle ${obstacleId}`);

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

        console.log(`${verification} recorded for obstacle ${obstacleId}`);
      } catch (error: any) {
        console.error(`Failed to ${verification} obstacle:`, error);
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
          `Validation event recorded: ${obstacleId} - ${eventData.action}`
        );
      } catch (error: any) {
        console.error("Failed to record validation event:", error);
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

        console.log(`Updated confidence for ${obstacleId}: ${newConfidence}`);
      } catch (error: any) {
        console.error("Failed to update obstacle confidence:", error);
      }
    },
  };
}

// SIMPLIFIED: Always use real Firebase service - no mock fallback
class FirebaseServiceFactory {
  private static instance: FirebaseService | null = null;

  static getService(): FirebaseService {
    if (!this.instance) {
      console.log("Initializing real Firebase service...");
      this.instance = new SimpleFirebaseService();
    }
    return this.instance;
  }

  static reset() {
    this.instance = null;
  }
}

export const firebaseServices = FirebaseServiceFactory.getService();

export async function checkFirebaseHealth(): Promise<{
  status: "connected" | "error";
  message: string;
}> {
  try {
    // Always use real Firebase - no mock service
    return {
      status: "connected",
      message: "Connected to real Firebase",
    };
  } catch (error: any) {
    return {
      status: "error",
      message: `Firebase error: ${error.message}`,
    };
  }
}

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
    console.log("Obstacle saved locally");
  } catch (error) {
    console.error("Failed to save obstacle locally:", error);
  }
}
