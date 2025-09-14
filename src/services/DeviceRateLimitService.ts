// src/services/DeviceRateLimitService.ts
// FIXED: Device-Based Rate Limiting for Anonymous Users
// Uses device identifier + date combo to prevent multiple anonymous reports per day

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Application from "expo-application";
import { Platform } from "react-native";

// Clean interfaces for device-based rate limiting
export interface DeviceRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  authType: UserAuthType;
  upgradeRequired: boolean;
  message?: string;
  deviceId?: string; // For debugging
}

export interface DeviceRateLimitConfig {
  anonymous: number;
  registered: number;
  admin: number; // -1 = unlimited
}

export type UserAuthType = "anonymous" | "registered" | "admin";

export interface DeviceRateLimitData {
  deviceId: string;
  authType: UserAuthType;
  userUID?: string; // Only for registered/admin users
  reportsToday: number;
  lastReportDate: string; // ISO date string "2025-01-15"
  dailyLimit: number;
  deviceInfo?: {
    platform: string;
    deviceBrand?: string;
    deviceModel?: string;
    appVersion?: string;
  };
}

class DeviceRateLimitService {
  private readonly STORAGE_KEY = "@waispath:device_rate_limits";
  private readonly DEVICE_ID_KEY = "@waispath:device_identifier";

  private readonly DEFAULT_LIMITS: DeviceRateLimitConfig = {
    anonymous: 1, // 🚫 1 report per day per device for anonymous
    registered: 50, // ✅ 50 reports per day for registered
    admin: -1, // 🔥 Unlimited for admins
  };

  private deviceId: string | null = null;

  /**
   * 🔧 GET UNIQUE DEVICE IDENTIFIER
   * Creates a consistent device ID that persists across app sessions
   */
  private async getDeviceIdentifier(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      // First, try to load existing device ID from storage
      const storedDeviceId = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
      if (storedDeviceId) {
        console.log(
          "📱 Using stored device ID:",
          storedDeviceId.substring(0, 8) + "..."
        );
        this.deviceId = storedDeviceId;
        return storedDeviceId;
      }

      // Generate new device ID using available device info
      const deviceInfo = {
        brand: Device.brand || "Unknown",
        modelName: Device.modelName || "Unknown",
        osName: Device.osName || Platform.OS,
        osVersion: Device.osVersion || "Unknown",
        appVersion: Application.nativeApplicationVersion || "1.0.0",
      };

      // Create device fingerprint
      const deviceFingerprint = `${deviceInfo.brand}-${deviceInfo.modelName}-${deviceInfo.osName}-${deviceInfo.osVersion}`;

      // Add timestamp and random component to ensure uniqueness
      const timestamp = Date.now();
      const randomComponent = Math.random().toString(36).substring(2, 8);

      // Create final device ID
      const newDeviceId = `device_${deviceFingerprint}_${timestamp}_${randomComponent}`;

      // Store for future use
      await AsyncStorage.setItem(this.DEVICE_ID_KEY, newDeviceId);

      this.deviceId = newDeviceId;
      console.log(
        "📱 Generated new device ID:",
        newDeviceId.substring(0, 8) + "..."
      );

      return newDeviceId;
    } catch (error) {
      console.error("❌ Failed to get device identifier:", error);

      // Fallback to timestamp-based ID if all else fails
      const fallbackId = `fallback_device_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      this.deviceId = fallbackId;
      return fallbackId;
    }
  }

  /**
   * 🎯 CHECK IF USER CAN REPORT - Main device-based rate limiting function
   */
  async checkReportingLimits(
    userUID: string,
    authType: UserAuthType
  ): Promise<DeviceRateLimitResult> {
    try {
      const today = this.getTodayDateString();
      const deviceId = await this.getDeviceIdentifier();

      // For anonymous users, use device ID as the key
      // For registered/admin users, use userUID as the key
      const rateLimitKey = authType === "anonymous" ? deviceId : userUID;

      const deviceLimitData = await this.getDeviceRateLimitData(
        rateLimitKey,
        authType,
        deviceId
      );

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
          deviceId: deviceId.substring(0, 12) + "...", // Truncated for privacy
        };
      }

      // Check if it's a new day (reset counter)
      if (deviceLimitData.lastReportDate !== today) {
        deviceLimitData.reportsToday = 0;
        deviceLimitData.lastReportDate = today;
        await this.saveDeviceRateLimitData(rateLimitKey, deviceLimitData);
      }

      // Calculate remaining reports
      const remaining = Math.max(0, dailyLimit - deviceLimitData.reportsToday);
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
        deviceId: deviceId.substring(0, 12) + "...", // Truncated for privacy
      };
    } catch (error) {
      console.error("Device rate limit check failed:", error);

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
      const deviceId = await this.getDeviceIdentifier();

      // Use appropriate key based on auth type
      const rateLimitKey = authType === "anonymous" ? deviceId : userUID;

      const deviceLimitData = await this.getDeviceRateLimitData(
        rateLimitKey,
        authType,
        deviceId
      );

      // Reset counter if new day
      if (deviceLimitData.lastReportDate !== today) {
        deviceLimitData.reportsToday = 0;
        deviceLimitData.lastReportDate = today;
      }

      // Increment report count
      deviceLimitData.reportsToday += 1;
      deviceLimitData.authType = authType;
      deviceLimitData.userUID = authType !== "anonymous" ? userUID : undefined;
      deviceLimitData.dailyLimit = this.DEFAULT_LIMITS[authType];

      // Save updated data
      await this.saveDeviceRateLimitData(rateLimitKey, deviceLimitData);

      console.log(
        `📊 Report recorded: ${
          authType === "anonymous" ? "Device" : "User"
        } ${rateLimitKey.substring(0, 8)}... (${authType}) - ${
          deviceLimitData.reportsToday
        }/${deviceLimitData.dailyLimit} today`
      );
    } catch (error) {
      console.error("Failed to record report for device rate limiting:", error);
      // Non-blocking - don't fail the report if rate limit recording fails
    }
  }

  /**
   * 🔄 UPGRADE USER TYPE - Call when anonymous user registers
   */
  async upgradeUserType(
    deviceIdOrUID: string,
    newAuthType: UserAuthType,
    newUserUID?: string
  ): Promise<void> {
    try {
      // When upgrading from anonymous, we need to transfer the device data to user data
      if (newAuthType === "registered" && newUserUID) {
        const deviceId = await this.getDeviceIdentifier();

        // Get current device data (anonymous)
        const deviceData = await this.getDeviceRateLimitData(
          deviceId,
          "anonymous",
          deviceId
        );

        // Create new user data with upgraded limits
        const upgradedData: DeviceRateLimitData = {
          ...deviceData,
          authType: newAuthType,
          userUID: newUserUID,
          dailyLimit: this.DEFAULT_LIMITS[newAuthType],
        };

        // Save under the new user UID
        await this.saveDeviceRateLimitData(newUserUID, upgradedData);

        // Optional: Clean up old device data
        await this.removeDeviceRateLimitData(deviceId);

        console.log(
          `🔄 User upgraded from anonymous (device) to ${newAuthType} (${newUserUID}) - new limit: ${upgradedData.dailyLimit}`
        );
      }
    } catch (error) {
      console.error(
        "Failed to upgrade user type for device rate limiting:",
        error
      );
    }
  }

  /**
   * 📊 GET USER STATS - For UI display
   */
  async getUserRateLimitStats(
    userUID: string,
    authType: UserAuthType
  ): Promise<DeviceRateLimitData> {
    const deviceId = await this.getDeviceIdentifier();
    const rateLimitKey = authType === "anonymous" ? deviceId : userUID;
    return await this.getDeviceRateLimitData(rateLimitKey, authType, deviceId);
  }

  /**
   * 🧪 TESTING: Clear all rate limit data
   */
  async clearAllRateLimitData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      await AsyncStorage.removeItem(this.DEVICE_ID_KEY);
      this.deviceId = null;
      console.log("🧹 All device rate limit data cleared");
    } catch (error) {
      console.error("Failed to clear rate limit data:", error);
    }
  }

  /**
   * 🔍 DEBUGGING: Get current device info
   */
  async getDebugInfo(): Promise<{
    deviceId: string;
    allRateLimitData: Record<string, DeviceRateLimitData>;
    deviceInfo: any;
  }> {
    try {
      const deviceId = await this.getDeviceIdentifier();
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const allRateLimitData = stored ? JSON.parse(stored) : {};

      const deviceInfo = {
        brand: Device.brand,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion,
      };

      return {
        deviceId,
        allRateLimitData,
        deviceInfo,
      };
    } catch (error) {
      console.error("Failed to get debug info:", error);
      return {
        deviceId: "unknown",
        allRateLimitData: {},
        deviceInfo: {},
      };
    }
  }

  // ========================================
  // 🔧 PRIVATE HELPER METHODS
  // ========================================

  private async getDeviceRateLimitData(
    key: string,
    authType: UserAuthType,
    deviceId: string
  ): Promise<DeviceRateLimitData> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const allData = stored ? JSON.parse(stored) : {};

      // Return existing data or create new data
      return (
        allData[key] || {
          deviceId,
          authType,
          reportsToday: 0,
          lastReportDate: this.getTodayDateString(),
          dailyLimit: this.DEFAULT_LIMITS[authType],
          deviceInfo: await this.getDeviceInfo(),
        }
      );
    } catch (error) {
      console.error("Failed to get device rate limit data:", error);

      // Return safe defaults
      return {
        deviceId,
        authType,
        reportsToday: 0,
        lastReportDate: this.getTodayDateString(),
        dailyLimit: this.DEFAULT_LIMITS[authType],
      };
    }
  }

  private async saveDeviceRateLimitData(
    key: string,
    data: DeviceRateLimitData
  ): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const allData = stored ? JSON.parse(stored) : {};

      allData[key] = data;

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
    } catch (error) {
      console.error("Failed to save device rate limit data:", error);
      throw error;
    }
  }

  private async removeDeviceRateLimitData(key: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const allData = JSON.parse(stored);
      delete allData[key];

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
    } catch (error) {
      console.error("Failed to remove device rate limit data:", error);
    }
  }

  private async getDeviceInfo() {
    try {
      return {
        platform: Platform.OS,
        deviceBrand: Device.brand || "Unknown",
        deviceModel: Device.modelName || "Unknown",
        appVersion: Application.nativeApplicationVersion || "1.0.0",
      };
    } catch (error) {
      return {
        platform: "Unknown",
        deviceBrand: "Unknown",
        deviceModel: "Unknown",
        appVersion: "1.0.0",
      };
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
          ? `${remaining} report remaining today (device-based)`
          : "Last report for today (device-based)";
      } else {
        return `${remaining} reports remaining today`;
      }
    } else {
      if (upgradeRequired) {
        return "Daily limit reached (1/1) on this device. Register for unlimited reporting with photos!";
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

      const allData = JSON.parse(stored);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffString = cutoffDate.toISOString().split("T")[0];

      let cleanedCount = 0;
      Object.keys(allData).forEach((key) => {
        const data = allData[key];
        if (data.lastReportDate < cutoffString) {
          delete allData[key];
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
        console.log(
          `🧹 Cleaned up ${cleanedCount} old device rate limit records`
        );
      }
    } catch (error) {
      console.error("Failed to cleanup old device rate limit data:", error);
    }
  }
}

// 🚀 EXPORT SINGLETON INSTANCE
export const deviceRateLimitService = new DeviceRateLimitService();

// 🎯 EXPORT UTILITY FUNCTIONS FOR EASY INTEGRATION
export const checkDeviceCanReport = (userUID: string, authType: UserAuthType) =>
  deviceRateLimitService.checkReportingLimits(userUID, authType);

export const recordDeviceReport = (userUID: string, authType: UserAuthType) =>
  deviceRateLimitService.recordReport(userUID, authType);

export const upgradeDeviceUser = (
  deviceIdOrUID: string,
  newAuthType: UserAuthType,
  newUserUID?: string
) =>
  deviceRateLimitService.upgradeUserType(
    deviceIdOrUID,
    newAuthType,
    newUserUID
  );

// 🧪 TESTING UTILITIES
export const clearDeviceRateLimits = () =>
  deviceRateLimitService.clearAllRateLimitData();

export const getDeviceRateLimitDebugInfo = () =>
  deviceRateLimitService.getDebugInfo();
