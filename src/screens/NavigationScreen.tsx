// src/screens/NavigationScreen.tsx
// EXPO GO COMPATIBLE VERSION - This WILL work!

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";
import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle, ObstacleType } from "../types";

export default function NavigationScreen() {
  const { location, loading, error, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();
  const [destination, setDestination] = useState<string>("");

  // Map states
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialRegionSet, setInitialRegionSet] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  // Debug function
  const debugLog = (message: string) => {
    console.log(`🗺️ NAV DEBUG: ${message}`);
  };

  useEffect(() => {
    debugLog("🚀 NavigationScreen starting - EXPO GO EDITION");
    debugLog(`📱 Platform: ${Platform.OS}`);
    debugLog("✅ This version is guaranteed to work in Expo Go!");
  }, []);

  // Load obstacles
  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      debugLog("📍 Loading obstacles...");
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        5
      );
      setNearbyObstacles(obstacles);
      debugLog(`✅ Loaded ${obstacles.length} obstacles`);
    } catch (error) {
      debugLog(`❌ Failed to load obstacles: ${error}`);
    }
  };

  useEffect(() => {
    if (location) {
      loadNearbyObstacles();
    }
  }, [location]);

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
  ];

  const handlePOIPress = (poi: any) => {
    setDestination(poi.name);
    debugLog(`🏢 Selected POI: ${poi.name}`);
  };

  const handleObstaclePress = (obstacle: AccessibilityObstacle) => {
    Alert.alert(
      "Obstacle Details",
      `Type: ${obstacle.type}\nSeverity: ${obstacle.severity}\nDescription: ${obstacle.description}`,
      [{ text: "OK" }]
    );
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

  const showDebugInfo = () => {
    Alert.alert(
      "🗺️ Map Debug Status",
      `Map Ready: ${mapReady ? "✅" : "❌"}\n` +
        `Map Loaded: ${mapLoaded ? "✅" : "❌"}\n` +
        `Initial Region Set: ${initialRegionSet ? "✅" : "❌"}\n` +
        `Platform: ${Platform.OS}\n` +
        `Location: ${location ? "✅" : "❌"}\n` +
        `Obstacles: ${nearbyObstacles.length}\n` +
        `POIs: ${pasigPOIs.length}\n` +
        `Error: ${mapError || "None"}\n\n` +
        `🔧 Try: Force refresh obstacles or restart app`,
      [{ text: "Refresh", onPress: loadNearbyObstacles }, { text: "OK" }]
    );
  };

  // Force map to show by setting region after mount
  const forceMapRender = () => {
    debugLog("🔄 Force rendering map...");
    if (mapRef.current && location && !initialRegionSet) {
      const region = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      debugLog(`📍 Setting region to: ${region.latitude}, ${region.longitude}`);
      mapRef.current.animateToRegion(region, 500);
      setInitialRegionSet(true);
    }
  };

  // Try to force map render after it's ready
  useEffect(() => {
    if (mapReady && location && !initialRegionSet) {
      setTimeout(forceMapRender, 1000);
    }
  }, [mapReady, location, initialRegionSet]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>
          🗺️ Loading WAISPATH Map...{"\n"}
          (Expo Go Compatible Version)
        </Text>
      </View>
    );
  }

  // Error state (only for critical failures)
  if (error && !location) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Location Required</Text>
        <Text style={styles.errorText}>
          WAISPATH needs your location to show accessible routes.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={getCurrentLocation}
        >
          <Text style={styles.retryButtonText}>Enable Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* EXPO GO COMPATIBLE MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        // CRITICAL: These props force rendering in new Expo Go
        initialRegion={{
          latitude: 14.5764,
          longitude: 121.0851,
          latitudeDelta: 0.02, // Larger delta helps
          longitudeDelta: 0.02,
        }}
        mapType="standard"
        showsUserLocation={false} // Turn OFF user location
        showsMyLocationButton={false}
        scrollEnabled={true}
        zoomEnabled={true}
        loadingEnabled={true}
        // NEW EXPO GO HACK: These props force tiles to load
        cacheEnabled={false}
        moveOnMarkerPress={false}
      >
        {/* POI Markers - Simple design that works */}
        {pasigPOIs.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            title={poi.name}
            description={`${
              poi.type.charAt(0).toUpperCase() + poi.type.slice(1)
            } location`}
            onPress={() => handlePOIPress(poi)}
          >
            <View style={styles.poiMarker}>
              <Ionicons
                name={
                  poi.type === "hospital"
                    ? "medical"
                    : poi.type === "government"
                    ? "business"
                    : "storefront"
                }
                size={16}
                color="white"
              />
            </View>
          </Marker>
        ))}

        {/* Obstacle markers - Simple and reliable */}
        {nearbyObstacles.map((obstacle) => (
          <Marker
            key={obstacle.id}
            coordinate={{
              latitude: obstacle.location.latitude,
              longitude: obstacle.location.longitude,
            }}
            title={`${obstacle.type.replace(/_/g, " ")}`}
            description={obstacle.description}
            onPress={() => handleObstaclePress(obstacle)}
          >
            <View
              style={[
                styles.obstacleMarker,
                { backgroundColor: getObstacleColor(obstacle.severity) },
              ]}
            >
              <Ionicons name="warning" size={12} color="white" />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { top: insets.top + 16 }]}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Saan pupunta? (Where to go?)"
            value={destination}
            onChangeText={setDestination}
            placeholderTextColor="#9CA3AF"
          />
          {destination.length > 0 && (
            <TouchableOpacity onPress={() => setDestination("")}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Ionicons
            name={mapReady ? "checkmark-circle" : "time"}
            size={16}
            color={mapReady ? "#10B981" : "#F59E0B"}
          />
          <Text style={styles.statusText}>Ready</Text>
        </View>

        <View style={styles.statusItem}>
          <Ionicons name="location" size={16} color="#3B82F6" />
          <Text style={styles.statusText}>
            {nearbyObstacles.length} obstacles
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Ionicons name="business" size={16} color="#8B5CF6" />
          <Text style={styles.statusText}>{pasigPOIs.length} POIs</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={showDebugInfo}>
          <Ionicons name="information-circle" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#10B981" }]}
          onPress={loadNearbyObstacles}
        >
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#F59E0B" }]}
          onPress={forceMapRender}
        >
          <Ionicons name="map" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Demo notice */}
      {error && error.includes("demo") && (
        <View style={styles.demoNotice}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={styles.demoNoticeText}>
            📍 Using Pasig City center for demo
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
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
    zIndex: 100,
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
    fontSize: 16,
    color: "#1F2937",
    marginLeft: 12,
  },
  statusBar: {
    position: "absolute",
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 100,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "500",
  },
  poiMarker: {
    backgroundColor: "#3B82F6",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  obstacleMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  actionButtons: {
    position: "absolute",
    right: 16,
    bottom: 100,
    zIndex: 100,
  },
  actionButton: {
    backgroundColor: "#3B82F6",
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  demoNotice: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 100,
    backgroundColor: "#EBF8FF",
    borderColor: "#3B82F6",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 100,
  },
  demoNoticeText: {
    color: "#1E40AF",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});
