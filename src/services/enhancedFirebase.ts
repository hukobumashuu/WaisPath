// src/services/enhancedFirebase.ts - NEW FILE (don't modify existing firebase.ts)
// Enhanced Firebase services that work with your existing system

import {
  ahpCalculator,
  AHPUtils,
  AccessibilityScore,
  SidewalkData,
} from "../utils/ahp";
import {
  UserMobilityProfile,
  CommunityObstacle,
  EnhancedObstacleReport,
  RouteAccessibilityAnalysis,
  RouteSegmentScore,
  AccessibilityWarning,
} from "../types";
import { firebaseServices } from "./firebase"; // Your existing Firebase service

class EnhancedAccessibilityService {
  /**
   * Convert your existing AccessibilityObstacle to CommunityObstacle format
   */
  private convertToCommunityObstacle(obstacle: any): CommunityObstacle {
    return {
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
    };
  }

  /**
   * Analyze obstacles with AHP scoring for enhanced reporting
   */
  async analyzeObstacleWithAHP(
    obstacle: CommunityObstacle,
    userProfile: UserMobilityProfile
  ): Promise<EnhancedObstacleReport> {
    // Create sidewalk data context for this obstacle
    const sidewalkData = this.estimateSidewalkConditions(obstacle);

    // Calculate AHP-based accessibility impact
    const accessibilityImpact = ahpCalculator.calculateAccessibilityScore(
      sidewalkData,
      userProfile
    );

    // Determine which user types are most affected
    const affectedUserTypes = this.getAffectedUserTypes(obstacle);

    // Calculate user-specific rating (1-5 stars)
    const userSpecificRating = this.calculateUserRating(
      accessibilityImpact,
      userProfile
    );

    // Determine priority level for government reports
    const priorityLevel = this.calculatePriorityLevel(
      obstacle,
      accessibilityImpact
    );

    // Estimate detour time needed
    const estimatedDetourTime = this.estimateDetourTime(obstacle, userProfile);

    return {
      ...obstacle,
      accessibilityImpact,
      userSpecificRating,
      affectedUserTypes,
      priorityLevel,
      estimatedDetourTime,
    };
  }

  /**
   * Get enhanced obstacle list with AHP scores for nearby area
   */
  async getEnhancedObstaclesInArea(
    latitude: number,
    longitude: number,
    radiusKm: number,
    userProfile: UserMobilityProfile
  ): Promise<EnhancedObstacleReport[]> {
    try {
      // Get obstacles using existing Firebase service
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        latitude,
        longitude,
        radiusKm
      );

      // Convert to CommunityObstacle format and enhance with AHP analysis
      const enhancedObstacles = await Promise.all(
        obstacles.map(async (obstacle) => {
          const communityObstacle = this.convertToCommunityObstacle(obstacle);
          return this.analyzeObstacleWithAHP(communityObstacle, userProfile);
        })
      );

      // Sort by priority level and user-specific impact
      return enhancedObstacles.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff =
          priorityOrder[b.priorityLevel] - priorityOrder[a.priorityLevel];

        if (priorityDiff !== 0) return priorityDiff;

        // If same priority, sort by user-specific rating
        return b.userSpecificRating - a.userSpecificRating;
      });
    } catch (error) {
      console.error("Failed to get enhanced obstacles:", error);
      throw new Error("Hindi nakuha ang obstacles. Check internet connection.");
    }
  }

  /**
   * Analyze complete route for accessibility using AHP methodology
   */
  async analyzeRouteAccessibility(
    routeCoordinates: Array<{ latitude: number; longitude: number }>,
    userProfile: UserMobilityProfile,
    routeId?: string
  ): Promise<RouteAccessibilityAnalysis> {
    const segments: RouteSegmentScore[] = [];
    let totalDistance = 0;
    let obstacleCount = 0;
    const warnings: AccessibilityWarning[] = [];

    try {
      // Break route into 100-meter segments for detailed analysis
      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const start = routeCoordinates[i];
        const end = routeCoordinates[i + 1];

        // Calculate segment distance
        const segmentDistance = this.calculateDistance(start, end);
        totalDistance += segmentDistance;

        // Get obstacles near this segment (50-meter buffer)
        const nearbyObstacles = await this.getObstaclesNearPath(start, end, 50);
        obstacleCount += nearbyObstacles.length;

        // Estimate sidewalk conditions for this segment
        const estimatedSidewalkData = this.estimateSidewalkConditionsForSegment(
          start,
          end,
          nearbyObstacles
        );

        // Calculate AHP accessibility score
        const accessibilityScore = ahpCalculator.calculateAccessibilityScore(
          estimatedSidewalkData,
          userProfile
        );

        // Generate warnings for problematic areas
        const segmentWarnings = this.generateSegmentWarnings(
          nearbyObstacles,
          accessibilityScore,
          userProfile
        );
        warnings.push(...segmentWarnings);

        segments.push({
          segmentIndex: i,
          startLocation: start,
          endLocation: end,
          distance: segmentDistance,
          obstacles: nearbyObstacles,
          accessibilityScore,
          estimatedSidewalkData,
          confidence: this.calculateConfidence(
            nearbyObstacles.length,
            segmentDistance
          ),
        });
      }

      // Calculate overall route accessibility (distance-weighted average)
      const overallAccessibilityScore =
        this.calculateOverallRouteScore(segments);

      // Generate route recommendations
      const recommendations = this.generateRouteRecommendations(
        segments,
        warnings,
        userProfile
      );

      return {
        routeId: routeId || `route_${Date.now()}`,
        segments,
        overallAccessibilityScore,
        userProfile,
        totalDistance,
        estimatedDuration: this.estimateWalkingDuration(
          totalDistance,
          userProfile
        ),
        obstacleCount,
        warnings,
        recommendations,
        analyzedAt: new Date(),
      };
    } catch (error) {
      console.error("Route analysis failed:", error);
      throw new Error("Hindi na-analyze ang route. Subukan ulit.");
    }
  }

  /**
   * Estimate sidewalk conditions based on obstacle data and location
   */
  private estimateSidewalkConditions(
    obstacle: CommunityObstacle
  ): SidewalkData {
    return {
      obstacles: [obstacle],
      estimatedWidth: this.estimateWidthFromLocation(obstacle.location),
      surfaceCondition: this.estimateSurfaceCondition(obstacle),
      slope: 0, // Default - can be enhanced with elevation API later
      lighting: this.estimateLighting(obstacle.location),
      shadeLevel: this.estimateShade(obstacle.location),
      trafficLevel: this.estimateTrafficLevel(obstacle.location),
      hasRamp: obstacle.type === "stairs_no_ramp" ? false : true,
      hasHandrails: false, // Default - can be enhanced with crowdsourced data
    };
  }

  /**
   * Estimate sidewalk conditions for route segment
   */
  private estimateSidewalkConditionsForSegment(
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    obstacles: CommunityObstacle[]
  ): SidewalkData {
    const midpoint = {
      latitude: (start.latitude + end.latitude) / 2,
      longitude: (start.longitude + end.longitude) / 2,
    };

    return {
      obstacles,
      estimatedWidth: this.estimateWidthFromLocation(midpoint),
      surfaceCondition: this.estimateSurfaceFromObstacles(obstacles),
      slope: 0, // Default
      lighting: this.estimateLighting(midpoint),
      shadeLevel: this.estimateShade(midpoint),
      trafficLevel: this.estimateTrafficLevel(midpoint),
      hasRamp: !obstacles.some((o) => o.type === "stairs_no_ramp"),
      hasHandrails: false,
    };
  }

  private estimateSurfaceCondition(
    obstacle: CommunityObstacle
  ): "smooth" | "rough" | "broken" {
    if (obstacle.type === "broken_pavement") return "broken";
    if (obstacle.type === "flooding") return "rough";
    if (obstacle.type === "tree_roots") return "rough";
    return "smooth";
  }

  private estimateWidthFromLocation(location: {
    latitude: number;
    longitude: number;
  }): number {
    // Default estimates for Pasig City areas
    if (this.isInBusinessDistrict(location)) return 2.0; // Wider business sidewalks
    if (this.isInResidentialArea(location)) return 1.2; // Narrower residential
    return 1.5; // Default assumption
  }

  private estimateSurfaceFromObstacles(
    obstacles: CommunityObstacle[]
  ): "smooth" | "rough" | "broken" {
    if (obstacles.some((o) => o.type === "broken_pavement")) return "broken";
    if (obstacles.some((o) => o.type === "flooding" || o.type === "tree_roots"))
      return "rough";
    return "smooth";
  }

  private estimateLighting(location: {
    latitude: number;
    longitude: number;
  }): "good" | "poor" | "none" {
    if (this.isInBusinessDistrict(location)) return "good";
    if (this.isNearMainRoad(location)) return "good";
    return "poor";
  }

  private estimateShade(location: {
    latitude: number;
    longitude: number;
  }): "covered" | "partial" | "none" {
    if (this.isInBusinessDistrict(location)) return "covered";
    return "partial";
  }

  private estimateTrafficLevel(location: {
    latitude: number;
    longitude: number;
  }): "high" | "medium" | "low" {
    if (this.isNearMainRoad(location)) return "high";
    if (this.isInBusinessDistrict(location)) return "medium";
    return "low";
  }

  private getAffectedUserTypes(obstacle: CommunityObstacle): string[] {
    const affectedTypes: string[] = [];

    switch (obstacle.type) {
      case "stairs_no_ramp":
        affectedTypes.push("wheelchair", "walker");
        if (obstacle.severity === "blocking") affectedTypes.push("crutches");
        break;
      case "narrow_passage":
        affectedTypes.push("wheelchair", "walker");
        break;
      case "broken_pavement":
      case "tree_roots":
        affectedTypes.push("wheelchair", "walker", "cane", "crutches");
        break;
      case "flooding":
        affectedTypes.push("wheelchair", "walker", "crutches");
        break;
      case "vendor_blocking":
        if (obstacle.severity === "high" || obstacle.severity === "blocking") {
          affectedTypes.push("wheelchair", "walker");
        }
        break;
      case "parked_vehicles":
      case "no_sidewalk":
        affectedTypes.push("wheelchair", "walker");
        break;
      case "construction":
        affectedTypes.push("wheelchair", "walker", "crutches");
        break;
      default:
        affectedTypes.push("wheelchair");
    }

    return affectedTypes;
  }

  private calculateUserRating(
    accessibilityScore: AccessibilityScore,
    userProfile: UserMobilityProfile
  ): number {
    let rating = 5;

    if (accessibilityScore.overall < 20) rating = 1;
    else if (accessibilityScore.overall < 40) rating = 2;
    else if (accessibilityScore.overall < 60) rating = 3;
    else if (accessibilityScore.overall < 80) rating = 4;

    // Adjust based on user-specific factors
    if (accessibilityScore.userSpecificAdjustment < -10) {
      rating = Math.max(1, rating - 1);
    } else if (accessibilityScore.userSpecificAdjustment > 5) {
      rating = Math.min(5, rating + 1);
    }

    return rating;
  }

  private calculatePriorityLevel(
    obstacle: CommunityObstacle,
    accessibilityScore: AccessibilityScore
  ): "critical" | "high" | "medium" | "low" {
    if (obstacle.severity === "blocking") return "critical";
    if (accessibilityScore.overall < 30) return "high";
    if (obstacle.type === "stairs_no_ramp" || obstacle.type === "no_sidewalk")
      return "high";
    if (obstacle.type === "broken_pavement" || obstacle.type === "flooding") {
      return obstacle.severity === "high" ? "high" : "medium";
    }
    return obstacle.severity === "high" ? "medium" : "low";
  }

  private estimateDetourTime(
    obstacle: CommunityObstacle,
    userProfile: UserMobilityProfile
  ): number {
    const baseDetourTimes: Record<string, number> = {
      stairs_no_ramp: 5,
      parked_vehicles: 2,
      vendor_blocking: 1,
      flooding: 8,
      broken_pavement: 3,
      narrow_passage: 2,
      construction: 10,
      no_sidewalk: 15,
      tree_roots: 2,
      electrical_post: 1,
    };

    let detourTime = baseDetourTimes[obstacle.type] || 2;

    if (obstacle.severity === "blocking") detourTime *= 2;
    else if (obstacle.severity === "high") detourTime *= 1.5;

    if (
      userProfile.type === "wheelchair" &&
      (obstacle.type === "stairs_no_ramp" || obstacle.type === "narrow_passage")
    ) {
      detourTime *= 1.5;
    }

    return Math.round(detourTime);
  }

  private generateSegmentWarnings(
    obstacles: CommunityObstacle[],
    accessibilityScore: AccessibilityScore,
    userProfile: UserMobilityProfile
  ): AccessibilityWarning[] {
    const warnings: AccessibilityWarning[] = [];

    if (accessibilityScore.overall < 40) {
      warnings.push({
        type: "difficult",
        severity: accessibilityScore.overall < 20 ? "critical" : "high",
        message: `Very difficult path for ${userProfile.type} users (${accessibilityScore.grade} grade)`,
        location: obstacles[0]?.location || { latitude: 0, longitude: 0 },
        affectedUserTypes: [userProfile.type],
        suggestedAction: "Consider alternative route or request assistance",
      });
    }

    obstacles.forEach((obstacle) => {
      if (obstacle.severity === "blocking") {
        warnings.push({
          type: "blocking",
          severity: "critical",
          message: `Path completely blocked by ${obstacle.type}`,
          location: obstacle.location,
          affectedUserTypes: this.getAffectedUserTypes(obstacle),
          suggestedAction: "Find alternative route immediately",
        });
      }
    });

    return warnings;
  }

  private calculateOverallRouteScore(
    segments: RouteSegmentScore[]
  ): AccessibilityScore {
    if (segments.length === 0) {
      return {
        traversability: 100,
        safety: 100,
        comfort: 100,
        overall: 100,
        grade: "A",
        userSpecificAdjustment: 0,
      };
    }

    let totalDistance = 0;
    let weightedTraversability = 0;
    let weightedSafety = 0;
    let weightedComfort = 0;
    let weightedOverall = 0;
    let totalAdjustment = 0;

    segments.forEach((segment) => {
      const weight = segment.distance;
      totalDistance += weight;

      weightedTraversability +=
        segment.accessibilityScore.traversability * weight;
      weightedSafety += segment.accessibilityScore.safety * weight;
      weightedComfort += segment.accessibilityScore.comfort * weight;
      weightedOverall += segment.accessibilityScore.overall * weight;
      totalAdjustment +=
        segment.accessibilityScore.userSpecificAdjustment * weight;
    });

    if (totalDistance === 0) totalDistance = 1;

    const overall = weightedOverall / totalDistance;

    return {
      traversability:
        Math.round((weightedTraversability / totalDistance) * 10) / 10,
      safety: Math.round((weightedSafety / totalDistance) * 10) / 10,
      comfort: Math.round((weightedComfort / totalDistance) * 10) / 10,
      overall: Math.round(overall * 10) / 10,
      grade: this.scoreToGrade(overall),
      userSpecificAdjustment:
        Math.round((totalAdjustment / totalDistance) * 10) / 10,
    };
  }

  private generateRouteRecommendations(
    segments: RouteSegmentScore[],
    warnings: AccessibilityWarning[],
    userProfile: UserMobilityProfile
  ): string[] {
    const recommendations: string[] = [];

    const criticalWarnings = warnings.filter((w) => w.severity === "critical");
    if (criticalWarnings.length > 0) {
      recommendations.push(
        "⚠️ CRITICAL: This route has major accessibility barriers"
      );
      recommendations.push("Strongly recommend finding alternative route");
    }

    if (userProfile.type === "wheelchair") {
      const stairsCount = segments.reduce(
        (count, s) =>
          count + s.obstacles.filter((o) => o.type === "stairs_no_ramp").length,
        0
      );

      if (stairsCount > 0) {
        recommendations.push(
          `${stairsCount} stairs without ramps - look for alternative entrances`
        );
      }
    }

    const avgScore =
      segments.reduce((sum, s) => sum + s.accessibilityScore.overall, 0) /
      segments.length;

    if (avgScore < 50) {
      recommendations.push(
        "Overall accessibility is poor - consider requesting assistance"
      );
    } else if (avgScore > 80) {
      recommendations.push(
        "Good accessibility route - should be comfortable to navigate"
      );
    }

    return recommendations;
  }

  // Utility methods
  private isInBusinessDistrict(location: {
    latitude: number;
    longitude: number;
  }): boolean {
    return (
      location.latitude >= 14.585 &&
      location.latitude <= 14.595 &&
      location.longitude >= 121.055 &&
      location.longitude <= 121.07
    );
  }

  private isInResidentialArea(location: {
    latitude: number;
    longitude: number;
  }): boolean {
    return (
      !this.isInBusinessDistrict(location) && !this.isNearMainRoad(location)
    );
  }

  private isNearMainRoad(location: {
    latitude: number;
    longitude: number;
  }): boolean {
    return false; // Placeholder
  }

  private calculateDistance(
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3;
    const φ1 = (start.latitude * Math.PI) / 180;
    const φ2 = (end.latitude * Math.PI) / 180;
    const Δφ = ((end.latitude - start.latitude) * Math.PI) / 180;
    const Δλ = ((end.longitude - start.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private estimateWalkingDuration(
    distance: number,
    userProfile: UserMobilityProfile
  ): number {
    const speeds = {
      wheelchair: 50,
      walker: 40,
      crutches: 35,
      cane: 60,
      none: 80,
    };

    const speed = speeds[userProfile.type] || 60;
    return Math.round(distance / speed);
  }

  private calculateConfidence(obstacleCount: number, distance: number): number {
    let confidence = 0.7;
    confidence += Math.min(0.2, obstacleCount * 0.05);
    confidence -= Math.min(0.2, (distance / 1000) * 0.1);
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  private async getObstaclesNearPath(
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    bufferMeters: number
  ): Promise<CommunityObstacle[]> {
    const midpoint = {
      latitude: (start.latitude + end.latitude) / 2,
      longitude: (start.longitude + end.longitude) / 2,
    };

    const searchRadius = Math.max(
      0.1,
      this.calculateDistance(start, end) / 1000 + bufferMeters / 1000
    );

    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        midpoint.latitude,
        midpoint.longitude,
        searchRadius
      );

      return obstacles.map((obstacle) =>
        this.convertToCommunityObstacle(obstacle)
      );
    } catch (error) {
      console.warn("Failed to get obstacles near path:", error);
      return [];
    }
  }
}

// Create enhanced accessibility service instance
export const enhancedAccessibilityService = new EnhancedAccessibilityService();

// Simple function to update verification using existing service
export const updateObstacleVerification = async (
  obstacleId: string,
  action: "upvote" | "downvote"
): Promise<void> => {
  try {
    await firebaseServices.obstacle.verifyObstacle(obstacleId, action);
  } catch (error) {
    console.error("Verification failed:", error);
    throw error;
  }
};
