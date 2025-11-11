// src/hooks/useRouteCalculation.ts
// ✅ COMPLETE FIX: TypeScript errors + Location closure issue + Proper polyline conversion
// Converts service data to UI-friendly format

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { decodePolyline } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";

// ✅ UI-Friendly interface (what the components expect)
interface SimpleUIRouteAnalysis {
  fastestRoute: {
    polyline: UserLocation[]; // ✅ Direct polyline array
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  clearestRoute: {
    polyline: UserLocation[]; // ✅ Direct polyline array
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

interface RouteCalculationState {
  routeAnalysis: SimpleUIRouteAnalysis | null; // ✅ UI-friendly format
  isCalculating: boolean;
  isCalculatingObstacles: boolean;
  selectedDestination: UserLocation | null;
  destinationName: string;
  routeObstacles: AccessibilityObstacle[];
  nearbyObstacles: AccessibilityObstacle[];
}

interface UseRouteCalculationOptions {
  location: UserLocation | null;
  profile: UserMobilityProfile | null;
  mapRef: React.RefObject<MapView>;
  destination: string;
}

// Route caching
interface CachedRoute {
  result: SimpleUIRouteAnalysis; // ✅ Cache the converted format
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const routeCache = new Map<string, CachedRoute>();

/**
 * Convert GoogleRoute polyline to UserLocation array
 */
function convertRouteToPolyline(googleRoute: any): UserLocation[] {
  try {
    if (!googleRoute) {
      return [];
    }

    // If already an array, return it
    if (Array.isArray(googleRoute.polyline)) {
      return googleRoute.polyline;
    }

    // If encoded string, decode it
    if (typeof googleRoute.polyline === "string") {
      return decodePolyline(googleRoute.polyline);
    }

    // Fallback: use route steps
    if (googleRoute.steps && googleRoute.steps.length > 0) {
      const stepPoints: UserLocation[] = [];
      googleRoute.steps.forEach((step: any) => {
        if (step.startLocation) {
          stepPoints.push(step.startLocation);
        }
      });
      const lastStep = googleRoute.steps[googleRoute.steps.length - 1];
      if (lastStep.endLocation) {
        stepPoints.push(lastStep.endLocation);
      }
      return stepPoints;
    }

    return [];
  } catch (error) {
    console.error("❌ Error converting polyline:", error);
    return [];
  }
}

/**
 * Custom hook for route calculation and management
 */
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

  // ✅ FIX: Store location and profile in refs to avoid closure issues
  const locationRef = useRef<UserLocation | null>(location);
  const profileRef = useRef<UserMobilityProfile | null>(profile);

  // ✅ Update refs whenever values change
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Memoized route obstacles
  const routeObstacles = useMemo(() => {
    if (!state.routeAnalysis) return [];

    const allObstacles = [
      ...state.routeAnalysis.fastestRoute.obstacles,
      ...state.routeAnalysis.clearestRoute.obstacles,
    ];

    return allObstacles.filter(
      (obstacle, index, self) =>
        index === self.findIndex((t) => t.id === obstacle.id)
    );
  }, [state.routeAnalysis]);

  // Generate cache key
  const getCacheKey = useCallback(
    (start: UserLocation, dest: UserLocation): string => {
      return `${start.latitude.toFixed(4)},${start.longitude.toFixed(
        4
      )}-${dest.latitude.toFixed(4)},${dest.longitude.toFixed(4)}`;
    },
    []
  );

  // Check cache
  const getCachedRoute = useCallback(
    (cacheKey: string): SimpleUIRouteAnalysis | null => {
      const cached = routeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log("✅ Using cached route analysis");
        return cached.result;
      }
      if (cached) {
        routeCache.delete(cacheKey);
      }
      return null;
    },
    []
  );

  /**
   * Main route calculation function
   */
  const calculateUnifiedRoutes = useCallback(
    async (poi?: any) => {
      // ✅ FIX: Read from refs instead of closure
      const currentLocation = locationRef.current;
      const currentProfile = profileRef.current;

      console.log("🔍 [calculateUnifiedRoutes] Location check:", {
        hasLocation: !!currentLocation,
      });

      if (!currentLocation) {
        Alert.alert(
          "Location Error",
          "Cannot get your current location. Please ensure GPS is enabled and app has location permission."
        );
        return;
      }

      if (!currentProfile) {
        Alert.alert("Profile Error", "Please set up your profile first.");
        return;
      }

      let destLocation: UserLocation;
      let destName: string;

      if (poi) {
        // ✅ FIX: Handle both POI formats
        if (poi.location) {
          // Standard PointOfInterest format: { location: { latitude, longitude } }
          destLocation = poi.location;
        } else if (poi.lat !== undefined && poi.lng !== undefined) {
          // Custom POI format: { lat, lng }
          destLocation = {
            latitude: poi.lat,
            longitude: poi.lng,
          };
        } else {
          console.error("❌ Invalid POI format:", poi);
          Alert.alert(
            "Invalid Destination",
            "The selected destination has an invalid format."
          );
          return;
        }
        destName = poi.name || "Custom Destination";
      } else {
        if (!destination.trim()) {
          Alert.alert("No Destination", "Please enter a destination first.");
          return;
        }
        const firstPOI = SAMPLE_POIS[0];
        destLocation = firstPOI.location;
        destName = destination;
      }

      console.log("🎯 Calculating route to:", destName);

      // Check cache first
      const cacheKey = getCacheKey(currentLocation, destLocation);
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
        console.log("🗺️ Fetching routes from service...");

        // Get routes from service (returns SimpleRouteComparison)
        const analysis: SimpleRouteComparison =
          await routeAnalysisService.analyzeRoutes(
            currentLocation,
            destLocation,
            currentProfile
          );

        if (!analysis || !analysis.fastestRoute || !analysis.clearestRoute) {
          throw new Error("Invalid route analysis - missing required routes");
        }

        console.log("✅ Got route analysis from service");
        console.log(
          `   - Fastest: ${analysis.fastestRoute.obstacleCount} obstacles`
        );
        console.log(
          `   - Clearest: ${analysis.clearestRoute.obstacleCount} obstacles`
        );

        // ✅ FIX: Convert service format to UI format
        const fastestPolyline = convertRouteToPolyline(
          analysis.fastestRoute.googleRoute
        );
        const clearestPolyline = convertRouteToPolyline(
          analysis.clearestRoute.googleRoute
        );

        if (fastestPolyline.length === 0 || clearestPolyline.length === 0) {
          throw new Error("Failed to extract route polylines");
        }

        // ✅ Create UI-friendly format
        const uiAnalysis: SimpleUIRouteAnalysis = {
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

        // Success feedback
        Vibration.vibrate([100, 50, 100]);

        // Cache the result
        routeCache.set(cacheKey, {
          result: uiAnalysis,
          timestamp: Date.now(),
        });

        setState((prev) => ({
          ...prev,
          routeAnalysis: uiAnalysis,
          selectedDestination: destLocation,
          destinationName: destName,
          isCalculating: false,
          isCalculatingObstacles: false,
        }));

        // Animate map to show route
        if (mapRef.current && clearestPolyline.length > 0) {
          mapRef.current.fitToCoordinates(
            [currentLocation, destLocation, ...clearestPolyline],
            {
              edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
              animated: true,
            }
          );
        }

        console.log("✅ Route calculation complete!");
      } catch (error: any) {
        console.error("❌ Route calculation error:", error);

        let errorMessage =
          "Could not calculate route. Please check your connection and try again.";

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
    // ✅ Remove location and profile from deps since we use refs
    [destination, mapRef, getCacheKey, getCachedRoute]
  );

  /**
   * Handler for POI selection
   */
  const handlePOIPress = useCallback(
    (poi: any) => {
      console.log("🏢 Selected POI:", poi.name);
      calculateUnifiedRoutes(poi);
    },
    [calculateUnifiedRoutes]
  );

  /**
   * Update route analysis
   */
  const updateRouteAnalysis = useCallback(
    (newAnalysis: SimpleUIRouteAnalysis) => {
      setState((prev) => ({
        ...prev,
        routeAnalysis: newAnalysis,
      }));
    },
    []
  );

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    routeCache.clear();
    console.log("🧹 Route cache cleared");
  }, []);

  /**
   * Clear all routes
   */
  const clearRoutes = useCallback(() => {
    setState((prev) => ({
      ...prev,
      routeAnalysis: null,
      selectedDestination: null,
      destinationName: "",
      routeObstacles: [],
      nearbyObstacles: [],
    }));
    routeCache.clear();
    console.log("🧹 All route data cleared");
  }, []);

  return {
    routeAnalysis: state.routeAnalysis,
    isCalculating: state.isCalculating,
    isCalculatingObstacles: state.isCalculatingObstacles,
    selectedDestination: state.selectedDestination,
    destinationName: state.destinationName,
    routeObstacles,
    nearbyObstacles: state.nearbyObstacles,
    calculateUnifiedRoutes,
    handlePOIPress,
    updateRouteAnalysis,
    clearRoutes,
    clearCache,
  };
}
