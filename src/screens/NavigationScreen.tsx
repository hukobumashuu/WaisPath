// src/screens/NavigationScreen.tsx
// FIXED: Complete NavigationScreen with Proper Detour State Management

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

// 🔥 EXTRACTED PROXIMITY DETECTION HOOK
import { useProximityDetection } from "../hooks/useProximityDetection";
import { useRouteCalculation } from "../hooks/useRouteCalculation";

// 🔥 EXTRACTED COMPONENTS
import { ProximityAlertsOverlay } from "../components/ProximityAlertsOverlay";
import { EnhancedObstacleMarker } from "../components/EnhancedObstacleMarker";
import { RouteInfoPanel } from "../components/RouteInfoPanel";
import { NavigationControls } from "../components/NavigationControls";

// 🔥 EXTRACTED UTILITIES AND CONSTANTS
import { decodePolyline, getPOIIcon } from "../utils/mapUtils";
import { SAMPLE_POIS, MAP_STYLES } from "../constants/navigationConstants";

// Route analysis services
import { routeAnalysisService } from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";

// 🔥 Proximity detection imports
import {
  proximityDetectionService,
  ProximityAlert,
} from "../services/proximityDetectionService";

// 🔥 VALIDATION SYSTEM IMPORTS
import { ValidationPrompt } from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";

// 🔥 DETOUR SYSTEM IMPORTS
import {
  microReroutingService,
  MicroDetour,
} from "../services/microReroutingService";
import {
  DetourSuggestionModal,
  CompactObstacleWarning,
  DetourStatusIndicator,
} from "../components/DetourComponents";

// ================================================
// MAIN NAVIGATION SCREEN COMPONENT
// ================================================

export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { location, error: locationError } = useLocation();
  const { profile } = useUserProfile();

  const mapRef = useRef<MapView | null>(null);

  const [destination, setDestination] = useState("");
  const {
    routeAnalysis,
    isCalculating,
    selectedDestination,
    destinationName,
    calculateUnifiedRoutes,
    handlePOIPress,
    routeMetrics,
    updateRouteAnalysis,
  } = useRouteCalculation({
    location,
    profile,
    mapRef, // Now mapRef is defined before we use it
    destination,
  });

  const [isNavigating, setIsNavigating] = useState(false);
  // Map and UI state
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [showSidewalks, setShowSidewalks] = useState(true);
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);

  // 🔥 DETOUR STATE - moved to main component scope
  const [showDetourModal, setShowDetourModal] = useState(false);
  const [showObstacleWarning, setShowObstacleWarning] = useState(false);
  const [currentMicroDetour, setCurrentMicroDetour] =
    useState<MicroDetour | null>(null);
  const [currentObstacleAlert, setCurrentObstacleAlert] =
    useState<ProximityAlert | null>(null);
  const [isUsingDetour, setIsUsingDetour] = useState(false);

  // 🔥 DETOUR HANDLERS - moved to main component scope
  const handleCriticalObstacle = useCallback(
    async (alert: ProximityAlert) => {
      try {
        console.log("🚨 Critical obstacle detected:", alert.obstacle.type);

        // Validate required data
        if (!location) {
          Alert.alert(
            "Location Error",
            "Cannot compute detour without current location."
          );
          return;
        }

        if (!selectedDestination) {
          // No destination - show simple warning banner
          setCurrentObstacleAlert(alert);
          setShowObstacleWarning(true);
          return;
        }

        if (!profile) {
          Alert.alert(
            "Profile Error",
            "Please set up your mobility profile first."
          );
          return;
        }

        // Cross-platform vibration feedback
        try {
          if (Platform.OS === "ios") {
            Vibration.vibrate([100, 50, 100]);
          } else {
            Vibration.vibrate(200);
          }
        } catch (error) {
          console.warn("Vibration failed:", error);
        }

        console.log("🔄 Computing micro-detour...");

        // CORE: Attempt to generate a safe street-only micro-detour
        const microDetour = await microReroutingService.createMicroDetour(
          location,
          alert.obstacle,
          selectedDestination,
          profile
        );

        if (!microDetour) {
          // No safe detour found - show warning banner
          console.log("📍 No safe detour available");
          setCurrentObstacleAlert(alert);
          setShowObstacleWarning(true);
          return;
        }

        // SUCCESS: Safe detour found - show modal
        console.log(
          `✅ Safe detour found: +${Math.round(microDetour.extraTime)}s`
        );
        setCurrentMicroDetour(microDetour);
        setCurrentObstacleAlert(alert);
        setShowDetourModal(true);
      } catch (error) {
        console.error("❌ Critical obstacle handler error:", error);

        // Fallback to simple warning
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

      // Close modal first
      setShowDetourModal(false);

      // Update the route analysis to show the detour
      updateRouteAnalysis((prev: any) => {
        if (!prev) {
          console.warn("⚠️ No route analysis to update");
          return prev;
        }

        // Create updated fastest route with detour
        const detourRoute = {
          ...prev.fastestRoute,
          polyline: currentMicroDetour.route.polyline, // Use decoded polyline for map display
          duration: currentMicroDetour.route.duration,
          distance: currentMicroDetour.route.distance,
          grade: prev.fastestRoute.grade, // Keep original grade
          isDetour: true, // Flag to indicate this is a detour
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
          activeDetour: currentMicroDetour, // Store detour info for reference
          comparison: {
            ...prev.comparison,
            recommendation: `Using safe detour (+${Math.round(
              currentMicroDetour.extraTime / 60
            )}min extra)`,
          },
        };
      });

      // Set detour mode
      setIsUsingDetour(true);

      // Auto-fit map to show the detour route
      if (mapRef.current && currentMicroDetour.route.polyline.length > 0) {
        const allCoords = [
          location,
          selectedDestination,
          ...currentMicroDetour.route.polyline.slice(0, 10), // Limit points for performance
        ].filter((coord) => coord && coord.latitude && coord.longitude);

        if (allCoords.length > 0) {
          const validCoords = allCoords.filter(
            (coord): coord is UserLocation => coord !== null
          );

          if (validCoords.length > 0) {
            setTimeout(() => {
              mapRef.current?.fitToCoordinates(validCoords, {
                edgePadding: { top: 120, right: 50, bottom: 200, left: 50 },
                animated: true,
              });
            }, 500);
          }
        }
      }

      // Log detour usage for analytics
      if (currentObstacleAlert && profile) {
        await microReroutingService.logDetourUsage(
          currentMicroDetour,
          currentObstacleAlert.obstacle.type,
          true, // User accepted
          profile
        );
      }

      // Clear current detour data
      setCurrentMicroDetour(null);
      setCurrentObstacleAlert(null);

      console.log("📊 Detour applied successfully");
    } catch (error) {
      console.error("❌ Failed to apply micro-detour:", error);
      Alert.alert(
        "Detour Error",
        "Failed to apply detour. Please try again or navigate manually.",
        [{ text: "OK" }]
      );
    }
  }, [
    currentMicroDetour,
    currentObstacleAlert,
    location,
    selectedDestination,
    profile,
    mapRef,
  ]);

  const handleDeclineDetour = useCallback(async () => {
    if (!currentMicroDetour) return;

    try {
      console.log("👤 User declined micro-detour");

      // Log detour usage for analytics
      if (currentObstacleAlert && profile) {
        await microReroutingService.logDetourUsage(
          currentMicroDetour,
          currentObstacleAlert.obstacle.type,
          false, // User declined
          profile
        );
      }

      // Close modal and clear data
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

  const reportObstacleIssue = useCallback(() => {
    if (!currentObstacleAlert) return;

    Alert.alert(
      "Report Obstacle Issue",
      "Help improve WAISPATH by reporting issues with this obstacle.",
      [
        {
          text: "Mark as Resolved",
          onPress: () => {
            console.log(
              "📝 Obstacle marked as resolved:",
              currentObstacleAlert.obstacle.id
            );
            dismissObstacleWarning();
          },
        },
        {
          text: "Mark as Incorrect",
          onPress: () => {
            console.log(
              "📝 Obstacle marked as incorrect:",
              currentObstacleAlert.obstacle.id
            );
            dismissObstacleWarning();
          },
        },
        { text: "Cancel" },
      ]
    );
  }, [currentObstacleAlert, dismissObstacleWarning]);

  const clearDetour = useCallback(() => {
    Alert.alert(
      "Return to Original Route",
      "Do you want to return to the original planned route?",
      [
        {
          text: "Yes, Return",
          onPress: () => {
            setIsUsingDetour(false);

            // Recalculate original routes
            if (selectedDestination) {
              // Call your existing route calculation function
              // calculateUnifiedRoutes(); // Uncomment if you have this function
            }

            console.log("🔄 Returned to original route");
          },
        },
        { text: "Keep Detour" },
      ]
    );
  }, [selectedDestination]);

  const handleFindAlternative = useCallback(
    async (alert: ProximityAlert) => {
      if (__DEV__) {
        console.log(
          "🔄 Finding alternative route around:",
          alert.obstacle.type
        );
      }

      // This now triggers the same micro-rerouting logic as handleCriticalObstacle
      await handleCriticalObstacle(alert);
    },
    [handleCriticalObstacle]
  );

  const handleProximityAlertPress = useCallback(
    (alert: ProximityAlert) => {
      if (__DEV__) {
        console.log("📍 User pressed proximity alert:", alert.obstacle.type);
      }

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

  // Memoize routePolyline to prevent infinite re-renders
  const routePolyline = useMemo(() => {
    return routeAnalysis?.fastestRoute?.polyline || [];
  }, [routeAnalysis?.fastestRoute?.polyline]);

  // 🔥 Proximity detection state
  const proximityState = useProximityDetection({
    isNavigating, // Now this exists!
    userLocation: location,
    routePolyline,
    userProfile: profile,
    onCriticalObstacle: handleCriticalObstacle,
  });

  // Load nearby obstacles when location changes
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
        1 // 1km radius
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

  // Start navigation
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

  // Error state
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

  // Loading state
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
            {/* FASTEST ROUTE - MAIN LINE */}
            {routeAnalysis.fastestRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.polyline}
                strokeColor={MAP_STYLES.FASTEST_ROUTE_COLOR}
                strokeWidth={MAP_STYLES.ROUTE_STROKE_WIDTH}
                lineDashPattern={[0]}
                zIndex={1}
              />
            )}

            {/* ACCESSIBLE ROUTE - MAIN LINE */}
            {routeAnalysis.accessibleRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.accessibleRoute.polyline}
                strokeColor={MAP_STYLES.ACCESSIBLE_ROUTE_COLOR}
                strokeWidth={MAP_STYLES.ROUTE_STROKE_WIDTH}
                lineDashPattern={[0]}
                zIndex={2}
              />
            )}
          </>
        )}
      </MapView>

      {/* 🔥 NAVIGATION CONTROLS - EXTRACTED COMPONENT */}
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

      {/* 🔥 DETOUR STATUS INDICATOR - shows when using detour */}
      <DetourStatusIndicator
        isActive={isUsingDetour}
        detourDescription={
          routeAnalysis?.activeDetour?.reason || "Taking alternative route"
        }
        onCancel={clearDetour}
      />

      {/* 🔥 MICRO-DETOUR MODAL - shows when safe detour is available */}
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

      {/* 🔥 OBSTACLE WARNING BANNER - shows when no detour available */}
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

// 🔥 COMPLETE STYLES with new proximity detection styles
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

  // Marker styles
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
  calloutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
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
  calloutDescription: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  validationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validationBadgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "white",
  },
});
