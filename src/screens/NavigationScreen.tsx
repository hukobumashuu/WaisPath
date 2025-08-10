// src/screens/NavigationScreen.tsx
// Accessible navigation with multi-route analysis and sidewalk intelligence

import React, { useState, useRef } from "react";
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
import { UserLocation, AccessibilityObstacle, ObstacleType, RouteJourney } from "../types";
import RouteFeedbackModal from "../components/RouteFeedbackModal";

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
  const [completedJourney, setCompletedJourney] = useState<RouteJourney | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapRetryCount, setMapRetryCount] = useState(0);

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
    }, 10000); // Reduced to 10 seconds

    return () => clearTimeout(mapTimeout);
  }, [mapLoaded, mapError]);

  // Reset map error after retry attempts
  React.useEffect(() => {
    if (mapRetryCount > 0 && mapError) {
      const retryTimeout = setTimeout(() => {
        setMapError(false);
        setMapLoaded(false);
      }, 2000);
      return () => clearTimeout(retryTimeout);
    }
  }, [mapRetryCount]);

  // Initialize journey tracking system
  React.useEffect(() => {
    const initializeFeedbackSystem = async () => {
      if (profile?.id) {
        // Load any active journey on app startup
        const existingJourney = await routeFeedbackService.loadActiveJourney(profile.id);
        if (existingJourney) {
          setActiveJourney(existingJourney);
          setIsNavigating(true);
        }
      }

      // Register callback for journey completion
      const handleJourneyCompleted = (journey: RouteJourney) => {
        setCompletedJourney(journey);
        setActiveJourney(null);
        setIsNavigating(false);
        setShowFeedbackModal(true);
      };

      routeFeedbackService.onJourneyCompleted(handleJourneyCompleted);

      // Return cleanup function
      return () => {
        routeFeedbackService.removeJourneyCompletedCallback(handleJourneyCompleted);
      };
    };

    initializeFeedbackSystem();
  }, [profile?.id]);

  // Track user location for journey completion detection
  React.useEffect(() => {
    if (activeJourney && location && isNavigating) {
      routeFeedbackService.updateLocation(location);
    }
  }, [activeJourney, location, isNavigating]);

  // Start navigation and journey tracking
  const startNavigation = async () => {
    if (!routeAnalysis || !location || !selectedDestination || !profile) {
      Alert.alert("Navigation Error", "Missing route information or location.");
      return;
    }

    try {
      const currentRoute = selectedRouteType === "fastest" 
        ? routeAnalysis.fastestRoute 
        : routeAnalysis.accessibleRoute;

      const journeyId = await routeFeedbackService.startJourney(
        profile.id,
        currentRoute.googleRoute.id,
        selectedRouteType,
        location,
        selectedDestination,
        Math.round(currentRoute.googleRoute.duration / 60),
        currentRoute.accessibilityScore
      );

      const journey = routeFeedbackService.getActiveJourney();
      setActiveJourney(journey);
      setIsNavigating(true);

      Alert.alert(
        "Navigation Started",
        `Journey tracking started! We'll ask for feedback when you reach your destination.`,
        [{ text: "OK" }]
      );

      console.log(`🎯 Navigation started for journey: ${journeyId}`);

    } catch (error) {
      console.error("Failed to start navigation:", error);
      Alert.alert("Error", "Failed to start navigation tracking.");
    }
  };

  // Stop navigation manually
  const stopNavigation = async () => {
    if (!activeJourney) return;

    try {
      const completed = await routeFeedbackService.completeJourney();
      if (completed) {
        // The journey completion callback will handle UI updates
        console.log("🏁 Journey completed manually");
      }
    } catch (error) {
      console.error("Failed to stop navigation:", error);
    }
  };

  // Handle feedback submission completion
  const handleFeedbackSubmitted = () => {
    setShowFeedbackModal(false);
    setCompletedJourney(null);
    Alert.alert(
      "Thank you!",
      "Your feedback has been submitted and will help improve route recommendations.",
      [{ text: "OK" }]
    );
  };

  // KEEP your existing functions
  const loadNearbyObstacles = async () => {
    if (!location) return;
    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        2
      );
      setNearbyObstacles(obstacles || []);
    } catch (error) {
      console.error("Failed to load nearby obstacles:", error);
    }
  };

  const handleLocationPress = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    } else {
      getCurrentLocation();
    }
  };

  // KEEP your existing search with multi-route trigger
  const handleSearch = () => {
    if (!destination.trim()) {
      Alert.alert("Search Error", "Please enter a destination to search for.");
      return;
    }

    const query = destination.toLowerCase();
    const results = pasigPOIs.filter(
      (poi) =>
        poi.name.toLowerCase().includes(query) ||
        poi.type.toLowerCase().includes(query)
    );

    if (results.length > 0) {
      const firstResult = results[0];
      const destLocation: UserLocation = {
        latitude: firstResult.lat,
        longitude: firstResult.lng,
      };

      setSelectedDestination(destLocation);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: firstResult.lat,
            longitude: firstResult.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }

      // Trigger sidewalk analysis by default (your existing behavior)
      getSidewalkRoute(firstResult);
    } else {
      Alert.alert(
        "No Results",
        `No results found for "${destination}" in Pasig area.\n\nTry searching for: City Hall, Hospital, Mall`,
        [{ text: "OK" }]
      );
    }
  };

  // Multi-route analysis function (your existing)
  const getSmartRoutes = async (poi: any) => {
    if (!location || !profile) {
      Alert.alert("Error", "Location and profile required for smart routing.");
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
      setAnalysisMode("original");
      setSelectedDestination(destLocation);
      setShowRouteSelection(false);
    } catch (error: any) {
      console.error("❌ Route analysis failed:", error);
      Alert.alert(
        "Route Analysis Failed",
        `Unable to analyze routes: ${error.message}`,
        [{ text: "OK" }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // KEEP your existing sidewalk analysis function
  const getSidewalkRoute = async (poi: any) => {
    if (!location) {
      Alert.alert("Location Error", "Current location not available.");
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

  // UPDATED: Enhanced POI press with debug options
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

  // KEEP all your existing obstacle and utility functions
  const handleObstaclePress = (obstacle: AccessibilityObstacle) => {
    setSelectedObstacle(obstacle);
    setShowObstacleModal(true);
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
        return "#EAB308";
      case "low":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  // KEEP all your existing sidewalk offset calculation functions
  const calculateBearing = (start: UserLocation, end: UserLocation): number => {
    const toRadians = (deg: number) => deg * (Math.PI / 180);
    const toDegrees = (rad: number) => rad * (180 / Math.PI);

    const dLng = toRadians(end.longitude - start.longitude);
    const lat1 = toRadians(start.latitude);
    const lat2 = toRadians(end.latitude);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
  };

  const calculatePerpendicularOffset = (
    point: UserLocation,
    bearing: number,
    distance: number,
    side: "left" | "right"
  ): UserLocation => {
    const toRadians = (deg: number) => deg * (Math.PI / 180);
    const offsetBearing =
      side === "left" ? (bearing + 90) % 360 : (bearing - 90 + 360) % 360;
    const bearingRad = toRadians(offsetBearing);

    const deltaLat = distance * Math.cos(bearingRad);
    const deltaLng = distance * Math.sin(bearingRad);

    return {
      latitude: point.latitude + deltaLat,
      longitude: point.longitude + deltaLng,
    };
  };

  const createSidewalkOffsetsFromRoute = (
    routeCoords: UserLocation[],
    offsetDistance: number = 0.00008
  ) => {
    if (routeCoords.length < 2) {
      return {
        leftSidewalk: createLeftSidewalkOffset(location!, selectedDestination!),
        rightSidewalk: createRightSidewalkOffset(
          location!,
          selectedDestination!
        ),
      };
    }

    const leftSidewalk: UserLocation[] = [];
    const rightSidewalk: UserLocation[] = [];

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const current = routeCoords[i];
      const next = routeCoords[i + 1];
      const bearing = calculateBearing(current, next);

      leftSidewalk.push(
        calculatePerpendicularOffset(current, bearing, offsetDistance, "left")
      );
      rightSidewalk.push(
        calculatePerpendicularOffset(current, bearing, offsetDistance, "right")
      );
    }

    // Add final point
    if (routeCoords.length > 1) {
      const lastIndex = routeCoords.length - 1;
      const secondLast = routeCoords[lastIndex - 1];
      const last = routeCoords[lastIndex];
      const bearing = calculateBearing(secondLast, last);

      leftSidewalk.push(
        calculatePerpendicularOffset(last, bearing, offsetDistance, "left")
      );
      rightSidewalk.push(
        calculatePerpendicularOffset(last, bearing, offsetDistance, "right")
      );
    }

    return { leftSidewalk, rightSidewalk };
  };

  // KEEP your fallback straight-line offsets
  const createLeftSidewalkOffset = (
    origin: UserLocation,
    destination: UserLocation
  ) => {
    const offset = 0.0001; // ~11 meters
    const deltaLat = destination.latitude - origin.latitude;
    const deltaLng = destination.longitude - origin.longitude;

    // Perpendicular offset for left sidewalk
    const offsetLat = deltaLng * offset;
    const offsetLng = -deltaLat * offset;

    return [
      {
        latitude: origin.latitude + offsetLat,
        longitude: origin.longitude + offsetLng,
      },
      {
        latitude: destination.latitude + offsetLat,
        longitude: destination.longitude + offsetLng,
      },
    ];
  };

  const createRightSidewalkOffset = (
    origin: UserLocation,
    destination: UserLocation
  ) => {
    const offset = 0.0001; // ~11 meters
    const deltaLat = destination.latitude - origin.latitude;
    const deltaLng = destination.longitude - origin.longitude;

    // Perpendicular offset for right sidewalk
    const offsetLat = -deltaLng * offset;
    const offsetLng = deltaLat * offset;

    return [
      {
        latitude: origin.latitude + offsetLat,
        longitude: origin.longitude + offsetLng,
      },
      {
        latitude: destination.latitude + offsetLat,
        longitude: destination.longitude + offsetLng,
      },
    ];
  };

  const getCrossingPoint = (
    origin: UserLocation,
    destination: UserLocation
  ) => {
    // Midpoint for crossing marker
    return {
      latitude: (origin.latitude + destination.latitude) / 2,
      longitude: (origin.longitude + destination.longitude) / 2,
    };
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View
        className="bg-accessible-blue pb-4 px-4"
        style={{ paddingTop: Math.max(insets.top, 12) + 12 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-white">Navigate Pasig</Text>
          <TouchableOpacity
            onPress={handleLocationPress}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel="Center on current location"
          >
            <Ionicons name="location" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center bg-white rounded-xl px-4 py-3">
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Search destinations in Pasig..."
            className="flex-1 ml-3 text-base"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={{ minHeight: 44 }}
            accessibilityLabel="Destination search"
            accessibilityHint="Enter a destination name to search for routes"
          />
          <TouchableOpacity
            onPress={handleSearch}
            style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Search for destination"
          >
            <Text className="text-accessible-blue font-semibold">Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            "Accessibility Obstacles",
            `Found ${nearbyObstacles.length} reported obstacles in this area.\n\nTap markers for details.\n\n🚫 Red: Blocking\n⚠️ Orange: High impact\n⚡ Yellow: Medium impact\n💡 Blue: Low impact`
          )
        }
        className="absolute right-4 w-12 h-12 bg-orange-500 rounded-full items-center justify-center shadow-lg z-10"
        style={{
          top: Math.max(insets.top, 12) + 120,
          minWidth: 48,
          minHeight: 48,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${nearbyObstacles.length} obstacles found nearby`}
        accessibilityHint="Tap to view obstacle information"
      >
        <Text className="text-white font-bold text-xs">
          {nearbyObstacles.length}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleLocationPress}
        className="absolute right-4 w-12 h-12 bg-blue-500 rounded-full items-center justify-center shadow-lg z-10"
        style={{
          bottom: 140 + insets.bottom,
          minWidth: 48,
          minHeight: 48,
        }}
        accessibilityRole="button"
        accessibilityLabel="Go to my location"
        accessibilityHint="Centers map on your current location"
      >
        <Ionicons name="locate" size={24} color="white" />
      </TouchableOpacity>

      {/* Optimized MapView for all device types */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || 14.5764,
          longitude: location?.longitude || 121.0851,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
        // Simplified optimizations for stability
        maxZoomLevel={17}
        minZoomLevel={11}
        rotateEnabled={false}
        pitchEnabled={false}
        // Memory management
        onMapLoaded={() => {
          console.log("Map loaded successfully");
          setMapLoaded(true);
          setMapError(false);
        }}
        onMapReady={() => {
          console.log("Map ready for interaction");
          setMapLoaded(true);
        }}
      >
        {/* KEEP all your existing markers */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Your Location"
            description="Current position"
            pinColor="#3B82F6"
          />
        )}

        {selectedDestination && (
          <Marker
            coordinate={{
              latitude: selectedDestination.latitude,
              longitude: selectedDestination.longitude,
            }}
            title="Destination"
            description="Selected destination"
            pinColor="#EF4444"
          />
        )}

        {/* Optimized POI markers - limit based on map level */}
        {pasigPOIs.slice(0, mapLoaded ? 6 : 4).map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            onPress={() => handlePOIPress(poi)}
          >
            <View className="bg-white p-2 rounded-full shadow-md border border-gray-200">
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
              <Text className="font-semibold">{poi.name}</Text>
              <Text className="text-xs text-gray-600">{poi.type}</Text>
            </Callout>
          </Marker>
        ))}

        {/* KEEP your existing obstacle markers */}
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
              className="items-center justify-center w-8 h-8 rounded-full border-2 border-white"
              style={{ backgroundColor: getObstacleColor(obstacle.severity) }}
            >
              <Ionicons
                name={getObstacleIcon(obstacle.type)}
                size={14}
                color="white"
              />
            </View>
          </Marker>
        ))}

        {/* Optimized Multi-route display - only show selected route */}
        {location &&
          selectedDestination &&
          routeAnalysis &&
          analysisMode === "original" &&
          (() => {
            // Only decode and render the selected route to improve performance
            const currentRoute =
              selectedRouteType === "fastest"
                ? routeAnalysis.fastestRoute
                : routeAnalysis.accessibleRoute;

            const routeCoords = currentRoute.googleRoute.polyline
              ? decodePolyline(currentRoute.googleRoute.polyline)
              : [];

            if (routeCoords.length === 0) return null;

            // Create sidewalk split for current route only
            const sidewalks = createSidewalkOffsetsFromRoute(
              routeCoords,
              0.00006
            );

            const colors =
              selectedRouteType === "fastest"
                ? { left: "#3B82F6", right: "#60A5FA" }
                : { left: "#10B981", right: "#34D399" };

            return (
              <>
                {/* Current Route - Split into Left and Right Sidewalks */}
                {sidewalks.leftSidewalk.length > 0 && (
                  <Polyline
                    coordinates={sidewalks.leftSidewalk}
                    strokeWidth={6}
                    strokeColor={colors.left}
                    zIndex={100}
                  />
                )}

                {sidewalks.rightSidewalk.length > 0 && (
                  <Polyline
                    coordinates={sidewalks.rightSidewalk}
                    strokeWidth={6}
                    strokeColor={colors.right}
                    zIndex={100}
                  />
                )}

                {/* Route Label */}
                {routeCoords.length > 10 && (
                  <Marker
                    coordinate={routeCoords[Math.floor(routeCoords.length / 4)]}
                    anchor={{ x: 0.5, y: 0.5 }}
                    zIndex={200}
                  >
                    <View
                      className={`px-3 py-1 rounded-full border-2 border-white shadow-lg ${
                        selectedRouteType === "fastest"
                          ? "bg-blue-500"
                          : "bg-green-500"
                      }`}
                    >
                      <Text className="text-xs font-bold text-white">
                        {selectedRouteType === "fastest"
                          ? "⚡ Fastest"
                          : "♿ Accessible"}{" "}
                        - {Math.round(currentRoute.googleRoute.duration / 60)}
                        min
                      </Text>
                    </View>
                  </Marker>
                )}
              </>
            );
          })()}

        {/* KEEP your existing sidewalk visualization */}
        {location && selectedDestination && (
          <>
            {/* Base Google route - capture coordinates */}
            <MapViewDirections
              origin={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              destination={{
                latitude: selectedDestination.latitude,
                longitude: selectedDestination.longitude,
              }}
              apikey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
              strokeWidth={2}
              strokeColor="#9CA3AF"
              mode="WALKING"
              onReady={(result) => {
                if (result.coordinates && result.coordinates.length > 0) {
                  setRouteCoordinates(result.coordinates);
                } else {
                  setRouteCoordinates([]);
                }
              }}
              onError={() => {
                setRouteCoordinates([]);
              }}
            />

            {/* Optimized Sidewalk Visualization */}
            {sidewalkAnalysis &&
              analysisMode === "sidewalk" &&
              routeCoordinates.length > 0 &&
              (() => {
                const sidewalks = createSidewalkOffsetsFromRoute(
                  routeCoordinates,
                  0.00008
                );

                const colors =
                  selectedRouteType === "fastest"
                    ? { left: "#3B82F6", right: "#60A5FA" }
                    : { left: "#10B981", right: "#34D399" };

                return (
                  <>
                    {/* Selected Sidewalk - Only show one side for performance */}
                    <Polyline
                      coordinates={
                        selectedRouteType === "fastest"
                          ? sidewalks.leftSidewalk
                          : sidewalks.rightSidewalk
                      }
                      strokeColor={
                        selectedRouteType === "fastest"
                          ? colors.left
                          : colors.right
                      }
                      strokeWidth={7}
                      zIndex={100}
                    />

                    {/* Road centerline for reference */}
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="#D1D5DB"
                      strokeWidth={2}
                      lineDashPattern={[5, 15]}
                      zIndex={10}
                    />

                    {/* Single Route Label */}
                    <Marker
                      coordinate={
                        routeCoordinates[
                          Math.floor(routeCoordinates.length / 2)
                        ]
                      }
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={180}
                    >
                      <View
                        className={`px-4 py-2 rounded-full border-2 border-white shadow-lg ${
                          selectedRouteType === "fastest"
                            ? "bg-blue-500"
                            : "bg-green-500"
                        }`}
                      >
                        <Text className="text-xs font-bold text-white">
                          {selectedRouteType === "fastest"
                            ? "🚶‍♂️ Standard"
                            : "♿ Optimized"}
                        </Text>
                      </View>
                    </Marker>

                    {/* Crossing indicator if applicable */}
                    {selectedRouteType === "accessible" &&
                      sidewalkAnalysis.comparison.crossingCount > 0 && (
                        <Marker
                          coordinate={getCrossingPoint(
                            location,
                            selectedDestination
                          )}
                          zIndex={200}
                        >
                          <View className="bg-green-500 w-10 h-10 rounded-full items-center justify-center border-2 border-white shadow-lg">
                            <Ionicons
                              name="swap-horizontal"
                              size={20}
                              color="white"
                            />
                          </View>
                        </Marker>
                      )}
                  </>
                );
              })()}
          </>
        )}
      </MapView>

      {/* Route Selection Modal */}
      <Modal
        visible={showRouteSelection}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRouteSelection(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="bg-white rounded-t-3xl p-6"
            style={{ paddingBottom: Math.max(insets.bottom, 8) + 60 + 8 }}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-gray-900">
                Choose Your Route
              </Text>
              <TouchableOpacity onPress={() => setShowRouteSelection(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {routeAnalysis && (
              <>
                {/* Fastest Route Option */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedRouteType("fastest");
                    setShowRouteSelection(false);
                  }}
                  className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <View className="bg-blue-500 p-2 rounded-full mr-3">
                        <Ionicons name="flash" size={20} color="white" />
                      </View>
                      <Text className="text-lg font-bold text-blue-900">
                        Fastest Route
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      {routeAnalysis.fastestRoute.accessibilityScore.overall <
                        40 && (
                        <View className="bg-red-500 px-2 py-1 rounded-full mr-2">
                          <Text className="text-xs font-bold text-white">
                            HIGH HAZARD
                          </Text>
                        </View>
                      )}
                      {routeAnalysis.fastestRoute.accessibilityScore.overall >=
                        40 &&
                        routeAnalysis.fastestRoute.accessibilityScore.overall <
                          60 && (
                          <View className="bg-orange-500 px-2 py-1 rounded-full mr-2">
                            <Text className="text-xs font-bold text-white">
                              MODERATE
                            </Text>
                          </View>
                        )}
                      <View className="flex-row items-center">
                        <Text className="text-2xl font-bold text-blue-600">
                          {routeAnalysis.fastestRoute.accessibilityScore.grade}
                        </Text>
                        {routeAnalysis.fastestRoute.accessibilityScore.confidence && (
                          <View className="ml-2 flex-row items-center">
                            <View
                              className={`px-1.5 py-0.5 rounded-full ${
                                routeAnalysis.fastestRoute.accessibilityScore.confidence.overall >= 80
                                  ? "bg-green-100"
                                  : routeAnalysis.fastestRoute.accessibilityScore.confidence.overall >= 60
                                  ? "bg-yellow-100"
                                  : "bg-red-100"
                              }`}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  routeAnalysis.fastestRoute.accessibilityScore.confidence.overall >= 80
                                    ? "text-green-800"
                                    : routeAnalysis.fastestRoute.accessibilityScore.confidence.overall >= 60
                                    ? "text-yellow-800"
                                    : "text-red-800"
                                }`}
                              >
                                {routeAnalysis.fastestRoute.accessibilityScore.confidence.overall}%
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-gray-600">
                      ⏱️{" "}
                      {Math.round(
                        routeAnalysis.fastestRoute.googleRoute.duration / 60
                      )}{" "}
                      min
                    </Text>
                    <Text className="text-sm text-gray-600">
                      📍{" "}
                      {(
                        routeAnalysis.fastestRoute.googleRoute.distance / 1000
                      ).toFixed(1)}{" "}
                      km
                    </Text>
                    <Text className="text-sm text-gray-600">
                      ⚠️ {routeAnalysis.fastestRoute.obstacleCount} obstacles
                    </Text>
                  </View>

                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-gray-500">
                      Accessibility:{" "}
                      {routeAnalysis.fastestRoute.accessibilityScore.overall.toFixed(
                        0
                      )}
                      /100
                    </Text>
                    <Text className="text-xs text-blue-600 font-semibold">
                      {routeAnalysis.fastestRoute.recommendation.toUpperCase()}
                    </Text>
                  </View>

                  {/* Confidence Information */}
                  {routeAnalysis.fastestRoute.accessibilityScore.confidence && (
                    <View className="mb-2 p-2 bg-gray-50 rounded-lg">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-semibold text-gray-700">
                          Data Confidence
                        </Text>
                        <Text className={`text-xs font-bold ${
                          routeAnalysis.fastestRoute.accessibilityScore.confidence.verificationStatus === "verified"
                            ? "text-green-600"
                            : routeAnalysis.fastestRoute.accessibilityScore.confidence.verificationStatus === "estimated"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}>
                          {routeAnalysis.fastestRoute.accessibilityScore.confidence.verificationStatus.toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-600">
                          {routeAnalysis.fastestRoute.accessibilityScore.confidence.lastVerified
                            ? `Verified ${Math.floor((Date.now() - new Date(routeAnalysis.fastestRoute.accessibilityScore.confidence.lastVerified).getTime()) / (1000 * 60 * 60 * 24))} days ago`
                            : `Data age: ${routeAnalysis.fastestRoute.accessibilityScore.confidence.confidenceFactors.obstacleAge} days`
                          }
                        </Text>
                        <Text className="text-xs text-gray-600">
                          {routeAnalysis.fastestRoute.accessibilityScore.confidence.communityValidation} community reports
                        </Text>
                      </View>
                    </View>
                  )}

                  {routeAnalysis.fastestRoute.userWarnings.length > 0 && (
                    <View className="mt-2 p-2 bg-yellow-100 rounded-lg">
                      <Text className="text-xs text-yellow-800">
                        ⚠️ {routeAnalysis.fastestRoute.userWarnings[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Accessible Route Option */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedRouteType("accessible");
                    setShowRouteSelection(false);
                  }}
                  className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <View className="bg-green-500 p-2 rounded-full mr-3">
                        <Ionicons
                          name="accessibility"
                          size={20}
                          color="white"
                        />
                      </View>
                      <Text className="text-lg font-bold text-green-900">
                        Most Accessible Route
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      {routeAnalysis.accessibleRoute.accessibilityScore
                        .overall < 40 && (
                        <View className="bg-red-500 px-2 py-1 rounded-full mr-2">
                          <Text className="text-xs font-bold text-white">
                            HIGH HAZARD
                          </Text>
                        </View>
                      )}
                      {routeAnalysis.accessibleRoute.accessibilityScore
                        .overall >= 40 &&
                        routeAnalysis.accessibleRoute.accessibilityScore
                          .overall < 60 && (
                          <View className="bg-orange-500 px-2 py-1 rounded-full mr-2">
                            <Text className="text-xs font-bold text-white">
                              MODERATE
                            </Text>
                          </View>
                        )}
                      <View className="flex-row items-center">
                        <Text className="text-2xl font-bold text-green-600">
                          {routeAnalysis.accessibleRoute.accessibilityScore.grade}
                        </Text>
                        {routeAnalysis.accessibleRoute.accessibilityScore.confidence && (
                          <View className="ml-2 flex-row items-center">
                            <View
                              className={`px-1.5 py-0.5 rounded-full ${
                                routeAnalysis.accessibleRoute.accessibilityScore.confidence.overall >= 80
                                  ? "bg-green-100"
                                  : routeAnalysis.accessibleRoute.accessibilityScore.confidence.overall >= 60
                                  ? "bg-yellow-100"
                                  : "bg-red-100"
                              }`}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  routeAnalysis.accessibleRoute.accessibilityScore.confidence.overall >= 80
                                    ? "text-green-800"
                                    : routeAnalysis.accessibleRoute.accessibilityScore.confidence.overall >= 60
                                    ? "text-yellow-800"
                                    : "text-red-800"
                                }`}
                              >
                                {routeAnalysis.accessibleRoute.accessibilityScore.confidence.overall}%
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-gray-600">
                      ⏱️{" "}
                      {Math.round(
                        routeAnalysis.accessibleRoute.googleRoute.duration / 60
                      )}{" "}
                      min
                    </Text>
                    <Text className="text-sm text-gray-600">
                      📍{" "}
                      {(
                        routeAnalysis.accessibleRoute.googleRoute.distance /
                        1000
                      ).toFixed(1)}{" "}
                      km
                    </Text>
                    <Text className="text-sm text-gray-600">
                      ✅ {routeAnalysis.accessibleRoute.obstacleCount} obstacles
                    </Text>
                  </View>

                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-gray-500">
                      Accessibility:{" "}
                      {routeAnalysis.accessibleRoute.accessibilityScore.overall.toFixed(
                        0
                      )}
                      /100
                    </Text>
                    <Text className="text-xs text-green-600 font-semibold">
                      {routeAnalysis.accessibleRoute.recommendation.toUpperCase()}
                    </Text>
                  </View>

                  {/* Confidence Information */}
                  {routeAnalysis.accessibleRoute.accessibilityScore.confidence && (
                    <View className="mb-2 p-2 bg-gray-50 rounded-lg">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-semibold text-gray-700">
                          Data Confidence
                        </Text>
                        <Text className={`text-xs font-bold ${
                          routeAnalysis.accessibleRoute.accessibilityScore.confidence.verificationStatus === "verified"
                            ? "text-green-600"
                            : routeAnalysis.accessibleRoute.accessibilityScore.confidence.verificationStatus === "estimated"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}>
                          {routeAnalysis.accessibleRoute.accessibilityScore.confidence.verificationStatus.toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-600">
                          {routeAnalysis.accessibleRoute.accessibilityScore.confidence.lastVerified
                            ? `Verified ${Math.floor((Date.now() - new Date(routeAnalysis.accessibleRoute.accessibilityScore.confidence.lastVerified).getTime()) / (1000 * 60 * 60 * 24))} days ago`
                            : `Data age: ${routeAnalysis.accessibleRoute.accessibilityScore.confidence.confidenceFactors.obstacleAge} days`
                          }
                        </Text>
                        <Text className="text-xs text-gray-600">
                          {routeAnalysis.accessibleRoute.accessibilityScore.confidence.communityValidation} community reports
                        </Text>
                      </View>
                    </View>
                  )}

                  {routeAnalysis.accessibleRoute.userWarnings.length === 0 ? (
                    <View className="mt-2 p-2 bg-green-100 rounded-lg">
                      <Text className="text-xs text-green-800">
                        ✅ No accessibility concerns for your {profile?.type}{" "}
                        device
                      </Text>
                    </View>
                  ) : (
                    <View className="mt-2 p-2 bg-yellow-100 rounded-lg">
                      <Text className="text-xs text-yellow-800 font-semibold mb-1">
                        ⚠️ Route Considerations:
                      </Text>
                      {routeAnalysis.accessibleRoute.userWarnings
                        .slice(0, 2)
                        .map((warning, index) => (
                          <Text key={index} className="text-xs text-yellow-700">
                            • {warning}
                          </Text>
                        ))}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Route Comparison Summary */}
                <View className="bg-gray-50 rounded-xl p-4 mb-4">
                  <Text className="text-sm font-semibold text-gray-900 mb-2">
                    📊 Route Comparison
                  </Text>
                  <View className="space-y-1">
                    <Text className="text-xs text-gray-600">
                      ⏱️ Time difference:{" "}
                      <Text className="font-semibold">
                        {Math.abs(
                          Math.round(
                            (routeAnalysis.accessibleRoute.googleRoute
                              .duration -
                              routeAnalysis.fastestRoute.googleRoute.duration) /
                              60
                          )
                        )}{" "}
                        minutes{" "}
                        {routeAnalysis.accessibleRoute.googleRoute.duration >
                        routeAnalysis.fastestRoute.googleRoute.duration
                          ? "longer"
                          : "shorter"}
                      </Text>
                    </Text>
                    <Text className="text-xs text-gray-600">
                      📏 Distance difference:{" "}
                      <Text className="font-semibold">
                        {Math.abs(
                          Math.round(
                            routeAnalysis.accessibleRoute.googleRoute.distance -
                              routeAnalysis.fastestRoute.googleRoute.distance
                          )
                        )}
                        m{" "}
                        {routeAnalysis.accessibleRoute.googleRoute.distance >
                        routeAnalysis.fastestRoute.googleRoute.distance
                          ? "longer"
                          : "shorter"}
                      </Text>
                    </Text>
                    <Text className="text-xs text-gray-600">
                      📈 Accessibility improvement:{" "}
                      <Text className="font-semibold text-green-600">
                        +
                        {Math.round(
                          Math.max(
                            0,
                            routeAnalysis.accessibleRoute.accessibilityScore
                              .overall -
                              routeAnalysis.fastestRoute.accessibilityScore
                                .overall
                          )
                        )}{" "}
                        points
                      </Text>
                    </Text>
                  </View>
                  <View className="mt-2 p-2 bg-blue-50 rounded-lg">
                    <Text className="text-xs text-blue-800">
                      💡 {routeAnalysis.routeComparison.recommendation}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Loading indicator for route analysis */}
      {isAnalyzing && (
        <View
          className="absolute left-4 right-4 bg-white rounded-xl p-4 shadow-lg z-10"
          style={{ bottom: 140 + insets.bottom }}
        >
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text className="text-gray-900 font-semibold ml-3">
              {analysisMode === "sidewalk"
                ? "Analyzing sidewalk routes..."
                : "Analyzing accessible routes..."}
            </Text>
          </View>
          <Text className="text-xs text-gray-600 mt-2">
            {analysisMode === "sidewalk"
              ? "Optimizing for sidewalk accessibility"
              : `Finding best options for ${profile?.type} users`}
          </Text>
        </View>
      )}

      {/* Route status display */}
      {(routeAnalysis || sidewalkAnalysis) && !showRouteSelection && (
        <View
          className="absolute left-4 right-4 bg-white rounded-xl p-4 shadow-lg z-10"
          style={{ bottom: 72 + insets.bottom }}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {analysisMode === "sidewalk"
                  ? selectedRouteType === "fastest"
                    ? "📍 Standard Sidewalk"
                    : "🌟 Optimized Sidewalk"
                  : selectedRouteType === "fastest"
                  ? "⚡ Fastest Route"
                  : "♿ Accessible Route"}
              </Text>
              {routeAnalysis && analysisMode === "original" && (
                <View className="ml-3">
                  {(() => {
                    const currentScore =
                      selectedRouteType === "fastest"
                        ? routeAnalysis.fastestRoute.accessibilityScore.overall
                        : routeAnalysis.accessibleRoute.accessibilityScore
                            .overall;

                    if (currentScore < 40) {
                      return (
                        <View className="bg-red-500 px-2 py-1 rounded-full">
                          <Text className="text-xs font-bold text-white">
                            HIGH HAZARD
                          </Text>
                        </View>
                      );
                    } else if (currentScore < 60) {
                      return (
                        <View className="bg-orange-500 px-2 py-1 rounded-full">
                          <Text className="text-xs font-bold text-white">
                            MODERATE
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setRouteAnalysis(null);
                setSidewalkAnalysis(null);
              }}
              className="w-8 h-8 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Sidewalk Analysis Display */}
          {sidewalkAnalysis && analysisMode === "sidewalk" && (
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600">
                    Grade{" "}
                    {selectedRouteType === "fastest"
                      ? sidewalkAnalysis.standardRoute.overallScore.grade
                      : sidewalkAnalysis.optimizedRoute.overallScore.grade}{" "}
                    •{" "}
                    {selectedRouteType === "fastest"
                      ? sidewalkAnalysis.standardRoute.segments[0].obstacles
                          .length
                      : sidewalkAnalysis.optimizedRoute.segments[0].obstacles
                          .length}{" "}
                    obstacles
                    {selectedRouteType === "accessible" &&
                      sidewalkAnalysis.comparison.crossingCount > 0 &&
                      ` • ${sidewalkAnalysis.comparison.crossingCount} crossing(s)`}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {Math.round(
                      (selectedRouteType === "fastest"
                        ? sidewalkAnalysis.standardRoute.totalTime
                        : sidewalkAnalysis.optimizedRoute.totalTime) / 60
                    )}
                    min •
                    {(
                      (selectedRouteType === "fastest"
                        ? sidewalkAnalysis.standardRoute.totalDistance
                        : sidewalkAnalysis.optimizedRoute.totalDistance) / 1000
                    ).toFixed(1)}
                    km
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setSelectedRouteType(
                      selectedRouteType === "fastest" ? "accessible" : "fastest"
                    )
                  }
                  className={`px-3 py-2 rounded-lg ${
                    selectedRouteType === "accessible"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                >
                  <Text className="text-white text-sm font-semibold">
                    {selectedRouteType === "fastest"
                      ? "Try Optimized"
                      : "Try Standard"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sidewalk Intelligence Summary */}
              {selectedRouteType === "accessible" &&
                sidewalkAnalysis.comparison.obstacleReduction > 0 && (
                  <View className="bg-green-50 p-3 rounded-lg mt-2">
                    <Text className="text-green-800 text-sm font-semibold">
                      🌟 Sidewalk Intelligence Active
                    </Text>
                    <Text className="text-green-700 text-xs mt-1">
                      Avoids {sidewalkAnalysis.comparison.obstacleReduction}{" "}
                      obstacles through strategic crossing
                    </Text>
                  </View>
                )}
            </View>
          )}

          {/* AHP Analysis Display */}
          {routeAnalysis && analysisMode === "original" && (
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600">
                    Grade{" "}
                    {selectedRouteType === "fastest"
                      ? routeAnalysis.fastestRoute.accessibilityScore.grade
                      : routeAnalysis.accessibleRoute.accessibilityScore
                          .grade}{" "}
                    •{" "}
                    {selectedRouteType === "fastest"
                      ? routeAnalysis.fastestRoute.obstacleCount
                      : routeAnalysis.accessibleRoute.obstacleCount}{" "}
                    obstacles
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {Math.round(
                      (selectedRouteType === "fastest"
                        ? routeAnalysis.fastestRoute.googleRoute.duration
                        : routeAnalysis.accessibleRoute.googleRoute.duration) /
                        60
                    )}{" "}
                    min •
                    {(
                      (selectedRouteType === "fastest"
                        ? routeAnalysis.fastestRoute.googleRoute.distance
                        : routeAnalysis.accessibleRoute.googleRoute.distance) /
                      1000
                    ).toFixed(1)}{" "}
                    km
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowRouteSelection(true)}
                  className="bg-blue-500 px-4 py-2 rounded-lg ml-3"
                >
                  <Text className="text-white text-sm font-semibold">
                    Switch
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Accessibility Warnings */}
              {routeAnalysis &&
                (() => {
                  const currentRoute =
                    selectedRouteType === "fastest"
                      ? routeAnalysis.fastestRoute
                      : routeAnalysis.accessibleRoute;

                  return (
                    currentRoute.userWarnings &&
                    currentRoute.userWarnings.length > 0 && (
                      <View className="bg-yellow-100 rounded-lg p-3 mt-2">
                        <Text className="text-xs text-yellow-800 font-semibold mb-1">
                          ⚠️ Accessibility Alerts:
                        </Text>
                        {currentRoute.userWarnings
                          .slice(0, 2)
                          .map((warning, index) => (
                            <Text
                              key={index}
                              className="text-xs text-yellow-700"
                            >
                              • {warning}
                            </Text>
                          ))}
                      </View>
                    )
                  );
                })()}
            </View>
          )}

          {/* Quick Actions */}
          <View className="flex-row mt-3 space-x-2">
            <TouchableOpacity
              onPress={isNavigating ? stopNavigation : startNavigation}
              className={`flex-1 py-2 px-3 rounded-lg mr-2 ${
                isNavigating 
                  ? "bg-red-500" 
                  : "bg-green-500"
              }`}
              accessibilityRole="button"
              accessibilityLabel={isNavigating ? "Stop navigation and complete journey" : "Start navigation with selected route"}
              style={{ minHeight: 44 }}
            >
              <Text className="text-center text-sm font-semibold text-white">
                {isNavigating ? "🏁 Complete Journey" : "🚶‍♂️ Start Navigation"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-gray-100 py-2 px-3 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Report accessibility issue"
              style={{ minHeight: 44 }}
            >
              <Text className="text-center text-sm font-semibold text-gray-700">
                🚩 Report Issue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Obstacle details modal */}
      <Modal
        visible={showObstacleModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowObstacleModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-4">
          <View className="bg-white rounded-xl p-6 w-full max-w-sm">
            {selectedObstacle && (
              <>
                <View className="flex-row items-center mb-4">
                  <View
                    className="p-3 rounded-full mr-3"
                    style={{
                      backgroundColor: getObstacleColor(
                        selectedObstacle.severity
                      ),
                    }}
                  >
                    <Ionicons
                      name={getObstacleIcon(selectedObstacle.type)}
                      size={24}
                      color="white"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 capitalize">
                      {selectedObstacle.type.replace("_", " ")}
                    </Text>
                    <Text className="text-sm text-gray-600 capitalize">
                      {selectedObstacle.severity} severity
                    </Text>
                  </View>
                </View>

                <Text className="text-sm text-gray-700 mb-4">
                  {selectedObstacle.description}
                </Text>

                <View className="flex-row justify-between mb-4">
                  <Text className="text-xs text-gray-500">
                    👍 {selectedObstacle.upvotes || 0} upvotes
                  </Text>
                  <Text className="text-xs text-gray-500">
                    📅{" "}
                    {new Date(selectedObstacle.reportedAt).toLocaleDateString()}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {selectedObstacle.verified ? "✅ Verified" : "⏳ Pending"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowObstacleModal(false)}
                  className="bg-blue-500 py-3 rounded-xl"
                  accessibilityRole="button"
                  accessibilityLabel="Close obstacle details"
                  style={{ minHeight: 44 }}
                >
                  <Text className="text-center text-white font-semibold">
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Map Loading Fallback for Low-End Devices */}
      {mapError && (
        <View
          className="absolute inset-0 bg-gray-100 flex items-center justify-center z-20"
          style={{ top: Math.max(insets.top, 12) + 100 }}
        >
          <View className="bg-white rounded-xl p-6 m-4 shadow-lg max-w-sm">
            <View className="items-center mb-4">
              <Ionicons name="map" size={48} color="#6B7280" />
              <Text className="text-xl font-bold text-gray-900 mt-2 text-center">
                Map Loading Issue
              </Text>
            </View>

            <Text className="text-gray-600 text-center mb-4">
              The map is having trouble loading on your device. This is common
              on some Android devices.
            </Text>

            <View className="space-y-3">
              <TouchableOpacity
                onPress={() => {
                  setMapError(false);
                  setMapRetryCount((prev) => prev + 1);
                  console.log(
                    `Retrying map load (attempt ${mapRetryCount + 1})`
                  );
                }}
                className="bg-blue-500 py-3 px-6 rounded-lg"
                style={{ minHeight: 44 }}
              >
                <Text className="text-white font-semibold text-center">
                  🔄 Retry Map ({mapRetryCount + 1}/3)
                </Text>
              </TouchableOpacity>

              {mapRetryCount >= 2 && (
                <View className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <Text className="text-yellow-800 text-sm font-semibold mb-2">
                    💡 Alternative Options:
                  </Text>
                  <Text className="text-yellow-700 text-sm">
                    • Use the search box above to find destinations
                    {"\n"}• POI locations will still work
                    {"\n"}• Route analysis features available
                    {"\n"}• Try updating Google Play Services
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Error and warning states */}
      {error && (
        <View
          className="absolute left-4 right-4 bg-red-100 rounded-xl p-4 z-10"
          style={{ top: Math.max(insets.top, 12) + 120 }}
        >
          <Text className="text-red-800 text-center text-base">{error}</Text>
        </View>
      )}

      {!profile && (
        <View
          className="absolute left-4 right-4 bg-yellow-100 rounded-xl p-4 z-10"
          style={{ top: Math.max(insets.top, 12) + 120 }}
        >
          <Text className="text-yellow-800 text-center font-semibold text-base">
            ⚠️ Set up your profile for personalized routes
          </Text>
        </View>
      )}

      {/* Route Feedback Modal */}
      <RouteFeedbackModal
        visible={showFeedbackModal}
        journey={completedJourney}
        userProfile={profile}
        onClose={() => setShowFeedbackModal(false)}
        onSubmitted={handleFeedbackSubmitted}
      />
    </View>
  );
}

// KEEP your existing StyleSheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  map: {
    flex: 1,
  },
});
