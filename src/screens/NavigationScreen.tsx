import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet, // Keep for MapView - NativeWind doesn't work with MapView
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
    if (!destination.trim()) {
      Alert.alert("Search Error", "Please enter a destination to search for.");
      return;
    }

    // Simple local search in our POI list
    const query = destination.toLowerCase();
    const results = pasigPOIs.filter(
      (poi) =>
        poi.name.toLowerCase().includes(query) ||
        poi.type.toLowerCase().includes(query)
    );

    if (results.length > 0) {
      // Zoom to first result
      const firstResult = results[0];
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
        "Search Results",
        `Found ${results.length} result(s) for "${destination}":\n\n${results
          .map((r) => `• ${r.name}`)
          .join("\n")}\n\nCheck the map for the location!`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "No Results",
        `No results found for "${destination}" in Pasig area.\n\nTry searching for:\n• City Hall\n• Hospital\n• Mall`,
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
      <View className="flex-1 justify-center items-center bg-white">
        <Ionicons name="location" size={48} color="#3B82F6" />
        <Text className="text-lg font-semibold text-gray-900 mt-4">
          Getting your location...
        </Text>
        <Text className="text-sm text-accessible-gray mt-2">
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

      {/* Map - Use StyleSheet for MapView as NativeWind doesn't work with it */}
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

      {/* Control Buttons - Use NativeWind */}
      <View className="absolute bottom-24 right-4">
        {/* My Location Button */}
        <TouchableOpacity
          className="bg-white w-12 h-12 rounded-full justify-center items-center mb-4 shadow-lg"
          onPress={handleLocationPress}
          accessibilityLabel="Go to my location"
        >
          <Ionicons name="locate" size={24} color="#3B82F6" />
        </TouchableOpacity>

        {/* Quick POI Buttons */}
        <View className="space-y-3 gap-3">
          <TouchableOpacity
            className="bg-accessible-green flex-row items-center px-4 py-3 rounded-full shadow-lg"
            onPress={() => handlePOIPress(pasigPOIs[0])}
          >
            <Ionicons name="business" size={20} color="white" />
            <Text className="text-white font-semibold ml-2 text-sm">
              City Hall
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-accessible-red flex-row items-center px-4 py-3 rounded-full shadow-lg"
            onPress={() => handlePOIPress(pasigPOIs[2])}
          >
            <Ionicons name="medical" size={20} color="white" />
            <Text className="text-white font-semibold ml-2 text-sm">
              Hospital
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Bar */}
      {error && (
        <View className="absolute bottom-4 left-4 right-4 bg-yellow-100 rounded-lg p-3 flex-row items-center">
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text className="ml-2 text-yellow-800 text-sm flex-1">{error}</Text>
        </View>
      )}
    </View>
  );
}

// Keep StyleSheet only for MapView - NativeWind doesn't work with react-native-maps
const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
