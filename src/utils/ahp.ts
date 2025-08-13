// src/utils/ahp.ts - FIXED to match your existing ObstacleType
// AHP-Based Accessibility Assessment for WAISPATH

import { UserMobilityProfile, ObstacleType } from "../types";
import type {
  AHPCriteria,
  SidewalkData,
  AccessibilityScore,
  CommunityObstacle,
} from "../types";

export class AHPAccessibilityCalculator {
  // Literature-based weights from WHO Accessibility Guidelines +
  // Philippine PWD Research (cite: DOTr Accessibility Manual 2019)
  private weights: AHPCriteria = {
    traversability: 0.7, // Primary concern - can they get through?
    safety: 0.2, // Secondary - safe passage without injury?
    comfort: 0.1, // Tertiary - pleasant journey (heat, shade, etc.)
  };

  // Philippine-specific obstacle penalties - FIXED to match your existing ObstacleType
  private obstacleBasePenalties: Partial<Record<ObstacleType, number>> = {
    vendor_blocking: 15, // Common in PH, manageable but problematic
    parked_vehicles: 20, // Forces PWD into traffic
    stairs_no_ramp: 50, // Major barrier for wheelchairs
    narrow_passage: 25, // Problematic for wheelchairs/walkers
    broken_pavement: 20, // Safety hazard, especially for visually impaired
    flooding: 30, // Major concern in PH during rainy season
    construction: 35, // Often blocks entire path
    electrical_post: 15, // Navigation obstacle
    tree_roots: 18, // Uneven surface hazard
    no_sidewalk: 40, // Forces use of road
    steep_slope: 30, // Difficult for many PWD types
    other: 10, // General obstacle penalty
  };

  /**
   * Main method: Calculate comprehensive accessibility score for a sidewalk segment
   */
  calculateAccessibilityScore(
    sidewalkData: SidewalkData,
    userProfile: UserMobilityProfile
  ): AccessibilityScore {
    // Calculate individual criteria scores
    const traversabilityScore = this.calculateTraversability(
      sidewalkData,
      userProfile
    );
    const safetyScore = this.calculateSafety(sidewalkData);
    const comfortScore = this.calculateComfort(sidewalkData, userProfile);

    // Apply AHP weights to get overall score
    const overallScore =
      traversabilityScore * this.weights.traversability +
      safetyScore * this.weights.safety +
      comfortScore * this.weights.comfort;

    // User-specific adjustment based on profile preferences
    const userAdjustment = this.calculateUserSpecificAdjustment(
      sidewalkData,
      userProfile
    );
    const finalScore = Math.max(
      0,
      Math.min(100, overallScore + userAdjustment)
    );

    return {
      traversability: Math.round(traversabilityScore * 10) / 10,
      safety: Math.round(safetyScore * 10) / 10,
      comfort: Math.round(comfortScore * 10) / 10,
      overall: Math.round(finalScore * 10) / 10,
      grade: this.scoreToGrade(finalScore),
      userSpecificAdjustment: Math.round(userAdjustment * 10) / 10,
    };
  }

  /**
   * Traversability: Can the user physically navigate this path?
   * Most important factor (70% weight)
   */
  private calculateTraversability(
    data: SidewalkData,
    profile: UserMobilityProfile
  ): number {
    let score = 100; // Start with perfect score

    // Apply obstacle penalties based on user's mobility device
    data.obstacles.forEach((obstacle) => {
      const penalty = this.getObstaclePenalty(obstacle, profile);
      score -= penalty;
    });

    // Width penalties - critical for wheelchair users
    const requiredWidth = this.getRequiredWidth(profile);
    if (data.estimatedWidth < requiredWidth) {
      const widthPenalty = Math.min(
        40,
        (requiredWidth - data.estimatedWidth) * 20
      );
      score -= widthPenalty;
    }

    // Surface condition penalties
    if (data.surfaceCondition === "broken") {
      score -= profile.type === "wheelchair" ? 35 : 25; // Worse for wheelchairs
    } else if (data.surfaceCondition === "rough") {
      score -= profile.type === "wheelchair" ? 15 : 10;
    }

    // Slope penalties (critical for wheelchairs)
    if (
      profile.type === "wheelchair" &&
      data.slope > (profile.maxRampSlope || 5)
    ) {
      score -= Math.min(50, data.slope * 8); // Steep penalty for excessive slope
    }

    // Ramp availability bonus for wheelchair users
    if (profile.type === "wheelchair" && data.hasRamp) {
      score += 5; // Small bonus for having ramps
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Safety: Risk of injury or dangerous situations
   * Secondary factor (20% weight)
   */
  private calculateSafety(data: SidewalkData): number {
    let score = 100;

    // Traffic level safety concerns
    const trafficPenalties = {
      high: 30, // Very dangerous
      medium: 15, // Some concern
      low: 5, // Minimal risk
    };
    score -= trafficPenalties[data.trafficLevel];

    // Lighting safety (especially important in PH urban areas)
    const lightingPenalties = {
      none: 25, // Very unsafe at night
      poor: 10, // Some risk
      good: 0, // Safe
    };
    score -= lightingPenalties[data.lighting];

    // Obstacle-specific safety penalties
    data.obstacles.forEach((obstacle) => {
      const safetyPenalty = this.getObstacleSafetyPenalty(obstacle);
      score -= safetyPenalty;
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Comfort: Pleasant journey considering Philippine climate
   * Tertiary factor (10% weight)
   */
  private calculateComfort(
    data: SidewalkData,
    profile: UserMobilityProfile
  ): number {
    let score = 100;

    // Shade consideration (critical in hot Philippine climate)
    if (profile.preferShade) {
      const shadePenalties = {
        none: 40, // Very uncomfortable in heat
        partial: 20, // Some discomfort
        covered: 0, // Comfortable
      };
      score -= shadePenalties[data.shadeLevel];
    }

    // Surface smoothness for comfort
    const surfaceComfortPenalties = {
      broken: 30, // Very uncomfortable
      rough: 15, // Some discomfort
      smooth: 0, // Comfortable
    };
    score -= surfaceComfortPenalties[data.surfaceCondition];

    // Handrails provide comfort for mobility aid users
    if (
      (profile.type === "walker" || profile.type === "cane") &&
      data.hasHandrails
    ) {
      score += 10; // Comfort bonus
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get obstacle penalty based on user's mobility device and preferences
   */
  private getObstaclePenalty(
    obstacle: CommunityObstacle,
    profile: UserMobilityProfile
  ): number {
    let penalty = this.obstacleBasePenalties[obstacle.type] || 10;

    // Severity multipliers
    const severityMultipliers = {
      low: 0.5, // Minor inconvenience
      medium: 1.0, // Standard penalty
      high: 1.5, // Major problem
      blocking: 2.5, // Nearly impossible to pass
    };
    penalty *= severityMultipliers[obstacle.severity];

    // User type specific adjustments
    penalty *= this.getUserTypeMultiplier(obstacle.type, profile.type);

    // User preference adjustments
    if (profile.avoidCrowds && obstacle.type === "vendor_blocking") {
      penalty *= 1.5; // Extra penalty for crowd-averse users
    }

    // Time pattern consideration
    if (this.isObstacleCurrentlyActive(obstacle)) {
      penalty *= 1.2; // 20% increase if obstacle is active now
    }

    return Math.round(penalty);
  }

  /**
   * Get safety penalty for specific obstacle types - FIXED for your ObstacleType
   */
  private getObstacleSafetyPenalty(obstacle: CommunityObstacle): number {
    const safetyPenalties: Partial<Record<ObstacleType, number>> = {
      flooding: 25, // High risk of slipping/falling
      broken_pavement: 20, // Trip hazard
      parked_vehicles: 15, // Forces into traffic
      stairs_no_ramp: 10, // Fall risk
      vendor_blocking: 5, // Minimal safety risk
      narrow_passage: 8, // Collision risk
      construction: 30, // High safety risk
      no_sidewalk: 35, // Forces into traffic
      steep_slope: 15, // Fall risk
      electrical_post: 5, // Minor collision risk
      tree_roots: 12, // Trip hazard
      other: 8, // General safety concern
    };

    let penalty = safetyPenalties[obstacle.type] || 5;

    // Increase penalty for blocking severity
    if (obstacle.severity === "blocking") {
      penalty *= 1.5;
    }

    return penalty;
  }

  /**
   * Get user-type specific multipliers for obstacle impact - FIXED for your ObstacleType
   */
  private getUserTypeMultiplier(
    obstacleType: ObstacleType,
    userType: string
  ): number {
    const multipliers: Partial<Record<ObstacleType, Record<string, number>>> = {
      stairs_no_ramp: {
        wheelchair: 2.0, // Stairs are major barrier for wheelchairs
        walker: 1.5, // Difficult with walker
        cane: 1.2, // Some difficulty
        crutches: 1.8, // Very difficult
        none: 1.0, // Standard difficulty
      },
      narrow_passage: {
        wheelchair: 1.8, // Width is critical for wheelchairs
        walker: 1.5, // Walker needs space
        cane: 1.0, // Less affected
        crutches: 1.3, // Some impact
        none: 1.0,
      },
      broken_pavement: {
        wheelchair: 1.6, // Very problematic for wheelchair wheels
        walker: 1.4, // Unstable with walker
        cane: 1.2, // Some difficulty
        crutches: 1.5, // Balance issues
        none: 1.0,
      },
      vendor_blocking: {
        wheelchair: 1.3, // Harder to navigate around
        walker: 1.2, // Some difficulty
        cane: 1.0, // Can navigate around easily
        crutches: 1.1, // Minor impact
        none: 1.0,
      },
      parked_vehicles: {
        wheelchair: 1.4, // Forces into traffic
        walker: 1.2, // Some navigation difficulty
        cane: 1.0, // Can step around
        crutches: 1.1, // Minor impact
        none: 1.0,
      },
      flooding: {
        wheelchair: 1.5, // Wheelchair can get stuck
        walker: 1.3, // Stability issues
        cane: 1.2, // Balance concerns
        crutches: 1.4, // Major balance risk
        none: 1.0,
      },
      no_sidewalk: {
        wheelchair: 1.8, // Forced into dangerous traffic
        walker: 1.6, // Very difficult
        cane: 1.3, // Some difficulty
        crutches: 1.7, // Very problematic
        none: 1.0,
      },
      construction: {
        wheelchair: 1.6, // Often impassable
        walker: 1.4, // Difficult to navigate
        cane: 1.2, // Some difficulty
        crutches: 1.5, // Unstable surfaces
        none: 1.0,
      },
    };

    return multipliers[obstacleType]?.[userType] || 1.0;
  }

  /**
   * Calculate user-specific adjustments based on preferences
   */
  private calculateUserSpecificAdjustment(
    data: SidewalkData,
    profile: UserMobilityProfile
  ): number {
    let adjustment = 0;

    // Distance preference adjustments
    if (profile.maxWalkingDistance && profile.maxWalkingDistance < 500) {
      // User prefers short walks - penalize if area requires detours
      if (data.obstacles.length > 2) {
        adjustment -= 5; // Likely requires longer walking
      }
    }

    // Weather preference (important in Philippines)
    if (profile.preferShade && data.shadeLevel === "covered") {
      adjustment += 3; // Bonus for shade-preferring users
    }

    // Accessibility feature bonuses
    if (profile.type === "wheelchair") {
      if (data.hasRamp) adjustment += 5;
      if (data.hasHandrails) adjustment += 3;
    }

    return adjustment;
  }

  /**
   * Required width for different mobility devices (in meters)
   */
  private getRequiredWidth(profile: UserMobilityProfile): number {
    const widthRequirements = {
      wheelchair: 0.9, // Standard wheelchair width + maneuvering
      walker: 0.7, // Walker width + comfortable space
      crutches: 0.6, // Crutch swing space
      cane: 0.5, // Minimal additional space
      none: 0.5, // Standard walking space
    };

    return widthRequirements[profile.type] || 0.6;
  }

  /**
   * Check if obstacle is currently active based on time pattern
   */
  private isObstacleCurrentlyActive(obstacle: CommunityObstacle): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    switch (obstacle.timePattern) {
      case "permanent":
        return true;
      case "morning":
        return currentHour >= 6 && currentHour < 10;
      case "afternoon":
        return currentHour >= 12 && currentHour < 18;
      case "evening":
        return currentHour >= 18 || currentHour < 6;
      case "weekend":
        return isWeekend;
      default:
        return true; // Assume active if unknown
    }
  }

  /**
   * Convert numerical score to letter grade for easy understanding
   */
  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 85) return "A"; // Excellent accessibility
    if (score >= 70) return "B"; // Good accessibility
    if (score >= 55) return "C"; // Acceptable accessibility
    if (score >= 40) return "D"; // Poor accessibility
    return "F"; // Very poor accessibility
  }

  /**
   * Get weights for academic transparency
   */
  getWeights(): AHPCriteria {
    return { ...this.weights };
  }

  /**
   * Update weights (for research/calibration purposes)
   */
  updateWeights(newWeights: Partial<AHPCriteria>): void {
    this.weights = { ...this.weights, ...newWeights };

    // Ensure weights sum to 1.0
    const sum =
      this.weights.traversability + this.weights.safety + this.weights.comfort;
    if (Math.abs(sum - 1.0) > 0.01) {
      console.warn(
        `AHP weights sum to ${sum}, should be 1.0. Consider rebalancing.`
      );
    }
  }
}

// Export singleton instance for app-wide use
export const ahpCalculator = new AHPAccessibilityCalculator();

// Export utility functions for testing and validation
export const AHPUtils = {
  createSampleSidewalkData: (obstacles: CommunityObstacle[]): SidewalkData => ({
    obstacles,
    estimatedWidth: 1.5,
    surfaceCondition: "smooth" as const,
    slope: 0,
    lighting: "good" as const,
    shadeLevel: "partial" as const,
    trafficLevel: "medium" as const,
    hasRamp: false,
    hasHandrails: false,
  }),

  validateScore: (score: AccessibilityScore): boolean => {
    return (
      score.overall >= 0 &&
      score.overall <= 100 &&
      score.traversability >= 0 &&
      score.traversability <= 100 &&
      score.safety >= 0 &&
      score.safety <= 100 &&
      score.comfort >= 0 &&
      score.comfort <= 100
    );
  },
};

// Re-export types for convenience
export type {
  AHPCriteria,
  SidewalkData,
  AccessibilityScore,
  CommunityObstacle,
};
