// src/hooks/useLocation.ts
// 🔥 CRITICAL FIX: Enable continuous location tracking for navigation

import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { UserLocation } from "../types";

// Pasig City center coordinates for fallback ONLY in case of errors
const PASIG_CENTER: UserLocation = {
  latitude: 14.5764,
  longitude: 121.0851,
  accuracy: 100,
};

interface LocationState {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    loading: true,
    error: null,
    hasPermission: false,
  });

  // 🔥 NEW: Store subscription reference for cleanup
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );

  // Get initial location
  const getCurrentLocation = async (): Promise<UserLocation> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      console.log("📍 Requesting location permission...");

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("❌ Location permission denied");
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            "Location permission denied. Using Pasig City center for demo.",
          hasPermission: false,
          location: PASIG_CENTER,
        }));
        return PASIG_CENTER;
      }

      console.log(
        "✅ Location permission granted, getting current position..."
      );

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
      });

      console.log(
        `📍 Got real user location: ${position.coords.latitude}, ${position.coords.longitude}`
      );

      const userLocation: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined,
      };

      setState((prev) => ({
        ...prev,
        loading: false,
        hasPermission: true,
        location: userLocation,
        error: null,
      }));

      console.log("✅ Initial location set:", userLocation);

      return userLocation;
    } catch (error: any) {
      console.log("❌ Location error:", error.message);

      let errorMessage = "Could not get location. Using Pasig City center.";

      if (error.message?.includes("timeout")) {
        errorMessage =
          "Location timeout. Please check GPS signal. Using Pasig City center.";
      } else if (error.message?.includes("Location provider is disabled")) {
        errorMessage =
          "GPS is disabled. Please enable location services. Using Pasig City center.";
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
        hasPermission: true,
        location: PASIG_CENTER,
      }));

      return PASIG_CENTER;
    }
  };

  // 🔥 CRITICAL FIX: Start continuous location tracking
  const startWatchingLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("❌ Cannot watch location - permission denied");
        return;
      }

      console.log("🔄 Starting continuous location tracking...");

      // 🔥 IMPORTANT: Store subscription for cleanup
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3000, // 🔥 Update every 3 seconds (matches detection interval)
          distanceInterval: 3, // 🔥 Update when moved 3 meters (matches detection threshold)
        },
        (position) => {
          const newLocation: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || undefined,
          };

          console.log("📍 Location update:", {
            lat: newLocation.latitude.toFixed(6),
            lng: newLocation.longitude.toFixed(6),
            accuracy: newLocation.accuracy?.toFixed(1) + "m",
          });

          setState((prev) => ({
            ...prev,
            location: newLocation,
          }));
        }
      );

      console.log(
        "✅ Location tracking started - updates every 3s or 3m movement"
      );
    } catch (error) {
      console.error("❌ Failed to start location tracking:", error);
    }
  };

  // 🔥 CRITICAL FIX: Auto-start tracking on mount
  useEffect(() => {
    let isMounted = true;

    const initializeLocation = async () => {
      // Get initial location
      await getCurrentLocation();

      // Start continuous tracking
      if (isMounted) {
        await startWatchingLocation();
      }
    };

    initializeLocation();

    // 🔥 CRITICAL: Cleanup on unmount
    return () => {
      isMounted = false;

      if (locationSubscription.current) {
        console.log("🛑 Stopping location tracking...");
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, []);

  // Helper functions
  const isNearPasig = (location: UserLocation): boolean => {
    const pasigBounds = {
      north: 14.62,
      south: 14.53,
      east: 121.12,
      west: 121.04,
    };

    return (
      location.latitude >= pasigBounds.south &&
      location.latitude <= pasigBounds.north &&
      location.longitude >= pasigBounds.west &&
      location.longitude <= pasigBounds.east
    );
  };

  return {
    ...state,
    getCurrentLocation,
    pasigCenter: PASIG_CENTER,
    isNearPasig,
  };
}
