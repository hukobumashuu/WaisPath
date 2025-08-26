// src/screens/NavigationScreen.tsx
// FIXED: Complete NavigationScreen with Proper Detour State Management + Proximity fixes
// UPDATED: Added proximity detection reset and enhanced route visualization

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
  InteractionManager,
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

  // === SAFETY / CONCURRENCY REFS ===
  // Track in-flight obstacle detour computations to avoid duplicates
  const processingDetourIdsRef = useRef<Set<string>>(new Set());
  // Snapshot of the original fastest route before applying a detour
  const originalFastestRouteRef = useRef<any | null>(null);
  // Mounted flag to avoid state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🔥 DETOUR HANDLERS - moved to main component scope
  const handleCriticalObstacle = useCallback(
    async (alert: ProximityAlert) => {
      const obstacleId = alert?.obstacle?.id;
      if (!alert || !obstacleId) return;

      // Prevent duplicate processing for same obstacle while one request is active
      if (processingDetourIdsRef.current.has(obstacleId)) {
        if (__DEV__)
          console.log("🛑 Already processing detour for", obstacleId);
        return;
      }
      processingDetourIdsRef.current.add(obstacleId);

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

        // If component unmounted while waiting, ignore results
        if (!isMountedRef.current) return;

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
      } finally {
        // allow reprocessing later
        processingDetourIdsRef.current.delete(obstacleId);
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

        // store original fastest route snapshot once
        if (!originalFastestRouteRef.current) {
          originalFastestRouteRef.current = prev.fastestRoute;
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
            // Use InteractionManager instead of setTimeout
            InteractionManager.runAfterInteractions(() => {
              mapRef.current?.fitToCoordinates(validCoords, {
                edgePadding: { top: 120, right: 50, bottom: 200, left: 50 },
                animated: true,
              });
            });
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

      // Clear current detour data (UI-only, routeAnalysis still holds activeDetour to track)
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
    updateRouteAnalysis,
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

            // Restore the original fastest route snapshot if present
            updateRouteAnalysis((prev: any) => {
              if (!prev || !originalFastestRouteRef.current) return prev;
              const restored = {
                ...prev,
                fastestRoute: originalFastestRouteRef.current,
                activeDetour: undefined,
                comparison: {
                  ...prev.comparison,
                  recommendation: "Returned to original route",
                },
              };
              // clear snapshot after restoring
              originalFastestRouteRef.current = null;
              return restored;
            });

            console.log("🔄 Returned to original route");
          },
        },
        { text: "Keep Detour" },
      ]
    );
  }, [updateRouteAnalysis]);

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

  // Memoize routePolyline to prefer fastest route but fallback to accessible route
  const routePolyline = useMemo(() => {
    if (!routeAnalysis) return [];
    return (
      routeAnalysis.fastestRoute?.polyline ||
      routeAnalysis.accessibleRoute?.polyline ||
      []
    );
  }, [
    routeAnalysis?.fastestRoute?.polyline,
    routeAnalysis?.accessibleRoute?.polyline,
    destinationName, // Force update when destination changes
  ]);

  // Start detection automatically when navigating OR when a route exists
  const shouldDetectProximity = useMemo(() => {
    const hasValidRoute = routePolyline && routePolyline.length > 0;
    const shouldDetect = isNavigating || hasValidRoute;

    if (__DEV__ && hasValidRoute) {
      console.log("🎯 Route detected, enabling proximity detection:", {
        destination: destinationName,
        routeLength: routePolyline.length,
        shouldDetect,
      });
    }

    return shouldDetect;
  }, [isNavigating, routePolyline, destinationName]);

  // 🔥 CRITICAL FIX: Force proximity detection reset when destination changes
  useEffect(() => {
    if (destinationName && shouldDetectProximity) {
      // Force reset proximity detection when destination changes
      proximityDetectionService.resetDetectionState();
      console.log(
        "🔄 Forced proximity detection reset for new destination:",
        destinationName
      );
    }
  }, [destinationName, shouldDetectProximity]);

  // 🔥 Proximity detection state — uses shouldDetectProximity so selecting POIs restarts detection
  const proximityState = useProximityDetection({
    isNavigating: shouldDetectProximity,
    userLocation: location,
    routePolyline,
    userProfile: profile,
    onCriticalObstacle: handleCriticalObstacle,
  });

  // Debug logging in dev for proximity + route changes
  useEffect(() => {
    if (!__DEV__) return;
    console.log("📍 Proximity Debug:", {
      isNavigating,
      shouldDetectProximity,
      hasRoutePolyline: routePolyline.length > 0,
      isDetecting: proximityState.isDetecting,
      alertsCount: proximityState.proximityAlerts.length,
      destination: destinationName,
      routeLength: routePolyline.length,
    });
  }, [
    isNavigating,
    shouldDetectProximity,
    routePolyline.length,
    proximityState.isDetecting,
    proximityState.proximityAlerts.length,
    destinationName,
  ]);

  // ENHANCED: Debug route coordinates to verify distinct routes
  useEffect(() => {
    if (routeAnalysis && __DEV__) {
      const fastest = routeAnalysis.fastestRoute?.polyline || [];
      const accessible = routeAnalysis.accessibleRoute?.polyline || [];

      console.log("🗺️ Route Debug:", {
        destination: destinationName,
        fastestPoints: fastest.length,
        accessiblePoints: accessible.length,
        firstDifference: fastest.findIndex(
          (point: UserLocation, i: number) =>
            !accessible[i] ||
            Math.abs(point.latitude - accessible[i].latitude) > 0.0001 ||
            Math.abs(point.longitude - accessible[i].longitude) > 0.0001
        ),
        fastestStart: fastest.slice(0, 2),
        accessibleStart: accessible.slice(0, 2),
      });
    }
  }, [routeAnalysis, destinationName]);

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

        {/* ROUTE VISUALIZATION - ENHANCED DISTINCT STYLING */}
        {routeAnalysis && (
          <>
            {/* ACCESSIBLE ROUTE - THICK GREEN WITH DASH PATTERN (Render first, lower zIndex) */}
            {routeAnalysis.accessibleRoute?.polyline && (
              <Polyline
                coordinates={routeAnalysis.accessibleRoute.polyline}
                strokeColor="#10B981" // Bright green
                strokeWidth={8} // Thicker
                lineDashPattern={[10, 10]} // Dashed pattern to differentiate
                zIndex={1}
              />
            )}

            {/* FASTEST ROUTE - SOLID RED (Render second, higher zIndex) */}
            {routeAnalysis.fastestRoute?.polyline && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.polyline}
                strokeColor="#DC2626" // Bright red
                strokeWidth={6} // Thinner to show green underneath
                lineDashPattern={[0]} // Solid
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
