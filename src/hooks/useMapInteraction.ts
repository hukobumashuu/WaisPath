// src/hooks/useMapInteraction.ts
// FIXED: Simplified to work without onPressOut

import { useState, useRef, useCallback, useEffect } from "react";
import { Vibration, Alert } from "react-native";
import { UserLocation, PointOfInterest } from "../types";

/**
 * Haversine distance calculation
 * Calculates accurate distance between two GPS coordinates on Earth's surface
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 */
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Custom hook to handle map touch-and-hold interactions
 *
 * This hook manages:
 * - Touch-and-hold gesture state (1.2 second duration)
 * - Visual progress feedback (0-100%)
 * - Haptic vibration patterns (start, middle, complete)
 * - Cleanup of timers to prevent memory leaks
 *
 * NOTE: We don't need onPressOut handling because:
 * - If user releases early, timers naturally expire without triggering the completion
 * - The visual marker will disappear after the timeout
 * - This is simpler and works reliably with React Native Maps
 *
 * @param isNavigating - Whether user is currently navigating (disables feature during navigation)
 * @param nearbyPOIs - Array of points of interest to find nearest location context
 * @param onLocationSelected - Callback when user successfully selects a location
 * @param onReportAtLocation - Callback when user chooses to report obstacle at location
 */
interface UseMapInteractionProps {
  isNavigating: boolean;
  nearbyPOIs: PointOfInterest[];
  onLocationSelected: (
    location: UserLocation,
    nearestPOI?: { name: string; distance: number }
  ) => void;
  onReportAtLocation: (location: UserLocation) => void;
}

export const useMapInteraction = ({
  isNavigating,
  nearbyPOIs,
  onLocationSelected,
  onReportAtLocation,
}: UseMapInteractionProps) => {
  // State for tracking the hold gesture
  const [isHoldingMap, setIsHoldingMap] = useState(false);
  const [holdLocation, setHoldLocation] = useState<UserLocation | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  // Refs for timers
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Cleanup function to clear all active timers
   * This prevents memory leaks if component unmounts during hold
   */
  const clearAllTimers = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  /**
   * Cleanup timers when component unmounts
   * This is CRITICAL to prevent memory leaks
   */
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  /**
   * Find the nearest POI to a given coordinate using Haversine formula
   */
  const findNearestPOI = useCallback(
    (
      coordinate: UserLocation
    ): { poi: PointOfInterest; distance: number } | null => {
      if (nearbyPOIs.length === 0) return null;

      let nearestPOI: PointOfInterest | null = null;
      let nearestDistance = Infinity;

      nearbyPOIs.forEach((poi) => {
        const distance = haversineDistance(
          poi.location.latitude,
          poi.location.longitude,
          coordinate.latitude,
          coordinate.longitude
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPOI = poi;
        }
      });

      return nearestPOI ? { poi: nearestPOI, distance: nearestDistance } : null;
    },
    [nearbyPOIs]
  );

  /**
   * Handler for when user starts long-pressing the map
   *
   * Initiates a 1.2 second countdown with:
   * - Visual progress (0-100%)
   * - Haptic feedback at start, middle (50%), and completion
   *
   * @param coordinate - The latitude/longitude where user pressed
   */
  const handleMapLongPress = useCallback(
    (coordinate: UserLocation) => {
      // Don't allow selection during active navigation
      if (isNavigating) return;

      // Clear any existing timers (in case of rapid taps)
      clearAllTimers();

      // Store the location and start the hold
      setHoldLocation(coordinate);
      setIsHoldingMap(true);
      setHoldProgress(0);

      // Initial haptic feedback (50ms buzz) tells user "hold detected"
      Vibration.vibrate(50);

      // Progress timer: updates every 120ms for smooth animation
      // 120ms × 10 intervals = 1200ms total duration
      progressTimerRef.current = setInterval(() => {
        setHoldProgress((prev) => {
          const next = prev + 10; // Increment by 10%

          // Midway haptic feedback (at 50%) tells user "halfway there"
          if (next >= 50 && prev < 50) {
            Vibration.vibrate(10);
          }

          return Math.min(next, 100); // Cap at 100%
        });
      }, 120);

      // Completion timer: fires after 1.2 seconds
      holdTimerRef.current = setTimeout(() => {
        handleHoldComplete(coordinate);
      }, 1200);
    },
    [isNavigating, clearAllTimers] // ✅ Added clearAllTimers to dependencies
  );

  /**
   * Handler for successful hold completion
   *
   * Shows a dialog with options:
   * 1. Set as Destination (start routing)
   * 2. Report Obstacle Here (navigate to Report screen)
   *
   * @param coordinate - The selected location
   */
  const handleHoldComplete = useCallback(
    (coordinate: UserLocation) => {
      // Safety check: ensure timers exist before clearing
      if (!holdTimerRef.current || !progressTimerRef.current) {
        console.warn("[useMapInteraction] Timer refs not initialized");
        return;
      }

      // Clean up timers
      clearAllTimers();

      // Success haptic pattern: buzz-pause-buzz (feels like "confirmation")
      // Pattern: [0ms delay, 100ms buzz, 50ms pause, 100ms buzz]
      Vibration.vibrate([0, 100, 50, 100]);

      // Reset visual state
      setIsHoldingMap(false);
      setHoldProgress(0);

      // Find contextual information about selected location
      const nearestInfo = findNearestPOI(coordinate);

      // Show action dialog
      Alert.alert(
        "Location Selected",
        nearestInfo
          ? `Near ${nearestInfo.poi.name} (${Math.round(
              nearestInfo.distance
            )}m away)`
          : "Custom location selected",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Set as Destination",
            onPress: () => {
              onLocationSelected(
                coordinate,
                nearestInfo
                  ? {
                      name: nearestInfo.poi.name,
                      distance: nearestInfo.distance,
                    }
                  : undefined
              );
            },
          },
          {
            text: "Report Obstacle Here",
            onPress: () => {
              onReportAtLocation(coordinate);
            },
          },
        ]
      );

      // Clear the hold location marker
      setHoldLocation(null);
    },
    [clearAllTimers, findNearestPOI, onLocationSelected, onReportAtLocation]
  );

  return {
    // State
    isHoldingMap,
    holdLocation,
    holdProgress,

    // Handlers
    handleMapLongPress,
    // ✅ REMOVED: handleMapPressOut - not needed for MapView
  };
};
