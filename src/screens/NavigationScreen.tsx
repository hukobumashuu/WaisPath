// src/screens/NavigationScreen.tsx
// FIXED: Working map + sidewalk integration
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
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from "react-native-maps";
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

      Alert.alert(
        "Destination Found!",
        `Found ${firstResult.name}. Choose your route analysis method:`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "🧠 Original AHP", onPress: () => getAHPRoute(firstResult) },
          {
            text: "🚶‍♂️ Sidewalk Analysis",
            onPress: () => getSidewalkRoute(firstResult),
          },
        ]
      );
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

    try {
      console.log("🚀 Getting original AHP route analysis...");

      const destination = { latitude: poi.lat, longitude: poi.lng };
      const analysis = await routeAnalysisService.analyzeRoutes(
        location,
        destination,
        profile
      );

      setRouteAnalysis(analysis);
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

    try {
      console.log("🚶‍♂️ Getting revolutionary sidewalk route analysis...");

      const destination = { latitude: poi.lat, longitude: poi.lng };
      const analysis = await sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
        location,
        destination,
        profile
      );

      // Convert sidewalk analysis to display in existing UI
      const convertedAnalysis: DualRouteComparison = {
        fastestRoute: {
          googleRoute: {
            id: "standard_route",
            polyline: "",
            distance: analysis.standardRoute.totalDistance,
            duration: analysis.standardRoute.totalTime,
            steps: [],
            bounds: { northeast: destination, southwest: location },
            warnings: [],
            summary: "Standard Route",
          },
          accessibilityScore: analysis.standardRoute.overallScore,
          obstacleCount: analysis.standardRoute.segments[0].obstacles.length,
          userWarnings: [],
          recommendation: "acceptable",
        },
        accessibleRoute: {
          googleRoute: {
            id: "optimized_route",
            polyline: "",
            distance: analysis.optimizedRoute.totalDistance,
            duration: analysis.optimizedRoute.totalTime,
            steps: [],
            bounds: { northeast: destination, southwest: location },
            warnings: [],
            summary: "Optimized Sidewalk Route",
          },
          accessibilityScore: analysis.optimizedRoute.overallScore,
          obstacleCount: analysis.optimizedRoute.segments[0].obstacles.length,
          userWarnings: [],
          recommendation: "excellent",
        },
        routeComparison: {
          timeDifference: analysis.comparison.timeDifference,
          distanceDifference:
            analysis.optimizedRoute.totalDistance -
            analysis.standardRoute.totalDistance,
          accessibilityImprovement:
            analysis.comparison.accessibilityImprovement,
          recommendation: analysis.comparison.recommendation,
        },
      };

      setRouteAnalysis(convertedAnalysis);
      setSelectedDestination(destination);

      // Show enhanced sidewalk route comparison
      Alert.alert(
        `🚶‍♂️ Revolutionary Sidewalk Routes to ${poi.name}`,
        `📍 Standard Route: ${Math.round(
          analysis.standardRoute.totalTime / 60
        )}min (Grade ${analysis.standardRoute.overallScore.grade}) - ${
          analysis.standardRoute.segments[0].obstacles.length
        } obstacles\n\n` +
          `🌟 Optimized Sidewalk Route: ${Math.round(
            analysis.optimizedRoute.totalTime / 60
          )}min (Grade ${analysis.optimizedRoute.overallScore.grade}) - ${
            analysis.optimizedRoute.segments[0].obstacles.length
          } obstacles\n` +
          `${
            analysis.optimizedRoute.crossingPoints.length > 0
              ? `• ${analysis.optimizedRoute.crossingPoints.length} strategic crossings\n`
              : ""
          }` +
          `${
            analysis.comparison.accessibilityImprovement > 0
              ? `• +${analysis.comparison.accessibilityImprovement.toFixed(
                  0
                )} accessibility points\n`
              : ""
          }\n` +
          `💡 ${analysis.comparison.recommendation}`,
        [
          {
            text: "Use Standard",
            onPress: () => setSelectedRouteType("fastest"), // Map to existing state
          },
          {
            text: "Use Optimized",
            onPress: () => setSelectedRouteType("accessible"), // Map to existing state
          },
        ]
      );
    } catch (error: any) {
      console.error("❌ Sidewalk route analysis failed:", error);
      Alert.alert(
        "Sidewalk Route Error",
        `Could not analyze sidewalk route: ${error.message}`
      );
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

        {/* Route Display (works with both analysis types) */}
        {routeAnalysis && location && selectedDestination && (
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
            onStart={(params) => {
              console.log(
                `Started routing between "${params.origin}" and "${params.destination}"`
              );
            }}
            onReady={(result) => {
              console.log(
                `Route ready: ${result.distance} km, ${result.duration} min`
              );
            }}
            onError={(errorMessage) => {
              console.error("MapViewDirections error:", errorMessage);
            }}
          />
        )}
      </MapView>

      {/* Route Status Display */}
      {routeAnalysis && (
        <View className="absolute bottom-16 left-4 right-4 bg-white rounded-xl p-4 shadow-lg z-10">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-gray-900">
              {selectedRouteType === "fastest"
                ? "📍 Standard Route"
                : "🌟 Optimized Route"}
            </Text>
            <TouchableOpacity
              onPress={() => setRouteAnalysis(null)}
              className="w-8 h-8 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm text-gray-600">
                Grade{" "}
                {selectedRouteType === "fastest"
                  ? routeAnalysis.fastestRoute.accessibilityScore.grade
                  : routeAnalysis.accessibleRoute.accessibilityScore.grade}{" "}
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
                    : routeAnalysis.accessibleRoute.googleRoute.distance) / 1000
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
        </View>
      )}

      {/* Loading indicator for route analysis */}
      {isAnalyzing && (
        <View className="absolute bottom-32 left-4 right-4 bg-blue-500 rounded-xl p-4 shadow-lg z-10">
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="white" />
            <Text className="text-white font-semibold ml-2">
              Analyzing route with advanced algorithms...
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
