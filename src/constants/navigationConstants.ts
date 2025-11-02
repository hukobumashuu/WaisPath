// src/constants/navigationConstants.ts
// Constants for navigation functionality in WAISPATH
// Includes sample POI data and configuration values

/**
 * Sample Points of Interest for testing navigation in Pasig City
 * These are real locations that can be used for route testing
 */
// src/constants/navigationConstants.ts
import { PointOfInterest } from "../types";

/**
 * Sample Points of Interest for testing navigation in Pasig City
 * These are real locations that can be used for route testing
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
 */
export const DEFAULT_MAP_REGION = {
  latitude: 14.5764, // Pasig City Hall
  longitude: 121.0851,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
} as const;

/**
 * Navigation timing constants
 */
export const NAVIGATION_TIMING = {
  MAP_ANIMATION_DURATION: 1000,
  ROUTE_CALCULATION_TIMEOUT: 30000,
  LOCATION_UPDATE_INTERVAL: 5000,
} as const;

/**
 * Map styling constants
 */
export const MAP_STYLES = {
  FASTEST_ROUTE_COLOR: "#EF4444",
  ACCESSIBLE_ROUTE_COLOR: "#22C55E",
  USER_MARKER_COLOR: "#3B82F6",
  DESTINATION_MARKER_COLOR: "#10B981",
  POI_MARKER_COLOR: "#8B5CF6",
  ROUTE_STROKE_WIDTH: 5,
} as const;
