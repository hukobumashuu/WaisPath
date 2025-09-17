// src/services/routeAnalysisService.ts
// SIMPLIFIED: Obstacle count-based routing - NO MORE COMPLEX SCORING!
// Clean, simple, and actually useful for PWD users

import { googleMapsService, GoogleRoute } from "./googleMapsService";
import { firebaseServices } from "./firebase";
import {
  UserMobilityProfile,
  UserLocation,
  AccessibilityObstacle,
} from "../types";

// SIMPLIFIED: No more complex scoring - just count obstacles!
interface SimpleRoute {
  googleRoute: GoogleRoute;
  obstacleCount: number;
  obstacles: AccessibilityObstacle[];
  routeType: "fastest" | "clearest" | "alternative";
}

// SIMPLIFIED: Two routes, clear choice for users
interface SimpleRouteComparison {
  fastestRoute: SimpleRoute;
  clearestRoute: SimpleRoute;
  alternativeRoutes?: SimpleRoute[]; // Optional 3rd/4th routes for variety
  summary: {
    fastestHasFewerObstacles: boolean;
    timeDifference: number; // seconds
    obstacleDifference: number; // count
    recommendation: string; // Simple recommendation
  };
}

class RouteAnalysisService {
  /**
   * MAIN METHOD: Get routes and count obstacles - SIMPLE!
   */
  async analyzeRoutes(
    start: UserLocation,
    end: UserLocation,
    userProfile: UserMobilityProfile
  ): Promise<SimpleRouteComparison> {
    try {
      console.log(
        "🚀 Starting SIMPLIFIED route analysis - just counting obstacles!"
      );

      // Step 1: Get multiple routes from Google Maps
      let googleRoutes = await this.getMultipleRoutes(start, end);

      if (googleRoutes.length === 0) {
        throw new Error("No routes found between these locations");
      }

      console.log(`📍 Found ${googleRoutes.length} routes from Google Maps`);

      // Step 2: Count obstacles for each route - NO COMPLEX SCORING!
      const routesWithObstacles = await this.addObstacleCounts(googleRoutes);

      console.log("🔢 Obstacle counts per route:");
      routesWithObstacles.forEach((route, index) => {
        console.log(
          `Route ${index + 1}: ${route.obstacleCount} obstacles (${Math.round(
            route.googleRoute.duration / 60
          )}min)`
        );
      });

      // Step 3: Pick fastest and clearest - SIMPLE SELECTION!
      const fastestRoute = this.selectFastestRoute(routesWithObstacles);
      const clearestRoute = this.selectClearestRoute(routesWithObstacles);

      // Step 4: Get alternatives for variety (optional)
      const alternativeRoutes = this.selectAlternativeRoutes(
        routesWithObstacles,
        fastestRoute,
        clearestRoute
      );

      // Step 5: Create simple summary
      const summary = this.createSimpleSummary(fastestRoute, clearestRoute);

      console.log("✅ SIMPLIFIED route analysis complete!");
      console.log(
        `🚀 Fastest: ${Math.round(
          fastestRoute.googleRoute.duration / 60
        )}min, ${fastestRoute.obstacleCount} obstacles`
      );
      console.log(
        `🛡️ Clearest: ${Math.round(
          clearestRoute.googleRoute.duration / 60
        )}min, ${clearestRoute.obstacleCount} obstacles`
      );

      return {
        fastestRoute,
        clearestRoute,
        alternativeRoutes,
        summary,
      };
    } catch (error) {
      console.error("❌ Route analysis failed:", error);
      throw error;
    }
  }

  /**
   * Get multiple routes from Google Maps (KEEP EXISTING LOGIC)
   */
  private async getMultipleRoutes(
    start: UserLocation,
    end: UserLocation
  ): Promise<GoogleRoute[]> {
    try {
      // Try to get alternatives from Google Maps
      const routes = await googleMapsService.getRoutes(start, end, true);

      if (routes.length >= 2) {
        console.log(`📍 Got ${routes.length} real alternatives from Google`);
        return routes.slice(0, 5); // Max 5 routes to keep it manageable
      }

      // If only 1 route, that's fine - we'll work with what we have
      console.log("📍 Only 1 route from Google - that's okay!");
      return routes;
    } catch (error) {
      console.error("❌ Error getting routes from Google:", error);
      throw error;
    }
  }

  /**
   * Count obstacles for each route - NO SCORING, JUST COUNTING!
   */
  private async addObstacleCounts(
    googleRoutes: GoogleRoute[]
  ): Promise<SimpleRoute[]> {
    const routesWithObstacles: SimpleRoute[] = [];

    for (let i = 0; i < googleRoutes.length; i++) {
      const googleRoute = googleRoutes[i];

      try {
        // Get obstacles along this specific route
        const obstacles = await this.getObstaclesAlongRoute(googleRoute);

        // SIMPLE: Just count them!
        const obstacleCount = obstacles.length;

        routesWithObstacles.push({
          googleRoute,
          obstacleCount,
          obstacles,
          routeType: i === 0 ? "fastest" : "alternative", // First route is usually fastest
        });

        console.log(`Route ${i + 1}: Found ${obstacleCount} obstacles`);
      } catch (error) {
        console.error(`❌ Error processing route ${i + 1}:`, error);

        // Add route anyway with 0 obstacles (better than failing)
        routesWithObstacles.push({
          googleRoute,
          obstacleCount: 0,
          obstacles: [],
          routeType: i === 0 ? "fastest" : "alternative",
        });
      }
    }

    return routesWithObstacles;
  }

  /**
   * Get obstacles along a specific route (KEEP EXISTING LOGIC)
   */
  private async getObstaclesAlongRoute(
    googleRoute: GoogleRoute
  ): Promise<AccessibilityObstacle[]> {
    try {
      // Decode route polyline to get route points
      let routePoints: UserLocation[] = [];

      if (Array.isArray(googleRoute.polyline)) {
        routePoints = googleRoute.polyline;
      } else if (typeof googleRoute.polyline === "string") {
        routePoints = this.decodePolylineString(googleRoute.polyline);
      } else {
        console.warn("⚠️ Invalid polyline format, using route bounds");
        // Fallback: use start/end points
        if (googleRoute.steps && googleRoute.steps.length > 0) {
          routePoints = [
            googleRoute.steps[0].startLocation,
            googleRoute.steps[googleRoute.steps.length - 1].endLocation,
          ];
        }
      }

      if (routePoints.length === 0) {
        console.warn("⚠️ No route points available");
        return [];
      }

      // Get obstacles near the route (keep existing buffer logic)
      const bufferMeters = 50; // 50 meter buffer on each side of route
      const allObstacles = await this.getObstaclesInRouteArea(routePoints);

      // Filter obstacles that are actually close to the route
      const routeObstacles = allObstacles.filter((obstacle) => {
        if (!obstacle.location) return false;

        const distanceToRoute = this.calculateDistanceToRoute(
          obstacle.location,
          routePoints
        );

        return distanceToRoute <= bufferMeters;
      });

      return routeObstacles;
    } catch (error) {
      console.error("❌ Error getting obstacles along route:", error);
      return [];
    }
  }

  /**
   * Select fastest route - SIMPLE!
   */
  private selectFastestRoute(routes: SimpleRoute[]): SimpleRoute {
    const fastest = routes.reduce((prev, current) => {
      return prev.googleRoute.duration < current.googleRoute.duration
        ? prev
        : current;
    });

    return {
      ...fastest,
      routeType: "fastest",
    };
  }

  /**
   * Select clearest route (fewest obstacles) - SIMPLE!
   */
  private selectClearestRoute(routes: SimpleRoute[]): SimpleRoute {
    const clearest = routes.reduce((prev, current) => {
      // If obstacle count is same, pick the faster one
      if (prev.obstacleCount === current.obstacleCount) {
        return prev.googleRoute.duration < current.googleRoute.duration
          ? prev
          : current;
      }
      return prev.obstacleCount < current.obstacleCount ? prev : current;
    });

    return {
      ...clearest,
      routeType: "clearest",
    };
  }

  /**
   * Select alternative routes for variety (optional)
   */
  private selectAlternativeRoutes(
    routes: SimpleRoute[],
    fastest: SimpleRoute,
    clearest: SimpleRoute
  ): SimpleRoute[] {
    // Get routes that aren't fastest or clearest
    const alternatives = routes.filter(
      (route) =>
        route.googleRoute.id !== fastest.googleRoute.id &&
        route.googleRoute.id !== clearest.googleRoute.id
    );

    // Return up to 2 alternatives
    return alternatives.slice(0, 2).map((route) => ({
      ...route,
      routeType: "alternative" as const,
    }));
  }

  /**
   * Create simple summary for UI
   */
  private createSimpleSummary(
    fastest: SimpleRoute,
    clearest: SimpleRoute
  ): SimpleRouteComparison["summary"] {
    const timeDifference =
      clearest.googleRoute.duration - fastest.googleRoute.duration;
    const obstacleDifference = fastest.obstacleCount - clearest.obstacleCount;
    const fastestHasFewerObstacles =
      fastest.obstacleCount < clearest.obstacleCount;

    // Simple recommendation logic
    let recommendation: string;

    if (fastest.googleRoute.id === clearest.googleRoute.id) {
      recommendation =
        "Perfect! The fastest route also has the fewest obstacles.";
    } else if (fastestHasFewerObstacles) {
      recommendation =
        "Great news! The fastest route also has fewer obstacles.";
    } else if (timeDifference <= 300) {
      // 5 minutes or less
      recommendation =
        "The clearest route is only a few minutes longer - might be worth it!";
    } else if (obstacleDifference >= 3) {
      recommendation =
        "Clearest route has significantly fewer obstacles but takes longer.";
    } else {
      recommendation =
        "Both routes are similar - choose based on your preference today.";
    }

    return {
      fastestHasFewerObstacles,
      timeDifference,
      obstacleDifference,
      recommendation,
    };
  }

  // =====================================================
  // UTILITY METHODS (KEEP EXISTING - THEY WORK!)
  // =====================================================

  /**
   * Get obstacles in route area
   */
  private async getObstaclesInRouteArea(
    routePoints: UserLocation[]
  ): Promise<AccessibilityObstacle[]> {
    try {
      // Calculate route bounds
      const bounds = this.calculateRouteBounds(routePoints);
      const radiusKm = Math.max(
        this.calculateDistance(
          { latitude: bounds.bounds.north, longitude: bounds.bounds.west },
          { latitude: bounds.bounds.south, longitude: bounds.bounds.east }
        ) / 2000, // Convert to km and take half
        1 // Minimum 1km radius
      );

      // Get obstacles from Firebase
      return await firebaseServices.obstacle.getObstaclesInArea(
        bounds.center.latitude,
        bounds.center.longitude,
        radiusKm
      );
    } catch (error) {
      console.error("❌ Error getting obstacles in route area:", error);
      return [];
    }
  }

  /**
   * Calculate distance from point to route
   */
  private calculateDistanceToRoute(
    point: UserLocation,
    routePoints: UserLocation[]
  ): number {
    let minDistance = Infinity;

    for (let i = 0; i < routePoints.length - 1; i++) {
      const segmentStart = routePoints[i];
      const segmentEnd = routePoints[i + 1];

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
   * Point to line segment distance calculation
   */
  private pointToLineSegmentDistance(
    point: UserLocation,
    lineStart: UserLocation,
    lineEnd: UserLocation
  ): number {
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
      return this.calculateDistance(point, lineStart);
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

    return this.calculateDistance(point, { latitude: yy, longitude: xx });
  }

  /**
   * Haversine distance calculation (meters)
   */
  private calculateDistance(
    point1: UserLocation,
    point2: UserLocation
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate route bounds
   */
  private calculateRouteBounds(routePoints: UserLocation[]): {
    center: UserLocation;
    bounds: { north: number; south: number; east: number; west: number };
  } {
    let minLat = routePoints[0].latitude;
    let maxLat = routePoints[0].latitude;
    let minLng = routePoints[0].longitude;
    let maxLng = routePoints[0].longitude;

    routePoints.forEach((p) => {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    });

    return {
      center: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
      },
      bounds: {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng,
      },
    };
  }

  /**
   * Decode Google polyline string
   */
  private decodePolylineString(encoded: string): UserLocation[] {
    const coords: UserLocation[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coords.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return coords;
  }
}

// Export singleton instance
export const routeAnalysisService = new RouteAnalysisService();

// Export simplified types
export type { SimpleRoute, SimpleRouteComparison };
