// src/screens/NavigationScreen.tsx
// ULTIMATE WORKING VERSION - Based on successful multi-route branch

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

  // KEEP all your existing state variables
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [selectedObstacle, setSelectedObstacle] =
    useState<AccessibilityObstacle | null>(null);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  // KEEP your sidewalk analysis state
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

  // NEW: Validation system state
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);

  const insets = useSafeAreaInsets();

  // POIs data - WORKING VERSION from multi-route branch
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
  ];

  // Load obstacles function
  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      console.log("🗺️ Loading nearby obstacles...");
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        5 // 5km radius
      );
      setNearbyObstacles(obstacles);
      console.log(`✅ Loaded ${obstacles.length} obstacles`);
    } catch (error) {
      console.error("❌ Failed to load obstacles:", error);
    }
  };

  // Existing useEffect for loading obstacles
  useEffect(() => {
    if (location) {
      loadNearbyObstacles();
    }
  }, [location]);

  // NEW: Validation system monitoring
  useEffect(() => {
    let validationInterval: NodeJS.Timeout | null = null;

    if (location && (showRouteSelection || isNavigating)) {
      obstacleValidationService.resetSessionCounters();

      const performValidationCheck = async () => {
        try {
          if (!location || (!showRouteSelection && !isNavigating)) {
            return;
          }

          if (!location.accuracy || location.accuracy > 30) {
            console.log(
              "🚫 Skipping validation - poor GPS accuracy:",
              location.accuracy
            );
            return;
          }

          if (currentValidationPrompt) {
            return;
          }

          const prompts =
            await obstacleValidationService.checkForValidationPrompts(
              location,
              routeCoordinates
            );

          if (prompts.length > 0) {
            setCurrentValidationPrompt(prompts[0]);
          }
        } catch (error) {
          console.error("❌ Validation check error:", error);
        }
      };

      performValidationCheck();
      validationInterval = setInterval(performValidationCheck, 30000);
    }

    return () => {
      if (validationInterval) {
        clearInterval(validationInterval);
      }
    };
  }, [location, showRouteSelection, isNavigating, currentValidationPrompt]);

  // Helper functions - WORKING VERSION from multi-route branch
  const handlePOIPress = (poi: any) => {
    setSelectedDestination({
      latitude: poi.lat,
      longitude: poi.lng,
    });
    setDestination(poi.name);
  };

  const handleObstaclePress = (obstacle: AccessibilityObstacle) => {
    setSelectedObstacle(obstacle);
    setShowObstacleModal(true);
  };

  const getObstacleColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "#F59E0B";
      case "medium":
        return "#EF4444";
      case "high":
        return "#DC2626";
      case "blocking":
        return "#7F1D1D";
      default:
        return "#6B7280";
    }
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

  // Validation handlers
  const handleValidationResponse = async (
    response: "still_there" | "cleared" | "skip"
  ) => {
    if (!currentValidationPrompt) return;

    try {
      await obstacleValidationService.processValidationResponse(
        currentValidationPrompt.obstacleId,
        response
      );

      let message = "";
      switch (response) {
        case "still_there":
          message = "Salamat sa pagconfirm! Nakatulong ka sa PWD community.";
          break;
        case "cleared":
          message = "Salamat! Naupdate na namin na wala na ang obstacle.";
          break;
        case "skip":
          message = "";
          break;
      }

      await loadNearbyObstacles();

      if (response !== "skip") {
        Alert.alert("Validation Recorded", message, [{ text: "OK" }]);
      }
    } catch (error) {
      console.error("❌ Validation response error:", error);
      Alert.alert(
        "Validation Failed",
        "Hindi ma-record ang validation. Subukan ulit.",
        [{ text: "OK" }]
      );
    } finally {
      setCurrentValidationPrompt(null);
    }
  };

  const handleValidationDismiss = () => {
    setCurrentValidationPrompt(null);
  };

  // Loading state
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

  // Error state - ONLY show for critical errors
  if (error && !location) {
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

  // MAIN RENDER - WORKING VERSION
  return (
    <View style={styles.container}>
      {/* WORKING MAP VIEW - Exactly like multi-route branch */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
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
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="standard"
        maxZoomLevel={18}
        minZoomLevel={10}
      >
        {/* POI Markers - WORKING VERSION */}
        {pasigPOIs.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            onPress={() => handlePOIPress(poi)}
          >
            <View style={styles.poiMarker}>
              <Ionicons
                name={
                  poi.type === "hospital"
                    ? "medical"
                    : poi.type === "mall"
                    ? "storefront"
                    : poi.type === "government"
                    ? "business"
                    : "location"
                }
                size={18}
                color={
                  poi.type === "hospital"
                    ? "#EF4444"
                    : poi.type === "government"
                    ? "#8B5CF6"
                    : "#F59E0B"
                }
              />
            </View>
            <Callout>
              <Text style={styles.calloutTitle}>{poi.name}</Text>
              <Text style={styles.calloutType}>{poi.type}</Text>
            </Callout>
          </Marker>
        ))}

        {/* Obstacle markers - WORKING VERSION */}
        {nearbyObstacles.map((obstacle) => (
          <Marker
            key={obstacle.id}
            coordinate={{
              latitude: obstacle.location.latitude,
              longitude: obstacle.location.longitude,
            }}
            onPress={() => handleObstaclePress(obstacle)}
          >
            <View
              style={[
                styles.obstacleMarker,
                { backgroundColor: getObstacleColor(obstacle.severity) },
              ]}
            >
              <Ionicons
                name={getObstacleIcon(obstacle.type)}
                size={14}
                color="white"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Search Container - WORKING VERSION */}
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

      {/* Demo notice if using fallback location */}
      {error && error.includes("demo") && (
        <View style={styles.demoNotice}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={styles.demoNoticeText}>{error}</Text>
        </View>
      )}

      {/* Quick action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            Alert.alert(
              "Map Info",
              `✅ Map loaded: ${mapLoaded}\n📍 Obstacles: ${nearbyObstacles.length}\n🏢 POIs: ${pasigPOIs.length}`
            )
          }
        >
          <Ionicons name="information-circle" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#10B981" }]}
          onPress={loadNearbyObstacles}
        >
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
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

      {/* Validation Prompt Overlay - NEW */}
      {currentValidationPrompt && (
        <View style={styles.validationOverlay}>
          <ValidationPrompt
            prompt={currentValidationPrompt}
            onResponse={handleValidationResponse}
            onDismiss={handleValidationDismiss}
          />
        </View>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && completedJourney && (
        <RouteFeedbackModal
          journey={completedJourney}
          userProfile={profile}
          visible={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSubmitted={() => {
            setShowFeedbackModal(false);
            setCompletedJourney(null);
          }}
        />
      )}
    </View>
  );
}

// WORKING STYLES - Based on multi-route branch
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  demoNotice: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: "#EBF8FF",
    borderColor: "#3B82F6",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
  },
  demoNoticeText: {
    color: "#1E40AF",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
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
  poiMarker: {
    backgroundColor: "white",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3B82F6",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  obstacleMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
  },
  calloutType: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  actionButtons: {
    position: "absolute",
    right: 16,
    bottom: 100,
    zIndex: 100,
  },
  actionButton: {
    backgroundColor: "#3B82F6",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
    color: "#6B7280",
    textAlign: "center",
  },
  validationOverlay: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
});
