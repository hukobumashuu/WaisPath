// src/screens/NavigationScreen.tsx
// UPDATED: Added map selection mode for "Choose on Map" feature

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Vibration,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";
import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle } from "../types";
import { calculateUserBearingFromRoute } from "../utils/navigationUtils";

// ✅ Import the hook
import { useMapInteraction } from "../hooks/useMapInteraction";

import { navigationStyles as styles } from "../styles/navigationStyles";

import { useProximityDetection } from "../hooks/useProximityDetection";
import { useRouteCalculation } from "../hooks/useRouteCalculation";
import { ProximityAlertsOverlay } from "../components/ProximityAlertsOverlay";
import { EnhancedObstacleMarker } from "../components/EnhancedObstacleMarker";
import { RouteInfoBottomSheet } from "../components/RouteInfoPanel";
import { NavigationControls } from "../components/NavigationControls";

import EnhancedSearchBar from "../components/EnhancedSearchBar";
import { PlaceSearchResult } from "../services/googlePlacesService";

import { getPOIIcon } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";
import {
  ProximityAlert,
  proximityDetectionService,
} from "../services/proximityDetectionService";
import { ValidationPrompt } from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";
import { textToSpeechService } from "../services/textToSpeechService";

/**
 * Haversine distance calculation (inline for map selection)
 */
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { location, error: locationError } = useLocation();
  const { profile } = useUserProfile();

  const mapRef = useRef<MapView | null>(null);
  const [destination, setDestination] = useState("");

  const [remainingPolyline, setRemainingPolyline] = useState<UserLocation[]>(
    []
  );
  const [selectedRouteType, setSelectedRouteType] = useState<
    "fastest" | "clearest" | null
  >(null);

  // All existing state
  const [showAllObstacles, setShowAllObstacles] = useState(false);
  const [validationRadiusObstacles, setValidationRadiusObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [hasArrived, setHasArrived] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(true);
  const [userBearing, setUserBearing] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [showSidewalks, setShowSidewalks] = useState(true);
  const [navigationPausedByBlur, setNavigationPausedByBlur] = useState(false);

  // ✅ NEW: Map selection mode state
  const [isMapSelectionMode, setIsMapSelectionMode] = useState(false);
  const [selectedMapLocation, setSelectedMapLocation] =
    useState<UserLocation | null>(null);

  const lastValidationCheckRef = useRef<number>(0);
  const VALIDATION_CHECK_INTERVAL = 30000;

  // Helper functions
  function getObstacleRouteType(
    obstacle: AccessibilityObstacle,
    routeAnalysis: any
  ): "fastest" | "clearest" | "both" | undefined {
    if (!routeAnalysis) return undefined;

    const onFastest = routeAnalysis.fastestRoute?.obstacles?.some(
      (obs: any) => obs.id === obstacle.id
    );
    const onClearest = routeAnalysis.clearestRoute?.obstacles?.some(
      (obs: any) => obs.id === obstacle.id
    );

    if (onFastest && onClearest) return "both";
    if (onFastest) return "fastest";
    if (onClearest) return "clearest";
    return undefined;
  }

  const calculateRemainingRoute = useCallback(
    (userLocation: UserLocation, fullRoute: UserLocation[]): UserLocation[] => {
      if (!fullRoute || fullRoute.length === 0 || !userLocation) return [];

      const norm = (p: any) =>
        ({
          latitude: p.latitude ?? p.lat,
          longitude: p.longitude ?? p.lng,
        } as UserLocation);

      const route = fullRoute.map(norm);
      const user = norm(userLocation);

      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const lat0 = toRad(user.latitude);
      const cosLat0 = Math.cos(lat0);

      const toXY = (p: UserLocation) => {
        const x = toRad(p.longitude - user.longitude) * R * cosLat0;
        const y = toRad(p.latitude - user.latitude) * R;
        return { x, y };
      };

      const userXY = { x: 0, y: 0 };
      const routeXY = route.map(toXY);

      const sq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

      const projectSeg = (
        pXY: { x: number; y: number },
        vXY: { x: number; y: number },
        wXY: { x: number; y: number }
      ) => {
        const dx = wXY.x - vXY.x;
        const dy = wXY.y - vXY.y;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0) return { t: 0, proj: { x: vXY.x, y: vXY.y } };
        let t = ((pXY.x - vXY.x) * dx + (pXY.y - vXY.y) * dy) / l2;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        return { t, proj: { x: vXY.x + t * dx, y: vXY.y + t * dy } };
      };

      let bestDist = Infinity;
      let bestIndex = -1;
      let bestProjXY: { x: number; y: number } | null = null;

      for (let i = 0; i < routeXY.length - 1; i++) {
        const { proj } = projectSeg(userXY, routeXY[i], routeXY[i + 1]);
        const d = sq(userXY, proj);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
          bestProjXY = proj;
        }
      }

      const lastIdx = routeXY.length - 1;
      const dLast = sq(userXY, routeXY[lastIdx]);
      if (dLast < bestDist) {
        bestDist = dLast;
        bestIndex = lastIdx;
        bestProjXY = routeXY[lastIdx];
      }

      if (!bestProjXY || bestIndex === -1) {
        return [user, ...route];
      }

      const projToLatLng = (xy: { x: number; y: number }) => {
        const lat = user.latitude + (xy.y / R) * (180 / Math.PI);
        const lon = user.longitude + (xy.x / (R * cosLat0)) * (180 / Math.PI);
        return { latitude: lat, longitude: lon } as UserLocation;
      };

      const projLatLng = projToLatLng(bestProjXY);
      const out: UserLocation[] = [];
      out.push({ latitude: user.latitude, longitude: user.longitude });

      const EPS_M_SQ = 0.01;
      if (sq(userXY, bestProjXY) > EPS_M_SQ) {
        out.push(projLatLng);
      }

      if (bestIndex >= lastIdx) {
        const lastPt = route[lastIdx];
        if (
          out.length === 0 ||
          out[out.length - 1].latitude !== lastPt.latitude ||
          out[out.length - 1].longitude !== lastPt.longitude
        ) {
          out.push(lastPt);
        }
        return out;
      }

      const start = bestIndex + 1;
      for (let k = start; k < route.length; k++) {
        const pt = route[k];
        const prev = out[out.length - 1];
        if (
          !prev ||
          prev.latitude !== pt.latitude ||
          prev.longitude !== pt.longitude
        ) {
          out.push(pt);
        }
      }

      return out;
    },
    []
  );

  const dedupeById = (arr: AccessibilityObstacle[] = []) => {
    const map = new Map<string, AccessibilityObstacle>();
    arr.forEach((o) => map.set(String(o.id), o));
    return Array.from(map.values());
  };

  // Existing hooks
  const {
    routeAnalysis,
    isCalculating,
    selectedDestination,
    destinationName,
    routeObstacles,
    nearbyObstacles,
    calculateUnifiedRoutes,
    handlePOIPress,
    updateRouteAnalysis,
    clearRoutes,
  } = useRouteCalculation({
    location,
    profile,
    mapRef,
    destination,
  });

  // Touch-and-hold hook
  const mapInteraction = useMapInteraction({
    isNavigating: isNavigating || isMapSelectionMode, // ✅ Disable during both navigation AND selection mode
    nearbyPOIs: SAMPLE_POIS,
    onLocationSelected: (coordinate, nearestInfo) => {
      const customPOI = {
        id: `custom_${Date.now()}`,
        name: nearestInfo ? `Near ${nearestInfo.name}` : "Custom Location",
        type: "custom" as const,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
      };

      handlePOIPress(customPOI);
      setShowRoutePanel(true);
    },
    onReportAtLocation: (coordinate) => {
      Alert.alert(
        "Report Feature",
        "This will navigate to Report screen with location pre-filled.",
        [{ text: "OK" }]
      );
    },
  });

  // ✅ NEW: Handle "Choose on Map" activation
  const handleChooseOnMap = useCallback(() => {
    console.log("📍 Map selection mode activated");

    // Activate map selection mode
    setIsMapSelectionMode(true);
    setShowRoutePanel(false);
    setSelectedMapLocation(null);

    // Center map on user location with animation
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [location]);

  // ✅ NEW: Cancel map selection mode
  const cancelMapSelection = useCallback(() => {
    console.log("❌ Map selection mode cancelled");
    setIsMapSelectionMode(false);
    setSelectedMapLocation(null);
  }, []);

  // ✅ NEW: Handle single tap on map (when in selection mode)
  const handleMapSingleTap = useCallback(
    (coordinate: UserLocation) => {
      if (!isMapSelectionMode) return;

      console.log("📍 Location tapped:", coordinate);
      setSelectedMapLocation(coordinate);

      // ✅ PROPERLY TYPE-SAFE: Find nearest POI
      type POI = (typeof SAMPLE_POIS)[number]; // Gets the array element type

      const nearestInfo = SAMPLE_POIS.reduce<{
        poi: POI;
        distance: number;
      } | null>(
        (nearest, poi) => {
          const distance = haversineDistance(
            poi.location.latitude,
            poi.location.longitude,
            coordinate.latitude,
            coordinate.longitude
          );

          if (!nearest || distance < nearest.distance) {
            return { poi, distance };
          }
          return nearest;
        },
        null // Initial value
      );

      // ✅ NOW TypeScript knows nearestInfo is either null or { poi, distance }
      // No type narrowing issues!

      Alert.alert(
        "Location Selected",
        nearestInfo
          ? `Near ${nearestInfo.poi.name} (${Math.round(
              nearestInfo.distance
            )}m away)`
          : "Custom location selected",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setSelectedMapLocation(null),
          },
          {
            text: "Set as Destination",
            onPress: () => {
              const customPOI = {
                id: `custom_${Date.now()}`,
                name: nearestInfo
                  ? `Near ${nearestInfo.poi.name}`
                  : "Custom Location",
                type: "custom" as const,
                lat: coordinate.latitude,
                lng: coordinate.longitude,
              };

              handlePOIPress(customPOI);
              setShowRoutePanel(true);
              setIsMapSelectionMode(false);
              setSelectedMapLocation(null);
            },
          },
          {
            text: "Report Obstacle Here",
            onPress: () => {
              Alert.alert(
                "Report Feature",
                "This will navigate to Report screen with location pre-filled.",
                [{ text: "OK" }]
              );
              setIsMapSelectionMode(false);
              setSelectedMapLocation(null);
            },
          },
        ]
      );
    },
    [isMapSelectionMode, handlePOIPress]
  );

  // All existing functions (unchanged)
  const handleDestinationSelect = async (destination: PlaceSearchResult) => {
    try {
      setDestination(destination.name);

      const poiObject = {
        id: `search_${destination.placeId}`,
        name: destination.name,
        type: getDestinationTypeFromGoogleTypes(destination.types),
        lat: destination.location.latitude,
        lng: destination.location.longitude,
      };

      await calculateUnifiedRoutes(poiObject);
      setShowRoutePanel(true);

      if (destination.accessibilityFeatures?.wheelchairAccessible) {
        Alert.alert(
          "Accessibility Info",
          `${destination.name} is marked as wheelchair accessible.`,
          [{ text: "Great!" }]
        );
      }
    } catch (error) {
      console.error("Error selecting destination:", error);
      Alert.alert("Error", "Unable to calculate route to this destination.");
    }
  };

  const getDestinationTypeFromGoogleTypes = (types: string[]): string => {
    if (types.includes("hospital") || types.includes("pharmacy"))
      return "healthcare";
    if (types.includes("government_office") || types.includes("city_hall"))
      return "government";
    if (types.includes("shopping_mall") || types.includes("store"))
      return "shopping";
    return "business";
  };

  const loadValidationRadiusObstacles = async () => {
    if (!location) return;

    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        0.05
      );
      setValidationRadiusObstacles(obstacles);
    } catch (error) {
      console.error("Failed to load validation obstacles:", error);
    }
  };

  const handleToggleObstacles = useCallback(() => {
    const newState = !showAllObstacles;
    setShowAllObstacles(newState);
  }, [showAllObstacles]);

  const handleValidationResponse = async (
    response: "still_there" | "cleared" | "skip"
  ) => {
    if (!currentValidationPrompt) return;

    try {
      setShowValidationPrompt(false);
      setCurrentValidationPrompt(null);

      if (location) {
        loadValidationRadiusObstacles();
      }

      if (response !== "skip") {
        Alert.alert(
          "Thank You!",
          "Your validation helps improve accessibility data.",
          [{ text: "You're Welcome!" }]
        );
      }
    } catch (error) {
      console.error("Validation response failed:", error);
      Alert.alert("Error", "Failed to record your validation.");
    }
  };

  const handleValidationPromptWithHighlight = (
    prompt: ValidationPromptType
  ) => {
    setCurrentValidationPrompt(prompt);
    setShowValidationPrompt(true);

    if (mapRef.current && prompt.location) {
      mapRef.current.animateToRegion(
        {
          latitude: prompt.location.latitude,
          longitude: prompt.location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        1000
      );
    }
  };

  const handleProximityAlertPress = useCallback((alert: ProximityAlert) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: alert.obstacle.location.latitude,
          longitude: alert.obstacle.location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        1000
      );
    }

    Alert.alert(
      "Obstacle Details",
      `Type: ${alert.obstacle.type.replace("_", " ")}\n` +
        `Distance: ${alert.distance}m away\n` +
        `${alert.obstacle.description}`,
      [{ text: "OK" }]
    );
  }, []);

  const routePolyline = useMemo(() => {
    return routeAnalysis?.fastestRoute?.polyline || [];
  }, [routeAnalysis?.fastestRoute?.polyline]);

  const proximityState = useProximityDetection({
    isNavigating,
    userLocation: location,
    routePolyline,
    userProfile: profile,
  });

  useEffect(() => {
    if (location) {
      loadValidationRadiusObstacles();

      if (profile) {
        const now = Date.now();
        const timeSinceLastCheck = now - lastValidationCheckRef.current;

        if (timeSinceLastCheck >= VALIDATION_CHECK_INTERVAL) {
          checkForValidationPrompts();
          lastValidationCheckRef.current = now;
          console.log("🎯 Validation prompt check triggered (30s throttle)");
        }
      }
    }
  }, [location, profile, showAllObstacles]);

  useEffect(() => {
    if (destinationName && proximityState.isDetecting) {
      proximityDetectionService.resetDetectionState();
    }
  }, [destinationName, proximityState.isDetecting]);

  const checkForValidationPrompts = async () => {
    if (!location || !profile) return;

    try {
      const prompts = await obstacleValidationService.checkForValidationPrompts(
        location,
        profile
      );

      if (prompts.length > 0) {
        handleValidationPromptWithHighlight(prompts[0]);
      }
    } catch (error) {
      console.error("Validation prompt check failed:", error);
    }
  };

  const startNavigation = (routeType: "fastest" | "clearest") => {
    if (!routeAnalysis) {
      console.error("Cannot start navigation: No route analysis");
      Alert.alert("Error", "Route not ready. Please try again.");
      return;
    }

    setIsNavigating(true);
    setSelectedRouteType(routeType);
    setHasArrived(false);
    Vibration.vibrate(100);

    const selectedRoute =
      routeType === "fastest"
        ? routeAnalysis.fastestRoute
        : routeAnalysis.clearestRoute;

    setRemainingPolyline(selectedRoute.polyline);

    Alert.alert(
      "Navigation Started!",
      `Following ${routeType} route to ${destinationName}.`,
      [{ text: "Let's Go!" }]
    );
  };

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setHasArrived(false);
    setSelectedRouteType(null);
    setRemainingPolyline([]);
    setDestination("");
    proximityDetectionService.resetDetectionState();
    textToSpeechService.stopSpeaking();
    console.log("🛑 Navigation stopped");
  }, []);

  const clearRoutesAndPanel = useCallback(() => {
    setIsNavigating(false);
    setHasArrived(false);
    setSelectedRouteType(null);
    setRemainingPolyline([]);
    setShowRoutePanel(false);
    setDestination("");
    clearRoutes();
    console.log("🗑️ Routes cleared");
  }, [clearRoutes]);

  const checkArrival = useCallback(() => {
    if (hasArrived) {
      return;
    }

    if (!location || !selectedDestination || !isNavigating) return;

    const distance = proximityDetectionService.calculateDistance(
      location,
      selectedDestination
    );
    const ARRIVAL_THRESHOLD = 20;

    if (distance <= ARRIVAL_THRESHOLD) {
      setHasArrived(true);
      setIsNavigating(false);
      setDestination("");
      proximityDetectionService.resetDetectionState();
      textToSpeechService.stopSpeaking();

      console.log(
        `🎉 Arrival detected - ${distance.toFixed(1)}m from destination`
      );

      Alert.alert("🎉 Arrival", `You have reached your destination!`, [
        { text: "Great!" },
      ]);
    }
  }, [
    location,
    selectedDestination,
    isNavigating,
    destinationName,
    hasArrived,
  ]);

  useEffect(() => {
    if (isNavigating && location && selectedDestination) {
      checkArrival();
    }
  }, [location, isNavigating, selectedDestination, checkArrival]);

  useEffect(() => {
    if (!isNavigating || !location || !selectedRouteType || !routeAnalysis) {
      return;
    }

    const selectedRoute =
      selectedRouteType === "fastest"
        ? routeAnalysis.fastestRoute
        : routeAnalysis.clearestRoute;

    if (!selectedRoute || !selectedRoute.polyline) {
      return;
    }

    const updatedPolyline = calculateRemainingRoute(
      location,
      selectedRoute.polyline
    );

    if (updatedPolyline.length > 0) {
      setRemainingPolyline(updatedPolyline);
      console.log(
        `🗺️ Polyline trimmed: ${selectedRoute.polyline.length} → ${updatedPolyline.length} points`
      );
    } else {
      console.warn("⚠️ Updated polyline is empty, keeping previous polyline");
    }
  }, [
    location,
    isNavigating,
    selectedRouteType,
    routeAnalysis,
    calculateRemainingRoute,
  ]);

  useFocusEffect(
    useCallback(() => {
      console.log("📱 NavigationScreen focused");

      // ONLY resume if navigation was actually paused
      if (
        navigationPausedByBlur &&
        selectedDestination &&
        isNavigating === false
      ) {
        setIsNavigating(true);
        setNavigationPausedByBlur(false);
        console.log("▶️ Resuming navigation after screen focus");
      }

      return () => {
        console.log("📱 NavigationScreen blurred");

        // ONLY pause if actively navigating
        if (isNavigating) {
          setIsNavigating(false);
          setNavigationPausedByBlur(true);
          console.log("⏸️ Pausing navigation due to screen blur");
        }
      };
    }, [isNavigating, selectedDestination, navigationPausedByBlur])
  );

  useEffect(() => {
    if (!isNavigating || !location || !selectedRouteType || !routeAnalysis) {
      setUserBearing(null);
      return;
    }

    const selectedRoute =
      selectedRouteType === "fastest"
        ? routeAnalysis.fastestRoute
        : routeAnalysis.clearestRoute;

    if (!selectedRoute || !selectedRoute.polyline) {
      return;
    }

    const bearing = calculateUserBearingFromRoute(
      location,
      selectedRoute.polyline
    );

    if (bearing !== null) {
      setUserBearing(bearing);
      console.log(`🧭 User marker bearing updated: ${Math.round(bearing)}°`);
    }
  }, [location, isNavigating, selectedRouteType, routeAnalysis]);

  useEffect(() => {
    const initServices = async () => {
      console.log("🚀 Initializing navigation services...");

      const ttsReady = await textToSpeechService.initialize();
      if (ttsReady) {
        console.log("✅ TTS initialized and ready");
      } else {
        console.warn("⚠️ TTS initialization failed");
      }
    };

    initServices();
  }, []);

  const renderObstacles = () => {
    const allObstacleIds = new Set<string>();
    const renderedObstacles: JSX.Element[] = [];

    const addObstacleIfUnique = (
      obstacle: AccessibilityObstacle,
      keyPrefix: string,
      isOnRoute: boolean,
      routeType?: "fastest" | "clearest" | "both" | undefined,
      opacity: number = 1.0
    ) => {
      const obstacleId = String(obstacle.id);
      if (!allObstacleIds.has(obstacleId)) {
        allObstacleIds.add(obstacleId);
        renderedObstacles.push(
          <EnhancedObstacleMarker
            key={`${keyPrefix}-${obstacleId}`}
            obstacle={obstacle}
            isOnRoute={isOnRoute}
            routeType={routeType}
            opacity={opacity}
            onPress={() => {}}
          />
        );
      }
    };

    if (routeObstacles && routeObstacles.length > 0) {
      dedupeById(routeObstacles).forEach((obstacle) => {
        const routeType = getObstacleRouteType(obstacle, routeAnalysis);
        addObstacleIfUnique(obstacle, "route", true, routeType, 1.0);
      });
    }

    validationRadiusObstacles.forEach((obstacle) => {
      addObstacleIfUnique(obstacle, "validation", false, undefined, 0.8);
    });

    if (showAllObstacles && nearbyObstacles && nearbyObstacles.length > 0) {
      const extendedOpacity = isNavigating ? 0.5 : 0.7;
      dedupeById(nearbyObstacles).forEach((obstacle) => {
        addObstacleIfUnique(
          obstacle,
          "extended",
          false,
          undefined,
          extendedOpacity
        );
      });
    }

    return renderedObstacles;
  };

  if (!location && !locationError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </SafeAreaView>
    );
  }

  if (locationError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="location-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Location Required</Text>
        <Text style={styles.errorMessage}>
          WAISPATH needs your location to provide accessible navigation.
        </Text>
        <Text style={styles.errorMessage}>{locationError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || 14.5764,
          longitude: location?.longitude || 121.0851,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        followsUserLocation={isNavigating}
        loadingEnabled={true}
        onMapReady={() => {
          console.log("Map is ready!");
        }}
        onPress={(event) => {
          // ✅ NEW: Handle single tap in selection mode
          if (isMapSelectionMode) {
            const coordinate = event.nativeEvent.coordinate;
            handleMapSingleTap(coordinate);
          }
        }}
        onLongPress={(event) => {
          // Touch-and-hold only works when NOT in selection mode
          if (!isMapSelectionMode) {
            const coordinate = event.nativeEvent.coordinate;
            mapInteraction.handleMapLongPress(coordinate);
          }
        }}
      >
        {location && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={userBearing || 0}
            flat={true}
          >
            <View style={styles.userLocationMarker}>
              <Ionicons name="navigate" size={20} color="white" />
            </View>
          </Marker>
        )}

        {selectedDestination && (
          <Marker coordinate={selectedDestination} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={24} color="white" />
            </View>
          </Marker>
        )}

        {renderObstacles()}

        {SAMPLE_POIS.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={poi.location}
            onPress={() => {
              if (!isMapSelectionMode) {
                handlePOIPress(poi);
                setShowRoutePanel(true);
              }
            }}
          >
            <View style={styles.poiMarker}>
              <Ionicons name={getPOIIcon(poi.type)} size={20} color="white" />
            </View>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{poi.name}</Text>
                <Text style={styles.calloutType}>
                  {poi.type.charAt(0).toUpperCase() + poi.type.slice(1)}
                </Text>
                <Text style={styles.calloutAction}>
                  Tap for intelligent routing
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {mapInteraction.isHoldingMap && mapInteraction.holdLocation && (
          <Marker
            coordinate={mapInteraction.holdLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 80,
                height: 80,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 4,
                  borderColor: "#3B82F6",
                  opacity: mapInteraction.holdProgress / 100,
                }}
              />

              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#3B82F6",
                  borderWidth: 3,
                  borderColor: "white",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              />

              <Text
                style={{
                  position: "absolute",
                  bottom: -25,
                  fontSize: 12,
                  color: "#3B82F6",
                  fontWeight: "700",
                  backgroundColor: "white",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 3,
                }}
              >
                Hold... {Math.round(mapInteraction.holdProgress)}%
              </Text>
            </View>
          </Marker>
        )}

        {/* ✅ NEW: Selected location marker (when in selection mode) */}
        {isMapSelectionMode && selectedMapLocation && (
          <Marker
            coordinate={selectedMapLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#3B82F6",
                borderWidth: 3,
                borderColor: "white",
                justifyContent: "center",
                alignItems: "center",
                elevation: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
              }}
            >
              <Ionicons name="location-sharp" size={24} color="white" />
            </View>
          </Marker>
        )}

        {routeAnalysis && (
          <>
            {!isNavigating && (
              <>
                {routeAnalysis.fastestRoute.polyline && (
                  <Polyline
                    coordinates={routeAnalysis.fastestRoute.polyline}
                    strokeColor="#EF4444"
                    strokeWidth={5}
                  />
                )}
                {routeAnalysis.clearestRoute.polyline && (
                  <Polyline
                    coordinates={routeAnalysis.clearestRoute.polyline}
                    strokeColor="#22C55E"
                    strokeWidth={5}
                  />
                )}
              </>
            )}

            {isNavigating &&
              selectedRouteType &&
              remainingPolyline.length > 0 && (
                <Polyline
                  key={`nav-route-${
                    remainingPolyline.length
                  }-${remainingPolyline[0]?.latitude.toFixed(6)}`}
                  coordinates={remainingPolyline}
                  strokeColor={
                    selectedRouteType === "fastest" ? "#EF4444" : "#22C55E"
                  }
                  strokeWidth={6}
                  lineDashPattern={[0]}
                  zIndex={10}
                />
              )}
          </>
        )}
      </MapView>

      <EnhancedSearchBar
        onDestinationSelect={handleDestinationSelect}
        onChooseOnMap={handleChooseOnMap}
        userLocation={location || undefined}
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: 16,
          right: 16,
          zIndex: 1000,
        }}
        placeholder="Search for accessible destinations..."
      />

      {/* ✅ NEW: Map Selection Mode Banner */}
      {isMapSelectionMode && (
        <View style={[styles.mapSelectionBanner, { top: insets.top + 70 }]}>
          <View style={styles.mapSelectionBannerContent}>
            <Ionicons name="hand-left-outline" size={20} color="#3B82F6" />
            <Text style={styles.mapSelectionBannerText}>
              Tap anywhere on map to select location
            </Text>
          </View>
          <TouchableOpacity
            style={styles.mapSelectionCancelButton}
            onPress={cancelMapSelection}
          >
            <Text style={styles.mapSelectionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ NEW: Optional Crosshair (center of screen indicator) */}
      {isMapSelectionMode && !selectedMapLocation && (
        <View style={styles.mapSelectionCrosshair} pointerEvents="none">
          <View style={styles.crosshairLines}>
            <View style={styles.crosshairVertical} />
            <View style={styles.crosshairHorizontal} />
          </View>
          <View style={styles.crosshairCenter}>
            <Ionicons name="add" size={24} color="#3B82F6" />
          </View>
        </View>
      )}

      <NavigationControls
        showFAB={false}
        onFABPress={() => calculateUnifiedRoutes()}
        fabStyle={{ bottom: insets.bottom + 20 }}
        isCalculating={isCalculating}
        isNavigating={isNavigating}
        isDetecting={proximityState.isDetecting}
        proximityAlertsCount={proximityState.proximityAlerts.length}
        detectionError={proximityState.detectionError || undefined}
        showAllObstacles={showAllObstacles}
        onToggleObstacles={handleToggleObstacles}
        validationObstacleCount={validationRadiusObstacles.length}
        obstacleToggleStyle={{ top: insets.top + 70 }}
      />

      <ProximityAlertsOverlay
        alerts={proximityState.proximityAlerts}
        onAlertPress={handleProximityAlertPress}
      />

      <RouteInfoBottomSheet
        routeAnalysis={routeAnalysis}
        isVisible={!!routeAnalysis && showRoutePanel}
        onSelectRoute={(routeType) => {
          if (routeType === "fastest") {
            startNavigation("fastest");
          } else {
            startNavigation("clearest");
          }
        }}
        onStopNavigation={clearRoutesAndPanel}
      />

      <Modal
        visible={showValidationPrompt}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowValidationPrompt(false)}
      >
        {currentValidationPrompt && (
          <ValidationPrompt
            prompt={currentValidationPrompt}
            onResponse={handleValidationResponse}
            onDismiss={() => setShowValidationPrompt(false)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}
