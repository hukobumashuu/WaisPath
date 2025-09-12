// src/services/mobileAdminLogger.ts
// Mobile admin logging service for tracking admin activities on mobile app

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getUnifiedFirebaseAuth } from "../config/firebaseConfig";
import * as Device from "expo-device";
import * as Application from "expo-application";

// Mobile admin log entry interface
export interface MobileAdminLogEntry {
  id?: string;
  adminId: string;
  adminEmail: string;
  adminRole: "lgu_admin" | "field_admin";
  action: MobileAdminActionType;
  details: string;
  metadata: {
    platform: string;
    appVersion: string;
    deviceModel: string;
    deviceBrand?: string;
    osVersion: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    // For obstacle reports
    obstacleId?: string;
    obstacleType?: string;
    obstacleSeverity?: string;
  };
  timestamp: Date;
  source: "mobile_app";
}

// Mobile admin action types
export type MobileAdminActionType =
  | "mobile_admin_signin"
  | "mobile_admin_signout"
  | "mobile_obstacle_report"
  | "mobile_obstacle_verify"
  | "mobile_app_launch"
  | "mobile_location_access";

// Action descriptions for mobile actions
const MOBILE_ACTION_DESCRIPTIONS: Record<MobileAdminActionType, string> = {
  mobile_admin_signin: "Admin signed in to mobile app",
  mobile_admin_signout: "Admin signed out from mobile app",
  mobile_obstacle_report: "Reported obstacle via mobile app",
  mobile_obstacle_verify: "Verified obstacle report via mobile app",
  mobile_app_launch: "Launched mobile app",
  mobile_location_access: "Granted location access permission",
};

class MobileAdminLogger {
  private db: any;
  private isInitialized = false;

  constructor() {
    this.initializeFirestore();
  }

  private async initializeFirestore() {
    try {
      // Use the unified Firebase config
      const auth = await getUnifiedFirebaseAuth();
      if (auth && auth.app) {
        this.db = getFirestore(auth.app);
        this.isInitialized = true;
        console.log("✅ Mobile Admin Logger initialized");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Mobile Admin Logger:", error);
    }
  }

  /**
   * Get device information for logging
   */
  private async getDeviceInfo() {
    try {
      const deviceInfo = {
        platform: Device.osName || "Unknown",
        appVersion: Application.nativeApplicationVersion || "1.0.0",
        deviceModel: Device.modelName || "Unknown Device",
        deviceBrand: Device.brand || undefined,
        osVersion: Device.osVersion || "Unknown",
      };

      console.log("📱 Device info collected:", deviceInfo);
      return deviceInfo;
    } catch (error) {
      console.warn("⚠️ Could not collect device info:", error);
      return {
        platform: "React Native",
        appVersion: "1.0.0",
        deviceModel: "Unknown Device",
        osVersion: "Unknown",
      };
    }
  }

  /**
   * Check if current user is an admin
   */
  private async getCurrentAdminInfo(): Promise<{
    isAdmin: boolean;
    adminId?: string;
    adminEmail?: string;
    adminRole?: "lgu_admin" | "field_admin";
  }> {
    try {
      const auth = await getUnifiedFirebaseAuth();
      const user = auth?.currentUser;

      if (!user) {
        return { isAdmin: false };
      }

      // Get custom claims to check admin status
      const tokenResult = await user.getIdTokenResult();
      const claims = tokenResult.claims;

      const isAdmin = claims.admin === true;
      const adminRole = claims.role as "lgu_admin" | "field_admin";

      if (
        isAdmin &&
        (adminRole === "lgu_admin" || adminRole === "field_admin")
      ) {
        return {
          isAdmin: true,
          adminId: user.uid,
          adminEmail: user.email || "unknown@unknown.com",
          adminRole: adminRole,
        };
      }

      return { isAdmin: false };
    } catch (error) {
      console.error("❌ Failed to get admin info:", error);
      return { isAdmin: false };
    }
  }

  /**
   * Log mobile admin action
   */
  async logAdminAction(
    action: MobileAdminActionType,
    additionalDetails?: string,
    additionalMetadata?: Partial<MobileAdminLogEntry["metadata"]>
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initializeFirestore();
      }

      if (!this.db) {
        console.warn("⚠️ Firestore not initialized, skipping mobile log");
        return;
      }

      // Check if user is admin
      const adminInfo = await this.getCurrentAdminInfo();
      if (!adminInfo.isAdmin) {
        console.log("👤 Non-admin user, skipping admin log");
        return;
      }

      // Get device information
      const deviceInfo = await this.getDeviceInfo();

      // Create log entry
      const logEntry: Omit<MobileAdminLogEntry, "id"> = {
        adminId: adminInfo.adminId!,
        adminEmail: adminInfo.adminEmail!,
        adminRole: adminInfo.adminRole!,
        action: action,
        details: additionalDetails || MOBILE_ACTION_DESCRIPTIONS[action],
        metadata: {
          ...deviceInfo,
          ...additionalMetadata,
        },
        timestamp: new Date(),
        source: "mobile_app",
      };

      // Save to Firestore mobile_admin_logs collection
      await addDoc(collection(this.db, "mobile_admin_logs"), {
        ...logEntry,
        timestamp: serverTimestamp(), // Use server timestamp
      });

      console.log(`📝 Mobile admin log: ${action} by ${adminInfo.adminEmail}`);

      // Also log to main audit_logs for unified tracking
      await this.logToMainAuditTrail(logEntry);
    } catch (error) {
      console.error("❌ Failed to log mobile admin action:", error);
      // Don't throw error - logging shouldn't break app functionality
    }
  }

  /**
   * Log to main audit trail for website visibility
   */
  private async logToMainAuditTrail(
    mobileLogEntry: Omit<MobileAdminLogEntry, "id">
  ) {
    try {
      // Convert mobile log to main audit log format
      const auditEntry = {
        adminId: mobileLogEntry.adminId,
        adminEmail: mobileLogEntry.adminEmail,
        action: mobileLogEntry.action,
        targetType: "system" as const,
        targetId: "mobile_app",
        targetDescription: `Mobile App (${mobileLogEntry.metadata.platform})`,
        details: `${mobileLogEntry.details} - ${mobileLogEntry.metadata.deviceModel}`,
        metadata: {
          source: "mobile_app",
          deviceInfo: mobileLogEntry.metadata,
          mobileAction: true,
        },
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(this.db, "audit_logs"), auditEntry);
      console.log("📋 Mobile action logged to main audit trail");
    } catch (error) {
      console.error("⚠️ Failed to log to main audit trail:", error);
      // Non-critical error, continue
    }
  }

  /**
   * Log admin sign in
   */
  async logAdminSignIn(): Promise<void> {
    await this.logAdminAction(
      "mobile_admin_signin",
      "Admin signed in to WAISPATH mobile app"
    );
  }

  /**
   * Log admin sign out
   */
  async logAdminSignOut(): Promise<void> {
    await this.logAdminAction(
      "mobile_admin_signout",
      "Admin signed out from WAISPATH mobile app"
    );
  }

  /**
   * Log obstacle report by admin
   */
  async logObstacleReport(
    obstacleId: string,
    obstacleType: string,
    severity: string,
    location?: { latitude: number; longitude: number }
  ): Promise<void> {
    await this.logAdminAction(
      "mobile_obstacle_report",
      `Admin reported ${obstacleType} obstacle (${severity} severity)`,
      {
        obstacleId,
        obstacleType,
        obstacleSeverity: severity,
        location,
      }
    );
  }

  /**
   * Log app launch by admin
   */
  async logAppLaunch(): Promise<void> {
    const adminInfo = await this.getCurrentAdminInfo();
    if (adminInfo.isAdmin) {
      await this.logAdminAction(
        "mobile_app_launch",
        "Admin launched WAISPATH mobile app"
      );
    }
  }
}

// Export singleton instance
export const mobileAdminLogger = new MobileAdminLogger();

// Convenience functions
export const logAdminSignIn = () => mobileAdminLogger.logAdminSignIn();
export const logAdminSignOut = () => mobileAdminLogger.logAdminSignOut();
export const logAdminObstacleReport = (
  obstacleId: string,
  obstacleType: string,
  severity: string,
  location?: { latitude: number; longitude: number }
) =>
  mobileAdminLogger.logObstacleReport(
    obstacleId,
    obstacleType,
    severity,
    location
  );
export const logAdminAppLaunch = () => mobileAdminLogger.logAppLaunch();
