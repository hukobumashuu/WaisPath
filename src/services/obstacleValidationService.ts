// src/services/obstacleValidationService.ts
// PHASE 2 COMPLETE: Updated with all fixes applied

import { firebaseServices } from "./firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AccessibilityObstacle,
  UserLocation,
  ObstacleType,
} from "../types";

// CRITICAL: Normalize timestamp helper for Firestore compatibility
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate(); // Firestore Timestamp
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") return new Date(ts);
  if (ts instanceof Date) return ts;
  return null;
}

export interface ValidationPrompt {
  obstacleId: string;
  message: string;
  location: UserLocation;
  obstacleType: ObstacleType;
  reportCount: number;
  lastAsked?: Date;
}

export interface ObstacleValidationStatus {
  id: string;
  tier: "single_report" | "community_verified" | "admin_resolved";
  displayLabel: string;
  confidence: "low" | "medium" | "high";
  validationCount: number;
  conflictingReports: boolean;
  needsValidation: boolean;
  autoExpireDate: Date;
}

class ObstacleValidationService {
  // PHASE 2 UPDATED: Improved constants for better user experience
  private readonly PROXIMITY_RADIUS = 100; // meters (increased from 50m)
  private readonly MAX_PROMPTS_PER_SESSION = 5; // increased from 1
  private readonly AUTO_EXPIRE_DAYS = 30;
  private readonly USER_VALIDATION_COOLDOWN_DAYS = 1; // reduced from 7
  private sessionPromptCount = 0;

  /**
   * Check if user should be prompted to validate obstacles near their location
   * FIXED: Relaxed GPS accuracy requirements for urban environments
   */
  async checkForValidationPrompts(
    userLocation: UserLocation,
    currentRoute?: any
  ): Promise<ValidationPrompt[]> {
    try {
      console.log("🎯 Starting validation prompt check...");

      // Don't overwhelm users with prompts
      if (this.sessionPromptCount >= this.MAX_PROMPTS_PER_SESSION) {
        console.log(
          "⏰ Skip - session limit reached:",
          this.sessionPromptCount
        );
        return [];
      }

      // FIXED: More realistic GPS accuracy for urban Manila environments
      // Original was 30m, now 150m for better validation coverage
      if (!userLocation.accuracy || userLocation.accuracy > 150) {
        console.log(
          "🚫 Skipping validation check - poor GPS accuracy:",
          userLocation.accuracy
        );
        return [];
      }

      console.log(
        "✅ GPS accuracy acceptable for validation:",
        userLocation.accuracy + "m"
      );

      // Get obstacles in area
      const nearbyObstacles =
        await firebaseServices.obstacle.getObstaclesInArea(
          userLocation.latitude,
          userLocation.longitude,
          this.PROXIMITY_RADIUS / 1000 // Convert to km
        );

      console.log(`🔍 Found ${nearbyObstacles.length} obstacles to evaluate`);

      const validationPrompts: ValidationPrompt[] = [];

      for (const obstacle of nearbyObstacles) {
        const shouldPrompt = await this.shouldPromptForValidation(
          obstacle,
          userLocation
        );

        if (shouldPrompt) {
          console.log(
            `✅ Creating validation prompt for obstacle ${obstacle.id}`
          );

          // IMPORTANT: Record that we're showing this prompt
          await this.recordPromptShown(obstacle.id);

          validationPrompts.push({
            obstacleId: obstacle.id,
            message: this.generatePromptMessage(obstacle),
            location: obstacle.location,
            obstacleType: obstacle.type,
            reportCount: (obstacle.upvotes || 0) + 1,
            lastAsked: new Date(), // Set current time since we're showing it now
          });
        }
      }

      console.log(
        `📝 Generated ${validationPrompts.length} validation prompts`
      );
      return validationPrompts.slice(0, this.MAX_PROMPTS_PER_SESSION); // Max 1 prompt per check
    } catch (error) {
      console.error("❌ Error checking validation prompts:", error);
      return [];
    }
  }

  /**
   * Determine if obstacle needs validation prompt
   * ENHANCED: Added detailed debugging
   */
  private async shouldPromptForValidation(
    obstacle: AccessibilityObstacle,
    userLocation: UserLocation
  ): Promise<boolean> {
    console.log(`🔍 Evaluating obstacle ${obstacle.id} (${obstacle.type})`);

    // Skip if user already validated this obstacle recently
    const lastValidated = await this.getUserLastValidation(obstacle.id);
    if (lastValidated && this.isRecentValidation(lastValidated)) {
      console.log(`⏰ Skip - recently validated (${lastValidated})`);
      return false;
    }

    // Skip if obstacle is verified by admin
    if (obstacle.verified || obstacle.status === "resolved") {
      console.log(`✅ Skip - admin verified/resolved (${obstacle.status})`);
      return false;
    }

    // Skip if obstacle is too old (auto-expired)
    if (this.isExpired(obstacle)) {
      console.log(`📅 Skip - expired obstacle`);
      return false;
    }

    // Check proximity (within 100m radius)
    const distance = this.calculateDistance(userLocation, obstacle.location);
    console.log(`📏 Distance to obstacle: ${Math.round(distance)}m`);

    if (distance > this.PROXIMITY_RADIUS) {
      console.log(`📍 Skip - too far (>${this.PROXIMITY_RADIUS}m)`);
      return false;
    }

    // Prioritize obstacles with single reports or conflicting validations
    const validationStatus = this.getValidationStatus(obstacle);
    console.log(`📊 Validation status:`, {
      tier: validationStatus.tier,
      needsValidation: validationStatus.needsValidation,
      validationCount: validationStatus.validationCount,
      conflictingReports: validationStatus.conflictingReports,
    });

    if (validationStatus.needsValidation) {
      console.log(`✅ SHOULD PROMPT - obstacle needs validation`);
      return true;
    } else {
      console.log(`❌ Skip - validation not needed`);
      return false;
    }
  }

  /**
   * NEW: Record when a prompt is shown to user
   */
  async recordPromptShown(obstacleId: string): Promise<void> {
    try {
      const key = `@prompt:${obstacleId}`;
      await AsyncStorage.setItem(key, new Date().toISOString());
      console.log(`📝 Recorded prompt shown for obstacle: ${obstacleId}`);
    } catch (error) {
      console.error("❌ Failed to record prompt shown:", error);
    }
  }

  /**
   * Generate user-friendly validation prompt message
   */
  private generatePromptMessage(obstacle: AccessibilityObstacle): string {
    const obstacleLabels: Record<ObstacleType, string> = {
      vendor_blocking: "vendor blocking the sidewalk",
      parked_vehicles: "vehicles parked on sidewalk",
      construction: "construction blocking path",
      electrical_post: "electrical post in the way",
      tree_roots: "tree roots on sidewalk",
      no_sidewalk: "missing sidewalk",
      flooding: "flooding on path",
      stairs_no_ramp: "stairs without ramp",
      narrow_passage: "narrow passage",
      broken_pavement: "broken pavement",
      steep_slope: "steep slope",
      other: "obstacle",
    };

    const label = obstacleLabels[obstacle.type] || "obstacle";
    return `Quick check: Is there still ${label} here?`;
  }

  /**
   * Process user validation response
   */
  async processValidationResponse(
    obstacleId: string,
    response: "still_there" | "cleared" | "skip"
  ): Promise<void> {
    try {
      this.sessionPromptCount++;
      console.log(`📝 Processing validation: ${obstacleId} - ${response}`);

      if (response === "skip") {
        // Just record that user skipped
        await this.recordValidationInteraction(obstacleId, "skipped");
        return;
      }

      if (response === "still_there") {
        // Upvote the obstacle (confirm it exists)
        await firebaseServices.obstacle.verifyObstacle(obstacleId, "upvote");
        await this.recordValidationInteraction(obstacleId, "confirmed");
        console.log(`✅ Obstacle confirmed: ${obstacleId}`);
      } else if (response === "cleared") {
        // Downvote the obstacle (suggest it's resolved)
        await firebaseServices.obstacle.verifyObstacle(obstacleId, "downvote");
        await this.recordValidationInteraction(obstacleId, "disputed");
        console.log(`✅ Obstacle disputed: ${obstacleId}`);
      }

      console.log(`✅ Validation recorded: ${obstacleId} - ${response}`);
    } catch (error) {
      console.error("❌ Error processing validation:", error);
      throw error;
    }
  }

  /**
   * Get validation status for UI display
   * PHASE 2 UPDATED: Adjusted threshold for better testing with existing data
   */
  getValidationStatus(
    obstacle: AccessibilityObstacle
  ): ObstacleValidationStatus {
    const upvotes = obstacle.upvotes || 0;
    const downvotes = obstacle.downvotes || 0;
    const totalValidations = upvotes + downvotes;

    let tier: "single_report" | "community_verified" | "admin_resolved";
    let confidence: "low" | "medium" | "high";
    let displayLabel: string;

    // Admin resolved statuses
    if (obstacle.verified || obstacle.status === "resolved") {
      tier = "admin_resolved";
      confidence = "high";
      displayLabel =
        obstacle.status === "resolved"
          ? "CLEARED by Admin"
          : "VERIFIED by Admin";
    }
    // Community verified - PHASE 2 UPDATED: raised threshold to 8 for better testing
    else if (obstacle.status === "verified" || totalValidations >= 8) {
      tier = "community_verified";
      confidence = upvotes > downvotes ? "medium" : "low";
      displayLabel = `Community Verified (${upvotes} confirms, ${downvotes} disputes)`;
    }
    // Single report - pending status or new obstacles
    else {
      tier = "single_report";
      confidence = "low";
      displayLabel = "Single Report - Unverified";
    }

    return {
      id: obstacle.id,
      tier,
      displayLabel,
      confidence,
      validationCount: totalValidations,
      conflictingReports: downvotes > 0,
      needsValidation:
        tier === "single_report" || (downvotes > 0 && upvotes <= downvotes),
      autoExpireDate: new Date(
        obstacle.reportedAt.getTime() +
          this.AUTO_EXPIRE_DAYS * 24 * 60 * 60 * 1000
      ),
    };
  }

  /**
   * Get display styling for obstacle based on validation status
   */
  getObstacleDisplayStyle(obstacle: AccessibilityObstacle): {
    color: string;
    opacity: number;
    icon: string;
    priority: number;
  } {
    const status = this.getValidationStatus(obstacle);

    switch (status.tier) {
      case "admin_resolved":
        return {
          color: obstacle.status === "resolved" ? "#22C55E" : "#3B82F6",
          opacity: obstacle.status === "resolved" ? 0.6 : 1.0,
          icon:
            obstacle.status === "resolved"
              ? "checkmark-circle"
              : "shield-checkmark",
          priority: obstacle.status === "resolved" ? 1 : 3,
        };

      case "community_verified":
        return {
          color: status.conflictingReports ? "#F59E0B" : "#EF4444",
          opacity: 0.8,
          icon: status.conflictingReports ? "warning" : "alert-circle",
          priority: 2,
        };

      case "single_report":
      default:
        return {
          color: "#6B7280",
          opacity: 0.6,
          icon: "help-circle",
          priority: 1,
        };
    }
  }

  /**
   * Reset session counters (call when navigation starts)
   */
  resetSessionCounters(): void {
    this.sessionPromptCount = 0;
    console.log("🔄 Validation session counters reset");
  }

  /**
   * PHASE 2 NEW: Reset session counters and cooldowns for testing
   * Call this when user moves to a new area or manually resets
   */
  async resetValidationSession(): Promise<void> {
    this.sessionPromptCount = 0;
    console.log("🔄 Validation session manually reset - ready for new prompts");
  }

  /**
   * PHASE 2 NEW: Clear all user validation cooldowns (for testing)
   */
  async clearAllValidationCooldowns(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const validationKeys = keys.filter((key) =>
        key.startsWith("@validation:")
      );
      await AsyncStorage.multiRemove(validationKeys);
      console.log(`🧹 Cleared ${validationKeys.length} validation cooldowns`);
    } catch (error) {
      console.error("Failed to clear validation cooldowns:", error);
    }
  }

  // HELPER METHODS

  private async getUserLastValidation(
    obstacleId: string
  ): Promise<Date | undefined> {
    try {
      const key = `@validation:${obstacleId}`;
      const timestamp = await AsyncStorage.getItem(key);
      return timestamp ? new Date(timestamp) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // PHASE 2 FIXED: Now uses the configurable cooldown constant instead of hardcoded 7 days
  private isRecentValidation(lastValidated: Date): boolean {
    const cooldownDate = new Date();
    cooldownDate.setDate(
      cooldownDate.getDate() - this.USER_VALIDATION_COOLDOWN_DAYS
    );
    return lastValidated > cooldownDate;
  }

  private isExpired(obstacle: AccessibilityObstacle): boolean {
    const reportDate =
      obstacle.reportedAt instanceof Date
        ? obstacle.reportedAt
        : new Date(obstacle.reportedAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.AUTO_EXPIRE_DAYS);
    return reportDate < thirtyDaysAgo;
  }

  private calculateDistance(
    point1: UserLocation,
    point2: UserLocation
  ): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;

    // FIXED: Use latitude for latitude delta, not longitude
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180; // ✅ FIXED
    const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLngRad / 2) *
        Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private async recordValidationInteraction(
    obstacleId: string,
    action: "confirmed" | "disputed" | "skipped"
  ): Promise<void> {
    try {
      // Record user interaction locally
      const key = `@validation:${obstacleId}`;
      await AsyncStorage.setItem(key, new Date().toISOString());

      // Record analytics event
      await firebaseServices.obstacle.recordPromptEvent(obstacleId, {
        action,
        timestamp: new Date().toISOString(),
        method: "proximity_prompt",
      });

      console.log(
        `📊 Validation interaction recorded: ${obstacleId} - ${action}`
      );
    } catch (error) {
      console.error("❌ Failed to record validation interaction:", error);
      // Don't throw - this shouldn't break the validation flow
    }
  }

  private async getLastPromptTime(obstacleId: string): Promise<Date | null> {
    try {
      const key = `@prompt:${obstacleId}`;
      const timestamp = await AsyncStorage.getItem(key);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const obstacleValidationService = new ObstacleValidationService();
