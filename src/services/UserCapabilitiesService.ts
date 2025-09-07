// src/services/UserCapabilitiesService.ts
// 🎯 USER CAPABILITIES BEAST - Determines what users can do based on auth type
// Single responsibility: User permission management

import { UserAuthType } from "./RateLimitService";

// Clean interfaces for user capabilities
export interface UserCapabilities {
  authType: UserAuthType;
  canReport: boolean;
  canUploadPhotos: boolean;
  canValidateReports: boolean;
  canAccessAdminFeatures: boolean;
  dailyReportLimit: number;
  maxPhotoSize: number; // MB
  canViewAllObstacles: boolean;
  canModifyOwnReports: boolean;
  trustLevel: UserTrustLevel;
  badgeText: string;
  badgeColor: string;

  // NEW capabilities
  canTrackReports: boolean; // ability to see/report tracking of active reports
  canAccessReportHistory: boolean; // ability to view historic reports / history
}

export interface AdminCapabilities {
  canValidateReports: boolean;
  canDeleteReports: boolean;
  canBanUsers: boolean;
  canAccessAnalytics: boolean;
  canCreateFieldAdmins: boolean;
  canModifySystemSettings: boolean;
  role: AdminRole;
}

export type UserTrustLevel = "unverified" | "basic" | "trusted" | "official";
export type AdminRole = "field_admin" | "lgu_admin" | "super_admin";

export interface UserReputationData {
  accurateReports: number;
  helpfulValidations: number;
  communityUpvotes: number;
  flaggedReports: number;
  trustScore: number; // 0-1 scale
  joinedDate: Date;
}

class UserCapabilitiesService {
  /**
   * 🎯 GET USER CAPABILITIES - Main function to determine what user can do
   */
  getUserCapabilities(
    authType: UserAuthType,
    adminRole?: AdminRole,
    reputation?: UserReputationData
  ): UserCapabilities {
    const baseCapabilities = this.getBaseCapabilitiesByAuthType(authType);

    // Enhance with admin capabilities if user is admin
    if (authType === "admin" && adminRole) {
      return this.enhanceWithAdminCapabilities(baseCapabilities, adminRole);
    }

    // Enhance with reputation if user is registered
    if (authType === "registered" && reputation) {
      return this.enhanceWithReputation(baseCapabilities, reputation);
    }

    return baseCapabilities;
  }

  /**
   * 🔐 GET ADMIN CAPABILITIES - Specific admin permission management
   */
  getAdminCapabilities(adminRole: AdminRole): AdminCapabilities {
    switch (adminRole) {
      case "super_admin":
        return {
          canValidateReports: true,
          canDeleteReports: true,
          canBanUsers: true,
          canAccessAnalytics: true,
          canCreateFieldAdmins: true,
          canModifySystemSettings: true,
          role: adminRole,
        };

      case "lgu_admin":
        return {
          canValidateReports: true,
          canDeleteReports: true,
          canBanUsers: true,
          canAccessAnalytics: true,
          canCreateFieldAdmins: true, // Can create field admins
          canModifySystemSettings: false, // Cannot modify system settings
          role: adminRole,
        };

      case "field_admin":
        return {
          canValidateReports: true,
          canDeleteReports: false, // Can only validate, not delete
          canBanUsers: false,
          canAccessAnalytics: false,
          canCreateFieldAdmins: false,
          canModifySystemSettings: false,
          role: adminRole,
        };

      default:
        throw new Error(`Unknown admin role: ${adminRole}`);
    }
  }

  /**
   * 🏆 CALCULATE USER TRUST LEVEL - Based on reputation and activity
   */
  calculateTrustLevel(
    authType: UserAuthType,
    reputation?: UserReputationData
  ): UserTrustLevel {
    if (authType === "admin") {
      return "official";
    }

    if (authType === "anonymous") {
      return "unverified";
    }

    if (!reputation) {
      return "basic";
    }

    // Calculate trust based on reputation metrics
    const { trustScore, accurateReports, helpfulValidations, flaggedReports } =
      reputation;

    // High trust criteria
    if (
      trustScore >= 0.8 &&
      accurateReports >= 10 &&
      helpfulValidations >= 5 &&
      flaggedReports <= 1
    ) {
      return "trusted";
    }

    // Basic trust for registered users
    return "basic";
  }

  /**
   * 🎨 GET USER BADGE - Visual representation of user status
   */
  getUserBadge(capabilities: UserCapabilities): {
    text: string;
    color: string;
    emoji: string;
  } {
    switch (capabilities.authType) {
      case "admin":
        return {
          text: "OFFICIAL",
          color: "#3B82F6", // Blue
          emoji: "🏛️",
        };

      case "registered":
        switch (capabilities.trustLevel) {
          case "trusted":
            return {
              text: "TRUSTED",
              color: "#10B981", // Green
              emoji: "⭐",
            };
          default:
            return {
              text: "VERIFIED",
              color: "#6B7280", // Gray
              emoji: "✓",
            };
        }

      case "anonymous":
      default:
        return {
          text: "UNVERIFIED",
          color: "#F59E0B", // Orange
          emoji: "❓",
        };
    }
  }

  /**
   * 💡 GET UPGRADE SUGGESTIONS - Help users understand next steps
   */
  getUpgradeSuggestions(capabilities: UserCapabilities): string[] {
    const suggestions: string[] = [];

    if (capabilities.authType === "anonymous") {
      suggestions.push("Register for unlimited reporting with photos");
      suggestions.push("Join the community validation system");
      suggestions.push("Save your accessibility profile across devices");
    }

    if (
      capabilities.authType === "registered" &&
      capabilities.trustLevel === "basic"
    ) {
      suggestions.push("Report more accessibility obstacles to build trust");
      suggestions.push("Help validate community reports to gain reputation");
      suggestions.push("Upload accurate photos to improve community data");
    }

    return suggestions;
  }

  // ========================================
  // 🔧 PRIVATE HELPER METHODS
  // ========================================

  private getBaseCapabilitiesByAuthType(
    authType: UserAuthType
  ): UserCapabilities {
    switch (authType) {
      case "anonymous":
        return {
          authType,
          canReport: true,
          canUploadPhotos: false, // 🚫 No photos for anonymous
          canValidateReports: false, // 🚫 No validation for anonymous
          canAccessAdminFeatures: false,
          dailyReportLimit: 1, // 🚫 Limited to 1 report per day
          maxPhotoSize: 0,
          canViewAllObstacles: true,
          canModifyOwnReports: false,
          trustLevel: "unverified",
          badgeText: "UNVERIFIED",
          badgeColor: "#F59E0B",

          // NEW defaults
          canTrackReports: false,
          canAccessReportHistory: false,
        };

      case "registered":
        return {
          authType,
          canReport: true,
          canUploadPhotos: true, // ✅ Photos allowed
          canValidateReports: true, // ✅ Can upvote/downvote
          canAccessAdminFeatures: false,
          dailyReportLimit: 50, // ✅ Higher limit
          maxPhotoSize: 5, // 5MB max
          canViewAllObstacles: true,
          canModifyOwnReports: true, // Can edit their own reports
          trustLevel: "basic",
          badgeText: "VERIFIED",
          badgeColor: "#6B7280",

          // NEW defaults for registered users
          canTrackReports: true, // can track their reports and follow progress
          canAccessReportHistory: true, // can view their past reports
        };

      case "admin":
        return {
          authType,
          canReport: true,
          canUploadPhotos: true,
          canValidateReports: true,
          canAccessAdminFeatures: true, // ✅ Admin features
          dailyReportLimit: -1, // ✅ Unlimited
          maxPhotoSize: 10, // 10MB max for admins
          canViewAllObstacles: true,
          canModifyOwnReports: true,
          trustLevel: "official",
          badgeText: "OFFICIAL",
          badgeColor: "#3B82F6",

          // NEW defaults for admins
          canTrackReports: true,
          canAccessReportHistory: true,
        };

      default:
        throw new Error(`Unknown auth type: ${authType}`);
    }
  }

  private enhanceWithAdminCapabilities(
    baseCapabilities: UserCapabilities,
    adminRole: AdminRole
  ): UserCapabilities {
    const adminCaps = this.getAdminCapabilities(adminRole);

    return {
      ...baseCapabilities,
      canAccessAdminFeatures: true,
      trustLevel: "official",
      badgeText: `OFFICIAL (${adminRole.toUpperCase().replace("_", " ")})`,
      badgeColor: "#3B82F6",

      // Ensure admin-specific capabilities are enabled
      canTrackReports: true,
      canAccessReportHistory: true,
    };
  }

  private enhanceWithReputation(
    baseCapabilities: UserCapabilities,
    reputation: UserReputationData
  ): UserCapabilities {
    const trustLevel = this.calculateTrustLevel("registered", reputation);
    const badge = this.getUserBadge({ ...baseCapabilities, trustLevel });

    return {
      ...baseCapabilities,
      trustLevel,
      badgeText: badge.text,
      badgeColor: badge.color,

      // Reputation may increase tracking/history access — keep base defaults
      canTrackReports: baseCapabilities.canTrackReports,
      canAccessReportHistory: baseCapabilities.canAccessReportHistory,
    };
  }

  /**
   * 🔍 CHECK SPECIFIC PERMISSION - Utility for quick permission checks
   */
  canUserPerformAction(
    action:
      | "report"
      | "upload_photo"
      | "validate"
      | "track_reports"
      | "report_history"
      | "admin_validate"
      | "delete_report",
    capabilities: UserCapabilities,
    adminCapabilities?: AdminCapabilities
  ): boolean {
    switch (action) {
      case "report":
        return capabilities.canReport;

      case "upload_photo":
        return capabilities.canUploadPhotos;

      case "validate":
        return capabilities.canValidateReports;

      case "track_reports":
        return capabilities.canTrackReports;

      case "report_history":
        return capabilities.canAccessReportHistory;

      case "admin_validate":
        return (
          capabilities.canAccessAdminFeatures &&
          (adminCapabilities?.canValidateReports ?? false)
        );

      case "delete_report":
        return (
          capabilities.canAccessAdminFeatures &&
          (adminCapabilities?.canDeleteReports ?? false)
        );

      default:
        return false;
    }
  }
}

// 🚀 EXPORT SINGLETON INSTANCE
export const userCapabilitiesService = new UserCapabilitiesService();

// 🎯 EXPORT UTILITY FUNCTIONS FOR EASY INTEGRATION
export const getUserPermissions = (
  authType: UserAuthType,
  adminRole?: AdminRole,
  reputation?: UserReputationData
) =>
  userCapabilitiesService.getUserCapabilities(authType, adminRole, reputation);

export const checkUserPermission = (
  action:
    | "report"
    | "upload_photo"
    | "validate"
    | "track_reports"
    | "report_history"
    | "admin_validate"
    | "delete_report",
  capabilities: UserCapabilities,
  adminCapabilities?: AdminCapabilities
) =>
  userCapabilitiesService.canUserPerformAction(
    action,
    capabilities,
    adminCapabilities
  );

export const getUserBadgeInfo = (capabilities: UserCapabilities) =>
  userCapabilitiesService.getUserBadge(capabilities);
