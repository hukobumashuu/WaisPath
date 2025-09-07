// src/services/RateLimitService.ts
// 🔥 RATE LIMITING BEAST - Single Responsibility, Zero Breaking Changes
// Handles daily report limits for anonymous/registered/admin users

import AsyncStorage from "@react-native-async-storage/async-storage";

// Clean interfaces for rate limiting
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  authType: UserAuthType;
  upgradeRequired: boolean;
  message?: string;
}

export interface RateLimitConfig {
  anonymous: number;
  registered: number;
  admin: number; // -1 = unlimited
}

export type UserAuthType = "anonymous" | "registered" | "admin";

export interface UserRateLimitData {
  userUID: string;
  authType: UserAuthType;
  reportsToday: number;
  lastReportDate: string; // ISO date string "2025-01-15"
  dailyLimit: number;
}

class RateLimitService {
  private readonly STORAGE_KEY = "@waispath:rate_limits";
  private readonly DEFAULT_LIMITS: RateLimitConfig = {
    anonymous: 1, // 🚫 1 report per day for anonymous
    registered: 50, // ✅ 50 reports per day for registered
    admin: -1, // 🔥 Unlimited for admins
  };

  /**
   * 🎯 CHECK IF USER CAN REPORT - Main rate limiting function
   */
  async checkReportingLimits(
    userUID: string,
    authType: UserAuthType
  ): Promise<RateLimitResult> {
    try {
      const today = this.getTodayDateString();
      const userLimitData = await this.getUserRateLimitData(userUID);

      // Get daily limit for this user type
      const dailyLimit = this.DEFAULT_LIMITS[authType];

      // Admin users have unlimited reports
      if (authType === "admin" || dailyLimit === -1) {
        return {
          allowed: true,
          remaining: -1,
          resetTime: this.getTomorrowResetTime(),
          authType,
          upgradeRequired: false,
          message: "Unlimited reporting (Admin)",
        };
      }

      // Check if it's a new day (reset counter)
      if (userLimitData.lastReportDate !== today) {
        userLimitData.reportsToday = 0;
        userLimitData.lastReportDate = today;
      }

      // Calculate remaining reports
      const remaining = Math.max(0, dailyLimit - userLimitData.reportsToday);
      const allowed = remaining > 0;

      // Determine if upgrade is needed
      const upgradeRequired = !allowed && authType === "anonymous";

      return {
        allowed,
        remaining,
        resetTime: this.getTomorrowResetTime(),
        authType,
        upgradeRequired,
        message: this.generateLimitMessage(
          allowed,
          remaining,
          authType,
          upgradeRequired
        ),
      };
    } catch (error) {
      console.error("Rate limit check failed:", error);

      // Fail open - allow the report if rate limiting fails
      return {
        allowed: true,
        remaining: 0,
        resetTime: this.getTomorrowResetTime(),
        authType,
        upgradeRequired: false,
        message: "Rate limiting unavailable - proceeding",
      };
    }
  }

  /**
   * 📝 RECORD A REPORT - Call this after successful obstacle reporting
   */
  async recordReport(userUID: string, authType: UserAuthType): Promise<void> {
    try {
      const today = this.getTodayDateString();
      const userLimitData = await this.getUserRateLimitData(userUID);

      // Reset counter if new day
      if (userLimitData.lastReportDate !== today) {
        userLimitData.reportsToday = 0;
        userLimitData.lastReportDate = today;
      }

      // Increment report count
      userLimitData.reportsToday += 1;
      userLimitData.authType = authType;
      userLimitData.dailyLimit = this.DEFAULT_LIMITS[authType];

      // Save updated data
      await this.saveUserRateLimitData(userUID, userLimitData);

      console.log(
        `📊 Report recorded: ${userUID} (${authType}) - ${userLimitData.reportsToday}/${userLimitData.dailyLimit} today`
      );
    } catch (error) {
      console.error("Failed to record report for rate limiting:", error);
      // Non-blocking - don't fail the report if rate limit recording fails
    }
  }

  /**
   * 🔄 UPGRADE USER TYPE - Call when anonymous user registers
   */
  async upgradeUserType(
    userUID: string,
    newAuthType: UserAuthType
  ): Promise<void> {
    try {
      const userLimitData = await this.getUserRateLimitData(userUID);

      userLimitData.authType = newAuthType;
      userLimitData.dailyLimit = this.DEFAULT_LIMITS[newAuthType];

      await this.saveUserRateLimitData(userUID, userLimitData);

      console.log(
        `🔄 User ${userUID} upgraded to ${newAuthType} - new limit: ${userLimitData.dailyLimit}`
      );
    } catch (error) {
      console.error("Failed to upgrade user type for rate limiting:", error);
    }
  }

  /**
   * 📊 GET USER STATS - For UI display
   */
  async getUserRateLimitStats(userUID: string): Promise<UserRateLimitData> {
    return await this.getUserRateLimitData(userUID);
  }

  // ========================================
  // 🔧 PRIVATE HELPER METHODS
  // ========================================

  private async getUserRateLimitData(
    userUID: string
  ): Promise<UserRateLimitData> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const allUserData = stored ? JSON.parse(stored) : {};

      // Return existing data or create new user data
      return (
        allUserData[userUID] || {
          userUID,
          authType: "anonymous",
          reportsToday: 0,
          lastReportDate: this.getTodayDateString(),
          dailyLimit: this.DEFAULT_LIMITS.anonymous,
        }
      );
    } catch (error) {
      console.error("Failed to get user rate limit data:", error);

      // Return safe defaults
      return {
        userUID,
        authType: "anonymous",
        reportsToday: 0,
        lastReportDate: this.getTodayDateString(),
        dailyLimit: this.DEFAULT_LIMITS.anonymous,
      };
    }
  }

  private async saveUserRateLimitData(
    userUID: string,
    data: UserRateLimitData
  ): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const allUserData = stored ? JSON.parse(stored) : {};

      allUserData[userUID] = data;

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserData));
    } catch (error) {
      console.error("Failed to save user rate limit data:", error);
      throw error;
    }
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split("T")[0]; // "2025-01-15"
  }

  private getTomorrowResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Midnight reset
    return tomorrow;
  }

  private generateLimitMessage(
    allowed: boolean,
    remaining: number,
    authType: UserAuthType,
    upgradeRequired: boolean
  ): string {
    if (authType === "admin") {
      return "Unlimited reporting (Admin)";
    }

    if (allowed) {
      if (authType === "anonymous") {
        return remaining > 0
          ? `${remaining} report remaining today`
          : "Last report for today";
      } else {
        return `${remaining} reports remaining today`;
      }
    } else {
      if (upgradeRequired) {
        return "Daily limit reached (1/1). Register for unlimited reporting with photos!";
      } else {
        return "Daily limit reached. Resets at midnight.";
      }
    }
  }

  /**
   * 🧹 CLEANUP - Remove old rate limit data (call periodically)
   */
  async cleanupOldData(daysToKeep: number = 7): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const allUserData = JSON.parse(stored);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffString = cutoffDate.toISOString().split("T")[0];

      let cleanedCount = 0;
      Object.keys(allUserData).forEach((userUID) => {
        const userData = allUserData[userUID];
        if (userData.lastReportDate < cutoffString) {
          delete allUserData[userUID];
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        await AsyncStorage.setItem(
          this.STORAGE_KEY,
          JSON.stringify(allUserData)
        );
        console.log(`🧹 Cleaned up ${cleanedCount} old rate limit records`);
      }
    } catch (error) {
      console.error("Failed to cleanup old rate limit data:", error);
    }
  }
}

// 🚀 EXPORT SINGLETON INSTANCE
export const rateLimitService = new RateLimitService();

// 🎯 EXPORT UTILITY FUNCTIONS FOR EASY INTEGRATION
export const checkCanReport = (userUID: string, authType: UserAuthType) =>
  rateLimitService.checkReportingLimits(userUID, authType);

export const recordReportForUser = (userUID: string, authType: UserAuthType) =>
  rateLimitService.recordReport(userUID, authType);

export const upgradeUserRateLimit = (
  userUID: string,
  newAuthType: UserAuthType
) => rateLimitService.upgradeUserType(userUID, newAuthType);
