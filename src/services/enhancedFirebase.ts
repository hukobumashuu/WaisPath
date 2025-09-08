// src/services/enhancedFirebase.ts
// 🔥 ENHANCED FIREBASE SERVICE - FIXED VERSION
// Resolves auth state conflict between anonymous and admin login

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
  // 🔥 NEW: Cache for unified auth state
  private unifiedAuthCache: {
    user: any;
    timestamp: number;
    isAdmin: boolean;
    claims: any;
  } | null = null;

  private readonly CACHE_TTL = 30000; // 30 seconds cache

  /**
   * SIMPLIFIED: Get current Firebase user with unified auth
   */
  private async getCurrentFirebaseUser(): Promise<any> {
    try {
      // Check cache first
      if (
        this.unifiedAuthCache &&
        Date.now() - this.unifiedAuthCache.timestamp < this.CACHE_TTL
      ) {
        return this.unifiedAuthCache.user;
      }

      // Use unified Firebase auth (prevents auth conflicts)
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );
      const auth = await getUnifiedFirebaseAuth();
      const currentUser = auth.currentUser;

      console.log(
        `🔍 getCurrentFirebaseUser: ${
          currentUser?.email || "anonymous"
        } (isAnonymous: ${currentUser?.isAnonymous})`
      );

      // Update cache
      if (currentUser) {
        try {
          const tokenResult = await currentUser.getIdTokenResult();
          this.unifiedAuthCache = {
            user: currentUser,
            timestamp: Date.now(),
            isAdmin: tokenResult.claims.admin === true,
            claims: tokenResult.claims,
          };
        } catch (error) {
          console.warn("Failed to get token claims, using user without claims");
          this.unifiedAuthCache = {
            user: currentUser,
            timestamp: Date.now(),
            isAdmin: false,
            claims: {},
          };
        }
      } else {
        this.unifiedAuthCache = null;
      }

      return currentUser;
    } catch (error) {
      console.error("Failed to get current Firebase user:", error);
      this.unifiedAuthCache = null;
      return null;
    }
  }

  /**
   * 🔥 FIXED: Clear auth cache when login state changes
   */
  public clearAuthCache(): void {
    this.unifiedAuthCache = null;
    console.log("🧹 Auth cache cleared");
  }

  /**
   * 🔍 FIXED: GET CURRENT USER CONTEXT - Uses unified auth state
   */
  async getCurrentUserContext(): Promise<UserContext> {
    try {
      // STEP 1: Get current user from unified auth state
      const currentUser = await this.getCurrentFirebaseUser();

      if (!currentUser) {
        console.log(
          "🔍 No authenticated user found, returning anonymous context"
        );
        return {
          uid: "unknown",
          authType: "anonymous",
          capabilities: this.getDefaultCapabilities(),
        };
      }

      // STEP 2: Check if user is admin using cached claims
      if (this.unifiedAuthCache?.isAdmin) {
        const adminRole = this.unifiedAuthCache.claims.role as any;
        const capabilities = userCapabilitiesService.getUserCapabilities(
          "admin",
          adminRole
        );
        const adminCapabilities =
          userCapabilitiesService.getAdminCapabilities(adminRole);

        console.log(
          `🏛️ Admin user context: ${currentUser.email} (${adminRole})`
        );

        return {
          uid: currentUser.uid,
          authType: "admin",
          capabilities,
          adminCapabilities,
        };
      }

      // STEP 3: Check if user is registered (has email and not anonymous)
      const isRegistered =
        currentUser && !currentUser.isAnonymous && currentUser.email;
      const authType: UserAuthType = isRegistered ? "registered" : "anonymous";

      console.log(
        `👤 User context: ${authType} (email: ${currentUser.email}, anonymous: ${currentUser.isAnonymous})`
      );

      const capabilities =
        userCapabilitiesService.getUserCapabilities(authType);

      return {
        uid: currentUser.uid,
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
   * 🎯 ENHANCED OBSTACLE REPORTING - FIXED: Admin auto-verification
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
        console.log(
          `📷 Removing photo - ${context.authType} users cannot upload photos`
        );
        obstacleData = { ...obstacleData, photoBase64: undefined };
      }

      // 4. FIXED: GET ADMIN USER CONTEXT FOR AUTO-VERIFICATION (correct service path)
      let adminUser = null;
      if (context.authType === "admin") {
        try {
          // FIXED: Use correct service path (obstacle, not obstacles)
          adminUser = await firebaseServices.obstacle.getCurrentAdminUser();
          console.log(
            `🏛️ Admin user detected for reporting: ${adminUser?.email} (${adminUser?.role})`
          );
        } catch (error) {
          console.warn("Failed to get admin context:", error);
        }
      }

      // 5. CALL EXISTING FIREBASE SERVICE WITH ADMIN CONTEXT
      const obstacleId = await firebaseServices.obstacle.reportObstacle({
        ...obstacleData,
        adminUser: adminUser || undefined, // Pass admin context for auto-verification
      });

      // 6. RECORD REPORT FOR RATE LIMITING
      await rateLimitService.recordReport(context.uid, context.authType);

      console.log(
        `✅ Enhanced obstacle reporting successful: ${obstacleId}${
          adminUser ? " (AUTO-VERIFIED ADMIN REPORT)" : ""
        }`
      );

      return {
        success: true,
        obstacleId,
        rateLimitInfo: rateLimitCheck,
        userCapabilities: context.capabilities,
        message: adminUser
          ? "Official obstacle report submitted and auto-verified successfully! 🏛️"
          : this.getSuccessMessage(context.authType, rateLimitCheck.remaining),
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

      // Clear cache to force fresh auth state check
      this.clearAuthCache();

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
      // Clear cache to force fresh auth state check
      this.clearAuthCache();

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

      if (!context.capabilities.canValidateReports) {
        return {
          success: false,
          message: `${context.authType} users cannot validate reports. Register to join community validation!`,
          capabilities: context.capabilities,
        };
      }

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

  async getObstaclesInArea(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<AccessibilityObstacle[]> {
    return firebaseServices.obstacle.getObstaclesInArea(lat, lng, radiusKm);
  }

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
      await rateLimitService.cleanupOldData(7);
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

// 🧹 EXPORT CACHE MANAGEMENT
export const clearAuthCache = () => enhancedFirebaseService.clearAuthCache();
