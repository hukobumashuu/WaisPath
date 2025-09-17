// src/hooks/useRouteCalculation.ts
// SIMPLIFIED: Updated to use SimpleRouteComparison - NO MORE COMPLEX SCORING!
// Clean interface that just shows obstacle counts to users

import { useState, useCallback } from "react";
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

// SIMPLIFIED: Clean state interface - no more complex scoring data!
interface RouteCalculationState {
  routeAnalysis: SimpleUIRouteAnalysis | null; // Simplified for UI
  isCalculating: boolean;
  selectedDestination: UserLocation | null;
  destinationName: string;
  routeObstacles: AccessibilityObstacle[]; // All obstacles from both routes
  nearbyObstacles: AccessibilityObstacle[]; // Additional context obstacles
}

// SIMPLIFIED: What the UI actually needs - clean and simple!
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
    recommendation: string; // Simple text for users
    timeDifference: number; // seconds between routes
    obstacleDifference: number; // obstacle count difference
    fastestIsAlsoClearest: boolean; // Perfect scenario flag
  };
}

interface UseRouteCalculationOptions {
  location: UserLocation | null;
  profile: UserMobilityProfile | null;
  mapRef: React.RefObject<MapView>;
  destination: string;
}

export function useRouteCalculation({
  location,
  profile,
  mapRef,
  destination,
}: UseRouteCalculationOptions) {
  const [state, setState] = useState<RouteCalculationState>({
    routeAnalysis: null,
    isCalculating: false,
    selectedDestination: null,
    destinationName: "",
    routeObstacles: [],
    nearbyObstacles: [],
  });

  const calculateUnifiedRoutes = useCallback(
    async (poi?: any) => {
      if (!location) {
        Alert.alert("Location Error", "Cannot get your current location.");
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

      if (!profile) {
        Alert.alert("Profile Error", "Please set up your profile first.");
        return;
      }

      setState((prev) => ({
        ...prev,
        isCalculating: true,
        selectedDestination: destLocation,
        destinationName: destName,
        routeObstacles: [],
        nearbyObstacles: [],
      }));

      try {
        console.log("🗺️ Calculating SIMPLIFIED routes to", destName + "...");

        // Use our new simplified route analysis service!
        const analysis = await routeAnalysisService.analyzeRoutes(
          location,
          destLocation,
          profile
        );

        // Success vibration feedback
        Vibration.vibrate([100, 50, 100]);

        if (!analysis || !analysis.fastestRoute || !analysis.clearestRoute) {
          Alert.alert(
            "Route Error",
            "Could not find suitable routes. Please try a different destination."
          );
          setState((prev) => ({
            ...prev,
            isCalculating: false,
            routeObstacles: [],
            nearbyObstacles: [],
          }));
          return;
        }

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

        // Extract all obstacles for map display
        const routeObstacles: AccessibilityObstacle[] = [
          ...analysis.fastestRoute.obstacles,
          ...analysis.clearestRoute.obstacles,
        ];

        // Remove duplicates by ID
        const deduplicatedObstacles = routeObstacles.filter(
          (obstacle, index, self) =>
            index === self.findIndex((t) => t.id === obstacle.id)
        );

        // Get additional nearby obstacles for context (optional)
        let nearbyObstacles: AccessibilityObstacle[] = [];
        try {
          const fastestPolyline = await convertRouteToPolyline(
            analysis.fastestRoute.googleRoute
          );
          const clearestPolyline = await convertRouteToPolyline(
            analysis.clearestRoute.googleRoute
          );

          // FIX: Use the interface that routeObstacleService expects (accessibleRoute)
          nearbyObstacles = await routeObstacleService.getRelevantObstacles(
            location,
            {
              fastestRoute: { polyline: fastestPolyline },
              accessibleRoute: { polyline: clearestPolyline }, // Use accessibleRoute name for compatibility
            }
          );
        } catch (obstacleError) {
          console.warn("Could not load nearby obstacles:", obstacleError);
        }

        // Convert to clean UI format - NO MORE COMPLEX DATA!
        const cleanUIAnalysis: SimpleUIRouteAnalysis = {
          fastestRoute: {
            polyline: await convertRouteToPolyline(
              analysis.fastestRoute.googleRoute
            ),
            duration: analysis.fastestRoute.googleRoute.duration,
            distance: analysis.fastestRoute.googleRoute.distance,
            obstacleCount: analysis.fastestRoute.obstacleCount,
            obstacles: analysis.fastestRoute.obstacles,
          },
          clearestRoute: {
            polyline: await convertRouteToPolyline(
              analysis.clearestRoute.googleRoute
            ),
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

        // Center map on the clearest route (usually more interesting to see)
        if (
          mapRef.current &&
          cleanUIAnalysis.clearestRoute.polyline.length > 0
        ) {
          const coordinates = cleanUIAnalysis.clearestRoute.polyline.map(
            (point) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            })
          );

          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }

        // Update state with clean, simple data
        setState((prev) => ({
          ...prev,
          routeAnalysis: cleanUIAnalysis,
          routeObstacles: deduplicatedObstacles,
          nearbyObstacles: nearbyObstacles,
          selectedDestination: destLocation,
          destinationName: destName,
          isCalculating: false,
        }));

        console.log("✅ SIMPLIFIED route calculation complete!");

        // Show user a quick summary
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
        Alert.alert(
          "Route Calculation Failed",
          "Unable to calculate routes. Please check your connection and try again."
        );
        setState((prev) => ({
          ...prev,
          isCalculating: false,
          routeObstacles: [],
          nearbyObstacles: [],
        }));
      }
    },
    [location, profile, destination, mapRef]
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

  return {
    routeAnalysis: state.routeAnalysis,
    isCalculating: state.isCalculating,
    selectedDestination: state.selectedDestination,
    destinationName: state.destinationName,
    routeObstacles: state.routeObstacles,
    nearbyObstacles: state.nearbyObstacles,
    calculateUnifiedRoutes,
    handlePOIPress,
    updateRouteAnalysis,
  };
}

// =====================================================
// UTILITY FUNCTIONS - Keep polyline conversion working
// =====================================================

/**
 * Convert GoogleRoute to polyline - handle different formats
 */
async function convertRouteToPolyline(
  googleRoute: any
): Promise<UserLocation[]> {
  try {
    // If already an array of coordinates, return as-is
    if (Array.isArray(googleRoute.polyline)) {
      return googleRoute.polyline;
    }

    // If encoded string, decode it
    if (typeof googleRoute.polyline === "string") {
      return decodePolyline(googleRoute.polyline);
    }

    // Fallback: use route steps if available
    if (googleRoute.steps && googleRoute.steps.length > 0) {
      console.log("Using route steps as fallback polyline");
      const stepPoints: UserLocation[] = [];

      googleRoute.steps.forEach((step: any) => {
        if (step.startLocation) {
          stepPoints.push(step.startLocation);
        }
      });

      // Add final end location
      const lastStep = googleRoute.steps[googleRoute.steps.length - 1];
      if (lastStep.endLocation) {
        stepPoints.push(lastStep.endLocation);
      }

      return stepPoints;
    }

    console.warn("⚠️ Could not convert route to polyline, using empty array");
    return [];
  } catch (error) {
    console.error("❌ Error converting route to polyline:", error);
    return [];
  }
}
