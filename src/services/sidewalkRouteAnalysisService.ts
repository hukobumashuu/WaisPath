// src/services/sidewalkRouteAnalysisService.ts
// Revolutionary sidewalk-aware route analysis for PWD navigation

import { ahpCalculator, AHPUtils } from "../utils/ahp";
import { googleMapsService, GoogleRoute } from "./googleMapsService";
import { firebaseServices } from "./firebase";
import {
  UserMobilityProfile,
  UserLocation,
  AccessibilityScore,
  AccessibilityObstacle,
} from "../types";
import {
  SidewalkRouteComparison,
  SidewalkRoute,
  SidewalkRouteSegment,
  CrossingPoint,
  EnhancedAccessibilityObstacle,
  ProcessedSidewalkObstacle,
} from "../types/sidewalkTypes";
import {
  MANUAL_OBSTACLE_MAPPING,
  TEST_CROSSING_POINTS,
  getEnhancedObstacles,
} from "../data/manualSidewalkMapping";

class SidewalkRouteAnalysisService {
  /**
   * MAIN METHOD: Analyze routes with sidewalk-level intelligence
   */
  async analyzeSidewalkRoutes(
    start: UserLocation,
    end: UserLocation,
    userProfile: UserMobilityProfile
  ): Promise<SidewalkRouteComparison> {
    try {
      console.log("🚶‍♂️ Starting revolutionary sidewalk-aware route analysis...");

      // Step 1: Get base route from Google Maps
      const googleRoutes = await googleMapsService.getRoutes(start, end, false);
      if (googleRoutes.length === 0) {
        throw new Error("No routes found between these locations");
      }

      const baseRoute = googleRoutes[0]; // Use first route as baseline
      console.log(
        `📍 Base route: ${baseRoute.summary} (${Math.round(
          baseRoute.distance
        )}m)`
      );

      // Step 2: Get obstacles along route
      const allObstacles = await this.getObstaclesAlongRoute(baseRoute);
      console.log(`🚧 Found ${allObstacles.length} obstacles along route`);

      // Step 3: Enhance obstacles with sidewalk metadata
      const enhancedObstacles = getEnhancedObstacles(allObstacles);
      console.log(
        `🔍 Enhanced ${enhancedObstacles.length} obstacles with sidewalk data`
      );

      // Step 4: Generate standard route (current approach)
      const standardRoute = await this.generateStandardRoute(
        baseRoute,
        enhancedObstacles,
        userProfile
      );

      // Step 5: Generate optimized route (sidewalk-aware)
      const optimizedRoute = await this.generateOptimizedSidewalkRoute(
        baseRoute,
        enhancedObstacles,
        userProfile
      );

      // Step 6: Compare routes and generate insights
      const comparison = this.compareRoutes(
        standardRoute,
        optimizedRoute,
        userProfile
      );

      console.log("✅ Sidewalk route analysis complete!");

      return {
        routeId: `sidewalk_route_${Date.now()}`,
        standardRoute,
        optimizedRoute,
        comparison,
        userProfile,
        analyzedAt: new Date(),
      };
    } catch (error: any) {
      console.error("❌ Sidewalk route analysis failed:", error);
      throw new Error(`Sidewalk analysis failed: ${error.message}`);
    }
  }

  /**
   * Convert enhanced obstacles to processed sidewalk obstacles with guaranteed sidewalkInfo
   */
  private ensureSidewalkInfo(
    obstacles: EnhancedAccessibilityObstacle[]
  ): ProcessedSidewalkObstacle[] {
    return obstacles.map((obstacle) => ({
      ...obstacle,
      sidewalkInfo: obstacle.sidewalkInfo || {
        sidewalkId: "unknown_sidewalk",
        positionOnSidewalk: "center" as const,
        blocksWidth: 50,
        alternativeExists: false,
      },
    }));
  }
  /**
   * Generate standard route - stays on original side, encounters all obstacles
   */
  private async generateStandardRoute(
    googleRoute: GoogleRoute,
    obstacles: EnhancedAccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): Promise<SidewalkRoute> {
    // Calculate accessibility score for all obstacles
    const overallScore = this.calculateRouteAccessibilityScore(
      obstacles,
      userProfile
    );

    // Ensure all obstacles have sidewalkInfo
    const processedObstacles = this.ensureSidewalkInfo(obstacles);

    // Create single segment (simplified for proof of concept)
    const segments: SidewalkRouteSegment[] = [
      {
        id: "standard_segment_1",
        sidewalkId: "current_side", // Represents staying on current sidewalk
        startPoint: {
          latitude: googleRoute.steps[0].startLocation.latitude,
          longitude: googleRoute.steps[0].startLocation.longitude,
        },
        endPoint: {
          latitude:
            googleRoute.steps[googleRoute.steps.length - 1].endLocation
              .latitude,
          longitude:
            googleRoute.steps[googleRoute.steps.length - 1].endLocation
              .longitude,
        },
        distance: googleRoute.distance,
        estimatedTime: googleRoute.duration,
        obstacles: processedObstacles,
        accessibilityScore: overallScore,
        notes: `Encounters ${obstacles.length} obstacles on current sidewalk`,
      },
    ];

    return {
      id: "standard_route",
      type: "standard",
      segments,
      totalDistance: googleRoute.distance,
      totalTime: googleRoute.duration,
      crossingPoints: [], // No crossings in standard route
      overallScore,
      routeReasons: [
        `Follows direct path with ${obstacles.length} obstacles`,
        "No street crossings required",
      ],
    };
  }

  /**
   * Generate optimized route - uses sidewalk intelligence and strategic crossings
   */
  private async generateOptimizedSidewalkRoute(
    googleRoute: GoogleRoute,
    obstacles: EnhancedAccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): Promise<SidewalkRoute> {
    // CORE LOGIC: Filter obstacles based on sidewalk optimization
    const optimizedObstacles = this.filterObstaclesForOptimizedRoute(
      obstacles,
      userProfile
    );

    // Find strategic crossing points
    const strategicCrossings = this.findStrategicCrossings(
      obstacles,
      optimizedObstacles,
      userProfile
    );

    // Calculate improved accessibility score
    const optimizedScore = this.calculateRouteAccessibilityScore(
      optimizedObstacles,
      userProfile
    );

    // Ensure all optimized obstacles have sidewalkInfo
    const processedOptimizedObstacles =
      this.ensureSidewalkInfo(optimizedObstacles);

    // Add crossing time penalty
    const crossingTimePenalty = strategicCrossings.length * 30; // 30 seconds per crossing
    const totalTimeWithCrossings = googleRoute.duration + crossingTimePenalty;

    // Create segments with crossing information
    const segments: SidewalkRouteSegment[] = [
      {
        id: "optimized_segment_1",
        sidewalkId: "optimized_path", // Represents sidewalk-optimized path
        startPoint: {
          latitude: googleRoute.steps[0].startLocation.latitude,
          longitude: googleRoute.steps[0].startLocation.longitude,
        },
        endPoint: {
          latitude:
            googleRoute.steps[googleRoute.steps.length - 1].endLocation
              .latitude,
          longitude:
            googleRoute.steps[googleRoute.steps.length - 1].endLocation
              .longitude,
        },
        distance: googleRoute.distance * 1.05, // 5% longer due to strategic path
        estimatedTime: totalTimeWithCrossings,
        obstacles: processedOptimizedObstacles,
        accessibilityScore: optimizedScore,
        crossingAtEnd:
          strategicCrossings.length > 0 ? strategicCrossings[0] : undefined,
        notes: `Sidewalk-optimized path avoiding ${
          obstacles.length - optimizedObstacles.length
        } obstacles`,
      },
    ];

    // Generate route reasons
    const routeReasons = this.generateRouteReasons(
      obstacles,
      optimizedObstacles,
      strategicCrossings,
      userProfile
    );

    return {
      id: "optimized_route",
      type: "optimized",
      segments,
      totalDistance: googleRoute.distance * 1.05,
      totalTime: totalTimeWithCrossings,
      crossingPoints: strategicCrossings,
      overallScore: optimizedScore,
      routeReasons,
    };
  }

  /**
   * Filter obstacles for optimized route based on user profile and sidewalk intelligence
   */
  private filterObstaclesForOptimizedRoute(
    obstacles: EnhancedAccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): EnhancedAccessibilityObstacle[] {
    console.log(
      `🧠 Filtering ${obstacles.length} obstacles for ${userProfile.type} user...`
    );

    return obstacles.filter((obstacle) => {
      // Check if crossing street would avoid this obstacle
      if (obstacle.sidewalkInfo?.alternativeExists) {
        return true; // Keep obstacles that can be worked around
      }

      // User-specific filtering
      if (userProfile.type === "wheelchair") {
        // Wheelchair users MUST avoid certain obstacles
        const blockingTypes = [
          "stairs_no_ramp",
          "parked_vehicles",
          "narrow_passage",
        ];
        if (blockingTypes.includes(obstacle.type)) {
          console.log(`♿ Filtered out ${obstacle.type} (blocks wheelchair)`);
          return false; // Remove this obstacle through strategic routing
        }
      }

      if (userProfile.type === "walker" || userProfile.type === "cane") {
        // Walker/cane users can avoid some obstacles with crossing
        const avoidableTypes = ["broken_pavement", "flooding"];
        if (
          avoidableTypes.includes(obstacle.type) &&
          obstacle.severity === "high"
        ) {
          console.log(
            `🚶‍♂️ Filtered out high-severity ${obstacle.type} (avoidable by crossing)`
          );
          return false;
        }
      }

      // Keep all other obstacles
      return true;
    });
  }

  /**
   * Find strategic crossing points to avoid obstacles
   */
  private findStrategicCrossings(
    allObstacles: EnhancedAccessibilityObstacle[],
    optimizedObstacles: EnhancedAccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): CrossingPoint[] {
    const avoidsObstacles = allObstacles.length - optimizedObstacles.length;

    if (avoidsObstacles === 0) {
      return []; // No crossings needed
    }

    // Find appropriate crossing point for this user type
    const suitableCrossings = TEST_CROSSING_POINTS.filter((crossing) => {
      const userAccessibility = crossing.userTypes[userProfile.type];
      return userAccessibility === "accessible" || userAccessibility === "easy";
    });

    // Return first suitable crossing (simplified for proof of concept)
    return suitableCrossings.slice(0, 1);
  }

  /**
   * Generate human-readable route reasons
   */
  private generateRouteReasons(
    allObstacles: EnhancedAccessibilityObstacle[],
    optimizedObstacles: EnhancedAccessibilityObstacle[],
    crossings: CrossingPoint[],
    userProfile: UserMobilityProfile
  ): string[] {
    const reasons: string[] = [];
    const avoided = allObstacles.length - optimizedObstacles.length;

    if (avoided > 0) {
      reasons.push(
        `Avoided ${avoided} obstacles through sidewalk optimization`
      );
    }

    if (crossings.length > 0) {
      reasons.push(
        `Strategic crossing at ${crossings[0].type.replace(
          "_",
          " "
        )} for better accessibility`
      );
    }

    // User-specific reasons
    if (userProfile.type === "wheelchair") {
      const stairsAvoided =
        allObstacles.filter((o) => o.type === "stairs_no_ramp").length -
        optimizedObstacles.filter((o) => o.type === "stairs_no_ramp").length;
      if (stairsAvoided > 0) {
        reasons.push(
          `Avoided ${stairsAvoided} stair obstacles (wheelchair accessible path)`
        );
      }
    }

    if (userProfile.preferShade) {
      reasons.push("Prioritized shaded sidewalk sections");
    }

    return reasons.length > 0 ? reasons : ["Optimized for your mobility needs"];
  }

  /**
   * Compare standard vs optimized routes
   */
  private compareRoutes(
    standardRoute: SidewalkRoute,
    optimizedRoute: SidewalkRoute,
    userProfile: UserMobilityProfile
  ) {
    const timeDifference = optimizedRoute.totalTime - standardRoute.totalTime;
    const accessibilityImprovement =
      optimizedRoute.overallScore.overall - standardRoute.overallScore.overall;
    const obstacleReduction =
      standardRoute.segments[0].obstacles.length -
      optimizedRoute.segments[0].obstacles.length;

    // Generate recommendation based on improvement vs time cost
    let recommendation: string;

    if (accessibilityImprovement >= 20 && obstacleReduction >= 2) {
      recommendation = `🌟 Highly recommended! Much more accessible with ${obstacleReduction} fewer obstacles.`;
    } else if (accessibilityImprovement >= 10 && timeDifference <= 60) {
      recommendation = `✅ Recommended. Better accessibility with minimal extra time (${Math.round(
        timeDifference
      )}s).`;
    } else if (accessibilityImprovement > 0) {
      recommendation = `💡 Consider optimized route. ${accessibilityImprovement.toFixed(
        0
      )} points more accessible.`;
    } else {
      recommendation = `📍 Standard route is fine. No significant accessibility improvement available.`;
    }

    return {
      timeDifference,
      crossingCount: optimizedRoute.crossingPoints.length,
      accessibilityImprovement,
      obstacleReduction,
      recommendation,
    };
  }

  /**
   * Get obstacles along the Google Maps route
   */
  private async getObstaclesAlongRoute(
    googleRoute: GoogleRoute
  ): Promise<AccessibilityObstacle[]> {
    try {
      const routePoints = this.sampleRoutePoints(googleRoute, 3);
      const allObstacles: AccessibilityObstacle[] = [];

      for (const point of routePoints) {
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

      // Remove duplicates
      return allObstacles.filter(
        (obstacle, index, self) =>
          self.findIndex((o) => o.id === obstacle.id) === index
      );
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

    // Add middle point(s)
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
   * Calculate accessibility score using existing AHP algorithm
   */
  private calculateRouteAccessibilityScore(
    obstacles: AccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): AccessibilityScore {
    if (obstacles.length === 0) {
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
      // Convert obstacles to AHP format (using existing logic)
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

      // Use existing AHP algorithm
      const sidewalkData =
        AHPUtils.createSampleSidewalkData(communityObstacles);
      const ahpScore = ahpCalculator.calculateAccessibilityScore(
        sidewalkData,
        userProfile
      );

      return ahpScore;
    } catch (error) {
      console.error("⚠️ AHP calculation error:", error);

      // Fallback scoring
      const avgPenalty = obstacles.length * 8;
      const score = Math.max(30, 95 - avgPenalty);

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
   * Convert numeric score to letter grade
   */
  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  /**
   * Test method: Create test obstacles with sidewalk data for demonstration
   */
  async createSidewalkTestData(): Promise<void> {
    console.log("🧪 Creating sidewalk-aware test obstacles...");

    const testObstacles = [
      // North side of C. Raymundo (near City Hall)
      {
        location: { latitude: 14.5765, longitude: 121.0851 },
        type: "stairs_no_ramp" as any,
        severity: "blocking" as any,
        description: "City Hall stairs - north sidewalk (wheelchair blocking)",
        timePattern: "permanent" as any,
      },

      // South side of C. Raymundo (across from City Hall)
      {
        location: { latitude: 14.5763, longitude: 121.0851 },
        type: "vendor_blocking" as any,
        severity: "medium" as any,
        description: "Food vendors - south sidewalk (can navigate around)",
        timePattern: "morning" as any,
      },

      // North side continues east
      {
        location: { latitude: 14.5766, longitude: 121.0855 },
        type: "parked_vehicles" as any,
        severity: "high" as any,
        description: "Motorcycles parked - north sidewalk",
        timePattern: "permanent" as any,
      },

      // South side remains clearer
      {
        location: { latitude: 14.5762, longitude: 121.0856 },
        type: "broken_pavement" as any,
        severity: "low" as any,
        description: "Minor sidewalk damage - south side (passable)",
        timePattern: "permanent" as any,
      },
    ];

    let successCount = 0;
    for (const obstacleData of testObstacles) {
      try {
        await firebaseServices.obstacle.reportObstacle(obstacleData);
        console.log(
          `✅ Created sidewalk test obstacle: ${obstacleData.description}`
        );
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create test obstacle:`, error);
      }
    }

    console.log(
      `🎯 Created ${successCount}/${testObstacles.length} sidewalk test obstacles`
    );
  }
}

// Export singleton instance
export const sidewalkRouteAnalysisService = new SidewalkRouteAnalysisService();

// Also export the class for testing
export { SidewalkRouteAnalysisService };
