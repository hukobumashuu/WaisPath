// src/services/firebase.ts
// 🔥 PHASE 1 FIX: Remove Auto-Anonymous Creation
// Trust Firebase persistence and only create anonymous users when needed

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
    // ADD THESE TWO MISSING METHODS:
    getUserReports: (userId: string) => Promise<AccessibilityObstacle[]>;
    getObstacleById: (
      obstacleId: string
    ) => Promise<AccessibilityObstacle | null>;
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
  private auth: any = null; // 🔥 NEW: Store auth instance for lazy anonymous creation

  // 🔥 PHASE 1 FIX: Remove auto-anonymous creation
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.connectionFailed) {
      throw new Error("Firebase connection previously failed");
    }

    try {
      console.log("Initializing Firebase connection...");

      const { initializeApp, getApps } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore");

      // 🔥 FIX: Use unified auth instead of creating new auth instance
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );

      // Get existing app or create new one
      const existingApps = getApps();
      let app;
      if (existingApps.length > 0) {
        app = existingApps[0];
        console.log("Using existing Firebase app");
      } else {
        const config = getFirebaseConfig();
        app = initializeApp(config);
        console.log("Firebase app initialized");
      }

      this.db = getFirestore(app);

      // Use unified auth (prevents conflicts)
      this.auth = await getUnifiedFirebaseAuth();

      console.log("Connecting directly to production Firestore...");

      // 🔥 PHASE 1 FIX: Trust Firebase persistence - don't force anonymous creation
      if (this.auth.currentUser) {
        console.log(
          "User already authenticated, using existing auth:",
          this.auth.currentUser.email || "anonymous"
        );
        this.currentUser = this.auth.currentUser;
      } else {
        console.log(
          "🔄 No existing auth - waiting for Firebase persistence or explicit authentication"
        );
        // 🔥 KEY CHANGE: Don't automatically create anonymous user
        // Let Firebase restore previous auth state or wait for explicit action
        this.currentUser = null;
      }

      this.initialized = true;
      console.log(
        "🔥 Firebase initialized successfully (no forced anonymous creation)"
      );
    } catch (error: any) {
      console.error("Firebase initialization failed:", error.message);
      this.connectionFailed = true;
      throw new Error(`Firebase connection failed: ${error.message}`);
    }
  }

  // 🔥 NEW: Lazy anonymous user creation - only when needed
  private async ensureAnonymousUser(): Promise<void> {
    // If we already have a user, we're good
    if (this.currentUser) {
      return;
    }

    // If auth instance not available, initialize first
    if (!this.auth) {
      await this.ensureInitialized();
    }

    // Check if Firebase restored a user in the meantime
    if (this.auth.currentUser) {
      console.log("🔄 Firebase restored user during initialization");
      this.currentUser = this.auth.currentUser;
      return;
    }

    // Only now create anonymous user if absolutely needed
    try {
      console.log(
        "🔄 Creating anonymous user for operation that requires authentication"
      );
      const { signInAnonymously } = await import("firebase/auth");

      const authPromise = signInAnonymously(this.auth);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth timeout")), 10000)
      );

      const userCredential = await Promise.race([authPromise, timeoutPromise]);
      this.currentUser = (userCredential as any).user;

      console.log(
        "✅ Anonymous user created successfully:",
        this.currentUser.uid
      );
    } catch (error: any) {
      console.error("Failed to create anonymous user:", error);
      throw new Error(`Anonymous authentication failed: ${error.message}`);
    }
  }

  private async getUserDeviceType(): Promise<string> {
    return "mobile";
  }

  profile = {
    saveProfile: async (profile: UserMobilityProfile): Promise<void> => {
      await this.ensureInitialized();
      await this.ensureAnonymousUser();

      const { collection, query, where, getDocs, doc, setDoc, addDoc } =
        await import("firebase/firestore");

      try {
        // Check if profile already exists for this user
        const profilesQuery = query(
          collection(this.db, "profiles"),
          where("userId", "==", this.currentUser.uid)
        );

        const existingProfiles = await getDocs(profilesQuery);

        const profileData = {
          ...profile,
          userId: this.currentUser.uid,
          lastUpdated: new Date(),
        };

        if (!existingProfiles.empty) {
          // Update existing profile
          const existingDoc = existingProfiles.docs[0];
          await setDoc(existingDoc.ref, profileData);
          console.log("Profile updated in Firestore");
        } else {
          // Create new profile
          await addDoc(collection(this.db, "profiles"), profileData);
          console.log("Profile created in Firestore");
        }
      } catch (error: any) {
        console.error("Failed to save profile:", error);
        throw new Error(`Hindi ma-save ang profile: ${error.message}`);
      }
    },

    getProfile: async (): Promise<UserMobilityProfile | null> => {
      await this.ensureInitialized();
      await this.ensureAnonymousUser();

      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      try {
        // Query profiles by userId field
        const profilesQuery = query(
          collection(this.db, "profiles"),
          where("userId", "==", this.currentUser.uid)
        );

        const querySnapshot = await getDocs(profilesQuery);

        if (!querySnapshot.empty) {
          const profileDoc = querySnapshot.docs[0];
          const data = profileDoc.data();
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
      await this.ensureAnonymousUser();

      const { collection, query, where, getDocs, deleteDoc } = await import(
        "firebase/firestore"
      );

      try {
        // Query profiles by userId field
        const profilesQuery = query(
          collection(this.db, "profiles"),
          where("userId", "==", this.currentUser.uid)
        );

        const querySnapshot = await getDocs(profilesQuery);

        if (!querySnapshot.empty) {
          // Delete all profiles for this user (there should only be one)
          for (const profileDoc of querySnapshot.docs) {
            await deleteDoc(profileDoc.ref);
          }
          console.log("Profile deleted from Firestore");
        } else {
          console.log("No profile found to delete");
        }
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

      // 🔥 PHASE 1 FIX: Ensure user exists before obstacle operations
      await this.ensureAnonymousUser();

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
              ? `(ADMIN AUTO-VERIFIED by ${adminRole})`
              : "(pending verification)"
          }`
        );

        return obstacleId;
      } catch (error: any) {
        console.error("Failed to report obstacle:", error);
        throw new Error(`Hindi ma-report ang obstacle: ${error.message}`);
      }
    },

    getObstaclesInArea: async (
      lat: number,
      lng: number,
      radiusKm: number
    ): Promise<AccessibilityObstacle[]> => {
      await this.ensureInitialized();

      // 🔥 PHASE 1 FIX: getObstaclesInArea doesn't need user authentication
      // This is a read operation that can work without currentUser

      const { collection, getDocs } = await import("firebase/firestore");

      try {
        const obstaclesSnapshot = await getDocs(
          collection(this.db, "obstacles")
        );

        const allObstacles: AccessibilityObstacle[] = [];

        obstaclesSnapshot.forEach((doc) => {
          const data = doc.data();
          const obstacle: AccessibilityObstacle = {
            id: data.id || doc.id,
            location: data.location,
            type: data.type as ObstacleType,
            severity: data.severity,
            description: data.description,
            reportedBy: data.reportedBy,
            reportedAt: data.reportedAt?.toDate() || new Date(),
            verified: data.verified || false,
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            photoBase64: data.photoBase64,
            timePattern: data.timePattern || "permanent",
          };
          allObstacles.push(obstacle);
        });

        const filteredObstacles = allObstacles.filter((obstacle) => {
          const distance = haversineKm(
            { latitude: lat, longitude: lng },
            obstacle.location
          );
          return distance <= radiusKm;
        });

        const deduped = dedupeById(filteredObstacles);

        console.log(
          `📍 Found ${deduped.length} obstacles in ${radiusKm}km radius`
        );

        return deduped;
      } catch (error: any) {
        console.error("Failed to get obstacles:", error);
        throw new Error(`Hindi ma-load ang mga obstacles: ${error.message}`);
      }
    },

    verifyObstacle: async (
      obstacleId: string,
      verification: "upvote" | "downvote"
    ): Promise<void> => {
      await this.ensureInitialized();

      // 🔥 PHASE 1 FIX: Ensure user exists before verification operations
      await this.ensureAnonymousUser();

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
        const userId = this.currentUser.uid;

        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (!querySnapshot.empty) {
          const obstacleDoc = querySnapshot.docs[0];

          // 🔥 PHASE 1 CRITICAL FIX: Only update vote counts and metadata
          // DO NOT increment reportsCount - that's for duplicate reports, not validations
          await updateDoc(obstacleDoc.ref, {
            [verification === "upvote" ? "upvotes" : "downvotes"]: increment(1),
            [`${verification}dBy`]: arrayUnion(userId),
            // ❌ REMOVED: reportsCount: increment(1),  // THIS WAS THE BUG CAUSING CORRUPTION
            lastVerifiedAt: serverTimestamp(),
          });

          console.log(
            `✅ ${verification} recorded for obstacle ${obstacleId} (reportsCount unchanged)`
          );
        }
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

      // 🔥 PHASE 1 FIX: recordPromptEvent can work with or without user
      // Use current user if available, otherwise use anonymous placeholder

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

      // 🔥 PHASE 1 FIX: Confidence updates are administrative, don't need user

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
        // 🔥 PHASE 1 FIX: Admin check should work with existing auth state
        // Don't force anonymous creation for admin checks

        if (!this.currentUser) {
          await this.ensureInitialized();
          // Still no user after init? Not an admin
          if (!this.currentUser) return null;
        }

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

    getUserReports: async (
      userId: string
    ): Promise<AccessibilityObstacle[]> => {
      await this.ensureInitialized();

      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      try {
        console.log("Getting reports for user:", userId);

        const reportsQuery = query(
          collection(this.db, "obstacles"),
          where("reportedBy", "==", userId),
          orderBy("reportedAt", "desc") // Most recent first
        );

        const querySnapshot = await getDocs(reportsQuery);
        const reports: AccessibilityObstacle[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();

          // Convert Firestore timestamps to Date objects
          const report: AccessibilityObstacle = {
            id: data.id || doc.id,
            location: data.location,
            type: data.type,
            severity: data.severity,
            description: data.description,
            reportedBy: data.reportedBy,
            reportedAt: data.reportedAt?.toDate() || new Date(),
            verified: data.verified || false,
            status: data.status || "pending",
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            reportsCount: data.reportsCount || 1,
            timePattern: data.timePattern || "permanent",
            photoBase64: data.photoBase64,

            // Optional timestamps
            lastVerifiedAt: data.lastVerifiedAt?.toDate(),

            // Admin fields
            adminReported: data.adminReported,
            adminRole: data.adminRole,
            adminEmail: data.adminEmail,
            autoVerified: data.autoVerified,

            // Additional fields from your type
            reviewedBy: data.reviewedBy,
            reviewedAt: data.reviewedAt?.toDate(),
            adminNotes: data.adminNotes,
            confidenceScore: data.confidenceScore,
          };

          reports.push(report);
        });

        console.log(`Found ${reports.length} reports for user ${userId}`);
        return reports;
      } catch (error: any) {
        console.error("Failed to get user reports:", error);
        throw new Error(`Failed to load your reports: ${error.message}`);
      }
    },

    getObstacleById: async (
      obstacleId: string
    ): Promise<AccessibilityObstacle | null> => {
      await this.ensureInitialized();

      const { collection, query, where, getDocs, doc, getDoc } = await import(
        "firebase/firestore"
      );

      try {
        // First try to get by document ID
        const docRef = doc(this.db, "obstacles", obstacleId);
        const docSnapshot = await getDoc(docRef);

        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          return {
            id: data.id || docSnapshot.id,
            location: data.location,
            type: data.type,
            severity: data.severity,
            description: data.description,
            reportedBy: data.reportedBy,
            reportedAt: data.reportedAt?.toDate() || new Date(),
            verified: data.verified || false,
            status: data.status || "pending",
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            reportsCount: data.reportsCount || 1,
            timePattern: data.timePattern || "permanent",
            photoBase64: data.photoBase64,
            lastVerifiedAt: data.lastVerifiedAt?.toDate(),
            adminReported: data.adminReported,
            adminRole: data.adminRole,
            adminEmail: data.adminEmail,
            autoVerified: data.autoVerified,
            reviewedBy: data.reviewedBy,
            reviewedAt: data.reviewedAt?.toDate(),
            adminNotes: data.adminNotes,
            confidenceScore: data.confidenceScore,
          };
        }

        // If not found by document ID, try querying by the 'id' field
        const obstaclesQuery = query(
          collection(this.db, "obstacles"),
          where("id", "==", obstacleId)
        );

        const querySnapshot = await getDocs(obstaclesQuery);

        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0];
          const data = docData.data();

          return {
            id: data.id || docData.id,
            location: data.location,
            type: data.type,
            severity: data.severity,
            description: data.description,
            reportedBy: data.reportedBy,
            reportedAt: data.reportedAt?.toDate() || new Date(),
            verified: data.verified || false,
            status: data.status || "pending",
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            reportsCount: data.reportsCount || 1,
            timePattern: data.timePattern || "permanent",
            photoBase64: data.photoBase64,
            lastVerifiedAt: data.lastVerifiedAt?.toDate(),
            adminReported: data.adminReported,
            adminRole: data.adminRole,
            adminEmail: data.adminEmail,
            autoVerified: data.autoVerified,
            reviewedBy: data.reviewedBy,
            reviewedAt: data.reviewedAt?.toDate(),
            adminNotes: data.adminNotes,
            confidenceScore: data.confidenceScore,
          };
        }

        console.log("Obstacle not found:", obstacleId);
        return null;
      } catch (error: any) {
        console.error("Failed to get obstacle by ID:", error);
        throw new Error(`Failed to load report: ${error.message}`);
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
}): Promise<string> => {
  // Get admin context if available
  const adminUser = await firebaseServices.obstacle.getCurrentAdminUser();

  return firebaseServices.obstacle.reportObstacle({
    ...obstacleData,
    adminUser: adminUser || undefined,
  });
};
