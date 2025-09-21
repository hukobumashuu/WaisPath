// src/hooks/useRouteCalculation.ts
// FIXED & ENHANCED: Interface compatibility + All proposed improvements
// Clean interface that just shows obstacle counts to users

import { useState, useCallback, useMemo } from "react";
import { Alert, Vibration } from "react-native";
import MapView from "react-native-maps";
import {
  UserLocation,
  UserMobilityProfile,
  AccessibilityObstacle,
} from "../types";
import {
  routeAnalysisService,
  SimpleRouteComparison,
} from "../services/routeAnalysisService";
import { routeObstacleService } from "../services/routeObstacleService";
import { decodePolyline } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";

// ENHANCED: Added loading states for better UX
interface RouteCalculationState {
  routeAnalysis: SimpleUIRouteAnalysis | null;
  isCalculating: boolean;
  isCalculatingObstacles: boolean; // New loading state
  selectedDestination: UserLocation | null;
  destinationName: string;
  routeObstacles: AccessibilityObstacle[];
  nearbyObstacles: AccessibilityObstacle[];
}

// ENHANCED: Better TypeScript interfaces
interface SimpleUIRouteAnalysis {
  fastestRoute: {
    polyline: UserLocation[];
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  clearestRoute: {
    polyline: UserLocation[];
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  summary: {
    recommendation: string;
    timeDifference: number; // seconds between routes
    obstacleDifference: number; // obstacle count difference
    fastestIsAlsoClearest: boolean;
  };
}

interface UseRouteCalculationOptions {
  location: UserLocation | null;
  profile: UserMobilityProfile | null;
  mapRef: React.RefObject<MapView>;
  destination: string;
}

// ENHANCEMENT: Route caching for performance
interface CachedRoute {
  result: SimpleUIRouteAnalysis;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const routeCache = new Map<string, CachedRoute>();

export function useRouteCalculation({
  location,
  profile,
  mapRef,
  destination,
}: UseRouteCalculationOptions) {
  const [state, setState] = useState<RouteCalculationState>({
    routeAnalysis: null,
    isCalculating: false,
    isCalculatingObstacles: false,
    selectedDestination: null,
    destinationName: "",
    routeObstacles: [],
    nearbyObstacles: [],
  });

  // ENHANCEMENT: Memoized route obstacles for better performance
  const routeObstacles = useMemo(() => {
    if (!state.routeAnalysis) return [];

    const allObstacles = [
      ...state.routeAnalysis.fastestRoute.obstacles,
      ...state.routeAnalysis.clearestRoute.obstacles,
    ];

    // Remove duplicates by ID
    return allObstacles.filter(
      (obstacle, index, self) =>
        index === self.findIndex((t) => t.id === obstacle.id)
    );
  }, [state.routeAnalysis]);

  // ENHANCEMENT: Generate cache key for route caching
  const getCacheKey = useCallback(
    (start: UserLocation, dest: UserLocation): string => {
      return `${start.latitude.toFixed(4)},${start.longitude.toFixed(
        4
      )}-${dest.latitude.toFixed(4)},${dest.longitude.toFixed(4)}`;
    },
    []
  );

  // ENHANCEMENT: Check if cache is still valid
  const getCachedRoute = useCallback(
    (cacheKey: string): SimpleUIRouteAnalysis | null => {
      const cached = routeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log("✅ Using cached route analysis");
        return cached.result;
      }
      if (cached) {
        routeCache.delete(cacheKey); // Clean up expired cache
      }
      return null;
    },
    []
  );

  const calculateUnifiedRoutes = useCallback(
    async (poi?: any) => {
      // ENHANCEMENT: Better input validation
      if (!location) {
        Alert.alert("Location Error", "Cannot get your current location.");
        return;
      }

      if (!profile) {
        Alert.alert("Profile Error", "Please set up your profile first.");
        return;
      }

      let destLocation: UserLocation;
      let destName: string;

      if (poi) {
        destLocation = { latitude: poi.lat, longitude: poi.lng };
        destName = poi.name;
      } else {
        if (!destination.trim()) {
          Alert.alert("No Destination", "Please enter a destination first.");
          return;
        }
        const firstPOI = SAMPLE_POIS[0];
        destLocation = { latitude: firstPOI.lat, longitude: firstPOI.lng };
        destName = destination;
      }

      // ENHANCEMENT: Check cache first
      const cacheKey = getCacheKey(location, destLocation);
      const cachedResult = getCachedRoute(cacheKey);

      if (cachedResult) {
        setState((prev) => ({
          ...prev,
          routeAnalysis: cachedResult,
          selectedDestination: destLocation,
          destinationName: destName,
          isCalculating: false,
          isCalculatingObstacles: false,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isCalculating: true,
        isCalculatingObstacles: true,
        selectedDestination: destLocation,
        destinationName: destName,
        routeObstacles: [],
        nearbyObstacles: [],
      }));

      try {
        console.log("🗺️ Calculating SIMPLIFIED routes to", destName + "...");

        // Use our simplified route analysis service
        const analysis = await routeAnalysisService.analyzeRoutes(
          location,
          destLocation,
          profile
        );

        // ENHANCEMENT: Better error handling
        if (!analysis) {
          throw new Error("Route analysis service returned null");
        }

        if (!analysis.fastestRoute || !analysis.clearestRoute) {
          throw new Error("Invalid route analysis - missing required routes");
        }

        // Success vibration feedback
        Vibration.vibrate([100, 50, 100]);

        console.log("✅ Got simplified route analysis!");
        console.log(
          `🚀 Fastest: ${Math.round(
            analysis.fastestRoute.googleRoute.duration / 60
          )}min, ${analysis.fastestRoute.obstacleCount} obstacles`
        );
        console.log(
          `🛡️ Clearest: ${Math.round(
            analysis.clearestRoute.googleRoute.duration / 60
          )}min, ${analysis.clearestRoute.obstacleCount} obstacles`
        );

        // ENHANCEMENT: Better polyline conversion with error handling
        const [fastestPolyline, clearestPolyline] = await Promise.all([
          convertRouteToPolyline(analysis.fastestRoute.googleRoute),
          convertRouteToPolyline(analysis.clearestRoute.googleRoute),
        ]);

        // FIXED: Use the correct interface for routeObstacleService
        let nearbyObstacles: AccessibilityObstacle[] = [];
        try {
          setState((prev) => ({ ...prev, isCalculatingObstacles: true }));

          nearbyObstacles = await routeObstacleService.getRelevantObstacles(
            location,
            {
              fastestRoute: { polyline: fastestPolyline },
              accessibleRoute: { polyline: clearestPolyline }, // FIXED: Use accessibleRoute as expected
            }
          );

          setState((prev) => ({ ...prev, isCalculatingObstacles: false }));
        } catch (obstacleError) {
          console.warn("Could not load nearby obstacles:", obstacleError);
          setState((prev) => ({ ...prev, isCalculatingObstacles: false }));
        }

        // Convert to clean UI format
        const cleanUIAnalysis: SimpleUIRouteAnalysis = {
          fastestRoute: {
            polyline: fastestPolyline,
            duration: analysis.fastestRoute.googleRoute.duration,
            distance: analysis.fastestRoute.googleRoute.distance,
            obstacleCount: analysis.fastestRoute.obstacleCount,
            obstacles: analysis.fastestRoute.obstacles,
          },
          clearestRoute: {
            polyline: clearestPolyline,
            duration: analysis.clearestRoute.googleRoute.duration,
            distance: analysis.clearestRoute.googleRoute.distance,
            obstacleCount: analysis.clearestRoute.obstacleCount,
            obstacles: analysis.clearestRoute.obstacles,
          },
          summary: {
            recommendation: analysis.summary.recommendation,
            timeDifference: analysis.summary.timeDifference,
            obstacleDifference: analysis.summary.obstacleDifference,
            fastestIsAlsoClearest:
              analysis.fastestRoute.googleRoute.id ===
              analysis.clearestRoute.googleRoute.id,
          },
        };

        // ENHANCEMENT: Cache the result
        routeCache.set(cacheKey, {
          result: cleanUIAnalysis,
          timestamp: Date.now(),
        });

        // ENHANCEMENT: Better map centering
        if (mapRef.current && clearestPolyline.length > 0) {
          const coordinates = clearestPolyline.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }));

          try {
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
              animated: true,
            });
          } catch (mapError) {
            console.warn("Could not fit map to coordinates:", mapError);
          }
        }

        // Update state with clean, simple data
        setState((prev) => ({
          ...prev,
          routeAnalysis: cleanUIAnalysis,
          nearbyObstacles: nearbyObstacles,
          selectedDestination: destLocation,
          destinationName: destName,
          isCalculating: false,
          isCalculatingObstacles: false,
        }));

        console.log("✅ SIMPLIFIED route calculation complete!");

        // ENHANCEMENT: Better user feedback
        const fastestMin = Math.round(
          cleanUIAnalysis.fastestRoute.duration / 60
        );
        const clearestMin = Math.round(
          cleanUIAnalysis.clearestRoute.duration / 60
        );

        if (cleanUIAnalysis.summary.fastestIsAlsoClearest) {
          console.log(
            `🎉 Perfect! Same route is both fastest (${fastestMin}min) AND clearest (${cleanUIAnalysis.clearestRoute.obstacleCount} obstacles)`
          );
        } else {
          console.log(
            `⚖️ Choice: Fast (${fastestMin}min, ${cleanUIAnalysis.fastestRoute.obstacleCount} obstacles) vs Clear (${clearestMin}min, ${cleanUIAnalysis.clearestRoute.obstacleCount} obstacles)`
          );
        }
      } catch (error) {
        console.error("❌ Error calculating simplified routes:", error);

        // ENHANCEMENT: Better error messages
        let errorMessage =
          "Unable to calculate routes. Please check your connection and try again.";

        if (error instanceof Error) {
          if (error.message.includes("No routes found")) {
            errorMessage =
              "No routes found to this destination. Please try a different location.";
          } else if (
            error.message.includes("network") ||
            error.message.includes("fetch")
          ) {
            errorMessage =
              "Network error. Please check your internet connection.";
          }
        }

        Alert.alert("Route Calculation Failed", errorMessage);

        setState((prev) => ({
          ...prev,
          isCalculating: false,
          isCalculatingObstacles: false,
          routeObstacles: [],
          nearbyObstacles: [],
        }));
      }
    },
    [location, profile, destination, mapRef, getCacheKey, getCachedRoute]
  );

  const handlePOIPress = useCallback(
    (poi: any) => {
      console.log(
        "🏢 Selected POI:",
        poi.name,
        "- Auto-calculating simplified routes..."
      );
      calculateUnifiedRoutes(poi);
    },
    [calculateUnifiedRoutes]
  );

  const updateRouteAnalysis = useCallback(
    (newAnalysis: SimpleUIRouteAnalysis) => {
      setState((prev) => ({
        ...prev,
        routeAnalysis: newAnalysis,
      }));
    },
    []
  );

  // ENHANCEMENT: Cleanup function for cache management
  const clearCache = useCallback(() => {
    routeCache.clear();
    console.log("🧹 Route cache cleared");
  }, []);

  const clearRoutes = useCallback(() => {
    setState((prev) => ({
      ...prev,
      routeAnalysis: null,
      selectedDestination: null,
      destinationName: "",
      routeObstacles: [],
      nearbyObstacles: [],
    }));
    routeCache.clear(); // Also clear cache
    console.log("🧹 All route data cleared");
  }, []);

  return {
    routeAnalysis: state.routeAnalysis,
    isCalculating: state.isCalculating,
    isCalculatingObstacles: state.isCalculatingObstacles, // New loading state
    selectedDestination: state.selectedDestination,
    destinationName: state.destinationName,
    routeObstacles, // Using memoized version
    nearbyObstacles: state.nearbyObstacles,
    calculateUnifiedRoutes,
    handlePOIPress,
    updateRouteAnalysis,
    clearCache, // New utility function
    clearRoutes,
  };
}

// =====================================================
// ENHANCED UTILITY FUNCTIONS
// =====================================================

/**
 * ENHANCED: Convert GoogleRoute to polyline with better error handling
 */
async function convertRouteToPolyline(
  googleRoute: any
): Promise<UserLocation[]> {
  try {
    // Type guard for valid route
    if (!googleRoute) {
      throw new Error("Invalid googleRoute: null or undefined");
    }

    // If already an array of coordinates, return as-is
    if (Array.isArray(googleRoute.polyline)) {
      console.log("✅ Using existing polyline array");
      return googleRoute.polyline;
    }

    // If encoded string, decode it
    if (typeof googleRoute.polyline === "string") {
      console.log("🔄 Decoding polyline string");
      const decoded = decodePolyline(googleRoute.polyline);

      if (decoded.length === 0) {
        throw new Error("Decoded polyline is empty");
      }

      return decoded;
    }

    // Fallback: use route steps if available
    if (googleRoute.steps && googleRoute.steps.length > 0) {
      console.log("🔄 Using route steps as fallback polyline");
      const stepPoints: UserLocation[] = [];

      googleRoute.steps.forEach((step: any) => {
        if (
          step.startLocation &&
          typeof step.startLocation.latitude === "number" &&
          typeof step.startLocation.longitude === "number"
        ) {
          stepPoints.push(step.startLocation);
        }
      });

      // Add final end location
      const lastStep = googleRoute.steps[googleRoute.steps.length - 1];
      if (
        lastStep.endLocation &&
        typeof lastStep.endLocation.latitude === "number" &&
        typeof lastStep.endLocation.longitude === "number"
      ) {
        stepPoints.push(lastStep.endLocation);
      }

      if (stepPoints.length === 0) {
        throw new Error("No valid step points found");
      }

      return stepPoints;
    }

    throw new Error("No valid polyline data found in route");
  } catch (error) {
    console.error("❌ Error converting route to polyline:", error);

    // Final fallback: return empty array (UI should handle this gracefully)
    return [];
  }
}

// ENHANCEMENT: Type guard for valid UserLocation
function isValidUserLocation(location: any): location is UserLocation {
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
