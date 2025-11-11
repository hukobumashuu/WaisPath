// src/constants/navigationConstants.ts
// Constants for navigation functionality in WAISPATH
// Includes sample POI data and configuration values

import { PointOfInterest } from "../types";

/**
 * Sample Points of Interest for testing navigation in Pasig City
 * These are real locations that can be used for route testing
 *
 * ✅ FIXED: Now follows the PointOfInterest interface correctly
 * Uses `location: { latitude, longitude }` instead of `lat, lng`
 */
export const SAMPLE_POIS: PointOfInterest[] = [
  {
    id: "poi_1",
    name: "Pasig City Hall",
    location: {
      latitude: 14.5764,
      longitude: 121.0851,
    },
    type: "government",
    verified: true,
  },
  {
    id: "poi_2",
    name: "Robinson's Metro East",
    location: {
      latitude: 14.6042,
      longitude: 121.0753,
    },
    type: "shopping",
    verified: true,
  },
  {
    id: "poi_3",
    name: "SM City Pasig",
    location: {
      latitude: 14.5863,
      longitude: 121.0614,
    },
    type: "shopping",
    verified: true,
  },
];

/**
 * Default map configuration for Pasig City
 * Centers on Pasig City Hall
 */
export const DEFAULT_MAP_REGION = {
  latitude: 14.5764, // Pasig City Hall
  longitude: 121.0851,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
} as const;

/**
 * Navigation timing constants
 * Controls animation speeds and update intervals
 */
export const NAVIGATION_TIMING = {
  MAP_ANIMATION_DURATION: 1000, // milliseconds
  ROUTE_CALCULATION_TIMEOUT: 30000, // 30 seconds
  LOCATION_UPDATE_INTERVAL: 5000, // 5 seconds
} as const;

/**
 * Map styling constants
 * Defines colors for routes and markers
 */
export const MAP_STYLES = {
  FASTEST_ROUTE_COLOR: "#EF4444", // Red for fastest route
  ACCESSIBLE_ROUTE_COLOR: "#22C55E", // Green for clearest/most accessible route
  USER_MARKER_COLOR: "#3B82F6", // Blue for user location
  DESTINATION_MARKER_COLOR: "#10B981", // Green for destination
  POI_MARKER_COLOR: "#8B5CF6", // Purple for points of interest
  ROUTE_STROKE_WIDTH: 5,
} as const;
