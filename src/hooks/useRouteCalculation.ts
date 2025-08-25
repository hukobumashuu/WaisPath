// src/hooks/useRouteCalculation.ts
// 🔥 BEAST MODE: Complete route calculation logic extracted from NavigationScreen
// Handles unified route analysis, polyline decoding, and map fitting calculations
// PWD-optimized with accessibility scoring and intelligent route recommendations

import { useState, useCallback, useRef } from "react";
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

  // 🔥 UNIFIED ROUTE CALCULATION - THE BEAST FUNCTION
  const calculateUnifiedRoutes = useCallback(
    async (poi?: any) => {
      if (!location) {
        Alert.alert("Location Error", "Cannot get your current location.");
        return;
      }

      let destLocation: UserLocation;
      let destName: string;

      // Handle POI vs manual destination input
      if (poi) {
        destLocation = { latitude: poi.lat, longitude: poi.lng };
        destName = poi.name;
      } else {
        if (!destination.trim()) {
          Alert.alert("No Destination", "Please enter a destination first.");
          return;
        }
        // Fallback to first POI for demo purposes
        const firstPOI = SAMPLE_POIS[0];
        destLocation = { latitude: firstPOI.lat, longitude: firstPOI.lng };
        destName = destination;
      }

      if (!profile) {
        Alert.alert("Profile Error", "Please set up your profile first.");
        return;
      }

      // Update destination state immediately
      setState((prev) => ({
        ...prev,
        selectedDestination: destLocation,
        destinationName: destName,
        isCalculating: true,
      }));

      try {
        if (__DEV__) {
          console.log(
            `🗺️ BEAST MODE: Calculating unified routes from current location to ${destName}...`
          );
        }

        // 🚀 PARALLEL ROUTE ANALYSIS - MAXIMUM EFFICIENCY
        const [multiRouteResult, sidewalkResult] = await Promise.all([
          routeAnalysisService.analyzeRoutes(location, destLocation, profile),
          sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
            location,
            destLocation,
            profile
          ),
        ]);

        // 🎯 INTELLIGENT ROUTE PROCESSING WITH FALLBACKS
        const fastestRoute = multiRouteResult?.fastestRoute || {
          polyline: [location, destLocation],
          duration: 600, // 10 minutes fallback
          distance: 1000, // 1km fallback
          accessibilityScore: { overall: 70, grade: "B" },
        };

        const accessibleRoute =
          multiRouteResult?.accessibleRoute || fastestRoute;

        // 🔥 SMART POLYLINE HANDLING - HANDLES ALL FORMATS
        const processPolyline = (route: any): UserLocation[] => {
          const polylineData = route.googleRoute?.polyline;
          if (!polylineData) return [location, destLocation];

          if (Array.isArray(polylineData)) {
            return polylineData; // Already decoded
          }

          if (typeof polylineData === "string") {
            return decodePolyline(polylineData); // Decode Google polyline
          }

          return [location, destLocation]; // Fallback
        };

        // 🎯 UNIFIED ANALYSIS OBJECT - CLEAN DATA STRUCTURE
        const unifiedAnalysis = {
          fastestRoute: {
            polyline: processPolyline(fastestRoute),
            duration: fastestRoute.googleRoute?.duration || 600,
            distance: fastestRoute.googleRoute?.distance || 1000,
            grade: fastestRoute.accessibilityScore?.grade || "B",
          },
          accessibleRoute: {
            polyline: processPolyline(accessibleRoute),
            duration: accessibleRoute.googleRoute?.duration || 600,
            distance: accessibleRoute.googleRoute?.distance || 1000,
            grade: accessibleRoute.accessibilityScore?.grade || "A",
          },
          comparison: {
            timeDifference:
              (accessibleRoute.googleRoute?.duration || 600) -
              (fastestRoute.googleRoute?.duration || 600),
            gradeDifference: 0,
            recommendation: generateSmartRecommendation(
              fastestRoute,
              accessibleRoute,
              profile
            ),
          },
        };

        // 🚀 MAP AUTO-FIT - INTELLIGENT VIEWPORT CALCULATION
        await fitMapToRoutes(unifiedAnalysis, location, destLocation);

        // Update state with results
        setState((prev) => ({
          ...prev,
          routeAnalysis: unifiedAnalysis,
          isCalculating: false,
        }));

        // Success feedback
        Vibration.vibrate(100);

        if (__DEV__) {
          console.log("✅ BEAST MODE: Unified route calculation complete!", {
            fastest: unifiedAnalysis.fastestRoute.polyline.length,
            accessible: unifiedAnalysis.accessibleRoute.polyline.length,
          });
        }
      } catch (error: any) {
        console.error("❌ BEAST MODE: Route calculation failed:", error);
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

  // 🧠 INTELLIGENT ROUTE RECOMMENDATION GENERATOR
  const generateSmartRecommendation = useCallback(
    (fastestRoute: any, accessibleRoute: any, userProfile: any): string => {
      const timeDiff = Math.round(
        ((accessibleRoute.googleRoute?.duration || 600) -
          (fastestRoute.googleRoute?.duration || 600)) /
          60
      );

      // PWD-specific recommendations
      if (userProfile?.mobilityAids?.includes("wheelchair")) {
        return timeDiff <= 2
          ? "✅ Accessible route recommended - minimal time difference"
          : `⚖️ Accessible route is ${timeDiff}min longer but wheelchair-friendly`;
      }

      if (userProfile?.type === "elderly") {
        return timeDiff <= 5
          ? "✅ Accessible route recommended - safer for elderly users"
          : `🚶‍♂️ Consider accessible route (+${timeDiff}min) for safer walking`;
      }

      // General accessibility recommendations
      if (timeDiff <= 3) {
        return "✅ Accessible route recommended - minimal time trade-off";
      } else if (timeDiff <= 10) {
        return `⚖️ Accessible route is ${timeDiff}min longer but better accessibility grade`;
      } else {
        return `⏱️ Fastest route saves ${timeDiff}min but check accessibility concerns`;
      }
    },
    []
  );

  // 🗺️ SMART MAP VIEWPORT FITTING
  const fitMapToRoutes = useCallback(
    async (analysis: any, origin: UserLocation, destination: UserLocation) => {
      if (!mapRef.current) return;

      try {
        const allCoords = [
          origin,
          destination,
          ...(analysis.fastestRoute.polyline || []),
          ...(analysis.accessibleRoute.polyline || []),
        ].filter((coord) => coord?.latitude && coord?.longitude);

        if (allCoords.length > 0) {
          // Smart timeout to ensure map is ready
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(allCoords, {
              edgePadding: {
                top: 100,
                right: 50,
                bottom: 200,
                left: 50,
              },
              animated: true,
            });
          }, 300);
        }
      } catch (error) {
        console.warn("⚠️ Map fitting failed:", error);
      }
    },
    [mapRef]
  );

  // 🎯 POI SELECTION HANDLER WITH AUTO-CALCULATION
  const handlePOIPress = useCallback(
    (poi: any) => {
      if (__DEV__) {
        console.log(
          `🏢 BEAST MODE: Selected POI: ${poi.name} - Auto-calculating routes...`
        );
      }

      // Animate to POI location first
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

      // Auto-calculate routes
      calculateUnifiedRoutes(poi);
    },
    [calculateUnifiedRoutes, mapRef]
  );

  // 🔄 RESET ROUTE ANALYSIS
  const resetRoutes = useCallback(() => {
    setState({
      routeAnalysis: null,
      isCalculating: false,
      selectedDestination: null,
      destinationName: "",
    });
  }, []);

  // 📊 ROUTE METRICS CALCULATOR
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

  // 🔥 UPDATE ROUTE ANALYSIS (for detour system)
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
    updateRouteAnalysis, // 🔥 NEW: For detour system

    // Computed values
    routeMetrics: getRouteMetrics(),
  };
}
