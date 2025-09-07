// src/services/EnhancedFirebaseService.ts
// 🔥 ENHANCED FIREBASE SERVICE - Adds rate limiting to existing Firebase service
// ZERO BREAKING CHANGES - Wraps your existing firebaseServices

import { firebaseServices } from "./firebase";
import {
  rateLimitService,
  UserAuthType,
  RateLimitResult,
} from "./RateLimitService";
import {
  userCapabilitiesService,
  UserCapabilities,
  AdminCapabilities,
} from "./UserCapabilitiesService";
import { UserLocation, ObstacleType, AccessibilityObstacle } from "../types";
import { Alert } from "react-native";

// Enhanced obstacle reporting interface
interface EnhancedObstacleData {
  location: UserLocation;
  type: ObstacleType;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
  photoBase64?: string;
  timePattern?: "permanent" | "morning" | "afternoon" | "evening" | "weekend";
}

// Enhanced reporting result
interface EnhancedReportingResult {
  success: boolean;
  obstacleId?: string;
  rateLimitInfo: RateLimitResult;
  userCapabilities: UserCapabilities;
  message: string;
}

// User context for enhanced operations
interface UserContext {
  uid: string;
  authType: UserAuthType;
  capabilities: UserCapabilities;
  adminCapabilities?: AdminCapabilities;
}

class EnhancedFirebaseService {
  /**
   * 🎯 ENHANCED OBSTACLE REPORTING - Main function with rate limiting
   */
  async reportObstacleEnhanced(
    obstacleData: EnhancedObstacleData,
    userContext?: UserContext
  ): Promise<EnhancedReportingResult> {
    try {
      // Get user context if not provided
      const context = userContext || (await this.getCurrentUserContext());

      console.log(
        `🚀 Enhanced obstacle reporting for ${context.authType} user: ${context.uid}`
      );

      // 1. CHECK RATE LIMITING
      const rateLimitCheck = await rateLimitService.checkReportingLimits(
        context.uid,
        context.authType
      );

      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          rateLimitInfo: rateLimitCheck,
          userCapabilities: context.capabilities,
          message: rateLimitCheck.message || "Rate limit exceeded",
        };
      }

      // 2. CHECK USER CAPABILITIES
      if (!context.capabilities.canReport) {
        return {
          success: false,
          rateLimitInfo: rateLimitCheck,
          userCapabilities: context.capabilities,
          message: "User does not have reporting permissions",
        };
      }

      // 3. VALIDATE PHOTO UPLOAD PERMISSION
      if (obstacleData.photoBase64 && !context.capabilities.canUploadPhotos) {
        // Remove photo for users who can't upload photos
        console.log(
          `📷 Removing photo - ${context.authType} users cannot upload photos`
        );
        obstacleData = { ...obstacleData, photoBase64: undefined };
      }

      // 4. GET ADMIN USER FOR EXISTING FIREBASE SERVICE
      const adminUserResult =
        context.authType === "admin"
          ? await firebaseServices.obstacle.getCurrentAdminUser()
          : null;

      // Fix the null assignment error by explicitly handling null
      const adminUser = adminUserResult || undefined;

      // 5. CALL EXISTING FIREBASE SERVICE (ZERO BREAKING CHANGES)
      const obstacleId = await firebaseServices.obstacle.reportObstacle({
        ...obstacleData,
        adminUser,
      });

      // 6. RECORD REPORT FOR RATE LIMITING
      await rateLimitService.recordReport(context.uid, context.authType);

      console.log(`✅ Enhanced obstacle reporting successful: ${obstacleId}`);

      return {
        success: true,
        obstacleId,
        rateLimitInfo: rateLimitCheck,
        userCapabilities: context.capabilities,
        message: this.getSuccessMessage(
          context.authType,
          rateLimitCheck.remaining
        ),
      };
    } catch (error: any) {
      console.error("Enhanced obstacle reporting failed:", error);

      return {
        success: false,
        rateLimitInfo: {
          allowed: false,
          remaining: 0,
          resetTime: new Date(),
          authType: "anonymous",
          upgradeRequired: false,
          message: "Reporting failed",
        },
        userCapabilities: this.getDefaultCapabilities(),
        message: `Reporting failed: ${error.message}`,
      };
    }
  }

  /**
   * 🔍 GET CURRENT USER CONTEXT - Determines user auth type and capabilities
   */
  async getCurrentUserContext(): Promise<UserContext> {
    try {
      // Check if user is admin
      const adminUser = await firebaseServices.obstacle.getCurrentAdminUser();

      if (adminUser) {
        const adminRole = adminUser.role as any;
        const capabilities = userCapabilitiesService.getUserCapabilities(
          "admin",
          adminRole
        );
        const adminCapabilities =
          userCapabilitiesService.getAdminCapabilities(adminRole);

        return {
          uid: adminUser.uid,
          authType: "admin",
          capabilities,
          adminCapabilities,
        };
      }

      // Check if user is registered (has email)
      const currentUser = await this.getCurrentFirebaseUser();
      const isRegistered = currentUser && !currentUser.isAnonymous;

      const authType: UserAuthType = isRegistered ? "registered" : "anonymous";
      const capabilities =
        userCapabilitiesService.getUserCapabilities(authType);

      return {
        uid: currentUser?.uid || "unknown",
        authType,
        capabilities,
      };
    } catch (error) {
      console.error("Failed to get current user context:", error);

      // Return safe defaults
      return {
        uid: "unknown",
        authType: "anonymous",
        capabilities: this.getDefaultCapabilities(),
      };
    }
  }

  /**
   * 📊 GET USER REPORTING STATUS - For UI display
   */
  async getUserReportingStatus(): Promise<{
    rateLimitInfo: RateLimitResult;
    capabilities: UserCapabilities;
    canReportNow: boolean;
    nextAction: "report" | "register" | "wait";
    actionMessage: string;
  }> {
    try {
      const context = await this.getCurrentUserContext();
      const rateLimitInfo = await rateLimitService.checkReportingLimits(
        context.uid,
        context.authType
      );

      const canReportNow =
        rateLimitInfo.allowed && context.capabilities.canReport;

      let nextAction: "report" | "register" | "wait" = "report";
      let actionMessage = "Ready to report obstacles";

      if (!canReportNow) {
        if (rateLimitInfo.upgradeRequired) {
          nextAction = "register";
          actionMessage = "Register for unlimited reporting with photos";
        } else {
          nextAction = "wait";
          actionMessage = `Daily limit reached. Resets at ${rateLimitInfo.resetTime.toLocaleTimeString()}`;
        }
      }

      return {
        rateLimitInfo,
        capabilities: context.capabilities,
        canReportNow,
        nextAction,
        actionMessage,
      };
    } catch (error) {
      console.error("Failed to get user reporting status:", error);

      // Return safe defaults
      return {
        rateLimitInfo: {
          allowed: false,
          remaining: 0,
          resetTime: new Date(),
          authType: "anonymous",
          upgradeRequired: false,
          message: "Status check failed",
        },
        capabilities: this.getDefaultCapabilities(),
        canReportNow: false,
        nextAction: "wait",
        actionMessage: "Unable to check reporting status",
      };
    }
  }

  /**
   * 🔄 UPGRADE USER TO REGISTERED - Called after successful registration
   */
  async upgradeUserToRegistered(userUID?: string): Promise<void> {
    try {
      const uid = userUID || (await this.getCurrentFirebaseUser())?.uid;
      if (!uid) {
        throw new Error("No user ID available for upgrade");
      }

      // Update rate limiting for new user type
      await rateLimitService.upgradeUserType(uid, "registered");

      console.log(
        `🔄 User ${uid} upgraded to registered - unlimited reporting enabled`
      );
    } catch (error) {
      console.error("Failed to upgrade user to registered:", error);
    }
  }

  /**
   * 🏛️ UPGRADE USER TO ADMIN - Called when admin claims are set
   */
  async upgradeUserToAdmin(userUID: string, adminRole: any): Promise<void> {
    try {
      // Update rate limiting for admin user
      await rateLimitService.upgradeUserType(userUID, "admin");

      console.log(
        `🏛️ User ${userUID} upgraded to admin (${adminRole}) - unlimited reporting enabled`
      );
    } catch (error) {
      console.error("Failed to upgrade user to admin:", error);
    }
  }

  /**
   * 📱 SHOW RATE LIMIT ALERT - User-friendly rate limit notification
   */
  showRateLimitAlert(
    rateLimitInfo: RateLimitResult,
    onRegister?: () => void,
    onCancel?: () => void
  ): void {
    if (rateLimitInfo.upgradeRequired) {
      Alert.alert(
        "Daily Limit Reached",
        "Anonymous users can report 1 obstacle per day.\n\nRegister for unlimited reporting with photos!",
        [
          {
            text: "Later",
            style: "cancel",
            onPress: onCancel,
          },
          {
            text: "Register",
            onPress: onRegister || (() => console.log("Registration needed")),
          },
        ]
      );
    } else {
      Alert.alert(
        "Daily Limit Reached",
        `You've reached your daily reporting limit.\n\nResets at ${rateLimitInfo.resetTime.toLocaleTimeString()}`,
        [
          {
            text: "OK",
            onPress: onCancel,
          },
        ]
      );
    }
  }

  /**
   * 🎯 ENHANCED OBSTACLE VERIFICATION - With user capability checking
   */
  async verifyObstacleEnhanced(
    obstacleId: string,
    verification: "upvote" | "downvote"
  ): Promise<{
    success: boolean;
    message: string;
    capabilities: UserCapabilities;
  }> {
    try {
      const context = await this.getCurrentUserContext();

      // Check if user can validate reports
      if (!context.capabilities.canValidateReports) {
        return {
          success: false,
          message: `${context.authType} users cannot validate reports. Register to join community validation!`,
          capabilities: context.capabilities,
        };
      }

      // Call existing Firebase service
      await firebaseServices.obstacle.verifyObstacle(obstacleId, verification);

      return {
        success: true,
        message: `${
          verification === "upvote" ? "Upvoted" : "Downvoted"
        } obstacle successfully`,
        capabilities: context.capabilities,
      };
    } catch (error: any) {
      console.error("Enhanced obstacle verification failed:", error);

      return {
        success: false,
        message: `Verification failed: ${error.message}`,
        capabilities: this.getDefaultCapabilities(),
      };
    }
  }

  // ========================================
  // 🔧 WRAPPER METHODS - Direct access to existing Firebase services
  // ========================================

  /**
   * 🗺️ GET OBSTACLES - Direct wrapper to existing service
   */
  async getObstaclesInArea(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<AccessibilityObstacle[]> {
    return firebaseServices.obstacle.getObstaclesInArea(lat, lng, radiusKm);
  }

  /**
   * 👤 PROFILE METHODS - Direct wrappers to existing profile service
   */
  async saveProfile(profile: any): Promise<void> {
    return firebaseServices.profile.saveProfile(profile);
  }

  async getProfile(): Promise<any> {
    return firebaseServices.profile.getProfile();
  }

  async deleteProfile(): Promise<void> {
    return firebaseServices.profile.deleteProfile();
  }

  // ========================================
  // 🔧 PRIVATE HELPER METHODS
  // ========================================

  private async getCurrentFirebaseUser(): Promise<any> {
    try {
      // Access the current user from your existing Firebase service
      // This might need adjustment based on your exact Firebase service structure
      return (firebaseServices as any).currentUser;
    } catch (error) {
      console.error("Failed to get current Firebase user:", error);
      return null;
    }
  }

  private getDefaultCapabilities(): UserCapabilities {
    return userCapabilitiesService.getUserCapabilities("anonymous");
  }

  private getSuccessMessage(authType: UserAuthType, remaining: number): string {
    switch (authType) {
      case "admin":
        return "Official obstacle report submitted successfully";

      case "registered":
        return `Obstacle reported successfully! ${remaining} reports remaining today`;

      case "anonymous":
        return remaining > 0
          ? `Obstacle reported successfully! ${remaining} report remaining today`
          : "Obstacle reported successfully! Register for unlimited reporting";

      default:
        return "Obstacle reported successfully";
    }
  }

  /**
   * 🧹 CLEANUP - Call periodically to clean old rate limit data
   */
  async performMaintenance(): Promise<void> {
    try {
      await rateLimitService.cleanupOldData(7); // Keep 7 days of data
      console.log("🧹 Enhanced Firebase service maintenance completed");
    } catch (error) {
      console.error("Maintenance failed:", error);
    }
  }
}

// 🚀 EXPORT SINGLETON INSTANCE
export const enhancedFirebaseService = new EnhancedFirebaseService();

// 🎯 EXPORT CONVENIENCE FUNCTIONS FOR EASY MIGRATION
export const reportObstacleWithRateLimit = (
  obstacleData: EnhancedObstacleData
) => enhancedFirebaseService.reportObstacleEnhanced(obstacleData);

export const checkUserReportingStatus = () =>
  enhancedFirebaseService.getUserReportingStatus();

export const verifyObstacleWithPermissionCheck = (
  obstacleId: string,
  verification: "upvote" | "downvote"
) => enhancedFirebaseService.verifyObstacleEnhanced(obstacleId, verification);

export const showRateLimitNotification = (
  rateLimitInfo: RateLimitResult,
  onRegister?: () => void,
  onCancel?: () => void
) =>
  enhancedFirebaseService.showRateLimitAlert(
    rateLimitInfo,
    onRegister,
    onCancel
  );

// 🔄 EXPORT USER UPGRADE FUNCTIONS
export const upgradeToRegisteredUser = (userUID?: string) =>
  enhancedFirebaseService.upgradeUserToRegistered(userUID);

export const upgradeToAdminUser = (userUID: string, adminRole: any) =>
  enhancedFirebaseService.upgradeUserToAdmin(userUID, adminRole);
