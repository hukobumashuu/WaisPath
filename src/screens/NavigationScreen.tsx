// src/screens/NavigationScreen.tsx
// COMPLETE FILE with debug logging and duplicate key fix

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

// 🔥 EXTRACTED STYLES
import { navigationStyles as styles } from "../styles/navigationStyles";

// SIMPLIFIED: Only essential imports
import { useProximityDetection } from "../hooks/useProximityDetection";
import { useRouteCalculation } from "../hooks/useRouteCalculation";

// 🔥 EXTRACTED COMPONENTS
import { ProximityAlertsOverlay } from "../components/ProximityAlertsOverlay";
import { EnhancedObstacleMarker } from "../components/EnhancedObstacleMarker";
import { RouteInfoPanel } from "../components/RouteInfoPanel";
import { NavigationControls } from "../components/NavigationControls";

// Utils
import { getPOIIcon } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";

// Proximity detection
import {
  ProximityAlert,
  proximityDetectionService,
} from "../services/proximityDetectionService";

// Validation
import { ValidationPrompt } from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";

// Detour system
import {
  microReroutingService,
  MicroDetour,
} from "../services/microReroutingService";
import {
  DetourSuggestionModal,
  CompactObstacleWarning,
  DetourStatusIndicator,
} from "../components/DetourComponents";

export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { location, error: locationError } = useLocation();
  const { profile } = useUserProfile();

  const mapRef = useRef<MapView | null>(null);
  const [destination, setDestination] = useState("");

  // Helper function for obstacle route type detection
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

  // Helper function for deduplication by ID
  const dedupeById = (arr: AccessibilityObstacle[] = []) => {
    const map = new Map<string, AccessibilityObstacle>();
    arr.forEach((o) => map.set(String(o.id), o));
    return Array.from(map.values());
  };

  // SIMPLIFIED: Use updated hook with monolith logic
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

  const [isNavigating, setIsNavigating] = useState(false);
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [showSidewalks, setShowSidewalks] = useState(true);

  // Detour state
  const [showDetourModal, setShowDetourModal] = useState(false);
  const [showObstacleWarning, setShowObstacleWarning] = useState(false);
  const [currentMicroDetour, setCurrentMicroDetour] =
    useState<MicroDetour | null>(null);
  const [currentObstacleAlert, setCurrentObstacleAlert] =
    useState<ProximityAlert | null>(null);
  const [isUsingDetour, setIsUsingDetour] = useState(false);

  // SIMPLIFIED: Detour handlers without complex concurrency logic
  const handleCriticalObstacle = useCallback(
    async (alert: ProximityAlert) => {
      try {
        console.log("🚨 Critical obstacle detected:", alert.obstacle.type);

        if (!location || !selectedDestination || !profile) {
          setCurrentObstacleAlert(alert);
          setShowObstacleWarning(true);
          return;
        }

        // Vibration feedback
        try {
          Vibration.vibrate(Platform.OS === "ios" ? [100, 50, 100] : 200);
        } catch (error) {
          console.warn("Vibration failed:", error);
        }

        console.log("🔄 Computing micro-detour...");

        const microDetour = await microReroutingService.createMicroDetour(
          location,
          alert.obstacle,
          selectedDestination,
          profile
        );

        if (!microDetour) {
          console.log("📍 No safe detour available");
          setCurrentObstacleAlert(alert);
          setShowObstacleWarning(true);
          return;
        }

        console.log(
          `✅ Safe detour found: +${Math.round(microDetour.extraTime)}s`
        );
        setCurrentMicroDetour(microDetour);
        setCurrentObstacleAlert(alert);
        setShowDetourModal(true);
      } catch (error) {
        console.error("❌ Critical obstacle handler error:", error);
        setCurrentObstacleAlert(alert);
        setShowObstacleWarning(true);
      }
    },
    [location, selectedDestination, profile]
  );

  const handleAcceptDetour = useCallback(async () => {
    if (!currentMicroDetour) return;

    try {
      console.log("✅ Applying micro-detour:", currentMicroDetour.reason);

      setShowDetourModal(false);

      updateRouteAnalysis((prev: any) => {
        if (!prev) return prev;

        const detourRoute = {
          ...prev.fastestRoute,
          polyline: currentMicroDetour.route.polyline,
          duration: currentMicroDetour.route.duration,
          distance: currentMicroDetour.route.distance,
          grade: prev.fastestRoute.grade,
          isDetour: true,
          detourInfo: {
            extraTime: currentMicroDetour.extraTime,
            extraDistance: currentMicroDetour.extraDistance,
            safetyRating: currentMicroDetour.safetyRating,
            reason: currentMicroDetour.reason,
          },
        };

        return {
          ...prev,
          fastestRoute: detourRoute,
          activeDetour: currentMicroDetour,
          comparison: {
            ...prev.comparison,
            recommendation: `Using safe detour (+${Math.round(
              currentMicroDetour.extraTime / 60
            )}min extra)`,
          },
        };
      });

      setIsUsingDetour(true);

      if (mapRef.current && currentMicroDetour.route.polyline.length > 0) {
        const allCoords = [
          location,
          selectedDestination,
          ...currentMicroDetour.route.polyline.slice(0, 10),
        ].filter(
          (coord): coord is UserLocation =>
            coord?.latitude != null && coord?.longitude != null
        );

        if (allCoords.length > 0) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(allCoords, {
              edgePadding: { top: 120, right: 50, bottom: 200, left: 50 },
              animated: true,
            });
          }, 500);
        }
      }

      if (currentObstacleAlert && profile) {
        await microReroutingService.logDetourUsage(
          currentMicroDetour,
          currentObstacleAlert.obstacle.type,
          true,
          profile
        );
      }

      setCurrentMicroDetour(null);
      setCurrentObstacleAlert(null);

      console.log("📊 Detour applied successfully");
    } catch (error) {
      console.error("❌ Failed to apply micro-detour:", error);
      Alert.alert(
        "Detour Error",
        "Failed to apply detour. Please try again or navigate manually."
      );
    }
  }, [
    currentMicroDetour,
    currentObstacleAlert,
    location,
    selectedDestination,
    profile,
    updateRouteAnalysis,
  ]);

  const handleDeclineDetour = useCallback(async () => {
    if (!currentMicroDetour) return;

    try {
      console.log("👤 User declined micro-detour");

      if (currentObstacleAlert && profile) {
        await microReroutingService.logDetourUsage(
          currentMicroDetour,
          currentObstacleAlert.obstacle.type,
          false,
          profile
        );
      }

      setShowDetourModal(false);
      setCurrentMicroDetour(null);
      setCurrentObstacleAlert(null);
    } catch (error) {
      console.error("❌ Error logging detour decline:", error);
    }
  }, [currentMicroDetour, currentObstacleAlert, profile]);

  const handleCloseModal = useCallback(() => {
    setShowDetourModal(false);
    setCurrentMicroDetour(null);
    setCurrentObstacleAlert(null);
  }, []);

  const dismissObstacleWarning = useCallback(() => {
    setShowObstacleWarning(false);
    setCurrentObstacleAlert(null);
  }, []);

  const clearDetour = useCallback(() => {
    Alert.alert(
      "Return to Original Route",
      "Do you want to return to the original planned route?",
      [
        {
          text: "Yes, Return",
          onPress: () => {
            setIsUsingDetour(false);
            console.log("🔄 Returned to original route");
          },
        },
        { text: "Keep Detour" },
      ]
    );
  }, []);

  const handleFindAlternative = useCallback(
    async (alert: ProximityAlert) => {
      console.log("🔄 Finding alternative route around:", alert.obstacle.type);
      await handleCriticalObstacle(alert);
    },
    [handleCriticalObstacle]
  );

  const handleProximityAlertPress = useCallback(
    (alert: ProximityAlert) => {
      console.log("📍 User pressed proximity alert:", alert.obstacle.type);

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
          `Severity: ${alert.severity}\n` +
          `Confidence: ${Math.round(alert.confidence * 100)}%\n\n` +
          `${alert.obstacle.description}`,
        [
          {
            text: "Find Alternative",
            onPress: () => handleFindAlternative(alert),
          },
          { text: "OK" },
        ]
      );
    },
    [handleFindAlternative]
  );

  // SIMPLIFIED: Route polyline for proximity detection
  const routePolyline = useMemo(() => {
    return routeAnalysis?.fastestRoute?.polyline || [];
  }, [routeAnalysis?.fastestRoute?.polyline]);

  // SIMPLIFIED: Proximity detection
  const proximityState = useProximityDetection({
    isNavigating,
    userLocation: location,
    routePolyline,
    userProfile: profile,
    onCriticalObstacle: handleCriticalObstacle,
  });

  // Load nearby obstacles
  useEffect(() => {
    if (location) {
      loadNearbyObstacles();
      checkForValidationPrompts();
    }
  }, [location]);

  useEffect(() => {
    if (destinationName && proximityState.isDetecting) {
      proximityDetectionService.resetDetectionState();
      console.log(
        "🔄 Forced proximity detection reset for new destination:",
        destinationName
      );
    }
  }, [destinationName, proximityState.isDetecting]);

  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        1
      );
      console.log(`Loaded ${obstacles.length} area obstacles`);
    } catch (error) {
      console.error("Failed to load obstacles:", error);
    }
  };

  const checkForValidationPrompts = async () => {
    if (!location || !profile) return;

    try {
      const prompts = await obstacleValidationService.checkForValidationPrompts(
        location,
        profile
      );

      if (prompts.length > 0) {
        console.log(`🔍 Found ${prompts.length} validation prompts`);
        setCurrentValidationPrompt(prompts[0]);
        setShowValidationPrompt(true);
      }
    } catch (error) {
      console.error("Validation prompt check failed:", error);
    }
  };

  const startNavigation = (routeType: "fastest" | "accessible") => {
    setIsNavigating(true);
    Vibration.vibrate(100);
    Alert.alert(
      "🚀 Navigation Started!",
      `Following ${routeType} route to ${destinationName}.\n\nRoute grade: ${
        routeType === "fastest"
          ? routeAnalysis?.fastestRoute.grade
          : routeAnalysis?.accessibleRoute.grade
      }\n\nProximity detection enabled.`,
      [{ text: "Let's Go!" }]
    );
  };

  // DEBUG: Prepare obstacle rendering with deduplication and logging
  const renderObstacles = () => {
    console.log("=== OBSTACLE RENDERING DEBUG ===");
    console.log(
      "routeObstacles ids:",
      (routeObstacles || []).map((o) => String(o.id))
    );
    console.log(
      "nearbyObstacles ids:",
      (nearbyObstacles || []).map((o) => String(o.id))
    );

    const combined = [
      ...(routeObstacles || [])
        .map((o) => String(o.id))
        .map((id) => `route-${id}`),
      ...(nearbyObstacles || [])
        .map((o) => String(o.id))
        .map((id) => `nearby-${id}`),
    ];
    const duplicates = combined.filter((x, i, a) => a.indexOf(x) !== i);
    console.log("duplicate keys (if any):", duplicates);

    // Robust deduplication
    const uniqueRouteObstacles = dedupeById(routeObstacles);
    const routeIds = new Set(
      (uniqueRouteObstacles || []).map((o) => String(o.id))
    );

    console.log("Filtering nearby obstacles:", {
      routeObstacles: uniqueRouteObstacles?.length || 0,
      nearbyObstacles: nearbyObstacles?.length || 0,
      duplicateIds: nearbyObstacles
        ?.filter((obs) => routeIds.has(String(obs.id)))
        .map((obs) => obs.id),
    });
    console.log("=== END OBSTACLE DEBUG ===");

    return (
      <>
        {/* ROUTE-SPECIFIC OBSTACLES */}
        {uniqueRouteObstacles &&
          uniqueRouteObstacles.map((obstacle) => (
            <EnhancedObstacleMarker
              key={`route-${obstacle.id}`}
              obstacle={obstacle}
              isOnRoute={true}
              routeType={getObstacleRouteType(obstacle, routeAnalysis)}
              onPress={() => {
                console.log("Route obstacle pressed:", obstacle.type);
              }}
            />
          ))}

        {/* NEARBY OBSTACLES with robust filtering */}
        {nearbyObstacles &&
          nearbyObstacles
            .filter((obstacle) => !routeIds.has(String(obstacle.id)))
            .map((obstacle, index) => (
              <EnhancedObstacleMarker
                key={`nearby-${obstacle.id}-${index}`}
                obstacle={obstacle}
                isOnRoute={false}
                opacity={0.6}
                onPress={() => {
                  console.log("Nearby obstacle pressed:", obstacle.type);
                }}
              />
            ))}
      </>
    );
  };

  if (locationError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Location Access Required</Text>
          <Text style={styles.errorMessage}>
            WAISPATH needs your location to provide accessible navigation.
            Please enable location services in your device settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* USER LOCATION MARKER */}
        <Marker
          coordinate={location}
          title="Your Location"
          description={`${profile?.type || "Standard"} user navigation`}
        >
          <View style={styles.userLocationMarker}>
            <Ionicons name="person" size={16} color="white" />
          </View>
        </Marker>

        {/* DESTINATION MARKER */}
        {selectedDestination && (
          <Marker
            coordinate={selectedDestination}
            title={destinationName}
            description="Destination"
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={16} color="white" />
            </View>
          </Marker>
        )}

        {/* OBSTACLE MARKERS with debug and deduplication */}
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

      {/* NAVIGATION CONTROLS */}
      <NavigationControls
        destination={destination}
        onDestinationChange={setDestination}
        isCalculating={isCalculating}
        searchContainerStyle={{ top: insets.top + 10 }}
        showFAB={!routeAnalysis}
        onFABPress={() => calculateUnifiedRoutes()}
        fabStyle={{ bottom: insets.bottom + 20 }}
        isNavigating={isNavigating}
        isDetecting={proximityState.isDetecting}
        proximityAlertsCount={proximityState.proximityAlerts.length}
        detectionError={proximityState.detectionError}
      />

      {/* PROXIMITY ALERTS OVERLAY */}
      <ProximityAlertsOverlay
        alerts={proximityState.proximityAlerts}
        onAlertPress={handleProximityAlertPress}
      />

      {/* ROUTE INFO PANEL */}
      <RouteInfoPanel
        routeAnalysis={routeAnalysis}
        destinationName={destinationName}
        onStartNavigation={startNavigation}
        onToggleSidewalks={() => setShowSidewalks(!showSidewalks)}
        onRecalculate={() => calculateUnifiedRoutes()}
        showSidewalks={showSidewalks}
        style={{ bottom: insets.bottom + 100 }}
      />

      {/* VALIDATION PROMPT MODAL */}
      <Modal
        visible={showValidationPrompt}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowValidationPrompt(false)}
      >
        {currentValidationPrompt && (
          <ValidationPrompt
            prompt={currentValidationPrompt}
            onResponse={async (response) => {
              if (currentValidationPrompt && location) {
                await obstacleValidationService.processValidationResponse(
                  currentValidationPrompt.obstacleId,
                  response
                );
              }
              setShowValidationPrompt(false);
              setCurrentValidationPrompt(null);
            }}
            onDismiss={() => {
              setShowValidationPrompt(false);
              setCurrentValidationPrompt(null);
            }}
          />
        )}
      </Modal>

      {/* DETOUR STATUS INDICATOR */}
      <DetourStatusIndicator
        isActive={isUsingDetour}
        detourDescription={
          routeAnalysis?.activeDetour?.reason || "Taking alternative route"
        }
        onCancel={clearDetour}
      />

      {/* MICRO-DETOUR MODAL */}
      {currentMicroDetour && currentObstacleAlert && (
        <DetourSuggestionModal
          visible={showDetourModal}
          detour={currentMicroDetour}
          obstacleAlert={currentObstacleAlert}
          onAccept={handleAcceptDetour}
          onDecline={handleDeclineDetour}
          onClose={handleCloseModal}
        />
      )}

      {/* OBSTACLE WARNING BANNER */}
      <CompactObstacleWarning
        visible={showObstacleWarning}
        message={
          currentObstacleAlert
            ? `${currentObstacleAlert.obstacle.type.replace(
                "_",
                " "
              )} • ${Math.round(
                currentObstacleAlert.distance
              )}m ahead • No safe street detour available - navigate around manually`
            : "Obstacle ahead"
        }
        obstacleType={currentObstacleAlert?.obstacle.type || ""}
        onDismiss={dismissObstacleWarning}
      />
    </SafeAreaView>
  );
}
