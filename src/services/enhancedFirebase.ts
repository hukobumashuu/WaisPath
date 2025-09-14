// src/services/enhancedFirebase.ts
// FINAL FIX: All 3 issues resolved - Rate limit display, duplicate logs, anonymous photos
// Device-based rate limiting + proper status display + photo upload fix

import { firebaseServices } from "./firebase";
import {
  deviceRateLimitService,
  UserAuthType,
  DeviceRateLimitResult,
} from "./DeviceRateLimitService";
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

// FIXED: Enhanced reporting result with device-based rate limiting
interface EnhancedReportingResult {
  success: boolean;
  obstacleId?: string;
  rateLimitInfo: DeviceRateLimitResult;
  userCapabilities: UserCapabilities;
  message: string;
}

// User context for enhanced operations
interface UserContext {
  uid: string;
  authType: UserAuthType;
  capabilities: UserCapabilities;
  adminCapabilities?: AdminCapabilities;
  rateLimitInfo?: DeviceRateLimitResult; // NEW: Include rate limit info
}

class EnhancedFirebaseService {
  // Cache for unified auth state
  private unifiedAuthCache: {
    user: any;
    timestamp: number;
    isAdmin: boolean;
    claims: any;
  } | null = null;

  // NEW: Cache for user context to prevent duplicate calls
  private userContextCache: {
    context: UserContext;
    timestamp: number;
  } | null = null;

  private readonly CACHE_TTL = 30000; // 30 seconds cache
  private readonly USER_CONTEXT_CACHE_TTL = 5000; // 5 seconds for user context (shorter to show updated rate limits)

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
    this.userContextCache = null; // NEW: Clear user context cache too

    // ENHANCED: Stop status monitoring when clearing cache
    adminStatusChecker.stopMonitoring();

    console.log("🧹 Auth cache cleared and monitoring stopped");
  }

  /**
   * FIXED: Get current user context with caching to prevent duplicate calls
   */
  async getCurrentUserContext(): Promise<UserContext> {
    try {
      // NEW: Check user context cache first to prevent duplicate calls
      if (
        this.userContextCache &&
        Date.now() - this.userContextCache.timestamp <
          this.USER_CONTEXT_CACHE_TTL
      ) {
        return this.userContextCache.context;
      }

      // STEP 1: Get current user from unified auth state
      const currentUser = await this.getCurrentFirebaseUser();

      if (!currentUser) {
        console.log("No authenticated user found, returning anonymous context");

        // Ensure monitoring is stopped for anonymous users (single call)
        adminStatusChecker.stopMonitoring();

        const anonymousContext: UserContext = {
          uid: "unknown",
          authType: "anonymous",
          capabilities: this.getDefaultCapabilities(),
        };

        // Cache the context
        this.userContextCache = {
          context: anonymousContext,
          timestamp: Date.now(),
        };

        return anonymousContext;
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

        const adminContext: UserContext = {
          uid: currentUser.uid,
          authType: "admin",
          capabilities,
          adminCapabilities,
        };

        // Cache the context
        this.userContextCache = {
          context: adminContext,
          timestamp: Date.now(),
        };

        return adminContext;
      }

      // STEP 3: Check if user is registered (has email and not anonymous)
      const isRegistered =
        currentUser && !currentUser.isAnonymous && currentUser.email;
      const authType: UserAuthType = isRegistered ? "registered" : "anonymous";

      // Ensure monitoring is stopped for non-admin users (single call)
      adminStatusChecker.stopMonitoring();

      const capabilities = userCapabilitiesService.getUserCapabilities(
        authType,
        undefined
      );

      // FIXED: Get device-based rate limit info for accurate display
      const rateLimitInfo = await deviceRateLimitService.checkReportingLimits(
        currentUser.uid || "anonymous_user",
        authType
      );

      console.log(
        `${authType} user context: ${
          currentUser.email || currentUser.uid || "anonymous"
        } - ${rateLimitInfo.remaining} reports remaining`
      );

      const userContext: UserContext = {
        uid: currentUser.uid || "anonymous_user",
        authType,
        capabilities,
        rateLimitInfo, // NEW: Include rate limit info in context
      };

      // Cache the context
      this.userContextCache = {
        context: userContext,
        timestamp: Date.now(),
      };

      return userContext;
    } catch (error) {
      console.error("Failed to get current user context:", error);

      // Fallback to anonymous context
      adminStatusChecker.stopMonitoring();

      const fallbackContext: UserContext = {
        uid: "unknown",
        authType: "anonymous",
        capabilities: this.getDefaultCapabilities(),
      };

      // Cache the fallback context
      this.userContextCache = {
        context: fallbackContext,
        timestamp: Date.now(),
      };

      return fallbackContext;
    }
  }

  /**
   * Get default capabilities for anonymous users - FIXED to allow photos
   */
  private getDefaultCapabilities(): UserCapabilities {
    const capabilities =
      userCapabilitiesService.getUserCapabilities("anonymous");

    // FIXED: Allow anonymous users to upload photos (they can take them, just can't see them in reports)
    return {
      ...capabilities,
      canUploadPhotos: true, // CHANGED: Allow anonymous photo upload
    };
  }

  /**
   * FIXED: Get user reporting status with device-based rate limiting info
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
   * FIXED: Enhanced obstacle reporting with device-based rate limiting and anonymous photo support
   */
  async reportObstacleEnhanced(
    obstacleData: EnhancedObstacleData
  ): Promise<EnhancedReportingResult> {
    try {
      // Get current user context
      const context = await this.getCurrentUserContext();

      // FIXED: Use device-based rate limiting service
      const rateLimitCheck = await deviceRateLimitService.checkReportingLimits(
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
            "Daily report limit reached on this device. Register for unlimited reporting!",
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

      // FIXED: Allow anonymous users to upload photos
      // Photos will be stored but anonymous users won't see them in their reports
      // This is better UX than removing photos after they took the effort to capture them

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

      // Record the report for device-based rate limiting
      await deviceRateLimitService.recordReport(context.uid, context.authType);

      // FIXED: Clear user context cache after successful report to show updated count
      this.userContextCache = null;

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
   * Show device-based rate limit alert with upgrade options
   */
  showRateLimitAlert(
    rateLimitInfo: DeviceRateLimitResult,
    onRegister?: () => void,
    onCancel?: () => void
  ): void {
    if (
      rateLimitInfo.authType === "anonymous" &&
      rateLimitInfo.upgradeRequired
    ) {
      Alert.alert(
        "Daily Limit Reached",
        "You've used your daily report on this device. Register now for unlimited reporting with photos and report tracking!",
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
   * Upgrade user from anonymous to registered with device data transfer
   */
  async upgradeUserToRegistered(userUID?: string): Promise<boolean> {
    try {
      if (userUID) {
        // Transfer device-based anonymous data to user account
        await deviceRateLimitService.upgradeUserType(
          "anonymous",
          "registered",
          userUID
        );
        console.log("Device data transferred to registered user account");
      }

      // Clear context cache to refresh rate limits
      this.userContextCache = null;

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
      // Clear context cache to refresh permissions
      this.userContextCache = null;

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
          : "Obstacle reported successfully!";

      case "anonymous":
        return remaining > 0
          ? `Obstacle reported successfully! ${remaining} report remaining today on this device`
          : "Obstacle reported successfully! Register for unlimited reporting";

      default:
        return "Obstacle reported successfully";
    }
  }

  /**
   * Cleanup - Call periodically to clean old device rate limit data
   */
  async performMaintenance(): Promise<void> {
    try {
      await deviceRateLimitService.cleanupOldData(7);
      console.log(
        "🧹 Enhanced Firebase service maintenance completed (device-based)"
      );
    } catch (error) {
      console.error("Maintenance failed:", error);
    }
  }

  /**
   * FIXED: Force refresh user context (for AuthenticationSection)
   */
  async refreshUserContext(): Promise<UserContext> {
    // Clear cache to force fresh data
    this.userContextCache = null;
    return await this.getCurrentUserContext();
  }

  /**
   * 🧪 TESTING: Get device rate limit debug info
   */
  async getDeviceRateLimitDebugInfo(): Promise<any> {
    try {
      return await deviceRateLimitService.getDebugInfo();
    } catch (error) {
      console.error("Failed to get debug info:", error);
      return null;
    }
  }

  /**
   * 🧪 TESTING: Clear all device rate limit data
   */
  async clearAllDeviceRateLimits(): Promise<void> {
    try {
      await deviceRateLimitService.clearAllRateLimitData();
      // Clear context cache after clearing data
      this.userContextCache = null;
      console.log("🧹 All device rate limit data cleared");
    } catch (error) {
      console.error("Failed to clear device rate limits:", error);
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
  rateLimitInfo: DeviceRateLimitResult,
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

// NEW: Force refresh context
export const refreshUserContext = () =>
  enhancedFirebaseService.refreshUserContext();

// 🧪 TESTING EXPORTS
export const getDeviceRateLimitDebugInfo = () =>
  enhancedFirebaseService.getDeviceRateLimitDebugInfo();

export const clearAllDeviceRateLimits = () =>
  enhancedFirebaseService.clearAllDeviceRateLimits();
