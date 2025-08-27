// src/screens/NavigationScreen.tsx
// SIMPLIFIED: NavigationScreen with monolith route calculation logic
// Keeps micro-rerouting but simplifies the core routing for consistency

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

// SIMPLIFIED: Only essential imports
import { useProximityDetection } from "../hooks/useProximityDetection";
import { useRouteCalculation } from "../hooks/useRouteCalculation";

// Components
import { ProximityAlertsOverlay } from "../components/ProximityAlertsOverlay";
import { EnhancedObstacleMarker } from "../components/EnhancedObstacleMarker";
import { RouteInfoPanel } from "../components/RouteInfoPanel";

// Utils
import { getPOIIcon } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";

// Proximity detection
import { ProximityAlert } from "../services/proximityDetectionService";

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

  // SIMPLIFIED: Use updated hook with monolith logic
  const {
    routeAnalysis,
    isCalculating,
    selectedDestination,
    destinationName,
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
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);

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
            // Could recalculate routes here if needed
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

  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        1
      );
      setNearbyObstacles(obstacles);
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

  const renderDetectionStatus = useCallback(() => {
    if (!isNavigating) return null;

    return (
      <View style={styles.detectionStatusContainer}>
        <Text style={styles.detectionStatus}>
          {proximityState.isDetecting
            ? `🔍 Scanning ahead... (${proximityState.proximityAlerts.length} obstacles)`
            : "⏸️ Detection paused"}
        </Text>

        {proximityState.detectionError && (
          <Text style={styles.detectionError}>
            ⚠️ {proximityState.detectionError}
          </Text>
        )}
      </View>
    );
  }, [
    isNavigating,
    proximityState.isDetecting,
    proximityState.proximityAlerts.length,
    proximityState.detectionError,
  ]);

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

        {/* OBSTACLE MARKERS */}
        {nearbyObstacles.map((obstacle) => (
          <EnhancedObstacleMarker
            key={obstacle.id}
            obstacle={obstacle}
            onPress={() => console.log("Obstacle pressed:", obstacle.type)}
          />
        ))}

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
            {/* FASTEST ROUTE */}
            {routeAnalysis.fastestRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.polyline}
                strokeColor="#EF4444"
                strokeWidth={5}
                lineDashPattern={[0]}
                zIndex={1}
              />
            )}

            {/* ACCESSIBLE ROUTE */}
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

      {/* SEARCH BAR */}
      <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Where do you want to go?"
            value={destination}
            onChangeText={setDestination}
            placeholderTextColor="#6B7280"
          />
          {isCalculating && <ActivityIndicator size="small" color="#3B82F6" />}
        </View>
      </View>

      {/* PROXIMITY DETECTION STATUS */}
      {renderDetectionStatus()}

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

      {/* FLOATING ACTION BUTTON */}
      {!routeAnalysis && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => calculateUnifiedRoutes()}
          disabled={isCalculating}
        >
          {isCalculating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="navigate-circle" size={24} color="white" />
          )}
        </TouchableOpacity>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1F2937",
  },
  detectionStatusContainer: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 8,
    zIndex: 8,
  },
  detectionStatus: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
  },
  detectionError: {
    color: "#FCD34D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },
  userLocationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  poiMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
  },
  calloutType: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  calloutAction: {
    fontSize: 12,
    color: "#3B82F6",
    fontStyle: "italic",
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
