// src/services/firebase.ts - ENHANCED WITH REAL OBSTACLE REPORTING
// Firebase Storage + Firestore with Photo Upload & Filipino Feedback

import {
  UserMobilityProfile,
  AccessibilityObstacle,
  ObstacleType,
  UserLocation,
} from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      photoUri?: string;
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
      const { getStorage } = await import("firebase/storage");
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

      // Initialize Storage
      this.storage = getStorage(this.app);
      console.log("🔥 Firebase Storage initialized");

      // Initialize Auth
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
   * Upload photo to Firebase Storage with compression info
   * Returns the download URL for Firestore storage
   */
  private async uploadPhoto(
    photoUri: string,
    obstacleId: string
  ): Promise<string> {
    await this.ensureInitialized();

    const { ref, uploadBytes, getDownloadURL } = await import(
      "firebase/storage"
    );

    try {
      console.log("📤 Uploading photo to Firebase Storage...");

      // Read the compressed photo file
      const response = await fetch(photoUri);
      const blob = await response.blob();

      // Create storage reference
      const photoRef = ref(this.storage, `obstacles/${obstacleId}/photo.jpg`);

      // Upload the file
      const snapshot = await uploadBytes(photoRef, blob);
      console.log("📤 Photo uploaded successfully");

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("🔗 Photo URL generated:", downloadURL);

      return downloadURL;
    } catch (error: any) {
      console.error("📤 Photo upload failed:", error);
      throw new Error(`Hindi ma-upload ang larawan: ${error.message}`);
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
    reportObstacle: async (obstacleData: {
      location: UserLocation;
      type: ObstacleType;
      severity: "low" | "medium" | "high" | "blocking";
      description: string;
      photoUri?: string;
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
        console.log("🚧 Reporting obstacle to Firebase...");

        // Generate obstacle ID first
        const obstacleId = `obstacle_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Upload photo if provided
        let photoUrl: string | undefined;
        if (obstacleData.photoUri) {
          try {
            photoUrl = await this.uploadPhoto(
              obstacleData.photoUri,
              obstacleId
            );
            console.log("📸 Photo uploaded for obstacle");
          } catch (photoError: any) {
            console.warn(
              "📸 Photo upload failed, continuing without photo:",
              photoError.message
            );
            // Continue without photo - obstacle report is still valuable
          }
        }

        // Create obstacle document
        const obstacleDocument = {
          id: obstacleId,
          location: obstacleData.location,
          type: obstacleData.type,
          severity: obstacleData.severity,
          description: obstacleData.description,
          photoUrl: photoUrl || null,
          timePattern: obstacleData.timePattern || "permanent",
          reportedBy: this.currentUser?.uid || "anonymous",
          reportedAt: serverTimestamp(),
          verified: false,
          upvotes: 0,
          downvotes: 0,
          status: "pending", // pending, verified, resolved, false_report

          // Additional metadata for community features
          barangay: this.getBarangayFromCoordinates(obstacleData.location),
          deviceType: await this.getUserDeviceType(),
        };

        // Save to Firestore
        const obstaclesRef = collection(this.db, "obstacles");
        await addDoc(obstaclesRef, obstacleDocument);

        console.log("✅ Obstacle reported successfully:", obstacleId);
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
