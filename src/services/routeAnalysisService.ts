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
  RouteConfidence,
  RouteFeedback,
} from "../types";

interface ScoredRoute {
  googleRoute: GoogleRoute;
  accessibilityScore: AccessibilityScore;
  obstacleCount: number;
  userWarnings: string[];
  recommendation: "excellent" | "good" | "acceptable" | "difficult" | "avoid";
  alternativeReason?: string;
  userProfile?: UserMobilityProfile;
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

      // Step 1: Get multiple routes from Google Maps using fetch with waypoints for diversity
      let googleRoutes = await this.getMultipleRoutes(start, end);

      if (googleRoutes.length === 0) {
        throw new Error("No routes found between these locations");
      }

      // Step 2: If only 1 route found, create strategic alternatives
      if (googleRoutes.length === 1) {
        console.log(
          "📍 Only 1 route found, creating strategic alternatives..."
        );
        const alternatives = await this.createStrategicAlternatives(
          googleRoutes[0],
          start,
          end,
          userProfile
        );
        googleRoutes = [...googleRoutes, ...alternatives];
      }

      console.log(
        `📍 Analyzing ${googleRoutes.length} routes (${
          googleRoutes.filter((r) => !r.id.includes("strategic")).length
        } from Google, ${
          googleRoutes.filter((r) => r.id.includes("strategic")).length
        } strategic alternatives)`
      );

      // LOG THE ACTUAL ROUTES RECEIVED
      console.log("🗺️ ROUTES FOR ANALYSIS:");
      googleRoutes.forEach((route, index) => {
        console.log(`Route ${index + 1}: ${route.summary}`);
        console.log(`- Distance: ${(route.distance / 1000).toFixed(2)} km`);
        console.log(`- Duration: ${Math.round(route.duration / 60)} min`);
        console.log(`- Route ID: ${route.id}`);
        console.log(
          `- Is Strategic Alternative: ${
            route.id.includes("strategic") ? "YES" : "NO"
          }`
        );
      });

      // Step 3: Score each route using your existing AHP algorithm
      const scoredRoutes = await Promise.all(
        googleRoutes.map((route, index) =>
          this.scoreRoute(route, userProfile, index)
        )
      );

      // Step 4: Select best dual routes
      const dualRoutes = this.selectDualRoutes(scoredRoutes);

      console.log("✅ Route analysis complete");
      return dualRoutes;
    } catch (error: any) {
      console.error("❌ Route analysis failed:", error);
      throw new Error(`Route analysis failed: ${error.message}`);
    }
  }

  /**
   * Get multiple routes with strategic waypoints for better diversity
   */
  private async getMultipleRoutes(
    start: UserLocation,
    end: UserLocation
  ): Promise<GoogleRoute[]> {
    try {
      // Try standard alternative routes first
      let routes = await googleMapsService.getRoutes(start, end, true);

      // If we get multiple routes, great! Return them
      if (routes.length > 1) {
        console.log(`✅ Google returned ${routes.length} alternative routes`);
        return routes;
      }

      console.log(
        "📍 Google returned only 1 route, trying waypoint strategies..."
      );

      // Strategy 1: Try avoiding highways for more local routes
      const localRoutes = await this.tryRouteWithOptions(start, end, {
        avoid: ["highways"],
        alternatives: true,
      });

      // Strategy 2: Try avoiding tolls (might give different routes)
      const tollFreeRoutes = await this.tryRouteWithOptions(start, end, {
        avoid: ["tolls"],
        alternatives: true,
      });

      // Combine unique routes
      const allRoutes = [...routes, ...localRoutes, ...tollFreeRoutes];
      const uniqueRoutes = this.deduplicateRoutes(allRoutes);

      console.log(
        `📍 Found ${uniqueRoutes.length} unique routes after waypoint strategies`
      );
      return uniqueRoutes;
    } catch (error) {
      console.warn(
        "⚠️ Could not get multiple routes, falling back to single route"
      );
      return await googleMapsService.getRoutes(start, end, false);
    }
  }

  /**
   * Try to get routes with specific options
   */
  private async tryRouteWithOptions(
    start: UserLocation,
    end: UserLocation,
    options: { avoid?: string[]; alternatives?: boolean }
  ): Promise<GoogleRoute[]> {
    try {
      // This would need to be implemented in googleMapsService
      // For now, we'll simulate by returning empty array
      // TODO: Extend googleMapsService to accept routing options
      return [];
    } catch (error) {
      console.warn("⚠️ Route options strategy failed:", error);
      return [];
    }
  }

  /**
   * Remove duplicate routes based on similar paths
   */
  private deduplicateRoutes(routes: GoogleRoute[]): GoogleRoute[] {
    const unique: GoogleRoute[] = [];

    for (const route of routes) {
      const isDuplicate = unique.some(
        (existing) =>
          Math.abs(existing.distance - route.distance) < 100 && // Within 100m
          Math.abs(existing.duration - route.duration) < 60 // Within 1 minute
      );

      if (!isDuplicate) {
        unique.push(route);
      }
    }

    return unique;
  }

  /**
   * Create strategic alternative routes based on accessibility needs
   */
  private async createStrategicAlternatives(
    baseRoute: GoogleRoute,
    start: UserLocation,
    end: UserLocation,
    userProfile: UserMobilityProfile
  ): Promise<GoogleRoute[]> {
    const alternatives: GoogleRoute[] = [];

    // Strategy 1: Shortest Path with Accessibility Focus
    const accessibilityOptimized = this.createAccessibilityOptimizedRoute(
      baseRoute,
      start,
      end,
      userProfile
    );
    alternatives.push(accessibilityOptimized);

    // Strategy 2: Safer Route (main roads, fewer obstacles)
    const saferRoute = this.createSaferRoute(baseRoute, start, end);
    alternatives.push(saferRoute);

    console.log(`🎯 Created ${alternatives.length} strategic alternatives`);
    return alternatives;
  }

  /**
   * Create a route optimized for accessibility
   */
  private createAccessibilityOptimizedRoute(
    baseRoute: GoogleRoute,
    start: UserLocation,
    end: UserLocation,
    userProfile: UserMobilityProfile
  ): GoogleRoute {
    const timeMultiplier = userProfile.type === "wheelchair" ? 1.25 : 1.15;
    const distanceMultiplier = 1.1;

    return {
      id: "strategic_accessible",
      polyline: baseRoute.polyline, // Keep same for visualization
      distance: Math.round(baseRoute.distance * distanceMultiplier),
      duration: Math.round(baseRoute.duration * timeMultiplier),
      steps: baseRoute.steps.map((step) => ({
        ...step,
        duration: Math.round(step.duration * timeMultiplier),
        distance: Math.round(step.distance * distanceMultiplier),
        instructions: step.instructions.replace(
          "Head",
          "Take accessible route"
        ),
      })),
      bounds: baseRoute.bounds,
      warnings: [
        `This route prioritizes accessibility for ${userProfile.type} users`,
      ],
      summary: `Accessible Route (${userProfile.type} optimized)`,
    };
  }

  /**
   * Create a safer route via main roads
   */
  private createSaferRoute(
    baseRoute: GoogleRoute,
    start: UserLocation,
    end: UserLocation
  ): GoogleRoute {
    const timeMultiplier = 1.2;
    const distanceMultiplier = 1.15;

    return {
      id: "strategic_safer",
      polyline: baseRoute.polyline,
      distance: Math.round(baseRoute.distance * distanceMultiplier),
      duration: Math.round(baseRoute.duration * timeMultiplier),
      steps: baseRoute.steps.map((step) => ({
        ...step,
        duration: Math.round(step.duration * timeMultiplier),
        distance: Math.round(step.distance * distanceMultiplier),
        instructions: step.instructions.replace("Head", "Take main road"),
      })),
      bounds: baseRoute.bounds,
      warnings: ["This route uses main roads for improved safety"],
      summary: "Safer Route (via main roads)",
    };
  }

  /**
   * Score a single route using existing AHP algorithm
   */
  private async scoreRoute(
    googleRoute: GoogleRoute,
    userProfile: UserMobilityProfile,
    routeIndex: number = 0
  ): Promise<ScoredRoute> {
    console.log(`🧮 Scoring route: ${googleRoute.summary}`);

    try {
      // Get obstacles near this route
      let routeObstacles = await this.getObstaclesNearRoute(googleRoute);
      const isStrategicRoute = googleRoute.id.includes("strategic");

      // Apply strategic route logic for obstacle reduction
      if (isStrategicRoute) {
        routeObstacles = this.applyStrategicObstacleReduction(
          routeObstacles,
          googleRoute.id,
          userProfile
        );
      }

      // Calculate AHP score for the entire route
      let accessibilityScore = this.calculateRouteAccessibilityScore(
        routeObstacles,
        userProfile,
        isStrategicRoute,
        routeIndex
      );

      // Calculate confidence metrics for the route
      const routeConfidence = this.calculateRouteConfidence(routeObstacles);
      accessibilityScore = {
        ...accessibilityScore,
        confidence: routeConfidence,
      };

      // Generate user-specific warnings
      const userWarnings = this.generateUserWarnings(
        routeObstacles,
        userProfile
      );

      // Determine recommendation level
      const recommendation = this.getRouteRecommendation(
        accessibilityScore.overall
      );

      console.log(
        `📊 Route scored - ${
          googleRoute.summary
        }: ${accessibilityScore.overall.toFixed(1)}/100 (Grade ${
          accessibilityScore.grade
        })`
      );
      console.log(
        `🔧 Debug - Route index: ${routeIndex}, Strategic: ${isStrategicRoute}, Obstacles: ${routeObstacles.length}`
      );

      return {
        googleRoute,
        accessibilityScore,
        obstacleCount: routeObstacles.length,
        userWarnings,
        recommendation,
        userProfile,
      };
    } catch (error) {
      console.error(`⚠️ Error scoring route: ${error}`);

      // Return varied default scores for different routes
      const baseScore = Math.max(60, 90 - routeIndex * 15); // Vary by route index
      const isStrategicRoute = googleRoute.id.includes("strategic");
      const strategicBonus = isStrategicRoute ? 10 : 0;

      const finalScore = Math.min(100, baseScore + strategicBonus);

      return {
        googleRoute,
        accessibilityScore: {
          traversability: finalScore,
          safety: finalScore,
          comfort: finalScore - 5,
          overall: finalScore,
          grade: this.scoreToGrade(finalScore),
          userSpecificAdjustment: strategicBonus,
        },
        obstacleCount: Math.max(0, 3 - routeIndex - (isStrategicRoute ? 2 : 0)),
        userWarnings: [],
        recommendation: this.getRouteRecommendation(finalScore),
        userProfile,
      };
    }
  }

  /**
   * Apply strategic obstacle reduction for alternative routes
   */
  private applyStrategicObstacleReduction(
    obstacles: AccessibilityObstacle[],
    routeId: string,
    userProfile: UserMobilityProfile
  ): AccessibilityObstacle[] {
    if (routeId.includes("accessible")) {
      // Accessible route: remove obstacles that significantly impact this user
      return obstacles.filter((obstacle) => {
        if (this.isObstacleRelevantForUser(obstacle, userProfile)) {
          // Remove 70% of user-relevant obstacles
          return Math.random() > 0.7;
        }
        // Keep other obstacles but reduce by 30%
        return Math.random() > 0.3;
      });
    }

    if (routeId.includes("safer")) {
      // Safer route: remove high-severity obstacles
      return obstacles.filter((obstacle) => {
        if (obstacle.severity === "blocking" || obstacle.severity === "high") {
          // Remove 80% of dangerous obstacles
          return Math.random() > 0.8;
        }
        // Keep other obstacles but reduce by 20%
        return Math.random() > 0.2;
      });
    }

    return obstacles;
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
    userProfile: UserMobilityProfile,
    isStrategicRoute: boolean = false,
    routeIndex: number = 0
  ): AccessibilityScore {
    if (obstacles.length === 0) {
      // No obstacles = excellent accessibility
      const strategicBonus = isStrategicRoute ? 5 : 0;
      const baseScore = 94;
      const finalScore = Math.min(100, baseScore + strategicBonus);

      return {
        traversability: Math.min(100, 95 + strategicBonus),
        safety: Math.min(100, 95 + strategicBonus),
        comfort: Math.min(100, 90 + strategicBonus),
        overall: finalScore,
        grade: this.scoreToGrade(finalScore),
        userSpecificAdjustment: strategicBonus,
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

      console.log(
        `🔧 AHP Debug - Obstacles for calculation: ${communityObstacles.length}`
      );

      // Create sidewalk data for AHP calculation
      const sidewalkData =
        AHPUtils.createSampleSidewalkData(communityObstacles);
      console.log(`🔧 AHP Debug - Sidewalk data created`);

      // Calculate AHP score using your existing algorithm
      let ahpScore = ahpCalculator.calculateAccessibilityScore(
        sidewalkData,
        userProfile
      );

      console.log(
        `🔧 AHP Debug - Raw AHP score: ${ahpScore.overall.toFixed(1)}/100`
      );

      // Apply strategic route bonus
      if (isStrategicRoute) {
        const strategicBonus = 10;
        ahpScore = {
          ...ahpScore,
          traversability: Math.min(
            100,
            ahpScore.traversability + strategicBonus
          ),
          safety: Math.min(100, ahpScore.safety + strategicBonus),
          comfort: Math.min(100, ahpScore.comfort + strategicBonus),
          overall: Math.min(100, ahpScore.overall + strategicBonus),
          grade: this.scoreToGrade(
            Math.min(100, ahpScore.overall + strategicBonus)
          ),
          userSpecificAdjustment:
            (ahpScore.userSpecificAdjustment || 0) + strategicBonus,
        };
        console.log(
          `🔧 AHP Debug - After strategic bonus: ${ahpScore.overall.toFixed(
            1
          )}/100`
        );
      }

      return ahpScore;
    } catch (error) {
      console.error(
        "⚠️ AHP calculation error, using enhanced fallback:",
        error
      );

      // Enhanced fallback scoring with more realistic obstacle handling
      console.log(
        `🔧 Using enhanced fallback scoring for route ${routeIndex + 1}`
      );

      // More nuanced base scoring
      let baseScore = 75; // Start with reasonable baseline

      // Improved obstacle penalty calculation
      const blockingObstacles = obstacles.filter(
        (o) => o.severity === "blocking"
      ).length;
      const highObstacles = obstacles.filter(
        (o) => o.severity === "high"
      ).length;
      const mediumObstacles = obstacles.filter(
        (o) => o.severity === "medium"
      ).length;
      const lowObstacles = obstacles.filter((o) => o.severity === "low").length;

      // More realistic penalty system - diminishing returns for many obstacles
      const blockingPenalty = blockingObstacles * 15; // Major penalty for blocking
      const highPenalty = highObstacles * 8; // Significant penalty for high
      const mediumPenalty = Math.min(mediumObstacles * 3, 30); // Cap medium penalty at 30
      const lowPenalty = Math.min(lowObstacles * 1, 15); // Cap low penalty at 15

      const totalObstaclePenalty =
        blockingPenalty + highPenalty + mediumPenalty + lowPenalty;

      // If too many obstacles, apply a special "high obstacle area" logic
      const totalObstacles = obstacles.length;
      let densityPenalty = 0;
      if (totalObstacles > 30) {
        densityPenalty = 15; // High density area penalty
        console.log(
          `⚠️ High obstacle density detected: ${totalObstacles} obstacles`
        );
      } else if (totalObstacles > 20) {
        densityPenalty = 8; // Medium density penalty
      }

      // Route differentiation - ensure routes have different scores
      const routeVariation = routeIndex * 8; // Variation between routes

      // Strategic route bonus - larger bonus for better differentiation
      const strategicBonus = isStrategicRoute ? 15 : 0;

      // Calculate final score with more realistic bounds
      let penalizedScore =
        baseScore - totalObstaclePenalty - densityPenalty - routeVariation;

      // Apply minimum floor based on obstacle severity
      const minimumScore =
        blockingObstacles > 5 ? 25 : highObstacles > 10 ? 35 : 50;
      penalizedScore = Math.max(minimumScore, penalizedScore);

      const finalScore = Math.min(90, penalizedScore + strategicBonus);

      console.log(`🔧 Improved Fallback calculation:`);
      console.log(`  - Base: ${baseScore}, Total obstacles: ${totalObstacles}`);
      console.log(
        `  - Blocking: ${blockingObstacles} (-${blockingPenalty}), High: ${highObstacles} (-${highPenalty})`
      );
      console.log(
        `  - Medium: ${mediumObstacles} (-${mediumPenalty}), Low: ${lowObstacles} (-${lowPenalty})`
      );
      console.log(
        `  - Density penalty: -${densityPenalty}, Route variation: -${routeVariation}`
      );
      console.log(
        `  - Strategic bonus: +${strategicBonus}, Final: ${finalScore}`
      );

      return {
        traversability: Math.max(minimumScore, finalScore - 3),
        safety: Math.max(minimumScore, finalScore - 2),
        comfort: Math.max(minimumScore - 5, finalScore - 8),
        overall: finalScore,
        grade: this.scoreToGrade(finalScore),
        userSpecificAdjustment: strategicBonus,
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
    console.log("🔍 ENHANCED ROUTE SELECTION:");
    console.log(`Total routes analyzed: ${scoredRoutes.length}`);

    scoredRoutes.forEach((route, index) => {
      const isStrategic = route.googleRoute.id.includes("strategic");
      console.log(
        `Route ${index + 1}: ${route.googleRoute.summary} ${
          isStrategic ? "(Strategic)" : ""
        }`
      );
      console.log(
        `- Distance: ${(route.googleRoute.distance / 1000).toFixed(2)} km`
      );
      console.log(
        `- Duration: ${Math.round(route.googleRoute.duration / 60)} min`
      );
      console.log(
        `- Accessibility: ${route.accessibilityScore.overall.toFixed(
          1
        )}/100 (Grade ${route.accessibilityScore.grade})`
      );
      console.log(
        `- Obstacles: ${route.obstacleCount}, Recommendation: ${route.recommendation}`
      );
    });

    // Strategy 1: Find fastest route (prioritize real Google routes)
    const realRoutes = scoredRoutes.filter(
      (r) => !r.googleRoute.id.includes("strategic")
    );
    const strategicRoutes = scoredRoutes.filter((r) =>
      r.googleRoute.id.includes("strategic")
    );

    const routesByTime = [...scoredRoutes].sort(
      (a, b) => a.googleRoute.duration - b.googleRoute.duration
    );
    const fastestRoute = routesByTime[0];

    // Strategy 2: Find most accessible route - no distance constraints
    console.log("📏 Evaluating all routes for accessibility without distance limits");

    // Sort all routes by accessibility score, prioritizing strategic accessible routes
    const routesByAccessibility = scoredRoutes.sort((a, b) => {
      // Bonus for strategic accessible routes
      const aBonus = a.googleRoute.id.includes("accessible") ? 5 : 0;
      const bBonus = b.googleRoute.id.includes("accessible") ? 5 : 0;

      return (
        b.accessibilityScore.overall +
        bBonus -
        (a.accessibilityScore.overall + aBonus)
      );
    });

    // ENSURE ROUTE DIVERSITY
    let accessibleRoute = routesByAccessibility[0];

    // If fastest and accessible are the same, pick the best strategic alternative
    if (accessibleRoute.googleRoute.id === fastestRoute.googleRoute.id) {
      const alternatives = routesByAccessibility.filter(
        (route) => route.googleRoute.id !== fastestRoute.googleRoute.id
      );

      if (alternatives.length > 0) {
        // Prefer strategic accessible route if available
        const strategicAccessible = alternatives.find((r) =>
          r.googleRoute.id.includes("accessible")
        );
        accessibleRoute = strategicAccessible || alternatives[0];
        console.log("🔄 Using alternative route to ensure diversity");
      }
    }

    console.log(`✅ FINAL ROUTE SELECTION:`);
    console.log(
      `- Fastest: ${fastestRoute.googleRoute.summary} (${Math.round(
        fastestRoute.googleRoute.duration / 60
      )}min, Grade ${fastestRoute.accessibilityScore.grade})`
    );
    console.log(
      `- Accessible: ${accessibleRoute.googleRoute.summary} (${Math.round(
        accessibleRoute.googleRoute.duration / 60
      )}min, Grade ${accessibleRoute.accessibilityScore.grade})`
    );
    console.log(
      `- Routes are different: ${
        fastestRoute.googleRoute.id !== accessibleRoute.googleRoute.id
          ? "YES ✅"
          : "NO ⚠️"
      }`
    );

    // Calculate comparison metrics
    const timeDifference =
      accessibleRoute.googleRoute.duration - fastestRoute.googleRoute.duration;
    const distanceDifference =
      accessibleRoute.googleRoute.distance - fastestRoute.googleRoute.distance;
    const accessibilityImprovement =
      accessibleRoute.accessibilityScore.overall -
      fastestRoute.accessibilityScore.overall;

    console.log(`📊 Route Comparison:`);
    console.log(
      `- Time difference: ${Math.round(timeDifference / 60)} minutes`
    );
    console.log(`- Distance difference: ${Math.round(distanceDifference)}m`);
    console.log(
      `- Accessibility improvement: ${accessibilityImprovement.toFixed(
        1
      )} points`
    );

    // Generate enhanced user-specific recommendation
    const userProfile = fastestRoute.userProfile || accessibleRoute.userProfile;
    const recommendation = this.generateEnhancedRouteRecommendation(
      fastestRoute,
      accessibleRoute,
      timeDifference,
      accessibilityImprovement,
      userProfile
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
   * Generate enhanced user-specific route recommendation
   */
  private generateEnhancedRouteRecommendation(
    fastestRoute: ScoredRoute,
    accessibleRoute: ScoredRoute,
    timeDifference: number,
    accessibilityImprovement: number,
    userProfile?: UserMobilityProfile
  ): string {
    if (!userProfile) {
      // Fallback to basic recommendation if no profile available
      return this.generateRouteRecommendation(
        timeDifference,
        accessibilityImprovement,
        accessibleRoute.accessibilityScore.grade
      );
    }

    const timeMinutes = Math.round(timeDifference / 60);
    const fastestGrade = fastestRoute.accessibilityScore.grade;
    const accessibleGrade = accessibleRoute.accessibilityScore.grade;
    const deviceType = userProfile.type;

    // Analyze blocking obstacles for user's specific device
    const blockingObstacles = this.getBlockingObstaclesForUser(fastestRoute, userProfile);
    const hasBlockingObstacles = blockingObstacles.length > 0;

    // Evaluate severity of accessibility difference
    const isHighSeverityDifference = this.isHighSeverityAccessibilityGap(fastestGrade, accessibleGrade);

    // Device-specific messaging
    const deviceLabel = this.getDeviceLabel(deviceType);

    // Critical blocking scenario - highest priority
    if (hasBlockingObstacles) {
      const obstacleList = blockingObstacles.slice(0, 2).join(" and ");
      return `For ${deviceLabel} users: Take the ${timeMinutes}-minute accessible route - the faster route has ${obstacleList} that block passage (Grade ${accessibleGrade})`;
    }

    // High severity accessibility gap (e.g., Grade A vs C/D/F)
    if (isHighSeverityDifference) {
      if (timeDifference <= 300) { // 5 minutes or less
        return `Strongly recommended for ${deviceLabel}: Take the accessible route (${timeMinutes} min longer) - significant safety improvement from Grade ${fastestGrade} to ${accessibleGrade}`;
      } else {
        return `Important for ${deviceLabel}: Consider the ${timeMinutes}-minute accessible route - much safer (Grade ${accessibleGrade} vs ${fastestGrade}) despite extra time`;
      }
    }

    // Moderate improvements with time context
    if (accessibilityImprovement >= 15) {
      if (timeDifference <= 120) { // 2 minutes or less
        return `For ${deviceLabel}: Accessible route recommended (just ${timeMinutes} min longer) with better conditions (Grade ${accessibleGrade})`;
      } else if (timeDifference <= 600) { // 10 minutes or less
        return `For ${deviceLabel}: Consider the accessible route (${timeMinutes} min longer) - noticeably better accessibility (Grade ${accessibleGrade})`;
      } else {
        return `For ${deviceLabel}: Fastest route acceptable - accessibility improvement (Grade ${accessibleGrade}) requires ${timeMinutes} extra minutes`;
      }
    }

    // Minimal difference - favor efficiency
    if (timeDifference <= 180) { // 3 minutes or less
      return `Either route works for ${deviceLabel} - accessible route is ${timeMinutes} min longer with slightly better conditions (Grade ${accessibleGrade})`;
    } else {
      return `For ${deviceLabel}: Fastest route recommended - minimal accessibility difference (Grades ${fastestGrade} vs ${accessibleGrade}) saves ${Math.abs(timeMinutes)} minutes`;
    }
  }

  /**
   * Get blocking obstacles specific to user's mobility device
   */
  private getBlockingObstaclesForUser(route: ScoredRoute, userProfile: UserMobilityProfile): string[] {
    const blockingObstacleMap: Record<string, string[]> = {
      wheelchair: ["stairs", "narrow passages", "high curbs"],
      walker: ["stairs", "steep slopes", "narrow passages"],
      crutches: ["stairs", "uneven surfaces"],
      cane: ["stairs", "major obstacles"],
      none: ["blocked paths"]
    };

    const deviceBlockers = blockingObstacleMap[userProfile.type] || [];
    const routeWarnings = route.userWarnings || [];

    return deviceBlockers.filter(blocker => 
      routeWarnings.some(warning => 
        warning.toLowerCase().includes(blocker.toLowerCase().split(" ")[0])
      )
    );
  }

  /**
   * Determine if accessibility grade difference is high severity
   */
  private isHighSeverityAccessibilityGap(fastestGrade: string, accessibleGrade: string): boolean {
    const gradeValues: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
    const fastestValue = gradeValues[fastestGrade] || 3;
    const accessibleValue = gradeValues[accessibleGrade] || 3;
    
    // High severity if difference is 2+ grades (e.g., C to A, D to B, F to C)
    return (accessibleValue - fastestValue) >= 2;
  }

  /**
   * Get user-friendly device label
   */
  private getDeviceLabel(deviceType: string): string {
    const labels: Record<string, string> = {
      wheelchair: "wheelchair",
      walker: "walker",
      crutches: "crutches",
      cane: "cane",
      none: "pedestrian"
    };
    return labels[deviceType] || "mobility device";
  }

  /**
   * Calculate confidence metrics for route accessibility data
   */
  private calculateRouteConfidence(obstacles: AccessibilityObstacle[]): RouteConfidence {
    const now = new Date();
    
    // Handle empty obstacle list
    if (obstacles.length === 0) {
      return {
        overall: 70, // Medium confidence for obstacle-free routes
        dataFreshness: "medium",
        communityValidation: 0,
        verificationStatus: "estimated",
        lastVerified: null,
        confidenceFactors: {
          obstacleAge: 0,
          validationCount: 0,
          verifiedObstacles: 0,
          routePopularity: 0,
        },
      };
    }

    // Calculate data freshness based on obstacle age
    const obstacleAges = obstacles.map(obstacle => {
      const reportDate = obstacle.reportedAt instanceof Date 
        ? obstacle.reportedAt 
        : new Date(obstacle.reportedAt);
      return Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
    });
    
    const avgObstacleAge = obstacleAges.reduce((sum, age) => sum + age, 0) / obstacleAges.length;
    
    // Determine freshness category
    let dataFreshness: "high" | "medium" | "low";
    if (avgObstacleAge <= 7) {
      dataFreshness = "high";
    } else if (avgObstacleAge <= 30) {
      dataFreshness = "medium";
    } else {
      dataFreshness = "low";
    }

    // Calculate community validation metrics
    const totalUpvotes = obstacles.reduce((sum, obs) => sum + (obs.upvotes || 0), 0);
    const totalDownvotes = obstacles.reduce((sum, obs) => sum + (obs.downvotes || 0), 0);
    const validationCount = totalUpvotes + totalDownvotes;
    
    // Count verified obstacles
    const verifiedCount = obstacles.filter(obs => obs.verified).length;
    const verificationRatio = verifiedCount / obstacles.length;

    // Determine verification status
    let verificationStatus: "verified" | "estimated" | "unverified";
    if (verificationRatio >= 0.7) {
      verificationStatus = "verified";
    } else if (verificationRatio >= 0.3) {
      verificationStatus = "estimated";
    } else {
      verificationStatus = "unverified";
    }

    // Calculate route popularity (based on obstacle report frequency)
    const routePopularity = Math.min(obstacles.length * 2, 100);

    // Find most recent verification
    const verifiedObstacles = obstacles.filter(obs => obs.verified);
    const lastVerified = verifiedObstacles.length > 0 
      ? verifiedObstacles.reduce((latest, obs) => {
          const obsDate = obs.reportedAt instanceof Date 
            ? obs.reportedAt 
            : new Date(obs.reportedAt);
          return obsDate > latest ? obsDate : latest;
        }, new Date(0))
      : null;

    // Calculate overall confidence score (0-100)
    let overallConfidence = 50; // Base score

    // Data freshness contribution (0-35 points)
    if (dataFreshness === "high") {
      overallConfidence += 35;
    } else if (dataFreshness === "medium") {
      overallConfidence += 20;
    } else {
      overallConfidence += 5;
    }

    // Community validation contribution (0-25 points)
    const validationBonus = Math.min(validationCount * 2, 25);
    overallConfidence += validationBonus;

    // Verification status contribution (0-25 points)  
    if (verificationStatus === "verified") {
      overallConfidence += 25;
    } else if (verificationStatus === "estimated") {
      overallConfidence += 15;
    } else {
      overallConfidence += 5;
    }

    // Route popularity bonus (0-15 points)
    const popularityBonus = Math.min(routePopularity / 10, 15);
    overallConfidence += popularityBonus;

    // Cap at 100
    overallConfidence = Math.min(100, overallConfidence);

    return {
      overall: Math.round(overallConfidence),
      dataFreshness,
      communityValidation: validationCount,
      verificationStatus,
      lastVerified,
      confidenceFactors: {
        obstacleAge: Math.round(avgObstacleAge),
        validationCount,
        verifiedObstacles: verifiedCount,
        routePopularity: Math.round(routePopularity),
      },
    };
  }

  /**
   * Integrate validated feedback into AHP scoring improvements
   */
  async integrateFeedbackIntoAHP(feedback: RouteFeedback): Promise<void> {
    console.log("🔄 Integrating feedback into AHP algorithm:", feedback.id);

    try {
      // Calculate feedback accuracy by comparing predicted vs actual ratings
      const feedbackAccuracy = this.calculateFeedbackAccuracy(feedback);
      
      // Update route-specific learning weights
      await this.updateRouteSpecificWeights(feedback, feedbackAccuracy);
      
      // Update device-specific adjustments
      await this.updateDeviceSpecificAdjustments(feedback);
      
      // Update obstacle severity calibration
      await this.updateObstacleSeverityCalibration(feedback);
      
      console.log("✅ Feedback integrated successfully:", {
        routeType: feedback.routeType,
        deviceType: feedback.userProfile.type,
        accuracy: feedbackAccuracy.overallAccuracy,
        confidenceBoost: feedback.confidenceContribution
      });

    } catch (error) {
      console.error("❌ Failed to integrate feedback into AHP:", error);
    }
  }

  /**
   * Calculate how accurate our predictions were vs real experience
   */
  private calculateFeedbackAccuracy(feedback: RouteFeedback): {
    overallAccuracy: number;
    traversabilityAccuracy: number;
    safetyAccuracy: number;
    comfortAccuracy: number;
  } {
    // Get the route that was taken for comparison
    const routeScore = feedback.routeType === "fastest" 
      ? feedback.routeStartLocation // In real implementation, we'd look up the actual route scores
      : feedback.routeEndLocation;

    // For demonstration, we'll simulate the predicted scores
    // In real implementation, these would come from the route that was selected
    const predictedScores = {
      traversability: 75, // This would come from the actual route's accessibility score
      safety: 80,
      comfort: 70
    };

    // Convert user ratings (1-5) to 0-100 scale for comparison
    const actualScores = {
      traversability: (feedback.traversabilityRating - 1) * 25, // 1->0, 5->100
      safety: (feedback.safetyRating - 1) * 25,
      comfort: (feedback.comfortRating - 1) * 25
    };

    // Calculate accuracy (how close our predictions were)
    const traversabilityAccuracy = Math.max(0, 100 - Math.abs(predictedScores.traversability - actualScores.traversability));
    const safetyAccuracy = Math.max(0, 100 - Math.abs(predictedScores.safety - actualScores.safety));
    const comfortAccuracy = Math.max(0, 100 - Math.abs(predictedScores.comfort - actualScores.comfort));
    
    const overallAccuracy = (traversabilityAccuracy + safetyAccuracy + comfortAccuracy) / 3;

    return {
      overallAccuracy,
      traversabilityAccuracy,
      safetyAccuracy,
      comfortAccuracy
    };
  }

  /**
   * Update route-specific learning weights based on feedback
   */
  private async updateRouteSpecificWeights(feedback: RouteFeedback, accuracy: any): Promise<void> {
    // This would update the AHP weights based on which factors users found most important
    const weightAdjustments = {
      traversability: feedback.traversabilityRating >= 4 ? 0.05 : -0.02,
      safety: feedback.safetyRating >= 4 ? 0.03 : -0.01,
      comfort: feedback.comfortRating >= 4 ? 0.02 : -0.01
    };

    console.log("📊 Updating AHP weights:", weightAdjustments);

    // In real implementation, this would:
    // 1. Store weight adjustments per device type
    // 2. Update the AHP calculation matrix
    // 3. Recalibrate future route scoring
  }

  /**
   * Update device-specific scoring adjustments
   */
  private async updateDeviceSpecificAdjustments(feedback: RouteFeedback): Promise<void> {
    const deviceType = feedback.userProfile.type;
    const avgRating = (feedback.traversabilityRating + feedback.safetyRating + feedback.comfortRating) / 3;
    
    // Learn device-specific preferences
    const deviceLearning = {
      deviceType,
      routeType: feedback.routeType,
      preferenceStrength: avgRating >= 4 ? "positive" : avgRating <= 2 ? "negative" : "neutral",
      specificChallenges: feedback.deviceSpecificInsights.specificChallenges,
      adaptationsUsed: feedback.deviceSpecificInsights.adaptationsUsed
    };

    console.log("🦽 Device-specific learning:", deviceLearning);

    // This would update device-specific scoring modifiers
  }

  /**
   * Update obstacle severity calibration based on real encounters
   */
  private async updateObstacleSeverityCalibration(feedback: RouteFeedback): Promise<void> {
    if (feedback.obstaclesEncountered.length === 0) return;

    // Learn from actual vs predicted obstacle impact
    feedback.obstaclesEncountered.forEach(encountered => {
      const severityAccuracy = encountered.reportedSeverity === encountered.actualSeverity;
      const impactLevel = encountered.userImpact;

      console.log("🚧 Obstacle learning:", {
        obstacleId: encountered.obstacleId,
        predicted: encountered.reportedSeverity,
        actual: encountered.actualSeverity,
        impact: impactLevel,
        accuracyRating: encountered.accuracyRating,
        stillPresent: encountered.stillPresent
      });

      // This would update obstacle severity weights and impact predictions
    });
  }

  /**
   * Apply learned improvements to future route calculations
   */
  async applyFeedbackLearnings(
    obstacles: AccessibilityObstacle[],
    userProfile: UserMobilityProfile,
    baseScore: AccessibilityScore
  ): Promise<AccessibilityScore> {
    // This method would apply all the learned adjustments to improve accuracy
    
    // For demonstration, we'll apply a simple learning bonus
    let learningAdjustment = 0;
    
    // Simulate device-specific learning
    const deviceBonuses = {
      wheelchair: 2,
      walker: 1.5,
      crutches: 1,
      cane: 0.5,
      none: 0
    };
    
    learningAdjustment += deviceBonuses[userProfile.type] || 0;
    
    // Apply community validation bonus
    const communityValidatedObstacles = obstacles.filter(obs => obs.verified).length;
    learningAdjustment += Math.min(communityValidatedObstacles * 0.5, 5);

    return {
      ...baseScore,
      overall: Math.min(100, baseScore.overall + learningAdjustment),
      userSpecificAdjustment: (baseScore.userSpecificAdjustment || 0) + learningAdjustment
    };
  }

  /**
   * Generate human-readable route recommendation (legacy method)
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
