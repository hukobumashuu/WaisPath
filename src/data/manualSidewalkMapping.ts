// src/data/manualSidewalkMapping.ts
// Manual tagging of existing obstacles with sidewalk information
// Focus: C. Raymundo Avenue corridor (Pasig City Hall area)

import { ObstacleSidewalkMapping, CrossingPoint } from "../types/sidewalkTypes";
import { UserLocation } from "../types/index";

// STEP 1: Define our test street - C. Raymundo Avenue
export const TEST_STREET = {
  name: "C. Raymundo Avenue",
  startPoint: { latitude: 14.576, longitude: 121.084 }, // Western end
  endPoint: { latitude: 14.577, longitude: 121.086 }, // Eastern end (near City Hall)
  direction: "east-west", // Street runs roughly east-west
};

// STEP 2: Manual mapping of existing obstacles to sidewalk sides
// Based on POI coordinates from your NavigationScreen:
// Pasig City Hall: 14.5764, 121.0851

export const MANUAL_OBSTACLE_MAPPING: ObstacleSidewalkMapping[] = [
  {
    obstacleId: "city_hall_stairs",
    obstacleLocation: {
      latitude: 14.5765, // City Hall + 0.001 (from your test data)
      longitude: 121.0851,
    },
    street: "C. Raymundo Avenue",
    side: "north", // City Hall entrance is on north side of street
    confidence: "high",
    reasoning:
      "Pasig City Hall main entrance faces south toward the avenue, so stairs are on north sidewalk",
    nearestCrossing: { latitude: 14.5764, longitude: 121.0845 }, // Intersection crossing
  },

  {
    obstacleId: "city_hall_vendors",
    obstacleLocation: {
      latitude: 14.5763, // Near City Hall but slightly south
      longitude: 121.0851,
    },
    street: "C. Raymundo Avenue",
    side: "south", // Vendors typically set up across from government buildings
    confidence: "high",
    reasoning:
      "Food vendors usually position across from City Hall for foot traffic",
    nearestCrossing: { latitude: 14.5764, longitude: 121.0845 },
  },

  {
    obstacleId: "parked_vehicles_hospital_area",
    obstacleLocation: {
      latitude: 14.5739, // Rizal Medical Center area
      longitude: 121.0892,
    },
    street: "Francisco Legaspi Street", // Different street, but connected route
    side: "east", // Hospital area - vehicles typically park on approach side
    confidence: "medium",
    reasoning:
      "Hospital visitors park on eastern side approaching main entrance",
    nearestCrossing: { latitude: 14.574, longitude: 121.089 },
  },

  {
    obstacleId: "broken_pavement_hospital",
    obstacleLocation: {
      latitude: 14.5858, // Pasig General Hospital area
      longitude: 121.0907,
    },
    street: "Dr. Sixto Antonio Avenue",
    side: "west", // Western approach to hospital
    confidence: "medium",
    reasoning: "Broken pavement typically on older, less maintained side",
    nearestCrossing: { latitude: 14.586, longitude: 121.0905 },
  },

  {
    obstacleId: "podium_vendors",
    obstacleLocation: {
      latitude: 14.5657, // The Podium mall area
      longitude: 121.0645, // +0.001 from your test data
    },
    street: "Ortigas Avenue",
    side: "south", // Mall entrance side
    confidence: "high",
    reasoning: "Vendors set up on main pedestrian approach to mall entrance",
    nearestCrossing: { latitude: 14.5655, longitude: 121.0644 },
  },
];

// STEP 3: Define crossing points for our test area
export const TEST_CROSSING_POINTS: CrossingPoint[] = [
  {
    id: "city_hall_intersection",
    location: { latitude: 14.5764, longitude: 121.0845 },
    type: "traffic_light",
    accessibility: {
      hasRamp: true,
      hasVisualSignals: true,
      hasTactileIndicators: false, // Most PH crossings lack this
      crossingTime: 45, // seconds to cross wide avenue
      safetyRating: 4, // Good traffic control
      waitTime: 30, // Average signal wait
    },
    connectsSidewalks: ["c_raymundo_north", "c_raymundo_south"],
    userTypes: {
      wheelchair: "accessible", // Has ramps
      walker: "easy",
      cane: "moderate", // No tactile indicators
      crutches: "moderate", // Takes time to cross
      none: "easy", // Added none type
    },
  },

  {
    id: "ortigas_podium_crossing",
    location: { latitude: 14.5655, longitude: 121.0644 },
    type: "pedestrian_crossing",
    accessibility: {
      hasRamp: true,
      hasVisualSignals: false,
      hasTactileIndicators: false,
      crossingTime: 35,
      safetyRating: 3, // Busy area, moderate safety
      waitTime: 20,
    },
    connectsSidewalks: ["ortigas_north", "ortigas_south"],
    userTypes: {
      wheelchair: "accessible",
      walker: "easy",
      cane: "difficult", // No signals for vision assistance
      crutches: "moderate",
      none: "easy", // Added none type
    },
  },

  {
    id: "hospital_area_crossing",
    location: { latitude: 14.574, longitude: 121.089 },
    type: "intersection",
    accessibility: {
      hasRamp: false, // Many hospital areas lack proper ramps
      hasVisualSignals: false,
      hasTactileIndicators: false,
      crossingTime: 25,
      safetyRating: 2, // Hospital traffic can be unpredictable
      waitTime: 15,
    },
    connectsSidewalks: ["legaspi_east", "legaspi_west"],
    userTypes: {
      wheelchair: "difficult", // No ramps
      walker: "moderate",
      cane: "difficult",
      crutches: "difficult",
      none: "moderate", // Added none type
    },
  },
];

// STEP 4: Helper function to apply manual mapping to existing obstacles
export const applySidewalkMappingToObstacle = (
  obstacle: any,
  mapping: ObstacleSidewalkMapping
) => {
  return {
    ...obstacle,
    sidewalkInfo: {
      sidewalkId: `${mapping.street.toLowerCase().replace(/\s+/g, "_")}_${
        mapping.side
      }`,
      positionOnSidewalk: "center" as const, // Default assumption
      blocksWidth: getObstacleWidthImpact(obstacle.type),
      alternativeExists: hasAlternativePath(obstacle.type),
      nearestCrossing: mapping.nearestCrossing,
    },
  };
};

// Helper: Estimate how much of sidewalk width each obstacle type blocks
const getObstacleWidthImpact = (obstacleType: string): number => {
  const widthMap: Record<string, number> = {
    vendor_blocking: 70, // Vendors typically block most of sidewalk
    parked_vehicles: 90, // Vehicles block almost entire sidewalk
    stairs_no_ramp: 100, // Stairs completely block wheelchair access
    broken_pavement: 30, // Can usually walk around broken areas
    flooding: 80, // Water forces users to road
    construction: 95, // Construction typically blocks full path
    electrical_post: 40, // Posts can usually be navigated around
    narrow_passage: 60, // Reduces effective width
  };

  return widthMap[obstacleType] || 50; // Default 50% width impact
};

// Helper: Does this obstacle type have alternative paths?
const hasAlternativePath = (obstacleType: string): boolean => {
  const alternatives: Record<string, boolean> = {
    vendor_blocking: true, // Can sometimes squeeze by or ask to move
    parked_vehicles: false, // Vehicles completely block path
    stairs_no_ramp: false, // No alternative for wheelchair users
    broken_pavement: true, // Can usually step around
    flooding: false, // Water forces complete detour
    construction: false, // Usually blocks entire sidewalk
    electrical_post: true, // Can navigate around
    narrow_passage: true, // Some users can still fit
  };

  return alternatives[obstacleType] || false;
};

// STEP 5: Export processed mappings for use in service
export const getEnhancedObstacles = (originalObstacles: any[]) => {
  return originalObstacles.map((obstacle) => {
    // Find matching manual mapping
    const mapping = MANUAL_OBSTACLE_MAPPING.find(
      (m) =>
        Math.abs(m.obstacleLocation.latitude - obstacle.location.latitude) <
          0.001 &&
        Math.abs(m.obstacleLocation.longitude - obstacle.location.longitude) <
          0.001
    );

    if (mapping) {
      return applySidewalkMappingToObstacle(obstacle, mapping);
    }

    // If no manual mapping found, return original obstacle
    return obstacle;
  });
};
