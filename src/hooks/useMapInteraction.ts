// src/hooks/useMapInteraction.ts
// ✅ COMPLETE FIX: Removed POI context + Added location check

import { useState, useRef, useCallback, useEffect } from "react";
import { Vibration, Alert } from "react-native";
import { UserLocation, PointOfInterest } from "../types";

/**
 * Custom hook for map touch-and-hold interactions
 *
 * Manages 1.2 second hold timer with visual progress and haptic feedback
 * Automatically checks for location availability before proceeding
 */

interface UseMapInteractionProps {
  isNavigating: boolean;
  nearbyPOIs: PointOfInterest[];
  currentLocation: UserLocation | null; // ✅ NEW: Need current location to check
  onLocationSelected: (
    location: UserLocation,
    nearestInfo?: { name: string; distance: number }
  ) => void;
  onReportAtLocation: (location: UserLocation) => void;
}

export const useMapInteraction = ({
  isNavigating,
  nearbyPOIs,
  currentLocation, // ✅ NEW
  onLocationSelected,
  onReportAtLocation,
}: UseMapInteractionProps) => {
  const [isHoldingMap, setIsHoldingMap] = useState(false);
  const [holdLocation, setHoldLocation] = useState<UserLocation | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const handleMapLongPress = useCallback(
    (coordinate: UserLocation) => {
      if (isNavigating) return;

      clearAllTimers();

      setHoldLocation(coordinate);
      setIsHoldingMap(true);
      setHoldProgress(0);

      Vibration.vibrate(50);

      progressTimerRef.current = setInterval(() => {
        setHoldProgress((prev) => {
          const next = prev + 10;

          if (next >= 50 && prev < 50) {
            Vibration.vibrate(10);
          }

          return Math.min(next, 100);
        });
      }, 120);

      holdTimerRef.current = setTimeout(() => {
        handleHoldComplete(coordinate);
      }, 1200);
    },
    [isNavigating, clearAllTimers]
  );

  const handleHoldComplete = useCallback(
    (coordinate: UserLocation) => {
      if (!holdTimerRef.current || !progressTimerRef.current) {
        console.warn("[useMapInteraction] Timer refs not initialized");
        return;
      }

      clearAllTimers();

      Vibration.vibrate([0, 100, 50, 100]);

      setIsHoldingMap(false);
      setHoldProgress(0);

      // ✅ FIX: Check location BEFORE showing dialog
      if (!currentLocation) {
        Alert.alert(
          "Location Error",
          "Cannot get your current location. Please ensure GPS is enabled and app has location permission.",
          [{ text: "OK" }]
        );
        setHoldLocation(null);
        return;
      }

      // ✅ SIMPLIFIED: No POI context checking
      Alert.alert(
        "Set Custom Destination?",
        `Coordinates: ${coordinate.latitude.toFixed(
          5
        )}, ${coordinate.longitude.toFixed(5)}`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              setHoldLocation(null);
            },
          },
          {
            text: "Calculate Route",
            onPress: () => {
              onLocationSelected(coordinate, undefined);
              setHoldLocation(null);
            },
          },
          {
            text: "Report Obstacle Here",
            onPress: () => {
              onReportAtLocation(coordinate);
              setHoldLocation(null);
            },
          },
        ]
      );
    },
    [clearAllTimers, currentLocation, onLocationSelected, onReportAtLocation]
  );

  return {
    isHoldingMap,
    holdLocation,
    holdProgress,
    handleMapLongPress,
  };
};
