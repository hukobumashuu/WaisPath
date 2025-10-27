// src/services/obstacleValidationService.ts
// FIXED VERSION - All TypeScript errors resolved

import { firebaseServices } from "./firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AccessibilityObstacle,
  UserLocation,
  ObstacleType,
  UserMobilityProfile,
} from "../types";

// CRITICAL: Normalize timestamp helper for Firestore compatibility
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
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
  distance: number;
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
  private readonly PROXIMITY_RADIUS = 20;
  private readonly ROUTE_TOLERANCE = 15;
  private readonly MAX_PROMPTS_PER_SESSION = 2;
  private readonly AUTO_EXPIRE_DAYS = 30;
  private readonly USER_VALIDATION_COOLDOWN_DAYS = 1;
  private sessionPromptCount = 0;

  async checkForValidationPrompts(
    userLocation: UserLocation,
    userProfile?: UserMobilityProfile
  ): Promise<ValidationPrompt[]> {
    try {
      console.log("🎯 Starting smart validation prompt check...");

      if (this.sessionPromptCount >= this.MAX_PROMPTS_PER_SESSION) {
        console.log(
          `⏰ Skip - session limit reached: ${this.sessionPromptCount}/${this.MAX_PROMPTS_PER_SESSION}`
        );
        return [];
      }

      if (!userLocation.accuracy || userLocation.accuracy > 150) {
        console.log("🚫 Skip - poor GPS accuracy:", userLocation.accuracy);
        return [];
      }

      console.log("✅ GPS accuracy OK:", userLocation.accuracy + "m");

      const currentUserId = await this.getCurrentUserId();
      console.log("👤 Current user ID:", currentUserId);

      const nearbyObstacles =
        await firebaseServices.obstacle.getObstaclesInArea(
          userLocation.latitude,
          userLocation.longitude,
          0.1
        );

      console.log(`🔍 Found ${nearbyObstacles.length} nearby obstacles`);

      const candidateObstacles: Array<{
        obstacle: AccessibilityObstacle;
        distance: number;
        weight: number;
      }> = [];

      for (const obstacle of nearbyObstacles) {
        const distance = this.calculateDistance(
          userLocation,
          obstacle.location
        );

        const shouldPrompt = await this.shouldPromptForValidation(
          obstacle,
          userLocation,
          currentUserId,
          distance
        );

        if (shouldPrompt) {
          const weight = this.calculateSelectionWeight(distance);

          candidateObstacles.push({
            obstacle,
            distance,
            weight,
          });

          console.log(
            `✅ Candidate: ${obstacle.type} @ ${Math.round(
              distance
            )}m (weight: ${weight.toFixed(2)})`
          );
        }
      }

      if (candidateObstacles.length === 0) {
        console.log("📭 No obstacles meet validation criteria");
        return [];
      }

      console.log(
        `🎲 ${candidateObstacles.length} candidates available for selection`
      );

      const selectedObstacle = this.weightedRandomSelection(candidateObstacles);

      if (!selectedObstacle) {
        console.log("❌ Selection failed");
        return [];
      }

      console.log(
        `🎯 Selected: ${selectedObstacle.obstacle.type} @ ${Math.round(
          selectedObstacle.distance
        )}m`
      );

      await this.recordPromptShown(selectedObstacle.obstacle.id);

      const validationPrompt: ValidationPrompt = {
        obstacleId: selectedObstacle.obstacle.id,
        message: this.generatePromptMessage(selectedObstacle.obstacle),
        location: selectedObstacle.obstacle.location,
        obstacleType: selectedObstacle.obstacle.type,
        reportCount: selectedObstacle.obstacle.reportsCount || 1,
        distance: selectedObstacle.distance,
      };

      console.log(
        `📝 Generated validation prompt for ${validationPrompt.obstacleId}`
      );
      return [validationPrompt];
    } catch (error) {
      console.error("❌ Error checking validation prompts:", error);
      return [];
    }
  }

  private calculateSelectionWeight(distance: number): number {
    const weight = Math.max(1, (20 - distance) / 5);
    return weight;
  }

  private weightedRandomSelection(
    candidates: Array<{
      obstacle: AccessibilityObstacle;
      distance: number;
      weight: number;
    }>
  ): { obstacle: AccessibilityObstacle; distance: number } | null {
    if (candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
      random -= candidate.weight;
      if (random <= 0) {
        return {
          obstacle: candidate.obstacle,
          distance: candidate.distance,
        };
      }
    }

    return {
      obstacle: candidates[0].obstacle,
      distance: candidates[0].distance,
    };
  }

  private async shouldPromptForValidation(
    obstacle: AccessibilityObstacle,
    userLocation: UserLocation,
    currentUserId: string,
    distance: number
  ): Promise<boolean> {
    console.log(
      `🔍 Evaluating ${obstacle.type} (${obstacle.id.slice(0, 8)}...)`
    );

    // FIXED: Skip if user reported this obstacle
    if (obstacle.reportedBy === currentUserId) {
      console.log("⏭️ Skip - you reported this obstacle");
      return false;
    }

    // REMOVED: upvotedBy/downvotedBy check (fields don't exist in type)
    // Firebase only stores upvotes/downvotes as numbers, not user arrays
    // So we rely on local AsyncStorage check instead

    const lastValidated = await this.getUserLastValidation(obstacle.id);
    if (lastValidated && this.isRecentValidation(lastValidated)) {
      console.log(
        `⏰ Skip - recently validated locally (${lastValidated.toLocaleDateString()})`
      );
      return false;
    }

    if (obstacle.verified || obstacle.status === "resolved") {
      console.log(`✅ Skip - admin ${obstacle.status}`);
      return false;
    }

    if (this.isExpired(obstacle)) {
      console.log("📅 Skip - obstacle expired");
      return false;
    }

    console.log(`📏 Distance: ${Math.round(distance)}m`);

    if (distance > this.PROXIMITY_RADIUS) {
      console.log(`📍 Skip - too far (>${this.PROXIMITY_RADIUS}m)`);
      return false;
    }

    const validationStatus = this.getValidationStatus(obstacle);

    console.log(
      `📊 Status: ${validationStatus.tier}, needs validation: ${validationStatus.needsValidation}`
    );

    if (!validationStatus.needsValidation) {
      console.log("❌ Skip - already well validated");
      return false;
    }

    console.log("✅ PASSED all checks - eligible for prompt");
    return true;
  }

  // FIXED: Get user ID without auth module
  private async getCurrentUserId(): Promise<string> {
    try {
      // Get from AsyncStorage (set during login/registration)
      const userId = await AsyncStorage.getItem("@user_id");

      if (userId && userId !== "null") {
        return userId;
      }

      // Fallback to anonymous
      return "anonymous";
    } catch (error) {
      console.warn("Failed to get user ID:", error);
      return "anonymous";
    }
  }

  async recordPromptShown(obstacleId: string): Promise<void> {
    try {
      const key = `@prompt:${obstacleId}`;
      await AsyncStorage.setItem(key, new Date().toISOString());
      console.log(`📝 Recorded prompt shown: ${obstacleId}`);
    } catch (error) {
      console.error("❌ Failed to record prompt:", error);
    }
  }

  private generatePromptMessage(obstacle: AccessibilityObstacle): string {
    // FIXED: Removed tree_roots (doesn't exist in ObstacleType)
    const obstacleLabels: Record<ObstacleType, string> = {
      vendor_blocking: "vendor blocking the sidewalk",
      parked_vehicles: "vehicles parked on sidewalk",
      construction: "construction blocking path",
      electrical_post: "electrical post in the way",
      no_sidewalk: "missing sidewalk",
      flooding: "flooding on path",
      stairs_no_ramp: "stairs without ramp",
      narrow_passage: "narrow passage",
      broken_infrastructure: "broken infrastructure",
      steep_slope: "steep slope",
      debris: "debris or trash",
      other: "obstacle",
    };

    const label = obstacleLabels[obstacle.type] || "obstacle";
    return `Quick check: Is there still ${label} here?`;
  }

  async processValidationResponse(
    obstacleId: string,
    response: "still_there" | "cleared" | "skip"
  ): Promise<void> {
    try {
      this.sessionPromptCount++;
      console.log(
        `📝 Processing: ${obstacleId} - ${response} (session: ${this.sessionPromptCount})`
      );

      if (response === "skip") {
        await this.recordValidationInteraction(obstacleId, "skipped");
        return;
      }

      if (response === "still_there") {
        await firebaseServices.obstacle.verifyObstacle(obstacleId, "upvote");
        await this.recordValidationInteraction(obstacleId, "confirmed");
        console.log(`✅ Obstacle confirmed: ${obstacleId}`);
      } else if (response === "cleared") {
        await firebaseServices.obstacle.verifyObstacle(obstacleId, "downvote");
        await this.recordValidationInteraction(obstacleId, "disputed");
        console.log(`✅ Obstacle disputed: ${obstacleId}`);
      }

      console.log(`✅ Validation recorded successfully`);
    } catch (error) {
      console.error("❌ Error processing validation:", error);
      throw error;
    }
  }

  getValidationStatus(
    obstacle: AccessibilityObstacle
  ): ObstacleValidationStatus {
    const upvotes = obstacle.upvotes || 0;
    const downvotes = obstacle.downvotes || 0;
    const totalValidations = upvotes + downvotes;

    let tier: "single_report" | "community_verified" | "admin_resolved";
    let confidence: "low" | "medium" | "high";
    let displayLabel: string;

    if (obstacle.verified || obstacle.status === "resolved") {
      tier = "admin_resolved";
      confidence = "high";
      displayLabel =
        obstacle.status === "resolved"
          ? "CLEARED by Admin"
          : "VERIFIED by Admin";
    } else if (obstacle.status === "verified" || totalValidations >= 8) {
      tier = "community_verified";
      confidence = upvotes > downvotes ? "medium" : "low";
      displayLabel = `Community Verified (${upvotes} confirms, ${downvotes} disputes)`;
    } else {
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
        (obstacle.reportedAt instanceof Date
          ? obstacle.reportedAt
          : new Date(obstacle.reportedAt)
        ).getTime() +
          this.AUTO_EXPIRE_DAYS * 24 * 60 * 60 * 1000
      ),
    };
  }

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

  resetSessionCounters(): void {
    this.sessionPromptCount = 0;
    console.log("🔄 Validation session reset");
  }

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
    const R = 6371000;
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
    return R * c;
  }

  private async recordValidationInteraction(
    obstacleId: string,
    action: "confirmed" | "disputed" | "skipped"
  ): Promise<void> {
    try {
      const key = `@validation:${obstacleId}`;
      await AsyncStorage.setItem(key, new Date().toISOString());

      await firebaseServices.obstacle.recordPromptEvent(obstacleId, {
        action,
        timestamp: new Date().toISOString(),
        method: "proximity_prompt",
      });

      console.log(`📊 Interaction recorded: ${obstacleId} - ${action}`);
    } catch (error) {
      console.error("❌ Failed to record interaction:", error);
    }
  }
}

export const obstacleValidationService = new ObstacleValidationService();
