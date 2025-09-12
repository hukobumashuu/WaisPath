// src/screens/NavigationScreen.tsx
// CLEAN: Removed debug panel, ready for production

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
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Vibration,
  SafeAreaView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";
import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle, ObstacleType } from "../types";

// Import existing styles
import { navigationStyles as styles } from "../styles/navigationStyles";

// Import existing hooks and components
import { useProximityDetection } from "../hooks/useProximityDetection";
import { useRouteCalculation } from "../hooks/useRouteCalculation";
import { ProximityAlertsOverlay } from "../components/ProximityAlertsOverlay";
import { EnhancedObstacleMarker } from "../components/EnhancedObstacleMarker";
import { RouteInfoPanel } from "../components/RouteInfoPanel";
import { NavigationControls } from "../components/NavigationControls";

// Enhanced search component
import EnhancedSearchBar from "../components/EnhancedSearchBar";
import { PlaceSearchResult } from "../services/googlePlacesService";

// Import existing utilities and services
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

export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { location, error: locationError } = useLocation();
  const { profile } = useUserProfile();

  const mapRef = useRef<MapView | null>(null);
  const [destination, setDestination] = useState("");

  // All existing state
  const [showAllObstacles, setShowAllObstacles] = useState(false);
  const [validationRadiusObstacles, setValidationRadiusObstacles] = useState<
    AccessibilityObstacle[]
  >([]);

  // Existing helper functions
  function getObstacleRouteType(
    obstacle: AccessibilityObstacle,
    routeAnalysis: any
  ): "fastest" | "accessible" | "both" | undefined {
    if (!routeAnalysis) return undefined;

    const onFastest = routeAnalysis.fastestRoute?.obstacles?.some(
      (obs: any) => obs.id === obstacle.id
    );
    const onAccessible = routeAnalysis.accessibleRoute?.obstacles?.some(
      (obs: any) => obs.id === obstacle.id
    );

    if (onFastest && onAccessible) return "both";
    if (onFastest) return "fastest";
    if (onAccessible) return "accessible";
    return undefined;
  }

  const dedupeById = (arr: AccessibilityObstacle[] = []) => {
    const map = new Map<string, AccessibilityObstacle>();
    arr.forEach((o) => map.set(String(o.id), o));
    return Array.from(map.values());
  };

  // Existing hook usage
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
  } = useRouteCalculation({
    location,
    profile,
    mapRef,
    destination,
  });

  // All existing state variables
  const [isNavigating, setIsNavigating] = useState(false);
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [showSidewalks, setShowSidewalks] = useState(true);

  // Enhanced destination selection handler
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

  // Helper function
  const getDestinationTypeFromGoogleTypes = (types: string[]): string => {
    if (types.includes("hospital") || types.includes("pharmacy"))
      return "healthcare";
    if (types.includes("government_office") || types.includes("city_hall"))
      return "government";
    if (types.includes("shopping_mall") || types.includes("store"))
      return "shopping";
    return "business";
  };

  // All existing functions unchanged
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

  // Removed micro-reroute/detour handlers and state to simplify navigation flow

  // All other existing handlers

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

    // Show a read-only details alert without any detour/alternative actions
    Alert.alert(
      "Obstacle Details",
      `Type: ${alert.obstacle.type.replace("_", " ")}\n` +
        `Distance: ${alert.distance}m away\n` +
        `${alert.obstacle.description}`,
      [{ text: "OK" }]
    );
  }, []);

  // All existing effects and memos
  const routePolyline = useMemo(() => {
    return routeAnalysis?.fastestRoute?.polyline || [];
  }, [routeAnalysis?.fastestRoute?.polyline]);

  // Removed onCriticalObstacle wiring — proximity detection will still report alerts
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
        checkForValidationPrompts();
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

  const startNavigation = (routeType: "fastest" | "accessible") => {
    setIsNavigating(true);
    Vibration.vibrate(100);
    Alert.alert(
      "Navigation Started!",
      `Following ${routeType} route to ${destinationName}.`,
      [{ text: "Let's Go!" }]
    );
  };

  // Existing obstacle rendering
  const renderObstacles = () => {
    const allObstacleIds = new Set<string>();
    const renderedObstacles: JSX.Element[] = [];

    const addObstacleIfUnique = (
      obstacle: AccessibilityObstacle,
      keyPrefix: string,
      isOnRoute: boolean,
      routeType?: "fastest" | "accessible" | "both" | undefined,
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

  // Loading and error screens
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
      >
        {/* USER MARKER */}
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userLocationMarker}>
              <Ionicons name="navigate" size={20} color="white" />
            </View>
          </Marker>
        )}

        {/* DESTINATION MARKER */}
        {selectedDestination && (
          <Marker coordinate={selectedDestination} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={24} color="white" />
            </View>
          </Marker>
        )}

        {/* OBSTACLES */}
        {renderObstacles()}

        {/* POI MARKERS */}
        {SAMPLE_POIS.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            onPress={() => handlePOIPress(poi)}
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

        {/* ROUTE VISUALIZATION */}
        {routeAnalysis && (
          <>
            {routeAnalysis.fastestRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.polyline}
                strokeColor="#EF4444"
                strokeWidth={5}
                lineDashPattern={[0]}
                zIndex={1}
              />
            )}
            {routeAnalysis.accessibleRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.accessibleRoute.polyline}
                strokeColor="#22C55E"
                strokeWidth={5}
                lineDashPattern={[0]}
                zIndex={2}
              />
            )}
          </>
        )}
      </MapView>

      {/* ENHANCED SEARCH */}
      <EnhancedSearchBar
        onDestinationSelect={handleDestinationSelect}
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

      {/* NAVIGATION CONTROLS */}
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

      {/* All existing overlays */}
      <ProximityAlertsOverlay
        alerts={proximityState.proximityAlerts}
        onAlertPress={handleProximityAlertPress}
      />

      <RouteInfoPanel
        routeAnalysis={routeAnalysis}
        destinationName={destinationName}
        onStartNavigation={startNavigation}
        onToggleSidewalks={() => setShowSidewalks(!showSidewalks)}
        onRecalculate={() => calculateUnifiedRoutes()}
        showSidewalks={showSidewalks}
        style={{ bottom: insets.bottom + 100 }}
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

      {/* Detour/micro-reroute UI removed to simplify behavior */}
    </SafeAreaView>
  );
}
