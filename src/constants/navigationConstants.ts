// src/constants/navigationConstants.ts
// Constants for navigation functionality in WAISPATH
// Includes sample POI data and configuration values

/**
 * Sample Points of Interest for testing navigation in Pasig City
 * These are real locations that can be used for route testing
 */
export const SAMPLE_POIS = [
  {
    id: "poi_1",
    name: "Pasig City Hall",
    type: "government",
    lat: 14.5764,
    lng: 121.0851,
  },
  {
    id: "poi_2",
    name: "Robinson's Metro East",
    type: "shopping",
    lat: 14.6042,
    lng: 121.0753,
  },
  {
    id: "poi_3",
    name: "SM City Pasig",
    type: "shopping",
    lat: 14.5863,
    lng: 121.0614,
  },
] as const;

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
