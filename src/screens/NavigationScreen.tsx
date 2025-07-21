import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { UserLocation } from "../types";

export default function NavigationScreen() {
  const { location, loading, error, getCurrentLocation } = useLocation();
  const [destination, setDestination] = useState<string>("");
  const [searchMode, setSearchMode] = useState<boolean>(false);
  const mapRef = useRef<MapView>(null);

  // Sample POIs in Pasig for development
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
  ];

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
    if (destination.trim()) {
      Alert.alert(
        "Search Feature",
        `Searching for: ${destination}\n\nThis will connect to Google Places API in the next sprint.`,
        [{ text: "OK" }]
      );
    }
  };

  const handlePOIPress = (poi: any) => {
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

    Alert.alert(
      poi.name,
      "Route to this location?\n\n(AHP + A* routing will be implemented in Month 2)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Get Route",
          onPress: () => console.log("Route to:", poi.name),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="location" size={48} color="#3B82F6" />
        <Text style={styles.loadingText}>Getting your location...</Text>
        <Text style={styles.subText}>Para sa accessible routes sa Pasig</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Saan ka pupunta? (e.g., City Hall, Mall)"
            value={destination}
            onChangeText={setDestination}
            onSubmitEditing={handleSearch}
            accessibilityLabel="Search for destination"
          />
          {destination.length > 0 && (
            <TouchableOpacity
              onPress={handleSearch}
              style={styles.searchButton}
            >
              <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

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

        {/* Sample POI Markers */}
        {pasigPOIs.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            title={poi.name}
            description={`Tap for accessible route`}
            onPress={() => handlePOIPress(poi)}
            pinColor={
              poi.type === "hospital"
                ? "#EF4444"
                : poi.type === "government"
                ? "#22C55E"
                : "#F59E0B"
            }
          />
        ))}
      </MapView>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {/* My Location Button */}
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleLocationPress}
          accessibilityLabel="Go to my location"
        >
          <Ionicons name="locate" size={24} color="#3B82F6" />
        </TouchableOpacity>

        {/* Quick POI Buttons */}
        <View style={styles.poiButtons}>
          <TouchableOpacity
            style={[styles.poiButton, { backgroundColor: "#22C55E" }]}
            onPress={() => handlePOIPress(pasigPOIs[0])}
          >
            <Ionicons name="business" size={20} color="white" />
            <Text style={styles.poiButtonText}>City Hall</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.poiButton, { backgroundColor: "#EF4444" }]}
            onPress={() => handlePOIPress(pasigPOIs[2])}
          >
            <Ionicons name="medical" size={20} color="white" />
            <Text style={styles.poiButtonText}>Hospital</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Bar */}
      {error && (
        <View style={styles.statusBar}>
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={styles.statusText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
  },
  subText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  searchContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#111827",
  },
  searchButton: {
    padding: 4,
  },
  map: {
    flex: 1,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 100,
    right: 16,
  },
  locationButton: {
    backgroundColor: "white",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  poiButtons: {
    flexDirection: "column",
    gap: 12,
  },
  poiButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  poiButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 14,
  },
  statusBar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginLeft: 8,
    color: "#92400E",
    fontSize: 14,
    flex: 1,
  },
});
