// src/utils/mapUtils.ts
// Map-related utility functions for WAISPATH navigation
// Includes polyline decoding and POI icon mapping

import { Ionicons } from "@expo/vector-icons";
import { UserLocation } from "../types";

/**
 * Decodes Google Maps polyline string into array of coordinates
 * Uses Google's polyline algorithm for efficient route transmission
 */
export const decodePolyline = (encoded: string): UserLocation[] => {
  if (!encoded || typeof encoded !== "string") return [];

  const points: UserLocation[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;

      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      // Decode longitude
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
  } catch (error) {
    console.warn("Polyline decode error:", error);
    return [];
  }
};

/**
 * Gets appropriate Ionicon for POI type
 * Used for Points of Interest markers on the map
 */
export function getPOIIcon(type: string): keyof typeof Ionicons.glyphMap {
  const icons = {
    government: "business-outline",
    shopping: "storefront-outline",
    restaurant: "restaurant-outline",
    hospital: "medical-outline",
    school: "school-outline",
    default: "location-outline",
  };

  return (icons[type as keyof typeof icons] ||
    icons.default) as keyof typeof Ionicons.glyphMap;
}

/**
 * Calculates the distance between two coordinates using Haversine formula
 * @param point1 First coordinate point
 * @param point2 Second coordinate point
 * @returns Distance in meters
 */
export function calculateDistance(
  point1: UserLocation,
  point2: UserLocation
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Fits map bounds to include all provided coordinates
 * @param coordinates Array of coordinates to include
 * @returns Map region object for react-native-maps
 */
export function calculateMapBounds(coordinates: UserLocation[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  if (coordinates.length === 0) {
    return {
      latitude: 14.5764, // Default to Pasig
      longitude: 121.0851,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  if (coordinates.length === 1) {
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  coordinates.forEach((coord) => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const deltaLat = (maxLat - minLat) * 1.3; // Add 30% padding
  const deltaLng = (maxLng - minLng) * 1.3;

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.max(deltaLat, 0.01),
    longitudeDelta: Math.max(deltaLng, 0.01),
  };
}
