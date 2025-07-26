// src/types/sidewalkTypes.ts
// NEW: Sidewalk-aware navigation types for WAISPATH

import {
  UserLocation,
  AccessibilityObstacle,
  AccessibilityScore,
  UserMobilityProfile,
} from "./index";

// NEW: Sidewalk as a navigation entity
export interface SidewalkEntity {
  id: string; // "c_raymundo_ave_north"
  parentStreet: string; // "C. Raymundo Avenue"
  side: "north" | "south" | "east" | "west";
  coordinates: UserLocation[]; // Polyline of actual sidewalk
  obstacles: AccessibilityObstacle[];
  accessibilityFeatures: {
    averageWidth: number; // cm
    surface: "concrete" | "tiles" | "dirt" | "asphalt";
    hasRamps: boolean;
    lighting: "good" | "fair" | "poor";
    covered: boolean; // Has roof/shade
    condition: "excellent" | "good" | "fair" | "poor";
  };
  estimatedScore: AccessibilityScore;
}

// NEW: Crossing points between sidewalks
export interface CrossingPoint {
  id: string;
  location: UserLocation;
  type: "traffic_light" | "pedestrian_crossing" | "intersection" | "informal";
  accessibility: {
    hasRamp: boolean;
    hasVisualSignals: boolean;
    hasTactileIndicators: boolean;
    crossingTime: number; // seconds needed to cross
    safetyRating: number; // 1-5 (5 = very safe)
    waitTime: number; // average seconds waiting for signal
  };
  connectsSidewalks: [string, string]; // Which sidewalk IDs it connects
  userTypes: {
    wheelchair: "accessible" | "difficult" | "impossible";
    walker: "easy" | "moderate" | "difficult";
    cane: "easy" | "moderate" | "difficult";
    crutches: "easy" | "moderate" | "difficult";
    none: "easy" | "moderate" | "difficult"; // Added none type
  };
}

// NEW: Enhanced obstacle with sidewalk metadata
export interface SidewalkObstacle extends AccessibilityObstacle {
  sidewalkInfo: {
    sidewalkId: string; // Which sidewalk entity this obstacle is on
    positionOnSidewalk: "left" | "center" | "right"; // Position relative to sidewalk
    blocksWidth: number; // Percentage of sidewalk width blocked (0-100)
    alternativeExists: boolean; // Can user go around it?
    nearestCrossing?: UserLocation; // Where to cross to avoid this obstacle
  };
}

// NEW: Sidewalk route analysis result
export interface SidewalkRouteComparison {
  routeId: string;

  // Primary routes
  standardRoute: SidewalkRoute; // Current side, all obstacles
  optimizedRoute: SidewalkRoute; // Crosses street strategically

  // Comparison metrics
  comparison: {
    timeDifference: number; // seconds (negative = optimized is faster)
    crossingCount: number; // How many street crossings needed
    accessibilityImprovement: number; // Points improved (0-100)
    obstacleReduction: number; // Number of obstacles avoided
    recommendation: string; // Human-readable recommendation
  };

  // Context
  userProfile: UserMobilityProfile;
  analyzedAt: Date;
}

// NEW: Route that understands sidewalks
export interface SidewalkRoute {
  id: string;
  type: "standard" | "optimized" | "custom";
  segments: SidewalkRouteSegment[];
  totalDistance: number; // meters
  totalTime: number; // seconds
  crossingPoints: CrossingPoint[];
  overallScore: AccessibilityScore;
  routeReasons: string[]; // ["Crossed at City Hall to avoid vendors", "Stayed on shaded north side"]
}

// NEW: Route segment that knows which sidewalk it uses
export interface SidewalkRouteSegment {
  id: string;
  sidewalkId: string; // Which sidewalk this segment uses
  startPoint: UserLocation;
  endPoint: UserLocation;
  distance: number; // meters
  estimatedTime: number; // seconds
  obstacles: ProcessedSidewalkObstacle[]; // Changed to ensure sidewalkInfo is always present
  accessibilityScore: AccessibilityScore;
  crossingAtEnd?: CrossingPoint; // If this segment ends with a street crossing
  notes?: string; // "Vendor area 8-10am", "Covered walkway"
}

// NEW: Manual tagging helper for existing obstacles
export interface ObstacleSidewalkMapping {
  obstacleId: string;
  obstacleLocation: UserLocation;
  street: string;
  side: "north" | "south" | "east" | "west";
  confidence: "high" | "medium" | "low"; // How sure we are about the side
  reasoning: string; // Why we think it's on this side
  nearestCrossing?: UserLocation;
}

// Export types that extend existing ones
export type EnhancedAccessibilityObstacle = AccessibilityObstacle & {
  sidewalkInfo?: SidewalkObstacle["sidewalkInfo"];
};

// Helper type to ensure obstacles always have sidewalkInfo when used in route segments
export type ProcessedSidewalkObstacle = AccessibilityObstacle & {
  sidewalkInfo: SidewalkObstacle["sidewalkInfo"];
};

// Helper functions for manual tagging
export class SidewalkMappingHelper {
  /**
   * Determine which side of street an obstacle is on based on coordinates
   */
  static determineStreetSide(
    obstacleLocation: UserLocation,
    streetName: string,
    streetStartPoint: UserLocation,
    streetEndPoint: UserLocation
  ): "north" | "south" | "east" | "west" {
    // Calculate street bearing (direction)
    const bearing = this.calculateBearing(streetStartPoint, streetEndPoint);

    // Determine if obstacle is left or right of street line
    const side = this.getRelativeSide(
      obstacleLocation,
      streetStartPoint,
      streetEndPoint
    );

    // Convert relative position to cardinal direction based on street bearing
    if (bearing >= 315 || bearing < 45) {
      // Street runs roughly N-S
      return side === "left" ? "west" : "east";
    } else if (bearing >= 45 && bearing < 135) {
      // Street runs roughly E-W
      return side === "left" ? "north" : "south";
    } else if (bearing >= 135 && bearing < 225) {
      // Street runs roughly S-N
      return side === "left" ? "east" : "west";
    } else {
      // Street runs roughly W-E
      return side === "left" ? "south" : "north";
    }
  }

  /**
   * Calculate bearing between two points in degrees
   */
  private static calculateBearing(
    start: UserLocation,
    end: UserLocation
  ): number {
    const lat1 = (start.latitude * Math.PI) / 180;
    const lat2 = (end.latitude * Math.PI) / 180;
    const deltaLng = ((end.longitude - start.longitude) * Math.PI) / 180;

    const x = Math.sin(deltaLng) * Math.cos(lat2);
    const y =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    const bearing = (Math.atan2(x, y) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Determine if point is left or right of a line
   */
  private static getRelativeSide(
    point: UserLocation,
    lineStart: UserLocation,
    lineEnd: UserLocation
  ): "left" | "right" {
    const cross =
      (lineEnd.longitude - lineStart.longitude) *
        (point.latitude - lineStart.latitude) -
      (lineEnd.latitude - lineStart.latitude) *
        (point.longitude - lineStart.longitude);
    return cross > 0 ? "left" : "right";
  }
}
