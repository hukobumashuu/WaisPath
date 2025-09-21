// src/services/proximityDetectionService.ts
// WAISPATH Algorithm 2: Proximity-Based Obstacle Detection
// UPDATED: Added resetDetectionState method to fix route change issues

import {
  UserLocation,
  AccessibilityObstacle,
  UserMobilityProfile,
} from "../types";
import { firebaseServices } from "./firebase";

// Type definitions for proximity detection
export interface ProximityAlert {
  obstacle: AccessibilityObstacle;
  distance: number; // meters from user
  timeToEncounter: number; // seconds at current speed
  severity: "low" | "medium" | "high" | "blocking";
  confidence: number; // 0-1 based on community validation
  urgency: number; // calculated urgency score 0-100
}

export interface ProximityDetectionConfig {
  detectionRadius: number; // meters
  routeTolerance: number; // meters - how close to route counts as "on route"
  updateInterval: number; // milliseconds
  minimumMovement: number; // meters - don't update if user hasn't moved much
  maxAlerts: number; // maximum alerts to return
}

export class ProximityDetectionService {
  private config: ProximityDetectionConfig = {
    detectionRadius: 100, // 100m lookahead
    routeTolerance: 15, // 15m tolerance for "on route"
    updateInterval: 5000, // 5 second updates
    minimumMovement: 10, // 10m minimum movement
    maxAlerts: 2, // Maximum alerts to return
  };

  private lastDetectionLocation?: UserLocation;

  /**
   * MAIN METHOD: Detect obstacles ahead on the planned route
   */
  async detectObstaclesAhead(
    userLocation: UserLocation,
    routePolyline: UserLocation[],
    userProfile: UserMobilityProfile
  ): Promise<ProximityAlert[]> {
    console.log(
      `🔍 Starting proximity detection at ${userLocation.latitude}, ${userLocation.longitude}`
    );

    try {
      // STEP 1: Check if we should update (avoid unnecessary processing)
      if (!this.shouldUpdate(userLocation)) {
        console.log(`⏭️ Skipping detection - insufficient movement`);
        return [];
      }

      // STEP 2: Get obstacles within detection radius
      const nearbyObstacles = await this.getNearbyObstacles(userLocation);
      console.log(
        `📍 Found ${nearbyObstacles.length} obstacles within ${this.config.detectionRadius}m`
      );

      // STEP 3: Filter obstacles that are on or near the planned route
      const routeObstacles = this.filterObstaclesOnRoute(
        nearbyObstacles,
        routePolyline
      );
      if (routeObstacles.length > 0) {
        console.log(
          `🛣️ ${routeObstacles.length} obstacles are on planned route`
        );
      }

      // STEP 4: Filter by user relevance (mobility type specific)
      const relevantObstacles = this.filterByUserRelevance(
        routeObstacles,
        userProfile
      );
      if (relevantObstacles.length > 0) {
        console.log(
          `👤 ${relevantObstacles.length} obstacles are relevant to user type: ${userProfile.type}`
        );
      }

      // STEP 5: Calculate proximity data and urgency
      const proximityAlerts = this.calculateProximityAlerts(
        relevantObstacles,
        userLocation,
        userProfile
      );

      // STEP 6: Sort by urgency and limit results (performance improvement)
      proximityAlerts.sort((a, b) => b.urgency - a.urgency);

      // Return only top N alerts to avoid overwhelming user and reduce processing
      const limitedAlerts = proximityAlerts.slice(0, this.config.maxAlerts);

      if (limitedAlerts.length > 0) {
        console.log(
          `🚨 Generated ${limitedAlerts.length} proximity alerts (limited from ${proximityAlerts.length})`
        );
      }

      this.lastDetectionLocation = userLocation;

      return limitedAlerts;
    } catch (error) {
      console.error("❌ Proximity detection error:", error);
      return [];
    }
  }

  /**
   * STEP 1: Check if we should run detection (performance optimization)
   */
  private shouldUpdate(currentLocation: UserLocation): boolean {
    if (!this.lastDetectionLocation) return true;

    const distanceMoved = this.calculateDistance(
      this.lastDetectionLocation,
      currentLocation
    );

    return distanceMoved >= this.config.minimumMovement;
  }

  /**
   * STEP 2: Get obstacles within detection radius using Firebase
   */
  private async getNearbyObstacles(
    userLocation: UserLocation
  ): Promise<AccessibilityObstacle[]> {
    try {
      // Convert radius from meters to kilometers for Firebase query
      // Firebase service expects radiusKm parameter based on existing codebase
      const radiusInKm = this.config.detectionRadius / 1000;

      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        userLocation.latitude,
        userLocation.longitude,
        radiusInKm
      );

      // Filter out obstacles with invalid locations (defensive check)
      const validObstacles = obstacles.filter((obstacle) => {
        const hasValidLocation =
          obstacle.location &&
          typeof obstacle.location.latitude === "number" &&
          typeof obstacle.location.longitude === "number";

        if (!hasValidLocation) {
          console.warn(
            `⚠️ Skipping obstacle ${obstacle.id} - invalid location`
          );
        }

        return hasValidLocation;
      });

      return validObstacles;
    } catch (error) {
      console.error("❌ Error fetching nearby obstacles:", error);
      return [];
    }
  }

  /**
   * STEP 3: Filter obstacles that intersect with the planned route
   */
  private filterObstaclesOnRoute(
    obstacles: AccessibilityObstacle[],
    routePolyline: UserLocation[]
  ): AccessibilityObstacle[] {
    if (routePolyline.length < 2) {
      console.warn("⚠️ Route polyline too short for intersection calculation");
      return [];
    }

    return obstacles.filter((obstacle) => {
      const distanceToRoute = this.calculateDistanceToRoute(
        obstacle.location,
        routePolyline
      );

      return distanceToRoute <= this.config.routeTolerance;
    });
  }

  /**
   * STEP 4: Filter obstacles by user mobility profile relevance
   */
  private filterByUserRelevance(
    obstacles: AccessibilityObstacle[],
    userProfile: UserMobilityProfile
  ): AccessibilityObstacle[] {
    return obstacles.filter((obstacle) => {
      return this.isObstacleRelevantToUser(obstacle, userProfile);
    });
  }

  /**
   * STEP 5: Calculate proximity alerts with urgency scoring
   */
  private calculateProximityAlerts(
    obstacles: AccessibilityObstacle[],
    userLocation: UserLocation,
    userProfile: UserMobilityProfile
  ): ProximityAlert[] {
    return obstacles.map((obstacle) => {
      const distance = this.calculateDistance(userLocation, obstacle.location);
      const timeToEncounter = this.calculateTimeToEncounter(
        distance,
        userProfile
      );
      const confidence = this.calculateConfidence(obstacle);
      const urgency = this.calculateUrgency(obstacle, distance, userProfile);

      const alert: ProximityAlert = {
        obstacle,
        distance: Math.round(distance),
        timeToEncounter: Math.round(timeToEncounter),
        severity: obstacle.severity,
        confidence: Math.round(confidence * 100) / 100,
        urgency: Math.round(urgency),
      };

      return alert;
    });
  }

  /**
   * UTILITY: Calculate Haversine distance between two points
   */
  public calculateDistance(point1: UserLocation, point2: UserLocation): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * UTILITY: Calculate minimum distance from point to route polyline
   */
  private calculateDistanceToRoute(
    point: UserLocation,
    routePolyline: UserLocation[]
  ): number {
    let minDistance = Infinity;

    for (let i = 0; i < routePolyline.length - 1; i++) {
      const segmentStart = routePolyline[i];
      const segmentEnd = routePolyline[i + 1];

      const distanceToSegment = this.pointToLineSegmentDistance(
        point,
        segmentStart,
        segmentEnd
      );

      minDistance = Math.min(minDistance, distanceToSegment);
    }

    return minDistance;
  }

  /**
   * UTILITY: Calculate perpendicular distance from point to line segment
   */
  private pointToLineSegmentDistance(
    point: UserLocation,
    lineStart: UserLocation,
    lineEnd: UserLocation
  ): number {
    // Convert to Cartesian coordinates (approximate for short distances)
    const x = point.longitude;
    const y = point.latitude;
    const x1 = lineStart.longitude;
    const y1 = lineStart.latitude;
    const x2 = lineEnd.longitude;
    const y2 = lineEnd.latitude;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      // Line segment is a point
      return this.calculateDistance(point, lineStart);
    }

    let param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return this.calculateDistance(point, { latitude: yy, longitude: xx });
  }

  /**
   * UTILITY: Check if obstacle is relevant to user's mobility type
   */
  private isObstacleRelevantToUser(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): boolean {
    // SIMPLIFIED: Show ALL obstacles regardless of user type
    // Users benefit from seeing complete accessibility picture
    console.log(`👤 All obstacles are relevant to all users: ${obstacle.type}`);
    return true;
  }

  /**
   * UTILITY: Calculate time to encounter obstacle based on walking speed
   */
  private calculateTimeToEncounter(
    distance: number,
    userProfile: UserMobilityProfile
  ): number {
    // Profile-specific walking speeds (m/s)
    const walkingSpeeds = {
      wheelchair: 1.2, // Slightly slower for wheelchair users
      walker: 1.0, // Slower for walker users
      crutches: 1.1, // Moderately slower for crutches
      cane: 1.3, // Slightly slower than normal
      none: 1.4, // Average walking speed
    };

    const speed = userProfile
      ? walkingSpeeds[userProfile.type]
      : walkingSpeeds.none;
    return distance / speed;
  }

  /**
   * UTILITY: Calculate confidence based on community validation
   */
  private calculateConfidence(obstacle: AccessibilityObstacle): number {
    const upvotes = obstacle.upvotes || 0;
    const downvotes = obstacle.downvotes || 0;
    const totalVotes = upvotes + downvotes;

    if (totalVotes === 0) {
      return 0.5; // Neutral confidence for unvalidated obstacles
    }

    const positiveRatio = upvotes / totalVotes;

    // Boost confidence for verified obstacles
    const verificationBonus = obstacle.verified ? 0.2 : 0;

    return Math.min(1.0, positiveRatio + verificationBonus);
  }

  /**
   * UTILITY: Calculate urgency score (0-100)
   */
  private calculateUrgency(
    obstacle: AccessibilityObstacle,
    distance: number,
    userProfile: UserMobilityProfile
  ): number {
    // Base urgency from severity
    const severityScores = {
      blocking: 40,
      high: 30,
      medium: 20,
      low: 10,
    };

    let urgency = severityScores[obstacle.severity] || 15;

    // Distance factor (closer = more urgent) - use configurable detection radius
    const distanceFactor = Math.max(
      0,
      ((this.config.detectionRadius - distance) / this.config.detectionRadius) *
        30
    );
    urgency += distanceFactor;

    // User profile factor (more severe for certain mobility types)
    const profileMultiplier =
      userProfile.type === "wheelchair"
        ? 1.3
        : userProfile.type === "walker"
        ? 1.2
        : userProfile.type === "crutches"
        ? 1.2
        : 1.0;
    urgency *= profileMultiplier;

    // Confidence factor
    const confidence = this.calculateConfidence(obstacle);
    urgency *= confidence;

    return Math.min(100, urgency);
  }

  /**
   * PUBLIC: Reset detection state - CRITICAL FIX for route changes
   */
  resetDetectionState(): void {
    this.lastDetectionLocation = undefined;
    console.log("🔄 Proximity detection state reset - will run on next check");
  }

  /**
   * PUBLIC: Update detection configuration
   */
  updateConfig(newConfig: Partial<ProximityDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("🔧 Proximity detection config updated:", this.config);
  }

  /**
   * PUBLIC: Get current configuration
   */
  getConfig(): ProximityDetectionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const proximityDetectionService = new ProximityDetectionService();
