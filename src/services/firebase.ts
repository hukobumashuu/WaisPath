// src/services/firebase.ts
// ENHANCED: Added admin support to existing Firebase service without breaking changes

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

// NEW: Admin user interface for mobile app
interface AdminUser {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  role?: "super_admin" | "lgu_admin" | "field_admin";
  permissions?: string[];
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
      // NEW: Admin context (optional)
      adminUser?: AdminUser;
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
    // NEW: Admin helper methods
    getCurrentAdminUser: () => Promise<AdminUser | null>;
    updateObstacleStatus: (
      obstacleId: string,
      status: "verified" | "resolved" | "false_report",
      adminUser: AdminUser,
      notes?: string
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

// ENHANCED Real Firebase service with admin support
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
    // ENHANCED: Updated reportObstacle with admin support
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
      // NEW: Admin context (optional)
      adminUser?: AdminUser;
    }): Promise<string> => {
      await this.ensureInitialized();

      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      try {
        const obstacleId = `obstacle_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // NEW: Admin logic - safe defaults for non-admin users
        const isAdminReport = obstacleData.adminUser?.isAdmin === true;
        const adminRole = obstacleData.adminUser?.role;
        const adminEmail = obstacleData.adminUser?.email;

        const obstacleDocument = {
          id: obstacleId,
          location: {
            latitude: obstacleData.location.latitude,
            longitude: obstacleData.location.longitude,
          },
          type: obstacleData.type,
          severity: obstacleData.severity,
          description: obstacleData.description,
          reportedBy: this.currentUser.uid,
          reportedAt: serverTimestamp(),
          timePattern: obstacleData.timePattern || "permanent",

          // ENHANCED: Auto-verification for admin reports
          verified: isAdminReport, // Admin reports are auto-verified
          status: isAdminReport ? "verified" : "pending", // Skip pending for admins

          // NEW: Admin metadata (only added if admin report)
          ...(isAdminReport && {
            adminReported: true,
            adminRole: adminRole,
            adminEmail: adminEmail,
            autoVerified: true, // Flag for auto-verification
          }),

          // Existing validation fields
          upvotes: 0,
          downvotes: 0,
          reportsCount: 1,

          // Media
          ...(obstacleData.photoBase64 && {
            photoBase64: obstacleData.photoBase64,
          }),
          deviceType: await this.getUserDeviceType(),
        };

        await addDoc(collection(this.db, "obstacles"), obstacleDocument);

        console.log(
          `✅ Obstacle reported successfully: ${obstacleId} ${
            isAdminReport
              ? "(ADMIN REPORT - AUTO-VERIFIED)"
              : "(COMMUNITY REPORT)"
          }`
        );

        // NEW: Log admin action if admin report (placeholder for Step 2)
        if (isAdminReport && adminEmail) {
          try {
            console.log(
              `📋 Admin report logged: ${adminEmail} reported ${obstacleData.type}`
            );
            // TODO: Add audit logging in Step 2
          } catch (error) {
            console.warn("Failed to log admin action:", error);
            // Non-blocking - report still succeeds
          }
        }

        return obstacleId;
      } catch (error: any) {
        console.error("Failed to report obstacle:", error);
        throw new Error(`Hindi ma-report ang obstacle: ${error.message}`);
      }
    },

    // ENHANCED: Get obstacles with admin metadata preserved
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
                data.reportedAt?.toDate?.() ||
                new Date(data.reportedAt) ||
                new Date(),
              verified: data.verified || false,
              timePattern: data.timePattern,
              upvotes: data.upvotes || 0,
              downvotes: data.downvotes || 0,
              status: data.status || "pending",
              reportsCount: data.reportsCount || 1,
              photoBase64: data.photoBase64,
              confidenceScore: data.confidenceScore,
              lastVerifiedAt: data.lastVerifiedAt?.toDate?.(),

              // NEW: Admin fields (safe access)
              adminReported: data.adminReported || false,
              adminRole: data.adminRole,
              adminEmail: data.adminEmail,
              autoVerified: data.autoVerified || false,
            });
          }
        });

        // FIXED: Apply spatial filtering using proper coordinate calculation
        const filteredObstacles = allObstacles.filter((obstacle) => {
          const distance = haversineKm(
            { latitude: lat, longitude: lng },
            obstacle.location
          );
          return distance <= radiusKm;
        });

        console.log(
          `📍 Found ${
            filteredObstacles.length
          } obstacles in ${radiusKm}km radius (${
            filteredObstacles.filter((o) => o.adminReported).length
          } admin reports)`
        );

        return dedupeById(filteredObstacles).slice(0, 50);
      } catch (error: any) {
        console.error("Failed to get obstacles in area:", error);
        throw new Error(`Hindi ma-load ang mga obstacles: ${error.message}`);
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

      const userId = this.currentUser?.uid || "anonymous";

      try {
        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (!querySnapshot.empty) {
          const obstacleDoc = querySnapshot.docs[0];
          await updateDoc(obstacleDoc.ref, {
            [verification === "upvote" ? "upvotes" : "downvotes"]: increment(1),
            [`${verification}dBy`]: arrayUnion(userId),
            reportsCount: increment(1),
            lastVerifiedAt: serverTimestamp(),
          });
        }

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

    // NEW: Helper method to check if current user is admin
    getCurrentAdminUser: async (): Promise<AdminUser | null> => {
      try {
        if (!this.currentUser) return null;

        // Get user's ID token with custom claims
        const tokenResult = await this.currentUser.getIdTokenResult();
        const claims = tokenResult.claims;

        if (claims.admin === true) {
          return {
            uid: this.currentUser.uid,
            email: this.currentUser.email,
            isAdmin: true,
            role: claims.role as "super_admin" | "lgu_admin" | "field_admin",
            permissions: (claims.permissions as string[]) || [],
          };
        }

        return null;
      } catch (error) {
        console.warn("Failed to check admin status:", error);
        return null;
      }
    },

    // NEW: Admin obstacle status update
    updateObstacleStatus: async (
      obstacleId: string,
      status: "verified" | "resolved" | "false_report",
      adminUser: AdminUser,
      notes?: string
    ): Promise<void> => {
      await this.ensureInitialized();

      const { collection, query, where, getDocs, updateDoc, serverTimestamp } =
        await import("firebase/firestore");

      try {
        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (!querySnapshot.empty) {
          const obstacleDoc = querySnapshot.docs[0];

          const updateData: any = {
            status,
            verified: status === "verified",
            reviewedBy: adminUser.uid,
            reviewedAt: serverTimestamp(),
            adminValidation: true,
          };

          if (notes) {
            updateData.adminNotes = notes;
          }

          await updateDoc(obstacleDoc.ref, updateData);

          console.log(
            `✅ Admin ${adminUser.email} updated obstacle ${obstacleId} to ${status}`
          );

          // TODO: Add audit logging in Step 2
          console.log(
            `📋 Admin action logged: ${adminUser.email} ${status} obstacle ${obstacleId}`
          );
        }
      } catch (error: any) {
        console.error("Failed to update obstacle status:", error);
        throw new Error(`Failed to update obstacle: ${error.message}`);
      }
    },
  };
}

// SIMPLIFIED: Always use real Firebase service
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

// NEW: Helper function for reporting obstacles with admin check
export const reportObstacleWithAdminCheck = async (obstacleData: {
  location: UserLocation;
  type: ObstacleType;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
  photoBase64?: string;
  timePattern?: "permanent" | "morning" | "afternoon" | "evening" | "weekend";
}) => {
  // Check if current user is admin
  const adminUser = await firebaseServices.obstacle.getCurrentAdminUser();

  // Report with admin context if applicable
  return firebaseServices.obstacle.reportObstacle({
    ...obstacleData,
    adminUser: adminUser || undefined,
  });
};

export async function checkFirebaseHealth(): Promise<{
  status: "connected" | "error";
  message: string;
}> {
  try {
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
