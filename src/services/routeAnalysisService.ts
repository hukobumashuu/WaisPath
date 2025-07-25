// src/services/routeAnalysisService.ts
// React Native compatible route analysis with AHP integration

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
  alternativeReason?: string;
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

class RouteAnalysisService {
  /**
   * Main method: Get and analyze multiple routes for accessibility
   */
  async analyzeRoutes(
    start: UserLocation,
    end: UserLocation,
    userProfile: UserMobilityProfile
  ): Promise<DualRouteComparison> {
    try {
      console.log("🔍 Starting route analysis with AHP integration...");

      // Step 1: Get multiple routes from Google Maps using fetch
      const googleRoutes = await googleMapsService.getRoutes(start, end, true);

      if (googleRoutes.length === 0) {
        throw new Error("No routes found between these locations");
      }

      console.log(
        `📍 Found ${googleRoutes.length} routes, analyzing with AHP...`
      );

      // Step 2: Score each route using your existing AHP algorithm
      const scoredRoutes = await Promise.all(
        googleRoutes.map((route) => this.scoreRoute(route, userProfile))
      );

      // Step 3: Apply 10% distance constraint and find best options
      const dualRoutes = this.selectDualRoutes(scoredRoutes);

      console.log("✅ Route analysis complete");
      return dualRoutes;
    } catch (error: any) {
      console.error("❌ Route analysis failed:", error);
      throw new Error(`Route analysis failed: ${error.message}`);
    }
  }

  /**
   * Score a single route using existing AHP algorithm
   */
  private async scoreRoute(
    googleRoute: GoogleRoute,
    userProfile: UserMobilityProfile
  ): Promise<ScoredRoute> {
    console.log(`🧮 Scoring route: ${googleRoute.summary}`);

    try {
      // Get obstacles near this route
      const routeObstacles = await this.getObstaclesNearRoute(googleRoute);

      // Calculate AHP score for the entire route
      const accessibilityScore = this.calculateRouteAccessibilityScore(
        routeObstacles,
        userProfile
      );

      // Generate user-specific warnings
      const userWarnings = this.generateUserWarnings(
        routeObstacles,
        userProfile
      );

      // Determine recommendation level
      const recommendation = this.getRouteRecommendation(
        accessibilityScore.overall
      );

      return {
        googleRoute,
        accessibilityScore,
        obstacleCount: routeObstacles.length,
        userWarnings,
        recommendation,
      };
    } catch (error) {
      console.error(`⚠️ Error scoring route: ${error}`);

      // Return default score if scoring fails
      return {
        googleRoute,
        accessibilityScore: {
          traversability: 85,
          safety: 85,
          comfort: 85,
          overall: 85,
          grade: "B",
          userSpecificAdjustment: 0,
        },
        obstacleCount: 0,
        userWarnings: [],
        recommendation: "good",
      };
    }
  }

  /**
   * Get obstacles near a route (simplified approach)
   */
  private async getObstaclesNearRoute(
    googleRoute: GoogleRoute
  ): Promise<AccessibilityObstacle[]> {
    try {
      // Sample a few points along the route for obstacle detection
      const samplePoints = this.sampleRoutePoints(googleRoute, 3); // 3 sample points
      const allObstacles: AccessibilityObstacle[] = [];

      for (const point of samplePoints) {
        try {
          const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
            point.latitude,
            point.longitude,
            0.3 // 300m radius
          );
          allObstacles.push(...obstacles);
        } catch (error) {
          console.warn("⚠️ Could not fetch obstacles for route point:", error);
        }
      }

      // Remove duplicates by ID
      const uniqueObstacles = allObstacles.filter(
        (obstacle, index, self) =>
          self.findIndex((o) => o.id === obstacle.id) === index
      );

      return uniqueObstacles;
    } catch (error) {
      console.warn("⚠️ Could not fetch obstacles for route:", error);
      return [];
    }
  }

  /**
   * Sample points along the route for obstacle detection
   */
  private sampleRoutePoints(
    googleRoute: GoogleRoute,
    numPoints: number
  ): UserLocation[] {
    const points: UserLocation[] = [];

    if (googleRoute.steps.length === 0) return points;

    // Add start point
    points.push(googleRoute.steps[0].startLocation);

    // Add midpoint(s)
    if (numPoints > 2 && googleRoute.steps.length > 1) {
      const midIndex = Math.floor(googleRoute.steps.length / 2);
      points.push(googleRoute.steps[midIndex].startLocation);
    }

    // Add end point
    const lastStep = googleRoute.steps[googleRoute.steps.length - 1];
    points.push(lastStep.endLocation);

    return points;
  }

  /**
   * Calculate overall route accessibility score using AHP
   */
  private calculateRouteAccessibilityScore(
    obstacles: AccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): AccessibilityScore {
    if (obstacles.length === 0) {
      // No obstacles = excellent accessibility
      return {
        traversability: 95,
        safety: 95,
        comfort: 90,
        overall: 94,
        grade: "A",
        userSpecificAdjustment: 0,
      };
    }

    try {
      // Convert obstacles to AHP format
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

      // Create sidewalk data for AHP calculation
      const sidewalkData =
        AHPUtils.createSampleSidewalkData(communityObstacles);

      // Calculate AHP score using your existing algorithm
      const ahpScore = ahpCalculator.calculateAccessibilityScore(
        sidewalkData,
        userProfile
      );

      return ahpScore;
    } catch (error) {
      console.error("⚠️ AHP calculation error:", error);

      // Fallback to simple scoring
      const avgPenalty = obstacles.length * 5; // Simple penalty per obstacle
      const score = Math.max(40, 100 - avgPenalty);

      return {
        traversability: score,
        safety: score,
        comfort: score,
        overall: score,
        grade: this.scoreToGrade(score),
        userSpecificAdjustment: 0,
      };
    }
  }

  /**
   * Generate user-specific warnings
   */
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

    return warnings.slice(0, 3); // Limit to 3 most important warnings
  }

  /**
   * Check if obstacle affects this user type
   */
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

  /**
   * Select best fastest and most accessible routes
   */
  private selectDualRoutes(scoredRoutes: ScoredRoute[]): DualRouteComparison {
    // Sort by travel time for fastest route
    const routesByTime = [...scoredRoutes].sort(
      (a, b) => a.googleRoute.duration - b.googleRoute.duration
    );
    const fastestRoute = routesByTime[0];

    // Apply 10% distance constraint
    const maxAllowedDistance = fastestRoute.googleRoute.distance * 1.1;
    const constrainedRoutes = scoredRoutes.filter(
      (route) => route.googleRoute.distance <= maxAllowedDistance
    );

    // Sort constrained routes by accessibility score
    const routesByAccessibility = constrainedRoutes.sort(
      (a, b) => b.accessibilityScore.overall - a.accessibilityScore.overall
    );

    const accessibleRoute = routesByAccessibility[0];

    // Calculate comparison metrics
    const timeDifference =
      accessibleRoute.googleRoute.duration - fastestRoute.googleRoute.duration;
    const distanceDifference =
      accessibleRoute.googleRoute.distance - fastestRoute.googleRoute.distance;
    const accessibilityImprovement =
      accessibleRoute.accessibilityScore.overall -
      fastestRoute.accessibilityScore.overall;

    // Generate recommendation
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

  /**
   * Convert score to grade
   */
  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  /**
   * Get route recommendation level
   */
  private getRouteRecommendation(
    score: number
  ): "excellent" | "good" | "acceptable" | "difficult" | "avoid" {
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 55) return "acceptable";
    if (score >= 40) return "difficult";
    return "avoid";
  }

  /**
   * Generate human-readable route recommendation
   */
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

// Export singleton instance
export const routeAnalysisService = new RouteAnalysisService();

// Export types
export type { ScoredRoute, DualRouteComparison };
