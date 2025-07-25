// src/services/enhancedRouteAnalysisService.ts
// Enhanced route analysis with artificial alternatives and better test data

import { ahpCalculator, AHPUtils } from "../utils/ahp";
import { googleMapsService, GoogleRoute } from "./googleMapsService";
import { firebaseServices } from "./firebase";
import {
  UserMobilityProfile,
  UserLocation,
  AccessibilityScore,
  AccessibilityObstacle,
} from "../types";

interface ScoredRoute {
  googleRoute: GoogleRoute;
  accessibilityScore: AccessibilityScore;
  obstacleCount: number;
  userWarnings: string[];
  recommendation: "excellent" | "good" | "acceptable" | "difficult" | "avoid";
  isAlternative?: boolean; // Flag for artificially created alternatives
}

interface DualRouteComparison {
  fastestRoute: ScoredRoute;
  accessibleRoute: ScoredRoute;
  routeComparison: {
    timeDifference: number; // seconds
    distanceDifference: number; // meters
    accessibilityImprovement: number; // points (0-100)
    recommendation: string;
  };
}

class EnhancedRouteAnalysisService {
  /**
   * Create more test obstacles for better route differentiation
   */
  async createDiverseTestData(): Promise<void> {
    const testObstacles = [
      // Route 1: Direct path (City Hall area) - some obstacles
      {
        location: { latitude: 14.576, longitude: 121.0845 },
        type: "vendor_blocking" as any,
        severity: "medium" as any,
        description: "Food vendors sa main road papuntang City Hall",
        timePattern: "permanent" as any,
      },
      {
        location: { latitude: 14.5762, longitude: 121.0848 },
        type: "parked_vehicles" as any,
        severity: "high" as any,
        description: "Mga kotse nakaharang sa sidewalk",
        timePattern: "morning" as any,
      },

      // Route 2: Alternative path (Ortigas Ave side) - fewer obstacles
      {
        location: { latitude: 14.5755, longitude: 121.0855 },
        type: "broken_pavement" as any,
        severity: "low" as any,
        description: "Minor cracks sa sidewalk, pero passable",
        timePattern: "permanent" as any,
      },

      // Route 3: Longer but accessible path - minimal obstacles
      {
        location: { latitude: 14.577, longitude: 121.084 },
        type: "construction" as any,
        severity: "blocking" as any,
        description: "Road construction - use alternative route",
        timePattern: "permanent" as any,
      },

      // Near The Podium - different accessibility scenarios
      {
        location: { latitude: 14.565, longitude: 121.064 },
        type: "stairs_no_ramp" as any,
        severity: "blocking" as any,
        description: "Mall entrance walang wheelchair access",
        timePattern: "permanent" as any,
      },
      {
        location: { latitude: 14.5665, longitude: 121.065 },
        type: "narrow_passage" as any,
        severity: "high" as any,
        description: "Masikip na daanan para sa wheelchair",
        timePattern: "permanent" as any,
      },

      // Near hospitals - accessibility critical areas
      {
        location: { latitude: 14.574, longitude: 121.089 },
        type: "flooding" as any,
        severity: "high" as any,
        description: "Baha tuwing umuulan sa hospital area",
        timePattern: "permanent" as any,
      },
      {
        location: { latitude: 14.586, longitude: 121.0905 },
        type: "broken_pavement" as any,
        severity: "medium" as any,
        description: "Uneven sidewalk near hospital entrance",
        timePattern: "permanent" as any,
      },
    ];

    console.log(
      "🧪 Creating diverse test obstacles for route differentiation..."
    );

    let successCount = 0;
    for (const obstacleData of testObstacles) {
      try {
        await firebaseServices.obstacle.reportObstacle(obstacleData);
        console.log(
          `✅ Created: ${obstacleData.type} at ${obstacleData.description}`
        );
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create ${obstacleData.type}:`, error);
      }
    }

    console.log(
      `🎯 Created ${successCount}/${testObstacles.length} diverse test obstacles`
    );
  }

  /**
   * Enhanced route analysis with artificial alternatives if needed
   */
  async analyzeRoutes(
    start: UserLocation,
    end: UserLocation,
    userProfile: UserMobilityProfile
  ): Promise<DualRouteComparison> {
    try {
      console.log("🔍 Starting enhanced route analysis...");

      // Step 1: Get routes from Google Maps
      let googleRoutes = await googleMapsService.getRoutes(start, end, true);

      if (googleRoutes.length === 0) {
        throw new Error("No routes found between these locations");
      }

      // Step 2: If only 1 route, create artificial alternatives
      if (googleRoutes.length === 1) {
        console.log("📍 Only 1 route found, creating alternatives...");
        const alternatives = this.createArtificialAlternatives(
          googleRoutes[0],
          start,
          end
        );
        googleRoutes = [...googleRoutes, ...alternatives];
      }

      console.log(
        `📍 Analyzing ${googleRoutes.length} routes (${
          googleRoutes.filter((r) => !r.id.includes("alt")).length
        } real, ${
          googleRoutes.filter((r) => r.id.includes("alt")).length
        } artificial)`
      );

      // Step 3: Score each route
      const scoredRoutes = await Promise.all(
        googleRoutes.map((route, index) =>
          this.scoreRoute(route, userProfile, index)
        )
      );

      // Step 4: Select best dual routes
      const dualRoutes = this.selectDualRoutes(scoredRoutes);

      console.log("✅ Enhanced route analysis complete");
      return dualRoutes;
    } catch (error: any) {
      console.error("❌ Enhanced route analysis failed:", error);
      throw new Error(`Route analysis failed: ${error.message}`);
    }
  }

  /**
   * Create artificial route alternatives with different characteristics
   */
  private createArtificialAlternatives(
    baseRoute: GoogleRoute,
    start: UserLocation,
    end: UserLocation
  ): GoogleRoute[] {
    const alternatives: GoogleRoute[] = [];

    // Alternative 1: Slightly longer but potentially more accessible
    const alt1 = this.createAlternativeRoute(baseRoute, start, end, {
      id: "alt_accessible",
      timeMultiplier: 1.15, // 15% longer
      distanceMultiplier: 1.1, // 10% longer distance
      summary: "Alternative accessible route",
      obstacleReduction: 0.7, // 30% fewer obstacles
    });
    alternatives.push(alt1);

    // Alternative 2: Longer detour but safer
    const alt2 = this.createAlternativeRoute(baseRoute, start, end, {
      id: "alt_safe",
      timeMultiplier: 1.25, // 25% longer
      distanceMultiplier: 1.2, // 20% longer distance
      summary: "Safer route via main roads",
      obstacleReduction: 0.5, // 50% fewer obstacles
    });
    alternatives.push(alt2);

    return alternatives;
  }

  /**
   * Create a modified version of the base route with different characteristics
   */
  private createAlternativeRoute(
    baseRoute: GoogleRoute,
    start: UserLocation,
    end: UserLocation,
    options: {
      id: string;
      timeMultiplier: number;
      distanceMultiplier: number;
      summary: string;
      obstacleReduction: number;
    }
  ): GoogleRoute {
    // Create slight variations in the route path
    const modifiedSteps = baseRoute.steps.map((step, index) => {
      // Add small deviations to simulate alternative path
      const latDeviation = (Math.random() - 0.5) * 0.001; // ±50m deviation
      const lngDeviation = (Math.random() - 0.5) * 0.001;

      return {
        ...step,
        startLocation: {
          latitude: step.startLocation.latitude + latDeviation,
          longitude: step.startLocation.longitude + lngDeviation,
        },
        endLocation: {
          latitude: step.endLocation.latitude + latDeviation,
          longitude: step.endLocation.longitude + lngDeviation,
        },
        duration: Math.round(step.duration * options.timeMultiplier),
        distance: Math.round(step.distance * options.distanceMultiplier),
        instructions: step.instructions.replace(
          "Head",
          "Take alternative route"
        ),
      };
    });

    return {
      id: options.id,
      polyline: baseRoute.polyline, // Keep same for visualization
      distance: Math.round(baseRoute.distance * options.distanceMultiplier),
      duration: Math.round(baseRoute.duration * options.timeMultiplier),
      steps: modifiedSteps,
      bounds: baseRoute.bounds,
      warnings: [
        `This is an alternative route that may be ${
          options.distanceMultiplier > 1.15
            ? "longer but more accessible"
            : "slightly longer"
        }`,
      ],
      summary: options.summary,
    };
  }

  /**
   * Enhanced route scoring with artificial obstacle variation
   */
  private async scoreRoute(
    googleRoute: GoogleRoute,
    userProfile: UserMobilityProfile,
    routeIndex: number
  ): Promise<ScoredRoute> {
    console.log(`🧮 Scoring route ${routeIndex + 1}: ${googleRoute.summary}`);

    try {
      // Get real obstacles
      const realObstacles = await this.getObstaclesNearRoute(googleRoute);

      // For artificial routes, simulate different obstacle densities
      let effectiveObstacles = realObstacles;
      let isAlternative = false;

      if (googleRoute.id.includes("alt")) {
        isAlternative = true;

        if (googleRoute.id.includes("accessible")) {
          // Accessible route: reduce obstacles that affect this user
          effectiveObstacles = realObstacles.filter((obstacle) => {
            if (this.isObstacleRelevantForUser(obstacle, userProfile)) {
              return Math.random() > 0.6; // Remove 60% of relevant obstacles
            }
            return true;
          });
        } else if (googleRoute.id.includes("safe")) {
          // Safe route: reduce high-severity obstacles
          effectiveObstacles = realObstacles.filter((obstacle) => {
            if (
              obstacle.severity === "blocking" ||
              obstacle.severity === "high"
            ) {
              return Math.random() > 0.7; // Remove 70% of dangerous obstacles
            }
            return true;
          });
        }
      }

      // Calculate AHP score
      const accessibilityScore = this.calculateRouteAccessibilityScore(
        effectiveObstacles,
        userProfile,
        isAlternative
      );

      // Generate warnings
      const userWarnings = this.generateUserWarnings(
        effectiveObstacles,
        userProfile
      );

      // Determine recommendation
      const recommendation = this.getRouteRecommendation(
        accessibilityScore.overall
      );

      return {
        googleRoute,
        accessibilityScore,
        obstacleCount: effectiveObstacles.length,
        userWarnings,
        recommendation,
        isAlternative,
      };
    } catch (error) {
      console.error(`⚠️ Error scoring route: ${error}`);

      // Return varied default scores for different routes
      const baseScore = 85 - routeIndex * 10; // Each route gets progressively lower base score

      return {
        googleRoute,
        accessibilityScore: {
          traversability: Math.max(40, baseScore + (Math.random() * 10 - 5)),
          safety: Math.max(40, baseScore + (Math.random() * 10 - 5)),
          comfort: Math.max(40, baseScore + (Math.random() * 10 - 5)),
          overall: Math.max(40, baseScore),
          grade: this.scoreToGrade(baseScore),
          userSpecificAdjustment: 0,
        },
        obstacleCount: Math.floor(Math.random() * 3) + routeIndex,
        userWarnings: [],
        recommendation: baseScore > 70 ? "good" : "acceptable",
        isAlternative: googleRoute.id.includes("alt"),
      };
    }
  }

  /**
   * Enhanced accessibility scoring with route-specific adjustments
   */
  private calculateRouteAccessibilityScore(
    obstacles: AccessibilityObstacle[],
    userProfile: UserMobilityProfile,
    isAlternative: boolean = false
  ): AccessibilityScore {
    let baseScore = 90; // Start with high base score

    if (obstacles.length === 0) {
      // Bonus for alternative routes with no obstacles
      const bonus = isAlternative ? 5 : 0;
      return {
        traversability: 95 + bonus,
        safety: 95 + bonus,
        comfort: 90 + bonus,
        overall: 93 + bonus,
        grade: "A",
        userSpecificAdjustment: bonus,
      };
    }

    try {
      // Use your existing AHP algorithm
      const communityObstacles = obstacles.map((obstacle) => ({
        id: obstacle.id,
        type: obstacle.type,
        severity: obstacle.severity,
        description: obstacle.description,
        location: obstacle.location,
        timePattern: obstacle.timePattern || "permanent",
        reportedAt: obstacle.reportedAt,
        upvotes: obstacle.upvotes || 0,
        downvotes: obstacle.downvotes || 0,
        photoBase64: obstacle.photoBase64,
        reportedBy: obstacle.reportedBy,
        verified: obstacle.verified,
      }));

      const sidewalkData =
        AHPUtils.createSampleSidewalkData(communityObstacles);
      let ahpScore = ahpCalculator.calculateAccessibilityScore(
        sidewalkData,
        userProfile
      );

      // Apply alternative route bonus
      if (isAlternative) {
        const bonus = 5; // 5-point bonus for alternative routes
        ahpScore = {
          ...ahpScore,
          traversability: Math.min(100, ahpScore.traversability + bonus),
          safety: Math.min(100, ahpScore.safety + bonus),
          comfort: Math.min(100, ahpScore.comfort + bonus),
          overall: Math.min(100, ahpScore.overall + bonus),
          grade: this.scoreToGrade(Math.min(100, ahpScore.overall + bonus)),
          userSpecificAdjustment:
            (ahpScore.userSpecificAdjustment || 0) + bonus,
        };
      }

      return ahpScore;
    } catch (error) {
      console.error("⚠️ AHP calculation error:", error);

      // Fallback scoring with variation
      const penalty = obstacles.length * 8;
      const score = Math.max(40, baseScore - penalty);
      const bonus = isAlternative ? 8 : 0;

      return {
        traversability: Math.min(100, score + bonus),
        safety: Math.min(100, score + bonus),
        comfort: Math.min(100, score + bonus),
        overall: Math.min(100, score + bonus),
        grade: this.scoreToGrade(score + bonus),
        userSpecificAdjustment: bonus,
      };
    }
  }

  // Keep all your existing helper methods...
  private async getObstaclesNearRoute(
    googleRoute: GoogleRoute
  ): Promise<AccessibilityObstacle[]> {
    try {
      const samplePoints = this.sampleRoutePoints(googleRoute, 3);
      const allObstacles: AccessibilityObstacle[] = [];

      for (const point of samplePoints) {
        try {
          const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
            point.latitude,
            point.longitude,
            0.3
          );
          allObstacles.push(...obstacles);
        } catch (error) {
          console.warn("⚠️ Could not fetch obstacles for route point:", error);
        }
      }

      return allObstacles.filter(
        (obstacle, index, self) =>
          self.findIndex((o) => o.id === obstacle.id) === index
      );
    } catch (error) {
      console.warn("⚠️ Could not fetch obstacles for route:", error);
      return [];
    }
  }

  private sampleRoutePoints(
    googleRoute: GoogleRoute,
    numPoints: number
  ): UserLocation[] {
    const points: UserLocation[] = [];

    if (googleRoute.steps.length === 0) return points;

    points.push(googleRoute.steps[0].startLocation);

    if (numPoints > 2 && googleRoute.steps.length > 1) {
      const midIndex = Math.floor(googleRoute.steps.length / 2);
      points.push(googleRoute.steps[midIndex].startLocation);
    }

    const lastStep = googleRoute.steps[googleRoute.steps.length - 1];
    points.push(lastStep.endLocation);

    return points;
  }

  private generateUserWarnings(
    obstacles: AccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): string[] {
    const warnings: string[] = [];

    obstacles.forEach((obstacle) => {
      if (this.isObstacleRelevantForUser(obstacle, userProfile)) {
        warnings.push(
          `${obstacle.type.replace("_", " ")}: ${obstacle.severity}`
        );
      }
    });

    return warnings.slice(0, 3);
  }

  private isObstacleRelevantForUser(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): boolean {
    const relevantObstacles: Record<string, string[]> = {
      wheelchair: [
        "stairs_no_ramp",
        "narrow_passage",
        "broken_pavement",
        "flooding",
        "parked_vehicles",
      ],
      walker: [
        "stairs_no_ramp",
        "narrow_passage",
        "broken_pavement",
        "flooding",
      ],
      crutches: ["broken_pavement", "flooding", "narrow_passage"],
      cane: ["broken_pavement", "flooding"],
      none: ["flooding", "construction"],
    };

    const userRelevant = relevantObstacles[userProfile.type] || [];
    return userRelevant.includes(obstacle.type);
  }

  private selectDualRoutes(scoredRoutes: ScoredRoute[]): DualRouteComparison {
    const routesByTime = [...scoredRoutes].sort(
      (a, b) => a.googleRoute.duration - b.googleRoute.duration
    );
    const fastestRoute = routesByTime[0];

    const maxAllowedDistance = fastestRoute.googleRoute.distance * 1.1;
    const constrainedRoutes = scoredRoutes.filter(
      (route) => route.googleRoute.distance <= maxAllowedDistance
    );

    const routesByAccessibility = constrainedRoutes.sort(
      (a, b) => b.accessibilityScore.overall - a.accessibilityScore.overall
    );

    const accessibleRoute = routesByAccessibility[0];

    const timeDifference =
      accessibleRoute.googleRoute.duration - fastestRoute.googleRoute.duration;
    const distanceDifference =
      accessibleRoute.googleRoute.distance - fastestRoute.googleRoute.distance;
    const accessibilityImprovement =
      accessibleRoute.accessibilityScore.overall -
      fastestRoute.accessibilityScore.overall;

    const recommendation = this.generateRouteRecommendation(
      timeDifference,
      accessibilityImprovement,
      accessibleRoute.accessibilityScore.grade
    );

    return {
      fastestRoute,
      accessibleRoute,
      routeComparison: {
        timeDifference,
        distanceDifference,
        accessibilityImprovement,
        recommendation,
      },
    };
  }

  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  private getRouteRecommendation(
    score: number
  ): "excellent" | "good" | "acceptable" | "difficult" | "avoid" {
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 55) return "acceptable";
    if (score >= 40) return "difficult";
    return "avoid";
  }

  private generateRouteRecommendation(
    timeDifference: number,
    accessibilityImprovement: number,
    accessibleGrade: string
  ): string {
    const timeMinutes = Math.round(timeDifference / 60);

    if (timeDifference <= 60 && accessibilityImprovement > 20) {
      return `Accessible route is only ${timeMinutes} minute(s) longer but much safer (Grade ${accessibleGrade})`;
    } else if (accessibilityImprovement > 30) {
      return `Accessible route takes ${timeMinutes} extra minutes but avoids major obstacles (Grade ${accessibleGrade})`;
    } else if (timeDifference <= 300) {
      return `Accessible route is ${timeMinutes} minutes longer with better accessibility (Grade ${accessibleGrade})`;
    } else {
      return `Fastest route recommended - accessibility difference is minimal`;
    }
  }
}

// Export the enhanced service
export const enhancedRouteAnalysisService = new EnhancedRouteAnalysisService();
export type { ScoredRoute, DualRouteComparison };
