// src/services/routeObstacleService.ts
// ENHANCED: Better interface compatibility + performance improvements
// Service for loading obstacles based on calculated routes

import { UserLocation, AccessibilityObstacle } from "../types";
import { firebaseServices } from "./firebase";

interface RouteBounds {
  center: UserLocation;
  radiusKm: number;
}

// ENHANCEMENT: Support both old and new interface patterns
interface RouteAnalysisLegacy {
  fastestRoute?: { polyline: UserLocation[] };
  accessibleRoute?: { polyline: UserLocation[] };
}

interface RouteAnalysisNew {
  fastestRoute?: { polyline: UserLocation[] };
  clearestRoute?: { polyline: UserLocation[] };
}

type RouteAnalysisCompat = RouteAnalysisLegacy | RouteAnalysisNew;

class RouteObstacleService {
  // ENHANCEMENT: Simple caching to avoid duplicate calls
  private obstacleCache = new Map<
    string,
    { obstacles: AccessibilityObstacle[]; timestamp: number }
  >();
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_CACHE_SIZE = 50;

  /**
   * ENHANCED: Get obstacles along multiple route polylines with caching
   */
  async getObstaclesAlongRoutes(
    fastestRoutePolyline: UserLocation[],
    accessibleRoutePolyline: UserLocation[],
    bufferMeters: number = 50
  ): Promise<AccessibilityObstacle[]> {
    try {
      console.log("🛣️ Loading obstacles along calculated routes...");

      // ENHANCEMENT: Generate cache key
      const cacheKey = this.generateCacheKey(
        fastestRoutePolyline,
        accessibleRoutePolyline,
        bufferMeters
      );
      const cached = this.getCachedObstacles(cacheKey);

      if (cached) {
        console.log("✅ Using cached obstacle data");
        return cached;
      }

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
        if (!obstacle.location || !this.isValidLocation(obstacle.location)) {
          continue;
        }

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

      // Remove duplicates by ID and cache result
      const deduplicatedObstacles = this.deduplicateObstacles(routeObstacles);
      this.cacheObstacles(cacheKey, deduplicatedObstacles);

      return deduplicatedObstacles;
    } catch (error) {
      console.error("❌ Error getting obstacles along routes:", error);
      return [];
    }
  }

  /**
   * ENHANCED: Get obstacles around a specific location with validation
   */
  async getObstaclesAroundLocation(
    location: UserLocation,
    radiusKm: number = 1
  ): Promise<AccessibilityObstacle[]> {
    try {
      console.log("📍 Loading obstacles around location (fallback)...");

      // ENHANCEMENT: Validate location input
      if (!this.isValidLocation(location)) {
        console.error("❌ Invalid location provided:", location);
        return [];
      }

      // ENHANCEMENT: Validate radius
      const validRadius = Math.max(0.1, Math.min(radiusKm, 5)); // Between 100m and 5km

      if (validRadius !== radiusKm) {
        console.warn(
          `⚠️ Adjusted radius from ${radiusKm}km to ${validRadius}km`
        );
      }

      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        validRadius
      );

      console.log(`📍 Found ${obstacles.length} obstacles around location`);
      return obstacles;
    } catch (error) {
      console.error("❌ Error getting obstacles around location:", error);
      return [];
    }
  }

  /**
   * ENHANCED: Smart obstacle loading with improved interface compatibility
   */
  async getRelevantObstacles(
    userLocation: UserLocation,
    routeAnalysis?: RouteAnalysisCompat
  ): Promise<AccessibilityObstacle[]> {
    try {
      // ENHANCEMENT: Better input validation
      if (!this.isValidLocation(userLocation)) {
        console.error("❌ Invalid user location:", userLocation);
        return [];
      }

      // Extract polylines with backward compatibility
      let fastestPolyline: UserLocation[] = [];
      let accessiblePolyline: UserLocation[] = [];

      if (routeAnalysis) {
        // Handle fastest route (consistent across both interfaces)
        if (routeAnalysis.fastestRoute?.polyline) {
          fastestPolyline = routeAnalysis.fastestRoute.polyline;
        }

        // Handle accessible/clearest route with compatibility
        if (
          "accessibleRoute" in routeAnalysis &&
          routeAnalysis.accessibleRoute?.polyline
        ) {
          accessiblePolyline = routeAnalysis.accessibleRoute.polyline;
        } else if (
          "clearestRoute" in routeAnalysis &&
          routeAnalysis.clearestRoute?.polyline
        ) {
          accessiblePolyline = routeAnalysis.clearestRoute.polyline;
        }
      }

      // If routes are available and valid, load obstacles along routes
      if (fastestPolyline.length > 0 && accessiblePolyline.length > 0) {
        console.log("🛣️ Loading obstacles along provided routes");
        return await this.getObstaclesAlongRoutes(
          fastestPolyline,
          accessiblePolyline,
          50 // 50m buffer
        );
      }

      // Fallback: Load obstacles around user location
      console.log("📍 Falling back to location-based obstacle loading");
      return await this.getObstaclesAroundLocation(userLocation, 1);
    } catch (error) {
      console.error("❌ Error getting relevant obstacles:", error);
      return [];
    }
  }

  /**
   * ENHANCEMENT: Cache management functions
   */
  private generateCacheKey(
    fastestPolyline: UserLocation[],
    accessiblePolyline: UserLocation[],
    bufferMeters: number
  ): string {
    // Create a simple hash of the route points
    const fastestHash = this.hashPolyline(fastestPolyline);
    const accessibleHash = this.hashPolyline(accessiblePolyline);
    return `${fastestHash}-${accessibleHash}-${bufferMeters}`;
  }

  private hashPolyline(polyline: UserLocation[]): string {
    if (polyline.length === 0) return "empty";

    // Use first, middle, and last points for a simple hash
    const first = polyline[0];
    const middle = polyline[Math.floor(polyline.length / 2)];
    const last = polyline[polyline.length - 1];

    return `${first.latitude.toFixed(4)},${first.longitude.toFixed(
      4
    )}-${middle.latitude.toFixed(4)},${middle.longitude.toFixed(
      4
    )}-${last.latitude.toFixed(4)},${last.longitude.toFixed(4)}`;
  }

  private getCachedObstacles(cacheKey: string): AccessibilityObstacle[] | null {
    const cached = this.obstacleCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.obstacles;
    }

    if (cached) {
      this.obstacleCache.delete(cacheKey); // Clean up expired cache
    }

    return null;
  }

  private cacheObstacles(
    cacheKey: string,
    obstacles: AccessibilityObstacle[]
  ): void {
    // Prune cache if at capacity
    if (this.obstacleCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.obstacleCache.keys().next().value;
      if (oldestKey) {
        this.obstacleCache.delete(oldestKey);
      }
    }

    this.obstacleCache.set(cacheKey, {
      obstacles,
      timestamp: Date.now(),
    });
  }

  /**
   * ENHANCEMENT: Clear cache manually
   */
  clearCache(): void {
    this.obstacleCache.clear();
    console.log("🧹 Route obstacle cache cleared");
  }

  /**
   * ENHANCEMENT: Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.obstacleCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttlMinutes: this.CACHE_TTL / (60 * 1000),
    };
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
   * ENHANCED: Calculate distance from point to polyline with validation
   */
  private calculateDistanceToPolyline(
    point: UserLocation,
    polyline: UserLocation[]
  ): number {
    if (polyline.length === 0) return Infinity;
    if (!this.isValidLocation(point)) return Infinity;

    let minDistance = Infinity;

    for (let i = 0; i < polyline.length - 1; i++) {
      const segmentStart = polyline[i];
      const segmentEnd = polyline[i + 1];

      // Validate segment points
      if (
        !this.isValidLocation(segmentStart) ||
        !this.isValidLocation(segmentEnd)
      ) {
        continue;
      }

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
   * ENHANCEMENT: Validate UserLocation
   */
  private isValidLocation(location: any): location is UserLocation {
    return (
      location &&
      typeof location.latitude === "number" &&
      typeof location.longitude === "number" &&
      !isNaN(location.latitude) &&
      !isNaN(location.longitude) &&
      Math.abs(location.latitude) <= 90 &&
      Math.abs(location.longitude) <= 180
    );
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
