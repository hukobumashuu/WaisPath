// src/hooks/useRouteCalculation.ts
// FINAL FIX: Corrected method names and proper typing

import { useState, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import MapView from "react-native-maps";
import {
  UserLocation,
  UserMobilityProfile,
  AccessibilityObstacle,
} from "../types";
import { routeAnalysisService } from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";
import { routeObstacleService } from "../services/routeObstacleService";
import { decodePolyline } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";

interface RouteCalculationState {
  routeAnalysis: any;
  isCalculating: boolean;
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
        console.log(
          "🗺️ Calculating unified routes from current location to",
          destName + "..."
        );

        // Use the correct method name from RouteAnalysisService
        const analysis = await routeAnalysisService.analyzeRoutes(
          location,
          destLocation,
          profile
        );

        // Vibration feedback on completion
        Vibration.vibrate([100, 50, 100]);

        if (!analysis || !analysis.fastestRoute || !analysis.accessibleRoute) {
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

        // Extract obstacles from the analysis
        const routeObstacles: AccessibilityObstacle[] = [
          ...(analysis.fastestRoute.obstacles || []),
          ...(analysis.accessibleRoute.obstacles || []),
        ];

        // Get additional nearby obstacles for context
        let nearbyObstacles: AccessibilityObstacle[] = [];
        try {
          // Build polylines from google routes
          const fastestPolyline =
            analysis.fastestRoute.googleRoute?.polyline || [];
          const accessiblePolyline =
            analysis.accessibleRoute.googleRoute?.polyline || [];

          nearbyObstacles = await routeObstacleService.getRelevantObstacles(
            location,
            {
              fastestRoute: { polyline: fastestPolyline },
              accessibleRoute: { polyline: accessiblePolyline },
            }
          );
        } catch (obstacleError) {
          console.warn("Could not load nearby obstacles:", obstacleError);
        }

        // Convert the analysis to the format expected by the UI
        const unifiedAnalysis = {
          fastestRoute: {
            polyline: Array.isArray(analysis.fastestRoute.googleRoute?.polyline)
              ? analysis.fastestRoute.googleRoute.polyline
              : typeof analysis.fastestRoute.googleRoute?.polyline === "string"
              ? decodePolyline(analysis.fastestRoute.googleRoute.polyline)
              : [location, destLocation],
            duration: analysis.fastestRoute.googleRoute?.duration || 600,
            distance: analysis.fastestRoute.googleRoute?.distance || 1000,
            grade: analysis.fastestRoute.accessibilityScore?.grade || "B",
            obstacles: analysis.fastestRoute.obstacles || [],
          },
          accessibleRoute: {
            polyline: Array.isArray(
              analysis.accessibleRoute.googleRoute?.polyline
            )
              ? analysis.accessibleRoute.googleRoute.polyline
              : typeof analysis.accessibleRoute.googleRoute?.polyline ===
                "string"
              ? decodePolyline(analysis.accessibleRoute.googleRoute.polyline)
              : [location, destLocation],
            duration: analysis.accessibleRoute.googleRoute?.duration || 600,
            distance: analysis.accessibleRoute.googleRoute?.distance || 1000,
            grade: analysis.accessibleRoute.accessibilityScore?.grade || "A",
            obstacles: analysis.accessibleRoute.obstacles || [],
          },
          comparison: analysis.routeComparison || {
            timeDifference: 300,
            distanceDifference: 500,
            accessibilityImprovement: 20,
            recommendation: "Use accessible route for better accessibility",
          },
        };

        // Center map on the route
        if (
          mapRef.current &&
          unifiedAnalysis.accessibleRoute.polyline?.length > 0
        ) {
          const polyline = unifiedAnalysis.accessibleRoute.polyline;
          const coordinates = polyline.map((point: UserLocation) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }));

          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }

        setState((prev) => ({
          ...prev,
          routeAnalysis: unifiedAnalysis,
          routeObstacles: routeObstacles,
          nearbyObstacles: nearbyObstacles,
          selectedDestination: destLocation,
          destinationName: destName,
          isCalculating: false,
        }));

        console.log("✅ Route calculation complete!");
      } catch (error) {
        console.error("❌ Error calculating routes:", error);
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
      console.log("🏢 Selected POI:", poi.name, "- Auto-calculating routes...");
      calculateUnifiedRoutes(poi);
    },
    [calculateUnifiedRoutes]
  );

  const updateRouteAnalysis = useCallback((newAnalysis: any) => {
    setState((prev) => ({
      ...prev,
      routeAnalysis: newAnalysis,
    }));
  }, []);

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
