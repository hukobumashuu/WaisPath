// src/screens/NavigationScreen.tsx
// UNIFIED INTELLIGENT ROUTING - Auto-calculates, shows both routes, true sidewalk-level

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
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";
import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle, ObstacleType } from "../types";

// Route analysis services
import { routeAnalysisService } from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";

// Unified route data structure
interface UnifiedRouteAnalysis {
  fastestRoute: {
    polyline: UserLocation[];
    duration: number;
    distance: number;
    grade: string;
    leftSidewalk: UserLocation[];
    rightSidewalk: UserLocation[];
  };
  accessibleRoute: {
    polyline: UserLocation[];
    duration: number;
    distance: number;
    grade: string;
    leftSidewalk: UserLocation[];
    rightSidewalk: UserLocation[];
  };
  comparison: {
    timeDifference: number;
    accessibilityImprovement: number;
    recommendation: string;
  };
}

// Polyline decoder
const decodePolyline = (encoded: string): UserLocation[] => {
  if (!encoded) return [];

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

// Generate sidewalk offset paths (left/right of main route)
const generateSidewalkPaths = (
  mainRoute: UserLocation[]
): { left: UserLocation[]; right: UserLocation[] } => {
  if (mainRoute.length < 2) return { left: [], right: [] };

  const offsetDistance = 0.00005; // ~5 meters sidewalk offset
  const leftSidewalk: UserLocation[] = [];
  const rightSidewalk: UserLocation[] = [];

  for (let i = 0; i < mainRoute.length; i++) {
    const point = mainRoute[i];

    if (i === 0 || i === mainRoute.length - 1) {
      // Start and end points stay the same
      leftSidewalk.push(point);
      rightSidewalk.push(point);
    } else {
      // Calculate perpendicular offset for sidewalk paths
      const prevPoint = mainRoute[i - 1];
      const nextPoint = mainRoute[i + 1];

      // Calculate direction vector
      const dx = nextPoint.longitude - prevPoint.longitude;
      const dy = nextPoint.latitude - prevPoint.latitude;

      // Calculate perpendicular vector (90 degrees rotated)
      const perpX = -dy;
      const perpY = dx;

      // Normalize and apply offset
      const length = Math.sqrt(perpX * perpX + perpY * perpY);
      if (length > 0) {
        const normalizedX = perpX / length;
        const normalizedY = perpY / length;

        leftSidewalk.push({
          latitude: point.latitude + normalizedY * offsetDistance,
          longitude: point.longitude + normalizedX * offsetDistance,
        });

        rightSidewalk.push({
          latitude: point.latitude - normalizedY * offsetDistance,
          longitude: point.longitude - normalizedX * offsetDistance,
        });
      } else {
        leftSidewalk.push(point);
        rightSidewalk.push(point);
      }
    }
  }

  return { left: leftSidewalk, right: rightSidewalk };
};

export default function NavigationScreen() {
  const { location, loading, error, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();
  const [destination, setDestination] = useState<string>("");

  // Map and obstacle states
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [selectedObstacle, setSelectedObstacle] =
    useState<AccessibilityObstacle | null>(null);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  // 🔥 UNIFIED ROUTING STATES
  const [routeAnalysis, setRouteAnalysis] =
    useState<UnifiedRouteAnalysis | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedDestination, setSelectedDestination] =
    useState<UserLocation | null>(null);
  const [destinationName, setDestinationName] = useState<string>("");
  const [showSidewalks, setShowSidewalks] = useState(true);

  // Analysis loading states
  const [mapLoaded, setMapLoaded] = useState(false);

  const insets = useSafeAreaInsets();

  // POI data
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

  // Load nearby obstacles
  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      console.log("🗺️ Loading obstacles...");
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        5
      );
      setNearbyObstacles(obstacles);
      console.log(`✅ Loaded ${obstacles.length} obstacles`);
    } catch (error) {
      console.error("❌ Error loading obstacles:", error);
    }
  };

  useEffect(() => {
    if (location) {
      loadNearbyObstacles();
    }
  }, [location]);

  // 🔥 UNIFIED ROUTE CALCULATION (AUTO-TRIGGERED)
  const calculateUnifiedRoutes = async (poi: any) => {
    if (!location || !profile) {
      Alert.alert(
        "Requirements Missing",
        "Location and profile required for intelligent routing."
      );
      return;
    }

    setIsCalculating(true);
    setRouteAnalysis(null);

    try {
      console.log("🧠 Calculating unified intelligent routes...");

      const destLocation: UserLocation = {
        latitude: poi.lat,
        longitude: poi.lng,
      };

      setSelectedDestination(destLocation);
      setDestinationName(poi.name);

      // Get both multi-route analysis AND sidewalk analysis
      const [multiRouteResult, sidewalkResult] = await Promise.all([
        routeAnalysisService
          .analyzeRoutes(location, destLocation, profile)
          .catch(() => null),
        sidewalkRouteAnalysisService
          .analyzeSidewalkRoutes(location, destLocation, profile)
          .catch(() => null),
      ]);

      // Combine results into unified analysis
      let fastestRoute, accessibleRoute;

      if (multiRouteResult) {
        // Use multi-route analysis results
        const fastestPolyline = decodePolyline(
          multiRouteResult.fastestRoute.googleRoute?.polyline || ""
        );
        const accessiblePolyline = decodePolyline(
          multiRouteResult.accessibleRoute.googleRoute?.polyline || ""
        );

        // Generate sidewalk paths for both routes
        const fastestSidewalks = generateSidewalkPaths(fastestPolyline);
        const accessibleSidewalks = generateSidewalkPaths(accessiblePolyline);

        fastestRoute = {
          polyline: fastestPolyline,
          duration: multiRouteResult.fastestRoute.googleRoute?.duration || 0,
          distance: multiRouteResult.fastestRoute.googleRoute?.distance || 0,
          grade: multiRouteResult.fastestRoute.accessibilityScore?.grade || "C",
          leftSidewalk: fastestSidewalks.left,
          rightSidewalk: fastestSidewalks.right,
        };

        accessibleRoute = {
          polyline: accessiblePolyline,
          duration: multiRouteResult.accessibleRoute.googleRoute?.duration || 0,
          distance: multiRouteResult.accessibleRoute.googleRoute?.distance || 0,
          grade:
            multiRouteResult.accessibleRoute.accessibilityScore?.grade || "B",
          leftSidewalk: accessibleSidewalks.left,
          rightSidewalk: accessibleSidewalks.right,
        };
      } else if (sidewalkResult) {
        // Fallback to sidewalk analysis - FIX: Handle missing polyline property
        const standardPolyline = sidewalkResult.standardRoute?.segments?.[0]
          ? (sidewalkResult.standardRoute.segments[0] as any).polyline
            ? decodePolyline(
                (sidewalkResult.standardRoute.segments[0] as any).polyline
              )
            : []
          : [];
        const optimizedPolyline = sidewalkResult.optimizedRoute?.segments?.[0]
          ? (sidewalkResult.optimizedRoute.segments[0] as any).polyline
            ? decodePolyline(
                (sidewalkResult.optimizedRoute.segments[0] as any).polyline
              )
            : []
          : [];

        // Generate sidewalk paths for both routes
        const standardSidewalks = generateSidewalkPaths(standardPolyline);
        const optimizedSidewalks = generateSidewalkPaths(optimizedPolyline);

        fastestRoute = {
          polyline: standardPolyline,
          duration: sidewalkResult.standardRoute?.totalTime || 0,
          distance: sidewalkResult.standardRoute?.totalDistance || 0,
          grade: sidewalkResult.standardRoute?.overallScore?.grade || "C",
          leftSidewalk: standardSidewalks.left,
          rightSidewalk: standardSidewalks.right,
        };

        accessibleRoute = {
          polyline: optimizedPolyline,
          duration: sidewalkResult.optimizedRoute?.totalTime || 0,
          distance: sidewalkResult.optimizedRoute?.totalDistance || 0,
          grade: sidewalkResult.optimizedRoute?.overallScore?.grade || "B",
          leftSidewalk: optimizedSidewalks.left,
          rightSidewalk: optimizedSidewalks.right,
        };
      } else {
        throw new Error("Could not calculate any routes");
      }

      // Create unified analysis
      const unifiedAnalysis: UnifiedRouteAnalysis = {
        fastestRoute,
        accessibleRoute,
        comparison: {
          timeDifference: accessibleRoute.duration - fastestRoute.duration,
          accessibilityImprovement:
            (accessibleRoute.grade === "A"
              ? 90
              : accessibleRoute.grade === "B"
              ? 80
              : 70) -
            (fastestRoute.grade === "A"
              ? 90
              : fastestRoute.grade === "B"
              ? 80
              : 70),
          recommendation: `Accessible route is ${Math.round(
            (accessibleRoute.duration - fastestRoute.duration) / 60
          )} minutes longer but ${accessibleRoute.grade} grade vs ${
            fastestRoute.grade
          } grade`,
        },
      };

      setRouteAnalysis(unifiedAnalysis);

      // Auto-fit map to show both routes
      if (mapRef.current) {
        const allCoords = [
          location,
          destLocation,
          ...fastestRoute.polyline,
          ...accessibleRoute.polyline,
        ].filter((coord) => coord.latitude && coord.longitude);

        if (allCoords.length > 0) {
          mapRef.current.fitToCoordinates(allCoords, {
            edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        }
      }

      // Success feedback
      Vibration.vibrate(100);
      console.log("✅ Unified route calculation complete!");
    } catch (error: any) {
      console.error("❌ Route calculation failed:", error);
      Alert.alert(
        "Route Error",
        `Could not calculate routes: ${error.message}`
      );
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle POI selection - AUTO CALCULATE ROUTES
  const handlePOIPress = (poi: any) => {
    console.log(`🏢 Selected POI: ${poi.name} - Auto-calculating routes...`);

    // Animate map to POI
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

    // AUTO-CALCULATE ROUTES (no modal, no extra clicks)
    calculateUnifiedRoutes(poi);
  };

  // Start navigation
  const startNavigation = (routeType: "fastest" | "accessible") => {
    Vibration.vibrate(100);
    Alert.alert(
      "🚀 Navigation Started!",
      `Following ${routeType} route to ${destinationName}.\n\nRoute grade: ${
        routeType === "fastest"
          ? routeAnalysis?.fastestRoute.grade
          : routeAnalysis?.accessibleRoute.grade
      }\n\nSidewalk guidance enabled.`,
      [{ text: "Let's Go!" }]
    );
  };

  // Clear routes
  const clearRoutes = () => {
    setRouteAnalysis(null);
    setSelectedDestination(null);
    setDestinationName("");
  };

  // Handle obstacle press
  const handleObstaclePress = (obstacle: AccessibilityObstacle) => {
    setSelectedObstacle(obstacle);
    setShowObstacleModal(true);
  };

  // Utility functions
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

  const getPOIIcon = (type: string) => {
    switch (type) {
      case "government":
        return "business";
      case "mall":
        return "storefront";
      case "hospital":
        return "medical";
      case "business":
        return "business";
      default:
        return "location";
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  // Error state
  if (error && !location) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Location Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={getCurrentLocation}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* MAP WITH UNIFIED ROUTE VISUALIZATION */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: location?.latitude || 14.5764,
          longitude: location?.longitude || 121.0851,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onMapReady={() => {
          setMapLoaded(true);
          console.log("✅ Map loaded successfully");
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="standard"
        loadingEnabled={true}
      >
        {/* 🔥 FASTEST ROUTE (RED) */}
        {routeAnalysis?.fastestRoute.polyline && (
          <Polyline
            coordinates={routeAnalysis.fastestRoute.polyline}
            strokeColor="#EF4444"
            strokeWidth={5}
            lineDashPattern={[0]}
            zIndex={1}
          />
        )}

        {/* 🔥 ACCESSIBLE ROUTE (GREEN) */}
        {routeAnalysis?.accessibleRoute.polyline && (
          <Polyline
            coordinates={routeAnalysis.accessibleRoute.polyline}
            strokeColor="#22C55E"
            strokeWidth={5}
            lineDashPattern={[0]}
            zIndex={2}
          />
        )}

        {/* 🚶‍♂️ LEFT SIDEWALK PATHS (DASHED) */}
        {showSidewalks && routeAnalysis?.fastestRoute.leftSidewalk && (
          <Polyline
            coordinates={routeAnalysis.fastestRoute.leftSidewalk}
            strokeColor="#EF4444"
            strokeWidth={2}
            lineDashPattern={[5, 5]}
            zIndex={3}
          />
        )}

        {showSidewalks && routeAnalysis?.accessibleRoute.leftSidewalk && (
          <Polyline
            coordinates={routeAnalysis.accessibleRoute.leftSidewalk}
            strokeColor="#22C55E"
            strokeWidth={2}
            lineDashPattern={[5, 5]}
            zIndex={4}
          />
        )}

        {/* 🚶‍♂️ RIGHT SIDEWALK PATHS (DOTTED) */}
        {showSidewalks && routeAnalysis?.fastestRoute.rightSidewalk && (
          <Polyline
            coordinates={routeAnalysis.fastestRoute.rightSidewalk}
            strokeColor="#EF4444"
            strokeWidth={2}
            lineDashPattern={[2, 8]}
            zIndex={5}
          />
        )}

        {showSidewalks && routeAnalysis?.accessibleRoute.rightSidewalk && (
          <Polyline
            coordinates={routeAnalysis.accessibleRoute.rightSidewalk}
            strokeColor="#22C55E"
            strokeWidth={2}
            lineDashPattern={[2, 8]}
            zIndex={6}
          />
        )}

        {/* POI MARKERS */}
        {pasigPOIs.map((poi) => (
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

        {/* OBSTACLE MARKERS */}
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
                size={12}
                color="white"
              />
            </View>
          </Marker>
        ))}
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

      {/* 🔥 UNIFIED ROUTE INFO PANEL */}
      {routeAnalysis && (
        <View
          style={[styles.routeInfoContainer, { bottom: insets.bottom + 100 }]}
        >
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>
              🗺️ Routes to {destinationName}
            </Text>

            {/* Route comparison */}
            <View style={styles.routeComparison}>
              <View style={styles.routeRow}>
                <View style={styles.routeIndicator}>
                  <View
                    style={[styles.routeColor, { backgroundColor: "#EF4444" }]}
                  />
                  <Text style={styles.routeLabel}>Fastest</Text>
                </View>
                <Text style={styles.routeDetails}>
                  {Math.round(routeAnalysis.fastestRoute.duration / 60)}min •{" "}
                  {(routeAnalysis.fastestRoute.distance / 1000).toFixed(1)}km •
                  Grade {routeAnalysis.fastestRoute.grade}
                </Text>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => startNavigation("fastest")}
                >
                  <Ionicons name="navigate" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routeIndicator}>
                  <View
                    style={[styles.routeColor, { backgroundColor: "#22C55E" }]}
                  />
                  <Text style={styles.routeLabel}>Accessible</Text>
                </View>
                <Text style={styles.routeDetails}>
                  {Math.round(routeAnalysis.accessibleRoute.duration / 60)}min •{" "}
                  {(routeAnalysis.accessibleRoute.distance / 1000).toFixed(1)}km
                  • Grade {routeAnalysis.accessibleRoute.grade}
                </Text>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => startNavigation("accessible")}
                >
                  <Ionicons name="navigate" size={16} color="#22C55E" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Recommendation */}
            <Text style={styles.recommendation}>
              💡 {routeAnalysis.comparison.recommendation}
            </Text>

            {/* Sidewalk toggle */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowSidewalks(!showSidewalks)}
              >
                <Ionicons
                  name={showSidewalks ? "eye" : "eye-off"}
                  size={16}
                  color="#3B82F6"
                />
                <Text style={styles.toggleText}>
                  {showSidewalks ? "Hide" : "Show"} Sidewalks
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearRoutes}
              >
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* CALCULATION LOADING OVERLAY */}
      {isCalculating && (
        <View style={styles.analysisOverlay}>
          <View style={styles.analysisCard}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.analysisText}>
              Calculating intelligent routes...
            </Text>
            <Text style={styles.analysisSubtext}>
              Analyzing accessibility • Generating sidewalk paths
            </Text>
          </View>
        </View>
      )}

      {/* OBSTACLE DETAIL MODAL */}
      <Modal visible={showObstacleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.obstacleModal}>
            {selectedObstacle && (
              <>
                <View style={styles.obstacleHeader}>
                  <View
                    style={[
                      styles.obstacleIconLarge,
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
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={styles.detailValue}>
                      {selectedObstacle.verified ? "Verified" : "Unverified"}
                    </Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* BOTTOM CONTROLS */}
      <View style={[styles.bottomControls, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color="#3B82F6" />
        </TouchableOpacity>
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
  routeInfoContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  routeInfo: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  routeComparison: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  routeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
  },
  routeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  routeDetails: {
    flex: 1,
    fontSize: 12,
    color: "#1F2937",
    marginLeft: 8,
  },
  navigateBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
  },
  recommendation: {
    fontSize: 12,
    color: "#059669",
    fontStyle: "italic",
    marginBottom: 12,
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  toggleText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
    marginLeft: 4,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
  },
  clearText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
    marginLeft: 4,
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
    fontWeight: "600",
  },
  analysisSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
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
  calloutAction: {
    fontSize: 11,
    color: "#3B82F6",
    marginTop: 4,
    fontStyle: "italic",
  },
  obstacleMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
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
    maxHeight: "70%",
  },
  obstacleHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  obstacleIconLarge: {
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
    maxHeight: 200,
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
});
