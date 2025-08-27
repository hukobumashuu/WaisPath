// src/hooks/useRouteCalculation.ts
// SIMPLIFIED: Uses monolith route calculation logic without enhanced services
// Direct route calculation matching the working micro-reroute branch

import { useState, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import MapView from "react-native-maps";
import { UserLocation, UserMobilityProfile } from "../types";
import { routeAnalysisService } from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";
import { decodePolyline } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";

interface RouteCalculationState {
  routeAnalysis: any;
  isCalculating: boolean;
  selectedDestination: UserLocation | null;
  destinationName: string;
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
  });

  // SIMPLIFIED: Direct route calculation matching working monolith version
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

      // FIXED: Clear previous state and set new destination
      setState({
        routeAnalysis: null, // Clear previous routes
        isCalculating: true,
        selectedDestination: destLocation,
        destinationName: destName,
      });

      try {
        console.log(
          `🗺️ Calculating unified routes from current location to ${destName}...`
        );

        // DIRECT: Call services same as working monolith version
        const [multiRouteResult, sidewalkResult] = await Promise.all([
          routeAnalysisService.analyzeRoutes(location, destLocation, profile),
          sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
            location,
            destLocation,
            profile
          ),
        ]);

        // DIRECT: Simple fallback handling
        const fastestRoute = multiRouteResult?.fastestRoute || {
          polyline: [location, destLocation],
          duration: 600,
          distance: 1000,
          accessibilityScore: { overall: 70, grade: "B" },
        };

        const accessibleRoute =
          multiRouteResult?.accessibleRoute || fastestRoute;

        // DIRECT: Build unified analysis same as monolith
        const unifiedAnalysis = {
          fastestRoute: {
            // Handle both old and new polyline formats
            polyline: fastestRoute.googleRoute?.polyline
              ? Array.isArray(fastestRoute.googleRoute.polyline)
                ? fastestRoute.googleRoute.polyline
                : decodePolyline(fastestRoute.googleRoute.polyline)
              : [location, destLocation],
            duration: fastestRoute.googleRoute?.duration || 600,
            distance: fastestRoute.googleRoute?.distance || 1000,
            grade: fastestRoute.accessibilityScore?.grade || "B",
          },
          accessibleRoute: {
            polyline: accessibleRoute.googleRoute?.polyline
              ? Array.isArray(accessibleRoute.googleRoute.polyline)
                ? accessibleRoute.googleRoute.polyline
                : decodePolyline(accessibleRoute.googleRoute.polyline)
              : [location, destLocation],
            duration: accessibleRoute.googleRoute?.duration || 600,
            distance: accessibleRoute.googleRoute?.distance || 1000,
            grade: accessibleRoute.accessibilityScore?.grade || "A",
          },
          comparison: {
            timeDifference:
              (accessibleRoute.googleRoute?.duration || 600) -
              (fastestRoute.googleRoute?.duration || 600),
            gradeDifference: 0,
            recommendation: `Accessible route is ${Math.round(
              ((accessibleRoute.googleRoute?.duration || 600) -
                (fastestRoute.googleRoute?.duration || 600)) /
                60
            )} minutes longer but better accessibility grade`,
          },
        };

        // Update state with results
        setState({
          routeAnalysis: unifiedAnalysis,
          isCalculating: false,
          selectedDestination: destLocation,
          destinationName: destName,
        });

        // Auto-fit map same as monolith
        if (mapRef.current) {
          const allCoords = [
            location,
            destLocation,
            ...(unifiedAnalysis.fastestRoute.polyline || []),
            ...(unifiedAnalysis.accessibleRoute.polyline || []),
          ].filter((coord) => coord.latitude && coord.longitude);

          if (allCoords.length > 0) {
            mapRef.current.fitToCoordinates(allCoords, {
              edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
              animated: true,
            });
          }
        }

        Vibration.vibrate(100);
        console.log("✅ Unified route calculation complete!");
      } catch (error: any) {
        console.error("❌ Route calculation failed:", error);
        Alert.alert(
          "Route Error",
          `Could not calculate routes: ${error.message}`
        );

        setState((prev) => ({
          ...prev,
          isCalculating: false,
        }));
      }
    },
    [location, profile, mapRef, destination]
  );

  // POI handler
  const handlePOIPress = useCallback(
    (poi: any) => {
      console.log(`🏢 Selected POI: ${poi.name} - Auto-calculating routes...`);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: poi.lat,
            longitude: poi.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }

      calculateUnifiedRoutes(poi);
    },
    [calculateUnifiedRoutes, mapRef]
  );

  // Reset routes
  const resetRoutes = useCallback(() => {
    setState({
      routeAnalysis: null,
      isCalculating: false,
      selectedDestination: null,
      destinationName: "",
    });
  }, []);

  // Route metrics
  const getRouteMetrics = useCallback(() => {
    if (!state.routeAnalysis) return null;

    const { fastestRoute, accessibleRoute } = state.routeAnalysis;

    return {
      fastest: {
        time: Math.round((fastestRoute.duration || 600) / 60),
        distance: ((fastestRoute.distance || 1000) / 1000).toFixed(1),
        grade: fastestRoute.grade || "B",
      },
      accessible: {
        time: Math.round((accessibleRoute.duration || 600) / 60),
        distance: ((accessibleRoute.distance || 1000) / 1000).toFixed(1),
        grade: accessibleRoute.grade || "A",
      },
      timeSavings: Math.round(
        (fastestRoute.duration - accessibleRoute.duration) / 60
      ),
    };
  }, [state.routeAnalysis]);

  // Update route analysis for detour system
  const updateRouteAnalysis = useCallback((updater: (prev: any) => any) => {
    setState((prev) => ({
      ...prev,
      routeAnalysis: updater(prev.routeAnalysis),
    }));
  }, []);

  return {
    // State
    routeAnalysis: state.routeAnalysis,
    isCalculating: state.isCalculating,
    selectedDestination: state.selectedDestination,
    destinationName: state.destinationName,

    // Actions
    calculateUnifiedRoutes,
    handlePOIPress,
    resetRoutes,
    updateRouteAnalysis,

    // Computed values
    routeMetrics: getRouteMetrics(),
  };
}
