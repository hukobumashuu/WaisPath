// src/utils/navigationUtils.ts
// Navigation utility functions for WAISPATH
// Handles bearing calculations and directional filtering

import { UserLocation } from "../types";

/**
 * Calculate bearing (direction) from one point to another
 * @returns Bearing in degrees (0-360, where 0 = North, 90 = East, 180 = South, 270 = West)
 */
export function calculateBearing(from: UserLocation, to: UserLocation): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;

  const x = Math.sin(deltaLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  const bearing = (Math.atan2(x, y) * 180) / Math.PI;

  // Normalize to 0-360
  return (bearing + 360) % 360;
}

/**
 * Calculate the angle difference between two bearings
 * @returns Angle difference in degrees (0-180)
 */
export function calculateAngleDifference(
  bearing1: number,
  bearing2: number
): number {
  let diff = Math.abs(bearing1 - bearing2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Determine if an obstacle is ahead of the user based on bearing
 * @param userLocation Current user position
 * @param userBearing User's direction of travel (degrees)
 * @param obstacleLocation Obstacle position
 * @param thresholdAngle Maximum angle to consider "ahead" (default 90° = front hemisphere)
 * @returns true if obstacle is ahead, false if behind
 */
export function isObstacleAhead(
  userLocation: UserLocation,
  userBearing: number,
  obstacleLocation: UserLocation,
  thresholdAngle: number = 90
): boolean {
  // Calculate bearing from user to obstacle
  const bearingToObstacle = calculateBearing(userLocation, obstacleLocation);

  // Calculate angle difference
  const angleDiff = calculateAngleDifference(userBearing, bearingToObstacle);

  // Obstacle is "ahead" if within threshold angle (default 90° = front hemisphere)
  return angleDiff <= thresholdAngle;
}

/**
 * Calculate user's bearing (direction of travel) from a route polyline
 * Looks at the next few points ahead on the route
 * @param userLocation Current user position
 * @param routePolyline Route coordinates
 * @param lookAheadPoints Number of points to look ahead (default 5)
 * @returns Bearing in degrees, or null if cannot determine
 */
export function calculateUserBearingFromRoute(
  userLocation: UserLocation,
  routePolyline: UserLocation[],
  lookAheadPoints: number = 5
): number | null {
  if (routePolyline.length < 2) return null;

  // Find closest point on route
  let closestIndex = 0;
  let minDistance = Infinity;

  routePolyline.forEach((point, index) => {
    const distance = calculateSimpleDistance(userLocation, point);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });

  // Look ahead on the route
  const targetIndex = Math.min(
    closestIndex + lookAheadPoints,
    routePolyline.length - 1
  );

  if (closestIndex === targetIndex) {
    // At end of route, use bearing to final point
    if (closestIndex > 0) {
      return calculateBearing(
        routePolyline[closestIndex - 1],
        routePolyline[closestIndex]
      );
    }
    return null;
  }

  // Calculate bearing from current position toward the look-ahead point
  return calculateBearing(
    routePolyline[closestIndex],
    routePolyline[targetIndex]
  );
}

/**
 * Simple distance calculation (faster than Haversine for short distances)
 * Used internally for finding closest point
 */
function calculateSimpleDistance(
  point1: UserLocation,
  point2: UserLocation
): number {
  const latDiff = point1.latitude - point2.latitude;
  const lngDiff = point1.longitude - point2.longitude;
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

/**
 * Get cardinal direction name from bearing
 * Useful for voice announcements
 */
export function getCardinalDirection(bearing: number): string {
  const directions = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ];

  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Format bearing for display
 * @example "heading northeast (45°)"
 */
export function formatBearing(bearing: number): string {
  const direction = getCardinalDirection(bearing);
  return `heading ${direction} (${Math.round(bearing)}°)`;
}
