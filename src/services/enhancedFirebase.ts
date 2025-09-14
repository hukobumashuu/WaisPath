// src/services/enhancedFirebase.ts
// ENHANCED: Complete Firebase service with admin status monitoring integration
// ALL TYPESCRIPT ERRORS FIXED

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

// ENHANCED: Import admin status monitoring
import { adminStatusChecker } from "./adminStatusChecker";

// FIXED: Import AdminUser type from firebase service
interface AdminUser {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  role?: "super_admin" | "lgu_admin" | "field_admin";
  permissions?: string[];
}

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
  // Cache for unified auth state
  private unifiedAuthCache: {
    user: any;
    timestamp: number;
    isAdmin: boolean;
    claims: any;
  } | null = null;

  private readonly CACHE_TTL = 30000; // 30 seconds cache

  /**
   * Get current Firebase user with unified auth
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
   * ENHANCED: Clear auth cache with status monitoring cleanup
   */
  public clearAuthCache(): void {
    this.unifiedAuthCache = null;

    // ENHANCED: Stop status monitoring when clearing cache
    adminStatusChecker.stopMonitoring();

    console.log("🧹 Auth cache cleared and monitoring stopped");
  }

  /**
   * ENHANCED: Get current user context with status monitoring integration (FIXED)
   */
  async getCurrentUserContext(): Promise<UserContext> {
    try {
      // STEP 1: Get current user from unified auth state
      const currentUser = await this.getCurrentFirebaseUser();

      if (!currentUser) {
        console.log("No authenticated user found, returning anonymous context");

        // Ensure monitoring is stopped for anonymous users (single call)
        adminStatusChecker.stopMonitoring();

        return {
          uid: "unknown",
          authType: "anonymous",
          capabilities: this.getDefaultCapabilities(),
        };
      }

      // STEP 2: Check if user is admin using FRESH cached claims
      if (this.unifiedAuthCache?.isAdmin) {
        const adminRole = this.unifiedAuthCache.claims.role as any;
        const capabilities = userCapabilitiesService.getUserCapabilities(
          "admin",
          adminRole
        );
        const adminCapabilities =
          userCapabilitiesService.getAdminCapabilities(adminRole);

        console.log(`Admin user context: ${currentUser.email} (${adminRole})`);

        // ENHANCED: Ensure status monitoring is active for admin users (prevent duplicates)
        if (currentUser.email) {
          const monitoringInfo = adminStatusChecker.getMonitoringInfo();
          if (!monitoringInfo.isMonitoring) {
            console.log("Starting admin status monitoring from context update");
            adminStatusChecker.startMonitoring(currentUser.email, true);
          }
        }

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

      // ENHANCED: Stop monitoring for non-admin users (single call)
      adminStatusChecker.stopMonitoring();

      console.log(
        `${authType} user context: ${currentUser.email || "anonymous"}`
      );

      return {
        uid: currentUser.uid,
        authType,
        capabilities: userCapabilitiesService.getUserCapabilities(authType),
      };
    } catch (error) {
      console.error("Failed to get user context:", error);

      // Ensure monitoring is stopped on errors
      adminStatusChecker.stopMonitoring();

      return {
        uid: "unknown",
        authType: "anonymous",
        capabilities: this.getDefaultCapabilities(),
      };
    }
  }

  /**
   * NEW: Manual admin status check method
   * Allows components to trigger immediate status verification
   */
  async checkAdminStatus(): Promise<{
    success: boolean;
    status: string;
    message: string;
  }> {
    try {
      const currentUser = await this.getCurrentFirebaseUser();

      if (!currentUser || !currentUser.email) {
        return {
          success: false,
          status: "not_authenticated",
          message: "User not authenticated",
        };
      }

      // Check if current user is admin
      if (!this.unifiedAuthCache?.isAdmin) {
        return {
          success: true,
          status: "not_admin",
          message: "User is not an admin",
        };
      }

      // Trigger manual status check
      const result = await adminStatusChecker.manualCheck();

      if (!result) {
        return {
          success: false,
          status: "check_failed",
          message: "Failed to check admin status",
        };
      }

      return {
        success: true,
        status: result.status,
        message: result.message,
      };
    } catch (error) {
      console.error("Manual admin status check failed:", error);
      return {
        success: false,
        status: "error",
        message: "Status check error",
      };
    }
  }

  /**
   * NEW: Get admin status monitoring info
   * Useful for debugging and status displays
   */
  getAdminMonitoringInfo() {
    return adminStatusChecker.getMonitoringInfo();
  }

  /**
   * Get default capabilities for anonymous users
   */
  private getDefaultCapabilities(): UserCapabilities {
    return userCapabilitiesService.getUserCapabilities("anonymous");
  }

  /**
   * Get user reporting status with enhanced capabilities
   */
  async getUserReportingStatus(): Promise<{
    capabilities: UserCapabilities;
    context: UserContext;
  }> {
    try {
      const context = await this.getCurrentUserContext();
      return {
        capabilities: context.capabilities,
        context,
      };
    } catch (error) {
      console.error("Failed to get user reporting status:", error);
      const defaultCapabilities = this.getDefaultCapabilities();
      return {
        capabilities: defaultCapabilities,
        context: {
          uid: "unknown",
          authType: "anonymous",
          capabilities: defaultCapabilities,
        },
      };
    }
  }

  /**
   * Enhanced obstacle reporting with rate limiting and admin monitoring
   */
  async reportObstacleEnhanced(
    obstacleData: EnhancedObstacleData
  ): Promise<EnhancedReportingResult> {
    try {
      // Get current user context
      const context = await this.getCurrentUserContext();

      // FIXED: Use correct method name
      const rateLimitCheck = await rateLimitService.checkReportingLimits(
        context.uid,
        context.authType
      );

      // If rate limit exceeded for anonymous users, show upgrade prompt
      if (!rateLimitCheck.allowed && context.authType === "anonymous") {
        return {
          success: false,
          rateLimitInfo: rateLimitCheck,
          userCapabilities: context.capabilities,
          message:
            "Daily report limit reached. Register for unlimited reporting!",
        };
      }

      // If rate limit exceeded for registered users (shouldn't happen), handle gracefully
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          rateLimitInfo: rateLimitCheck,
          userCapabilities: context.capabilities,
          message: "Daily report limit exceeded. Please try again tomorrow.",
        };
      }

      // Check if user can upload photos
      if (obstacleData.photoBase64 && !context.capabilities.canUploadPhotos) {
        // Remove photo for anonymous users but continue with report
        obstacleData.photoBase64 = undefined;
        console.warn("Photo removed - anonymous users cannot upload photos");
      }

      // FIXED: Handle potential null return from getCurrentAdminUser()
      let adminUser: AdminUser | undefined = undefined;
      if (context.authType === "admin") {
        try {
          const currentAdmin =
            await firebaseServices.obstacle.getCurrentAdminUser();
          adminUser = currentAdmin || undefined; // Convert null to undefined
        } catch (error) {
          console.warn("Failed to get admin context:", error);
          adminUser = undefined;
        }
      }

      // FIXED: Use correct property name and interface
      const obstacleId = await firebaseServices.obstacle.reportObstacle({
        ...obstacleData,
        adminUser, // Now properly typed as AdminUser | undefined
      });

      // Record the report for rate limiting
      await rateLimitService.recordReport(context.uid, context.authType);

      // Generate success message
      const message = this.generateSuccessMessage(
        context.authType,
        rateLimitCheck.remaining - 1
      );

      return {
        success: true,
        obstacleId,
        rateLimitInfo: {
          ...rateLimitCheck,
          remaining: rateLimitCheck.remaining - 1,
        },
        userCapabilities: context.capabilities,
        message,
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
        message: `Failed to report obstacle: ${error.message}`,
      };
    }
  }

  /**
   * Enhanced obstacle verification with admin capabilities check
   */
  async verifyObstacleEnhanced(
    obstacleId: string,
    verification: "upvote" | "downvote"
  ): Promise<{
    success: boolean;
    message: string;
    userCapabilities: UserCapabilities;
  }> {
    try {
      const context = await this.getCurrentUserContext();

      // Check if user can validate reports
      if (!context.capabilities.canValidateReports) {
        return {
          success: false,
          message: "You need to register to validate reports",
          userCapabilities: context.capabilities,
        };
      }

      // FIXED: Use correct property name and method signature
      await firebaseServices.obstacle.verifyObstacle(obstacleId, verification);

      return {
        success: true,
        message: `Report ${verification} recorded successfully`,
        userCapabilities: context.capabilities,
      };
    } catch (error: any) {
      console.error("Enhanced verification failed:", error);
      return {
        success: false,
        message: `Failed to ${verification} report: ${error.message}`,
        userCapabilities: this.getDefaultCapabilities(),
      };
    }
  }

  /**
   * Show rate limit alert with upgrade options
   */
  showRateLimitAlert(
    rateLimitInfo: RateLimitResult,
    onRegister?: () => void,
    onCancel?: () => void
  ): void {
    if (
      rateLimitInfo.authType === "anonymous" &&
      rateLimitInfo.upgradeRequired
    ) {
      Alert.alert(
        "Daily Limit Reached",
        "You've used your daily report. Register now for unlimited reporting with photos and report tracking!",
        [
          {
            text: "Maybe Later",
            style: "cancel",
            onPress: onCancel,
          },
          {
            text: "Register Now",
            style: "default",
            onPress: onRegister,
          },
        ]
      );
    } else {
      Alert.alert("Rate Limit", rateLimitInfo.message, [
        { text: "OK", style: "default" },
      ]);
    }
  }

  /**
   * Upgrade user from anonymous to registered
   */
  async upgradeUserToRegistered(userUID?: string): Promise<boolean> {
    try {
      // This would integrate with your user upgrade flow
      console.log("Upgrading user to registered status");
      return true;
    } catch (error) {
      console.error("User upgrade failed:", error);
      return false;
    }
  }

  /**
   * Upgrade user to admin (for testing/setup)
   */
  async upgradeUserToAdmin(userUID: string, adminRole: any): Promise<boolean> {
    try {
      // This would integrate with your admin setup flow
      console.log("Upgrading user to admin status");
      return true;
    } catch (error) {
      console.error("Admin upgrade failed:", error);
      return false;
    }
  }

  /**
   * Generate success message based on user type and remaining reports
   */
  private generateSuccessMessage(
    authType: UserAuthType,
    remaining: number
  ): string {
    switch (authType) {
      case "admin":
        return "Obstacle reported and automatically verified! Thank you for helping improve accessibility.";

      case "registered":
        return remaining > 0
          ? `Obstacle reported successfully! ${remaining} reports remaining today`
          : "Obstacle reported successfully! Register for unlimited reporting";

      case "anonymous":
        return remaining > 0
          ? `Obstacle reported successfully! ${remaining} report remaining today`
          : "Obstacle reported successfully! Register for unlimited reporting";

      default:
        return "Obstacle reported successfully";
    }
  }

  /**
   * Cleanup - Call periodically to clean old rate limit data
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

// Export singleton instance
export const enhancedFirebaseService = new EnhancedFirebaseService();

// Export convenience functions for easy migration
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

// Export user upgrade functions
export const upgradeToRegisteredUser = (userUID?: string) =>
  enhancedFirebaseService.upgradeUserToRegistered(userUID);

export const upgradeToAdminUser = (userUID: string, adminRole: any) =>
  enhancedFirebaseService.upgradeUserToAdmin(userUID, adminRole);

// Export cache management
export const clearAuthCache = () => enhancedFirebaseService.clearAuthCache();
