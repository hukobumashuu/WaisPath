// src/services/routeObstacleService.ts
// Service for loading obstacles based on calculated routes
// Extracted from NavigationScreen for better organization

import { UserLocation, AccessibilityObstacle } from "../types";
import { firebaseServices } from "./firebase";

interface RouteBounds {
  center: UserLocation;
  radiusKm: number;
}

class RouteObstacleService {
  /**
   * Get obstacles along multiple route polylines
   */
  async getObstaclesAlongRoutes(
    fastestRoutePolyline: UserLocation[],
    accessibleRoutePolyline: UserLocation[],
    bufferMeters: number = 50
  ): Promise<AccessibilityObstacle[]> {
    try {
      console.log("🛣️ Loading obstacles along calculated routes...");

      // Combine both route polylines
      const allRoutePoints = [
        ...fastestRoutePolyline,
        ...accessibleRoutePolyline,
      ];

      if (allRoutePoints.length === 0) {
        console.warn("⚠️ No route points available for obstacle loading");
        return [];
      }

      // Calculate bounding box for both routes
      const bounds = this.calculateRoutesBounds(allRoutePoints);

      // Get all obstacles in the routes area
      const allObstacles = await firebaseServices.obstacle.getObstaclesInArea(
        bounds.center.latitude,
        bounds.center.longitude,
        bounds.radiusKm
      );

      console.log(
        `🔍 Found ${allObstacles.length} total obstacles in routes area`
      );

      // Filter obstacles that are actually near either route
      const routeObstacles: AccessibilityObstacle[] = [];

      for (const obstacle of allObstacles) {
        if (!obstacle.location) continue;

        // Check distance to fastest route
        const distanceToFastest = this.calculateDistanceToPolyline(
          obstacle.location,
          fastestRoutePolyline
        );

        // Check distance to accessible route
        const distanceToAccessible = this.calculateDistanceToPolyline(
          obstacle.location,
          accessibleRoutePolyline
        );

        // Keep obstacle if it's within buffer of either route
        const minDistance = Math.min(distanceToFastest, distanceToAccessible);
        if (minDistance <= bufferMeters) {
          routeObstacles.push(obstacle);
        }
      }

      console.log(
        `✅ ${routeObstacles.length} obstacles are within ${bufferMeters}m of routes`
      );

      // Remove duplicates by ID
      return this.deduplicateObstacles(routeObstacles);
    } catch (error) {
      console.error("❌ Error getting obstacles along routes:", error);
      return [];
    }
  }

  /**
   * Get obstacles around a specific location (fallback method)
   */
  async getObstaclesAroundLocation(
    location: UserLocation,
    radiusKm: number = 1
  ): Promise<AccessibilityObstacle[]> {
    try {
      console.log("📍 Loading obstacles around location (fallback)...");

      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        radiusKm
      );

      console.log(`📍 Found ${obstacles.length} obstacles around location`);
      return obstacles;
    } catch (error) {
      console.error("❌ Error getting obstacles around location:", error);
      return [];
    }
  }

  /**
   * Smart obstacle loading: routes first, fallback to location
   */
  async getRelevantObstacles(
    userLocation: UserLocation,
    routeAnalysis?: {
      fastestRoute?: { polyline: UserLocation[] };
      accessibleRoute?: { polyline: UserLocation[] };
    }
  ): Promise<AccessibilityObstacle[]> {
    // If routes are available, load obstacles along routes
    if (
      routeAnalysis?.fastestRoute?.polyline?.length &&
      routeAnalysis?.accessibleRoute?.polyline?.length
    ) {
      return await this.getObstaclesAlongRoutes(
        routeAnalysis.fastestRoute.polyline,
        routeAnalysis.accessibleRoute.polyline,
        50 // 50m buffer
      );
    }

    // Fallback: Load obstacles around user location
    return await this.getObstaclesAroundLocation(userLocation, 1);
  }

  /**
   * Calculate bounding box and search radius for multiple routes
   */
  private calculateRoutesBounds(routePoints: UserLocation[]): RouteBounds {
    if (routePoints.length === 0) {
      throw new Error("No route points provided");
    }

    let minLat = routePoints[0].latitude;
    let maxLat = routePoints[0].latitude;
    let minLng = routePoints[0].longitude;
    let maxLng = routePoints[0].longitude;

    routePoints.forEach((point) => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    const center = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
    };

    // Calculate diagonal distance for search radius
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const diagonalKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
    const radiusKm = Math.max(1, diagonalKm / 2 + 0.5); // Add buffer

    return { center, radiusKm };
  }

  /**
   * Calculate distance from point to polyline
   */
  private calculateDistanceToPolyline(
    point: UserLocation,
    polyline: UserLocation[]
  ): number {
    if (polyline.length === 0) return Infinity;

    let minDistance = Infinity;

    for (let i = 0; i < polyline.length - 1; i++) {
      const segmentStart = polyline[i];
      const segmentEnd = polyline[i + 1];

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
   * Point to line segment distance using haversine
   */
  private pointToLineSegmentDistance(
    point: UserLocation,
    lineStart: UserLocation,
    lineEnd: UserLocation
  ): number {
    // Simplified cartesian approximation for short distances
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
      return this.haversineDistance(point, lineStart);
    }

    let param = dot / lenSq;
    let xx: number, yy: number;

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

    return this.haversineDistance(point, { latitude: yy, longitude: xx });
  }

  /**
   * Haversine distance calculation in meters
   */
  private haversineDistance(
    point1: UserLocation,
    point2: UserLocation
  ): number {
    const R = 6371e3; // Earth radius in meters
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
   * Remove duplicate obstacles by ID
   */
  private deduplicateObstacles(
    obstacles: AccessibilityObstacle[]
  ): AccessibilityObstacle[] {
    return obstacles.filter(
      (obstacle, index, self) =>
        self.findIndex((o) => o.id === obstacle.id) === index
    );
  }
}

// Export singleton instance
export const routeObstacleService = new RouteObstacleService();
