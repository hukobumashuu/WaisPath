// src/screens/NavigationScreen.tsx
// FIXED: Working map + sidewalk integration with street-following routes
// Keep all existing map code, only update the route analysis service

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

// UPDATED IMPORTS: Use both services for compatibility
import {
  routeAnalysisService,
  DualRouteComparison,
} from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";

import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle, ObstacleType } from "../types";

export default function NavigationScreen() {
  const { location, loading, error, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();
  const [destination, setDestination] = useState<string>("");
  const [selectedDestination, setSelectedDestination] =
    useState<UserLocation | null>(null);
  const [routeAnalysis, setRouteAnalysis] =
    useState<DualRouteComparison | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedRouteType, setSelectedRouteType] = useState<
    "fastest" | "accessible"
  >("accessible");
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [selectedObstacle, setSelectedObstacle] =
    useState<AccessibilityObstacle | null>(null);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  // NEW: State for actual route coordinates
  const [routeCoordinates, setRouteCoordinates] = useState<UserLocation[]>([]);
  const [sidewalkAnalysis, setSidewalkAnalysis] = useState<any>(null);
  const [analysisMode, setAnalysisMode] = useState<"original" | "sidewalk">(
    "sidewalk"
  );

  // Sample POIs in Pasig (keep your existing ones)
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
    {
      id: "6",
      name: "Antipolo",
      lat: 14.5873,
      lng: 121.1759,
      type: "city",
    },
  ];

  // Load obstacles near current location when component mounts or location changes
  React.useEffect(() => {
    if (location) {
      loadNearbyObstacles();
    }
  }, [location]);

  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      console.log("🔍 Loading obstacles near current location...");
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        2 // 2km radius for obstacle display
      );

      setNearbyObstacles(obstacles || []);
      console.log(`📍 Found ${obstacles?.length || 0} obstacles nearby`);
    } catch (error) {
      console.error("⚠️ Failed to load nearby obstacles:", error);
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

      // NEW: Auto-trigger sidewalk analysis (the revolutionary feature)
      getSidewalkRoute(firstResult);
    } else {
      Alert.alert(
        "No Results",
        `No results found for "${destination}" in Pasig area.\n\nTry searching for:\n• City Hall\n• Hospital\n• Mall`,
        [{ text: "OK" }]
      );
    }
  };

  // ORIGINAL AHP Route Analysis (keep for compatibility)
  const getAHPRoute = async (poi: any) => {
    if (!location) {
      Alert.alert("Location Error", "Current location not available.");
      return;
    }

    if (!profile) {
      Alert.alert(
        "Profile Required",
        "Please set up your accessibility profile first for personalized routes."
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisMode("original");

    try {
      console.log("🚀 Getting original AHP route analysis...");

      const destination = { latitude: poi.lat, longitude: poi.lng };
      const analysis = await routeAnalysisService.analyzeRoutes(
        location,
        destination,
        profile
      );

      setRouteAnalysis(analysis);
      setSidewalkAnalysis(null); // Clear sidewalk analysis
      setSelectedDestination(destination);

      // Show route comparison
      Alert.alert(
        `🧠 Original AHP Routes to ${poi.name}`,
        `⚡ Fastest: ${Math.round(
          analysis.fastestRoute.googleRoute.duration / 60
        )}min (Grade ${analysis.fastestRoute.accessibilityScore.grade})\n` +
          `♿ Accessible: ${Math.round(
            analysis.accessibleRoute.googleRoute.duration / 60
          )}min (Grade ${
            analysis.accessibleRoute.accessibilityScore.grade
          })\n\n` +
          `${analysis.routeComparison.recommendation}`,
        [
          {
            text: "Use Fastest",
            onPress: () => setSelectedRouteType("fastest"),
          },
          {
            text: "Use Accessible",
            onPress: () => setSelectedRouteType("accessible"),
          },
        ]
      );
    } catch (error: any) {
      console.error("❌ Original AHP route analysis failed:", error);
      Alert.alert("Route Error", `Could not analyze route: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // NEW: Sidewalk Route Analysis
  const getSidewalkRoute = async (poi: any) => {
    if (!location) {
      Alert.alert("Location Error", "Current location not available.");
      return;
    }

    if (!profile) {
      Alert.alert(
        "Profile Required",
        "Please set up your accessibility profile first for personalized routes."
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisMode("sidewalk");

    try {
      console.log("🚶‍♂️ Getting revolutionary sidewalk route analysis...");

      const destination = { latitude: poi.lat, longitude: poi.lng };
      const analysis = await sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
        location,
        destination,
        profile
      );

      setSidewalkAnalysis(analysis);
      setRouteAnalysis(null); // Clear original analysis
      setSelectedDestination(destination);

      // Show sidewalk comparison
      Alert.alert(
        `🌟 Sidewalk-Aware Routes to ${poi.name}`,
        `📍 Standard Route: ${analysis.standardRoute.segments[0].obstacles.length} obstacles (Grade ${analysis.standardRoute.overallScore.grade})\n` +
          `🌟 Optimized Route: ${analysis.optimizedRoute.segments[0].obstacles.length} obstacles (Grade ${analysis.optimizedRoute.overallScore.grade})\n\n` +
          `✅ ${analysis.comparison.obstacleReduction} obstacles avoided\n` +
          `⏱️ ${Math.round(analysis.comparison.timeDifference)}s extra time\n` +
          `🚦 ${analysis.comparison.crossingCount} strategic crossing(s)\n\n` +
          `${analysis.comparison.recommendation}`,
        [
          {
            text: "Use Standard",
            onPress: () => setSelectedRouteType("fastest"),
          },
          {
            text: "Use Optimized",
            onPress: () => setSelectedRouteType("accessible"),
          },
        ]
      );
    } catch (error: any) {
      console.error("❌ Sidewalk route analysis failed:", error);
      Alert.alert("Route Error", `Could not analyze route: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // NEW: Helper functions for street-following sidewalk offsets
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
  const toDegrees = (radians: number): number => radians * (180 / Math.PI);

  const calculateBearing = (
    point1: UserLocation,
    point2: UserLocation
  ): number => {
    const lat1 = toRadians(point1.latitude);
    const lat2 = toRadians(point2.latitude);
    const deltaLng = toRadians(point2.longitude - point1.longitude);

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    const bearing = Math.atan2(y, x);
    return (toDegrees(bearing) + 360) % 360;
  };

  const calculatePerpendicularOffset = (
    point: UserLocation,
    bearing: number,
    distance: number,
    side: "left" | "right"
  ): UserLocation => {
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
      // Fallback to straight line if no route data
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

      // Calculate bearing between consecutive points
      const bearing = calculateBearing(current, next);

      // Calculate perpendicular offset
      const leftOffset = calculatePerpendicularOffset(
        current,
        bearing,
        offsetDistance,
        "left"
      );
      const rightOffset = calculatePerpendicularOffset(
        current,
        bearing,
        offsetDistance,
        "right"
      );

      leftSidewalk.push(leftOffset);
      rightSidewalk.push(rightOffset);
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

  // FALLBACK: Simple straight-line offsets (for when route coordinates aren't available)
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

    // Enhanced with both route analysis options
    Alert.alert(poi.name, "Choose your route analysis method:", [
      { text: "Cancel", style: "cancel" },
      {
        text: "🧠 Original AHP",
        onPress: () => getAHPRoute(poi),
      },
      {
        text: "🚶‍♂️ Sidewalk Analysis",
        onPress: () => getSidewalkRoute(poi),
      },
    ]);
  };

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
      no_sidewalk: "trail-sign",
      flooding: "water",
      stairs_no_ramp: "walk",
      narrow_passage: "resize",
      broken_pavement: "warning",
      steep_slope: "trending-up",
      other: "alert-circle",
    };
    return icons[type] || "alert-circle";
  };

  const getObstacleColor = (severity: string): string => {
    switch (severity) {
      case "blocking":
        return "#DC2626"; // Red
      case "high":
        return "#EF4444"; // Orange-red
      case "medium":
        return "#F59E0B"; // Yellow
      case "low":
        return "#10B981"; // Green
      default:
        return "#6B7280"; // Gray
    }
  };

  const getSeverityEmoji = (severity: string): string => {
    switch (severity) {
      case "blocking":
        return "🚫";
      case "high":
        return "⚠️";
      case "medium":
        return "⚡";
      case "low":
        return "💡";
      default:
        return "❓";
    }
  };

  const isObstacleRelevantForUser = (
    obstacle: AccessibilityObstacle
  ): boolean => {
    if (!profile) return true;

    const relevantTypes: Record<string, ObstacleType[]> = {
      wheelchair: [
        "stairs_no_ramp",
        "narrow_passage",
        "broken_pavement",
        "flooding",
        "parked_vehicles",
      ],
      walker: [
        "stairs_no_ramp",
        "narrow_passage",
        "broken_pavement",
        "flooding",
      ],
      crutches: ["broken_pavement", "flooding", "narrow_passage"],
      cane: ["broken_pavement", "flooding"],
      none: ["flooding", "construction"],
    };

    return relevantTypes[profile.type]?.includes(obstacle.type) || false;
  };

  // NEW: Quick sidewalk test function
  const createSidewalkTestData = async () => {
    try {
      await sidewalkRouteAnalysisService.createSidewalkTestData();
      Alert.alert(
        "🎯 Test Data Created!",
        "Sidewalk test obstacles created on different sides of C. Raymundo Avenue!\n\nNow search for 'City Hall' and try the Sidewalk Analysis option."
      );
    } catch (error: any) {
      Alert.alert("Error", `Failed to create test data: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Ionicons name="location" size={48} color="#3B82F6" />
        <Text className="text-lg font-semibold text-gray-900 mt-4">
          Getting your location...
        </Text>
        <Text className="text-sm text-gray-600 mt-2">
          Para sa accessible routes sa Pasig
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Search Bar */}
      <View className="absolute top-12 left-4 right-4 z-10">
        <View className="flex-row items-center bg-white rounded-xl px-4 py-3 shadow-lg">
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-3 text-base text-gray-900"
            placeholder="Saan ka pupunta? (e.g., City Hall, Mall)"
            value={destination}
            onChangeText={setDestination}
            onSubmitEditing={handleSearch}
            accessibilityLabel="Search for destination"
          />
          {destination.length > 0 && (
            <TouchableOpacity onPress={handleSearch} className="p-1">
              <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* NEW: Sidewalk Test Button */}
      <TouchableOpacity
        onPress={createSidewalkTestData}
        className="absolute top-32 left-4 bg-yellow-500 px-3 py-2 rounded-lg shadow-lg z-10"
      >
        <Text className="text-white font-bold text-xs">
          Create Sidewalk Test
        </Text>
      </TouchableOpacity>

      {/* Obstacle Info Button */}
      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            "Obstacle Markers",
            `Showing ${nearbyObstacles.length} accessibility obstacles nearby. Tap markers for details.\n\n🚫 Red: Blocking\n⚠️ Orange: High impact\n⚡ Yellow: Medium impact\n💡 Green: Low impact`
          )
        }
        className="absolute top-32 right-4 w-12 h-12 bg-orange-500 rounded-full items-center justify-center shadow-lg z-10"
      >
        <Text className="text-white font-bold text-xs">
          {nearbyObstacles.length}
        </Text>
      </TouchableOpacity>

      {/* Current Location Button */}
      <TouchableOpacity
        onPress={handleLocationPress}
        className="absolute bottom-32 right-4 w-12 h-12 bg-blue-500 rounded-full items-center justify-center shadow-lg z-10"
        style={{ minWidth: 48, minHeight: 48 }}
      >
        <Ionicons name="locate" size={24} color="white" />
      </TouchableOpacity>

      {/* Map */}
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
        showsCompass={true}
        mapType="standard"
      >
        {/* Current Location Marker */}
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

        {/* Destination Marker */}
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

        {/* Obstacle Markers */}
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
                size={16}
                color="white"
              />
            </View>
            <Callout>
              <View className="w-48 p-2">
                <Text className="font-bold text-gray-900">
                  {getSeverityEmoji(obstacle.severity)}{" "}
                  {obstacle.type.replace("_", " ")}
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  {obstacle.description}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Severity: {obstacle.severity}
                  {isObstacleRelevantForUser(obstacle) && (
                    <Text className="text-orange-600 font-medium">
                      {" "}
                      • Affects you
                    </Text>
                  )}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Sample POI Markers */}
        {pasigPOIs.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            title={poi.name}
            description="Tap for route analysis"
            onPress={() => handlePOIPress(poi)}
            pinColor={
              poi.type === "hospital"
                ? "#EF4444"
                : poi.type === "government"
                ? "#8B5CF6"
                : "#F59E0B"
            }
          />
        ))}

        {/* FIXED: Route Display with street-following sidewalks */}
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
              onStart={(params) => {
                console.log(
                  `Started routing between "${params.origin}" and "${params.destination}"`
                );
              }}
              onReady={(result) => {
                console.log(
                  `Route ready: ${result.distance} km, ${result.duration} min`
                );

                // CAPTURE the actual route coordinates
                if (result.coordinates && result.coordinates.length > 0) {
                  setRouteCoordinates(result.coordinates);
                  console.log(
                    `📍 Captured ${result.coordinates.length} route points`
                  );
                } else {
                  console.warn(
                    "⚠️ No route coordinates available, using fallback"
                  );
                  setRouteCoordinates([]);
                }
              }}
              onError={(errorMessage) => {
                console.error("MapViewDirections error:", errorMessage);
                setRouteCoordinates([]); // Clear coordinates on error
              }}
            />

            {/* NEW: Sidewalk Visualization using actual route path */}
            {sidewalkAnalysis &&
              analysisMode === "sidewalk" &&
              (() => {
                const sidewalks =
                  createSidewalkOffsetsFromRoute(routeCoordinates);

                return (
                  <>
                    {/* Left Sidewalk (Standard Route) */}
                    <Polyline
                      coordinates={sidewalks.leftSidewalk}
                      strokeColor={
                        selectedRouteType === "fastest" ? "#3B82F6" : "#60A5FA"
                      }
                      strokeWidth={selectedRouteType === "fastest" ? 6 : 4}
                      lineDashPattern={
                        selectedRouteType === "fastest" ? undefined : [10, 5]
                      }
                    />

                    {/* Right Sidewalk (Optimized Route) */}
                    <Polyline
                      coordinates={sidewalks.rightSidewalk}
                      strokeColor={
                        selectedRouteType === "accessible"
                          ? "#10B981"
                          : "#34D399"
                      }
                      strokeWidth={selectedRouteType === "accessible" ? 6 : 4}
                      lineDashPattern={
                        selectedRouteType === "accessible" ? undefined : [10, 5]
                      }
                    />

                    {/* Strategic Crossing Marker */}
                    {selectedRouteType === "accessible" &&
                      sidewalkAnalysis.comparison.crossingCount > 0 && (
                        <Marker
                          coordinate={getCrossingPoint(
                            location,
                            selectedDestination
                          )}
                        >
                          <View className="bg-green-500 w-10 h-10 rounded-full items-center justify-center border-3 border-white shadow-lg">
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

            {/* Original AHP Route Display (fallback) */}
            {routeAnalysis && analysisMode === "original" && (
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
                strokeWidth={6}
                strokeColor={
                  selectedRouteType === "fastest" ? "#3B82F6" : "#10B981"
                }
                optimizeWaypoints={false}
                mode="WALKING"
              />
            )}
          </>
        )}
      </MapView>

      {/* Route Status Display */}
      {(routeAnalysis || sidewalkAnalysis) && (
        <View className="absolute bottom-16 left-4 right-4 bg-white rounded-xl p-4 shadow-lg z-10">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-gray-900">
              {analysisMode === "sidewalk"
                ? selectedRouteType === "fastest"
                  ? "📍 Standard Sidewalk"
                  : "🌟 Optimized Sidewalk"
                : selectedRouteType === "fastest"
                ? "⚡ Fastest Route"
                : "♿ Accessible Route"}
            </Text>
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

              {/* NEW: Sidewalk Intelligence Summary */}
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

          {/* Original AHP Analysis Display (keep existing) */}
          {routeAnalysis && analysisMode === "original" && (
            <View className="flex-row items-center justify-between">
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
                      : routeAnalysis.accessibleRoute.googleRoute.duration) / 60
                  )}
                  min •
                  {(
                    (selectedRouteType === "fastest"
                      ? routeAnalysis.fastestRoute.googleRoute.distance
                      : routeAnalysis.accessibleRoute.googleRoute.distance) /
                    1000
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
                className="bg-blue-500 px-3 py-2 rounded-lg"
              >
                <Text className="text-white text-sm font-semibold">
                  Switch Route
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Loading indicator for route analysis */}
      {isAnalyzing && (
        <View className="absolute bottom-32 left-4 right-4 bg-blue-500 rounded-xl p-4 shadow-lg z-10">
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="white" />
            <Text className="text-white font-semibold ml-2">
              {analysisMode === "sidewalk"
                ? "Analyzing sidewalk routes with revolutionary intelligence..."
                : "Analyzing route with advanced algorithms..."}
            </Text>
          </View>
        </View>
      )}

      {/* Obstacle Detail Modal */}
      <Modal
        visible={showObstacleModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">
              Obstacle Details
            </Text>
            <TouchableOpacity
              onPress={() => setShowObstacleModal(false)}
              className="w-8 h-8 items-center justify-center"
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {selectedObstacle && (
            <ScrollView className="flex-1 p-4">
              <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
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
                    <Text className="text-xl font-bold text-gray-900">
                      {selectedObstacle.type.replace("_", " ")}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {getSeverityEmoji(selectedObstacle.severity)}{" "}
                      {selectedObstacle.severity} severity
                    </Text>
                  </View>
                </View>

                <Text className="text-base text-gray-800 mb-4">
                  {selectedObstacle.description}
                </Text>

                <View className="space-y-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm font-medium text-gray-600">
                      Reported:
                    </Text>
                    <Text className="text-sm text-gray-800">
                      {new Date(
                        selectedObstacle.reportedAt
                      ).toLocaleDateString()}
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text className="text-sm font-medium text-gray-600">
                      Status:
                    </Text>
                    <Text className="text-sm text-gray-800">
                      {selectedObstacle.verified
                        ? "✅ Verified"
                        : "⏳ Pending verification"}
                    </Text>
                  </View>

                  {isObstacleRelevantForUser(selectedObstacle) && (
                    <View className="bg-orange-50 rounded-lg p-3 mt-3">
                      <Text className="text-orange-800 font-medium text-sm">
                        ⚠️ This obstacle may affect {profile?.type} users
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
