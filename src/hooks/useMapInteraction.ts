// src/hooks/useMapInteraction.ts
// ✅ FINAL FIX: Use ref to always get FRESH isLocationLoading value

import { useState, useRef, useCallback, useEffect } from "react";
import { Vibration, Alert } from "react-native";
import { UserLocation, PointOfInterest } from "../types";

interface UseMapInteractionProps {
  isNavigating: boolean;
  nearbyPOIs: PointOfInterest[];
  isLocationLoading: boolean;
  onLocationSelected: (
    location: UserLocation,
    nearestInfo?: { name: string; distance: number }
  ) => void;
  onReportAtLocation: (location: UserLocation) => void;
}

export const useMapInteraction = ({
  isNavigating,
  nearbyPOIs,
  isLocationLoading,
  onLocationSelected,
  onReportAtLocation,
}: UseMapInteractionProps) => {
  const [isHoldingMap, setIsHoldingMap] = useState(false);
  const [holdLocation, setHoldLocation] = useState<UserLocation | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ CRITICAL FIX: Store isLocationLoading in ref to always get fresh value
  const isLocationLoadingRef = useRef(isLocationLoading);

  // ✅ Update ref whenever isLocationLoading changes
  useEffect(() => {
    isLocationLoadingRef.current = isLocationLoading;
    console.log(
      "🔍 [useMapInteraction] isLocationLoading updated to:",
      isLocationLoading
    );
  }, [isLocationLoading]);

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

      // ✅ CRITICAL FIX: Read from ref to get FRESH value
      const currentLoadingState = isLocationLoadingRef.current;
      console.log(
        "🔍 [handleHoldComplete] Checking isLocationLoading from REF:",
        currentLoadingState
      );

      if (currentLoadingState) {
        console.log(
          "❌ [handleHoldComplete] SHOWING LOADING ALERT - isLocationLoading is TRUE"
        );
        Alert.alert(
          "⏳ Loading Location",
          "Please wait while we get your GPS location. This usually takes just a few seconds.",
          [
            {
              text: "OK",
              onPress: () => {
                setHoldLocation(null);
              },
            },
          ]
        );
        return;
      }

      console.log(
        "✅ [handleHoldComplete] PASSED - isLocationLoading is FALSE, showing dialog"
      );

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
    [clearAllTimers, onLocationSelected, onReportAtLocation] // ✅ Removed isLocationLoading from deps - using ref instead
  );

  return {
    isHoldingMap,
    holdLocation,
    holdProgress,
    handleMapLongPress,
  };
};
