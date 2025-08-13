// src/services/obstacleValidationService.ts
// FIXED: Two-Tier Obstacle Validation System with correct types

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
  private readonly PROXIMITY_RADIUS = 50; // meters
  private readonly MAX_PROMPTS_PER_SESSION = 1;
  private readonly AUTO_EXPIRE_DAYS = 30;
  private sessionPromptCount = 0;

  /**
   * Check if user should be prompted to validate obstacles near their location
   */
  async checkForValidationPrompts(
    userLocation: UserLocation,
    currentRoute?: any
  ): Promise<ValidationPrompt[]> {
    try {
      // Don't overwhelm users with prompts
      if (this.sessionPromptCount >= this.MAX_PROMPTS_PER_SESSION) {
        return [];
      }

      // CRITICAL: Guard against poor GPS accuracy
      if (!userLocation.accuracy || userLocation.accuracy > 30) {
        console.log(
          "🚫 Skipping validation check - poor GPS accuracy:",
          userLocation.accuracy
        );
        return [];
      }

      // Get obstacles in area
      const nearbyObstacles =
        await firebaseServices.obstacle.getObstaclesInArea(
          userLocation.latitude,
          userLocation.longitude,
          this.PROXIMITY_RADIUS / 1000 // Convert to km
        );

      const validationPrompts: ValidationPrompt[] = [];

      for (const obstacle of nearbyObstacles) {
        const shouldPrompt = await this.shouldPromptForValidation(
          obstacle,
          userLocation
        );

        if (shouldPrompt) {
          validationPrompts.push({
            obstacleId: obstacle.id,
            message: this.generatePromptMessage(obstacle),
            location: obstacle.location,
            obstacleType: obstacle.type,
            reportCount: (obstacle.upvotes || 0) + 1, // Including original report
            lastAsked: (await this.getLastPromptTime(obstacle.id)) || undefined,
          });
        }
      }

      return validationPrompts.slice(0, 1); // Max 1 prompt per check
    } catch (error) {
      console.error("❌ Error checking validation prompts:", error);
      return [];
    }
  }

  /**
   * Determine if obstacle needs validation prompt
   */
  private async shouldPromptForValidation(
    obstacle: AccessibilityObstacle,
    userLocation: UserLocation
  ): Promise<boolean> {
    // Skip if user already validated this obstacle recently
    const lastValidated = await this.getUserLastValidation(obstacle.id);
    if (lastValidated && this.isRecentValidation(lastValidated)) {
      return false;
    }

    // Skip if obstacle is verified by admin
    if (obstacle.verified || obstacle.status === "resolved") {
      return false;
    }

    // Skip if obstacle is too old (auto-expired)
    if (this.isExpired(obstacle)) {
      return false;
    }

    // Check proximity (within 50m radius)
    const distance = this.calculateDistance(userLocation, obstacle.location);
    if (distance > this.PROXIMITY_RADIUS) {
      return false;
    }

    // Prioritize obstacles with single reports or conflicting validations
    const validationStatus = this.getValidationStatus(obstacle);
    return validationStatus.needsValidation;
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

      if (response === "skip") {
        // Just record that user skipped
        await this.recordValidationInteraction(obstacleId, "skipped");
        return;
      }

      if (response === "still_there") {
        // Upvote the obstacle (confirm it exists)
        await firebaseServices.obstacle.verifyObstacle(obstacleId, "upvote");
        await this.recordValidationInteraction(obstacleId, "confirmed");
      } else if (response === "cleared") {
        // Downvote the obstacle (suggest it's resolved)
        await firebaseServices.obstacle.verifyObstacle(obstacleId, "downvote");
        await this.recordValidationInteraction(obstacleId, "disputed");
      }

      console.log(`✅ Validation recorded: ${obstacleId} - ${response}`);
    } catch (error) {
      console.error("❌ Error processing validation:", error);
      throw error;
    }
  }

  /**
   * Get validation status for UI display
   * FIXED: Maps actual status values to display tiers
   */
  getValidationStatus(
    obstacle: AccessibilityObstacle
  ): ObstacleValidationStatus {
    const upvotes = obstacle.upvotes || 0;
    const downvotes = obstacle.downvotes || 0;
    const totalValidations = upvotes + downvotes;
    const reportAge = this.getAgeInDays(obstacle.reportedAt);

    // FIXED: Map actual status values to display tiers
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
    // Community verified - when status is "verified" OR has enough upvotes
    else if (obstacle.status === "verified" || totalValidations >= 2) {
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
   * Check if obstacles need auto-expiry cleanup
   */
  async cleanupExpiredObstacles(): Promise<void> {
    try {
      // This would run periodically to clean up old obstacles
      // For testing phase, we'll keep it simple
      console.log("🧹 Obstacle cleanup would run here in production");
    } catch (error) {
      console.error("❌ Error cleaning up obstacles:", error);
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

  private isRecentValidation(lastValidated: Date): boolean {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastValidated > sevenDaysAgo;
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
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
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

  private getAgeInDays(reportedAt: Date | string): number {
    const reportDate =
      reportedAt instanceof Date ? reportedAt : new Date(reportedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - reportDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
