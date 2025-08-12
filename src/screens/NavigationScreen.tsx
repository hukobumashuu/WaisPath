// src/screens/NavigationScreen.tsx
// Accessible navigation with multi-route analysis, sidewalk intelligence, and obstacle validation

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Callout,
  Polyline,
} from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";

// Your existing imports
import {
  routeAnalysisService,
  DualRouteComparison,
} from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";
import { googleMapsService } from "../services/googleMapsService";
import { firebaseServices } from "../services/firebase";
import { routeFeedbackService } from "../services/routeFeedbackService";
import {
  UserLocation,
  AccessibilityObstacle,
  ObstacleType,
  RouteJourney,
} from "../types";
import RouteFeedbackModal from "../components/RouteFeedbackModal";

// NEW: Validation system imports
import {
  ValidationPrompt,
  EnhancedObstacleMarker,
} from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";

const decodePolyline = (encoded: string): UserLocation[] => {
  const points: UserLocation[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

export default function NavigationScreen() {
  const { location, loading, error, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();
  const [destination, setDestination] = useState<string>("");
  const [selectedDestination, setSelectedDestination] =
    useState<UserLocation | null>(null);

  // Existing obstacle state
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [selectedObstacle, setSelectedObstacle] =
    useState<AccessibilityObstacle | null>(null);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Existing sidewalk analysis state
  const [routeCoordinates, setRouteCoordinates] = useState<UserLocation[]>([]);
  const [sidewalkAnalysis, setSidewalkAnalysis] = useState<any>(null);
  const [analysisMode, setAnalysisMode] = useState<"original" | "sidewalk">(
    "sidewalk"
  );

  // Multi-route state
  const [routeAnalysis, setRouteAnalysis] =
    useState<DualRouteComparison | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedRouteType, setSelectedRouteType] = useState<
    "fastest" | "accessible"
  >("accessible");
  const [showRouteSelection, setShowRouteSelection] = useState(false);

  // Map loading state for low-end devices
  const [mapLoaded, setMapLoaded] = useState(false);

  // Journey tracking and feedback state
  const [activeJourney, setActiveJourney] = useState<RouteJourney | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [completedJourney, setCompletedJourney] = useState<RouteJourney | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapRetryCount, setMapRetryCount] = useState(0);

  // NEW: Validation system state
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [lastValidationCheck, setLastValidationCheck] = useState<Date>(
    new Date()
  );

  // Your existing POIs
  const pasigPOIs = [
    {
      id: "1",
      name: "Pasig City Hall",
      lat: 14.5764,
      lng: 121.0851,
      type: "government",
    },
    { id: "2", name: "The Podium", lat: 14.5657, lng: 121.0644, type: "mall" },
    {
      id: "3",
      name: "Rizal Medical Center",
      lat: 14.5739,
      lng: 121.0892,
      type: "hospital",
    },
    {
      id: "4",
      name: "Pasig General Hospital",
      lat: 14.5858,
      lng: 121.0907,
      type: "hospital",
    },
    {
      id: "5",
      name: "Ortigas Center",
      lat: 14.5866,
      lng: 121.0564,
      type: "business",
    },
    { id: "6", name: "Antipolo", lat: 14.5873, lng: 121.1759, type: "city" },
  ];

  const insets = useSafeAreaInsets();

  // Existing useEffect for loading obstacles
  React.useEffect(() => {
    if (location) {
      loadNearbyObstacles();
    }
  }, [location]);

  // Improved map loading detection
  React.useEffect(() => {
    const mapTimeout = setTimeout(() => {
      if (!mapLoaded && !mapError) {
        console.log("Map loading timeout - showing fallback");
        setMapError(true);
      }
    }, 10000);

    return () => clearTimeout(mapTimeout);
  }, [mapLoaded, mapError]);

  // Reset map error after retry attempts
  React.useEffect(() => {
    if (mapRetryCount > 2) {
      setMapError(false);
      setMapRetryCount(0);
    }
  }, [mapRetryCount]);

  // NEW: Validation system monitoring with robust polling
  useEffect(() => {
    let validationInterval: number | null = null;

    if (location && (showRouteSelection || isNavigating)) {
      // Reset session counters when navigation starts
      obstacleValidationService.resetSessionCounters();

      // Robust validation check function
      const performValidationCheck = async () => {
        try {
          // Guard against app background state
          if (!location || (!showRouteSelection && !isNavigating)) {
            return;
          }

          // Guard against poor GPS accuracy
          if (!location.accuracy || location.accuracy > 30) {
            console.log(
              "🚫 Skipping validation - poor GPS accuracy:",
              location.accuracy
            );
            return;
          }

          // Prevent overlapping calls
          if (currentValidationPrompt) {
            return;
          }

          const prompts =
            await obstacleValidationService.checkForValidationPrompts(location);

          if (prompts.length > 0 && !currentValidationPrompt) {
            setCurrentValidationPrompt(prompts[0]);
            setLastValidationCheck(new Date());

            // Haptic feedback when prompt appears
            Vibration.vibrate(100);
          }
        } catch (error) {
          console.error("❌ Validation check error:", error);
        }
      };

      // Initial check
      performValidationCheck();

      // Set up interval with proper RN timer type
      validationInterval = setInterval(
        performValidationCheck,
        10000
      ) as unknown as number;
    }

    return () => {
      if (validationInterval !== null) {
        clearInterval(validationInterval);
      }
    };
  }, [location, showRouteSelection, isNavigating, currentValidationPrompt]);

  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        5
      );
      setNearbyObstacles(obstacles);
    } catch (error) {
      console.error("Error loading obstacles:", error);
    }
  };

  const handleMapRetry = () => {
    setMapError(false);
    setMapLoaded(false);
    setMapRetryCount((prev) => prev + 1);
  };

  const getSmartRoutes = async (poi: any) => {
    if (!location) {
      Alert.alert(
        "Location Required",
        "Hindi makuha ang location mo. Subukan ulit.\n\n(Cannot get your location. Please try again.)"
      );
      return;
    }

    if (!profile) {
      Alert.alert(
        "Profile Required",
        "Please set up your accessibility profile first."
      );
      return;
    }

    setIsAnalyzing(true);
    setRouteAnalysis(null);

    try {
      const destLocation: UserLocation = {
        latitude: poi.lat,
        longitude: poi.lng,
      };

      const analysis = await routeAnalysisService.analyzeRoutes(
        location,
        destLocation,
        profile
      );

      setRouteAnalysis(analysis);
      setShowRouteSelection(true);
    } catch (error: any) {
      console.error("❌ Route analysis failed:", error);
      Alert.alert("Analysis Failed", `Error: ${error.message}`, [
        { text: "OK" },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSidewalkRoute = async (poi: any) => {
    if (!location) {
      Alert.alert(
        "Location Required",
        "Hindi makuha ang location mo. Subukan ulit.\n\n(Cannot get your location. Please try again.)"
      );
      return;
    }

    if (!profile) {
      Alert.alert(
        "Profile Required",
        "Please set up your accessibility profile first."
      );
      return;
    }

    setIsAnalyzing(true);
    setSidewalkAnalysis(null);

    try {
      const destLocation: UserLocation = {
        latitude: poi.lat,
        longitude: poi.lng,
      };

      const analysis = await sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
        location,
        destLocation,
        profile
      );

      setSidewalkAnalysis(analysis);
      setAnalysisMode("sidewalk");
    } catch (error: any) {
      console.error("❌ Sidewalk analysis failed:", error);
      Alert.alert("Analysis Failed", `Error: ${error.message}`, [
        { text: "OK" },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePOIPress = async (poi: any) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: poi.lat,
          longitude: poi.lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        1000
      );
    }

    Alert.alert(poi.name, "Choose route analysis:", [
      { text: "Cancel", style: "cancel" },
      { text: "🧠 Smart Routes", onPress: () => getSmartRoutes(poi) },
      { text: "🚶‍♂️ Sidewalk Analysis", onPress: () => getSidewalkRoute(poi) },
    ]);
  };

  const handleObstaclePress = (obstacle: AccessibilityObstacle) => {
    setSelectedObstacle(obstacle);
    setShowObstacleModal(true);
  };

  // NEW: Validation system handlers
  const handleValidationResponse = async (
    response: "still_there" | "cleared" | "skip"
  ) => {
    try {
      if (currentValidationPrompt) {
        console.log(
          `✅ User responded: ${response} for obstacle ${currentValidationPrompt.obstacleId}`
        );

        // Show feedback to user
        let message = "";
        switch (response) {
          case "still_there":
            message =
              "Salamat! Na-confirm na ang obstacle.\n\n(Thanks! Obstacle confirmed.)";
            break;
          case "cleared":
            message =
              "Salamat! Na-mark na as cleared.\n\n(Thanks! Marked as cleared.)";
            break;
          case "skip":
            message = "OK, skip lang.\n\n(Skipped validation.)";
            break;
        }

        // Reload obstacles to reflect validation changes
        await loadNearbyObstacles();

        // Optional: Show brief success message
        if (response !== "skip") {
          Alert.alert("Validation Recorded", message, [{ text: "OK" }]);
        }
      }
    } catch (error) {
      console.error("❌ Validation response error:", error);
      Alert.alert(
        "Validation Failed",
        "Hindi ma-record ang validation. Subukan ulit.\n\n(Could not record validation. Please try again.)",
        [{ text: "OK" }]
      );
    } finally {
      setCurrentValidationPrompt(null);
    }
  };

  const handleValidationDismiss = () => {
    setCurrentValidationPrompt(null);
  };

  // NEW: Enhanced obstacle markers rendering
  const renderEnhancedObstacleMarkers = () => {
    return nearbyObstacles.map((obstacle) => (
      <Marker
        key={obstacle.id}
        coordinate={{
          latitude: obstacle.location.latitude,
          longitude: obstacle.location.longitude,
        }}
      >
        <EnhancedObstacleMarker
          obstacle={obstacle}
          onPress={() => handleObstaclePress(obstacle)}
        />
      </Marker>
    ));
  };

  const getObstacleIcon = (
    type: ObstacleType
  ): keyof typeof Ionicons.glyphMap => {
    const icons: Record<ObstacleType, keyof typeof Ionicons.glyphMap> = {
      vendor_blocking: "storefront",
      parked_vehicles: "car",
      construction: "construct",
      electrical_post: "flash",
      tree_roots: "leaf",
      no_sidewalk: "warning",
      flooding: "water",
      stairs_no_ramp: "arrow-up",
      narrow_passage: "resize",
      broken_pavement: "warning",
      steep_slope: "trending-up",
      other: "help-circle",
    };
    return icons[type] || "help-circle";
  };

  const getObstacleColor = (severity: string) => {
    switch (severity) {
      case "blocking":
        return "#EF4444";
      case "high":
        return "#F97316";
      case "medium":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const startJourney = async (selectedRoute: "fastest" | "accessible") => {
    if (!location || !selectedDestination) return;

    try {
      setIsNavigating(true);
      setSelectedRouteType(selectedRoute);

      // Simplified journey start - match your RouteJourney interface
      const mockJourney: RouteJourney = {
        id: `journey_${Date.now()}`,
        userId: "current_user",
        startedAt: new Date(),
        status: "active",
        selectedRoute: {
          routeId: `route_${Date.now()}`,
          routeType: selectedRoute,
          estimatedDuration: 15, // default estimate
          accessibilityScore: {
            traversability: 70,
            safety: 70,
            comfort: 70,
            overall: 70,
            grade: "B" as const,
            userSpecificAdjustment: 0,
          },
        },
        startLocation: location,
        destinationLocation: selectedDestination,
        distanceFromDestination: 0,
        completionTriggered: false,
        feedbackSubmitted: false,
      };

      setActiveJourney(mockJourney);
      setShowRouteSelection(false);

      console.log(`🚀 Started ${selectedRoute} journey:`, mockJourney.id);
    } catch (error) {
      console.error("Failed to start journey:", error);
      Alert.alert("Journey Start Failed", "Unable to start tracking journey");
    }
  };

  const completeJourney = async () => {
    if (!activeJourney) return;

    try {
      // Simplified completion - match your RouteJourney interface
      const completedJourney: RouteJourney = {
        ...activeJourney,
        status: "completed",
        completedAt: new Date(),
        distanceFromDestination: 0,
        completionTriggered: true,
      };

      setCompletedJourney(completedJourney);
      setShowFeedbackModal(true);
      setActiveJourney(null);
      setIsNavigating(false);

      console.log("✅ Journey completed:", completedJourney.id);
    } catch (error) {
      console.error("Failed to complete journey:", error);
    }
  };

  const cancelJourney = async () => {
    if (!activeJourney) return;

    Alert.alert(
      "Cancel Journey",
      "Are you sure you want to cancel this journey?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              // Simply clear the journey state
              setActiveJourney(null);
              setIsNavigating(false);
              setShowRouteSelection(false);
            } catch (error) {
              console.error("Failed to cancel journey:", error);
            }
          },
        },
      ]
    );
  };

  const handleFeedbackSubmit = async (feedbackData: any) => {
    if (!completedJourney) return;

    try {
      // For now, just console log the feedback
      console.log("📝 Feedback submitted:", feedbackData);

      setShowFeedbackModal(false);
      setCompletedJourney(null);

      Alert.alert(
        "Feedback Submitted",
        "Thank you for helping improve WAISPATH!"
      );
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      Alert.alert("Feedback Failed", "Unable to submit feedback");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>
          Hinahanda ang mapa...\n(Loading map...)
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Location Error</Text>
        <Text style={styles.errorText}>
          Hindi makuha ang inyong location. Pakicheck ang location permissions.
          {"\n\n"}
          (Cannot get your location. Please check location permissions.)
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={getCurrentLocation}
        >
          <Text style={styles.retryButtonText}>Subukan Ulit (Try Again)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {mapError ? (
        <View style={styles.mapErrorContainer}>
          <Ionicons name="map-outline" size={64} color="#6B7280" />
          <Text style={styles.mapErrorTitle}>Map Loading Issue</Text>
          <Text style={styles.mapErrorText}>
            Hindi ma-load ang mapa. Subukan ulit.{"\n\n"}
            (Cannot load map. Please try again.)
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleMapRetry}>
            <Text style={styles.retryButtonText}>
              Retry Map ({mapRetryCount}/3)
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: location?.latitude || 14.5547,
            longitude: location?.longitude || 121.0244,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={() => {
            setMapLoaded(true);
            console.log("✅ Map loaded successfully");
          }}
          onMapLoaded={() => setMapLoaded(true)}
          showsUserLocation={true}
          showsMyLocationButton={false}
          mapType="standard"
          maxZoomLevel={18}
          minZoomLevel={10}
        >
          {/* Enhanced Obstacle Markers with Validation Status */}
          {renderEnhancedObstacleMarkers()}

          {/* POI Markers */}
          {pasigPOIs.map((poi) => (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.lat, longitude: poi.lng }}
              onPress={() => handlePOIPress(poi)}
            >
              <View style={styles.poiMarker}>
                <Ionicons
                  name={
                    poi.type === "government"
                      ? "business"
                      : poi.type === "mall"
                      ? "storefront"
                      : poi.type === "hospital"
                      ? "medical"
                      : "location"
                  }
                  size={20}
                  color="white"
                />
              </View>
              <Callout>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{poi.name}</Text>
                  <Text style={styles.calloutType}>
                    {poi.type.charAt(0).toUpperCase() + poi.type.slice(1)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}

          {/* Route visualization based on analysis mode */}
          {analysisMode === "sidewalk" && sidewalkAnalysis?.routes && (
            <>
              {sidewalkAnalysis.routes?.map((route: any, index: number) => (
                <Polyline
                  key={`sidewalk-route-${index}`}
                  coordinates={decodePolyline(route.overview_polyline.points)}
                  strokeColor={
                    index === 0
                      ? "#22C55E"
                      : index === 1
                      ? "#3B82F6"
                      : "#F59E0B"
                  }
                  strokeWidth={4}
                  lineDashPattern={index === 0 ? undefined : [10, 10]}
                />
              ))}
            </>
          )}

          {/* Smart route visualization */}
          {routeAnalysis && showRouteSelection && (
            <>
              <Polyline
                coordinates={
                  routeAnalysis.fastestRoute.googleRoute?.polyline
                    ? decodePolyline(
                        routeAnalysis.fastestRoute.googleRoute.polyline
                      )
                    : []
                }
                strokeColor="#EF4444"
                strokeWidth={selectedRouteType === "fastest" ? 6 : 4}
                lineDashPattern={
                  selectedRouteType === "fastest" ? undefined : [10, 5]
                }
              />
              <Polyline
                coordinates={
                  routeAnalysis.accessibleRoute.googleRoute?.polyline
                    ? decodePolyline(
                        routeAnalysis.accessibleRoute.googleRoute.polyline
                      )
                    : []
                }
                strokeColor="#22C55E"
                strokeWidth={selectedRouteType === "accessible" ? 6 : 4}
                lineDashPattern={
                  selectedRouteType === "accessible" ? undefined : [10, 5]
                }
              />
            </>
          )}
        </MapView>
      )}

      {/* Search and Analysis Controls */}
      <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Saan kayo pupunta? (Where are you going?)"
            value={destination}
            onChangeText={setDestination}
            placeholderTextColor="#6B7280"
          />
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Analysis Loading Overlay */}
      {isAnalyzing && (
        <View style={styles.analysisOverlay}>
          <View style={styles.analysisCard}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.analysisText}>
              Sinusuri ang mga ruta...{"\n"}
              (Analyzing routes...)
            </Text>
          </View>
        </View>
      )}

      {/* Route Selection Modal */}
      {routeAnalysis && showRouteSelection && (
        <View style={styles.routeSelectionOverlay}>
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Choose Your Route</Text>

            <View style={styles.routeOptions}>
              <TouchableOpacity
                style={[
                  styles.routeOption,
                  selectedRouteType === "fastest" && styles.selectedRoute,
                ]}
                onPress={() => setSelectedRouteType("fastest")}
              >
                <View style={styles.routeHeader}>
                  <Ionicons name="flash" size={24} color="#EF4444" />
                  <Text style={styles.routeOptionTitle}>Fastest Route</Text>
                </View>
                <Text style={styles.routeTime}>
                  {Math.round(
                    (routeAnalysis.fastestRoute.googleRoute?.duration || 0) / 60
                  )}{" "}
                  mins
                </Text>
                <Text style={styles.routeDistance}>
                  {(
                    (routeAnalysis.fastestRoute.googleRoute?.distance || 0) /
                    1000
                  ).toFixed(1)}
                  km
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.routeOption,
                  selectedRouteType === "accessible" && styles.selectedRoute,
                ]}
                onPress={() => setSelectedRouteType("accessible")}
              >
                <View style={styles.routeHeader}>
                  <Ionicons name="accessibility" size={24} color="#22C55E" />
                  <Text style={styles.routeOptionTitle}>Accessible Route</Text>
                </View>
                <Text style={styles.routeTime}>
                  {Math.round(
                    (routeAnalysis.accessibleRoute.googleRoute?.duration || 0) /
                      60
                  )}{" "}
                  mins
                </Text>
                <Text style={styles.routeDistance}>
                  {(
                    (routeAnalysis.accessibleRoute.googleRoute?.distance || 0) /
                    1000
                  ).toFixed(1)}
                  km
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routeActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRouteSelection(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => startJourney(selectedRouteType)}
              >
                <Text style={styles.startButtonText}>Start Journey</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Active Journey Controls */}
      {isNavigating && activeJourney && (
        <View style={styles.journeyControls}>
          <Text style={styles.journeyTitle}>
            {selectedRouteType === "fastest" ? "🚀" : "♿"} Journey Active
          </Text>
          <Text style={styles.journeyDetails}>
            Route:{" "}
            {selectedRouteType.charAt(0).toUpperCase() +
              selectedRouteType.slice(1)}
          </Text>
          <View style={styles.journeyActions}>
            <TouchableOpacity
              style={styles.cancelJourneyButton}
              onPress={cancelJourney}
            >
              <Text style={styles.cancelJourneyText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completeJourneyButton}
              onPress={completeJourney}
            >
              <Text style={styles.completeJourneyText}>Complete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Obstacle Detail Modal */}
      <Modal visible={showObstacleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.obstacleModal}>
            {selectedObstacle && (
              <>
                <View style={styles.obstacleHeader}>
                  <View
                    style={[
                      styles.obstacleIcon,
                      {
                        backgroundColor: getObstacleColor(
                          selectedObstacle.severity
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name={getObstacleIcon(selectedObstacle.type)}
                      size={24}
                      color="white"
                    />
                  </View>
                  <View style={styles.obstacleInfo}>
                    <Text style={styles.obstacleTitle}>
                      {selectedObstacle.type.replace("_", " ").toUpperCase()}
                    </Text>
                    <Text style={styles.obstacleSeverity}>
                      Severity: {selectedObstacle.severity}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowObstacleModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.obstacleContent}>
                  <Text style={styles.obstacleDescription}>
                    {selectedObstacle.description}
                  </Text>

                  <View style={styles.obstacleDetails}>
                    <Text style={styles.detailLabel}>Reported:</Text>
                    <Text style={styles.detailValue}>
                      {selectedObstacle.reportedAt.toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.obstacleDetails}>
                    <Text style={styles.detailLabel}>Location:</Text>
                    <Text style={styles.detailValue}>
                      {selectedObstacle.location.latitude.toFixed(6)},{" "}
                      {selectedObstacle.location.longitude.toFixed(6)}
                    </Text>
                  </View>

                  {selectedObstacle.timePattern && (
                    <View style={styles.obstacleDetails}>
                      <Text style={styles.detailLabel}>Time Pattern:</Text>
                      <Text style={styles.detailValue}>
                        {selectedObstacle.timePattern}
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.obstacleActions}>
                  <TouchableOpacity style={styles.reportButton}>
                    <Ionicons name="flag" size={16} color="#EF4444" />
                    <Text style={styles.reportButtonText}>Report Issue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.navigateButton}>
                    <Ionicons name="navigate" size={16} color="#3B82F6" />
                    <Text style={styles.navigateButtonText}>Navigate Here</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Route Feedback Modal */}
      {showFeedbackModal && completedJourney && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.obstacleModal}>
              <Text style={{ fontSize: 18, fontWeight: "bold", padding: 20 }}>
                Journey Feedback
              </Text>
              <Text style={{ padding: 20, paddingTop: 0 }}>
                How was your journey using the{" "}
                {completedJourney.selectedRoute.routeType} route?
              </Text>
              <View style={{ flexDirection: "row", padding: 20, gap: 12 }}>
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => handleFeedbackSubmit({ rating: "good" })}
                >
                  <Text style={styles.startButtonText}>Good</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowFeedbackModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* NEW: Validation Prompt Overlay */}
      {currentValidationPrompt && (
        <ValidationPrompt
          prompt={currentValidationPrompt}
          onResponse={handleValidationResponse}
          onDismiss={handleValidationDismiss}
        />
      )}

      {/* Bottom Controls */}
      <View style={[styles.bottomControls, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color="#3B82F6" />
        </TouchableOpacity>

        {sidewalkAnalysis && (
          <TouchableOpacity
            style={styles.analysisButton}
            onPress={() => {
              Alert.alert(
                "Sidewalk Analysis Results",
                `Found ${
                  sidewalkAnalysis.routes?.length || 0
                } possible routes with accessibility analysis.`,
                [{ text: "OK" }]
              );
            }}
          >
            <Ionicons name="analytics" size={24} color="#22C55E" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  mapErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  mapErrorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  mapErrorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
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
    fontSize: 16,
    color: "#1F2937",
  },
  searchButton: {
    padding: 4,
  },
  analysisOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  analysisCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    margin: 20,
  },
  analysisText: {
    marginTop: 16,
    fontSize: 16,
    color: "#1F2937",
    textAlign: "center",
  },
  routeSelectionOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 15,
  },
  routeCard: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  routeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  routeOptions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  routeOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  selectedRoute: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  routeOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginLeft: 8,
  },
  routeTime: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  routeDistance: {
    fontSize: 14,
    color: "#6B7280",
  },
  routeActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  startButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    alignItems: "center",
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  journeyControls: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  journeyDetails: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  journeyActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelJourneyButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
  },
  cancelJourneyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  completeJourneyButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
  },
  completeJourneyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#16A34A",
  },
  poiMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  calloutContainer: {
    padding: 8,
    minWidth: 120,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  calloutType: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  obstacleModal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  obstacleHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  obstacleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  obstacleInfo: {
    flex: 1,
    marginLeft: 16,
  },
  obstacleTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  obstacleSeverity: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  obstacleContent: {
    padding: 20,
    maxHeight: 300,
  },
  obstacleDescription: {
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 24,
    marginBottom: 16,
  },
  obstacleDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
    flex: 1,
    textAlign: "right",
  },
  obstacleActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  reportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 8,
  },
  navigateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    marginLeft: 8,
  },
  bottomControls: {
    position: "absolute",
    right: 16,
    flexDirection: "column",
    gap: 12,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  analysisButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
