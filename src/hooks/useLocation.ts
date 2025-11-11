// src/hooks/useLocation.ts
// 🔥 CRITICAL DEBUG: Add logs to see why loading stays true

import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { UserLocation } from "../types";

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

  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );

  const getCurrentLocation = async (): Promise<UserLocation> => {
    try {
      // ✅ DEBUG: Log before setting loading
      console.log("🔍 [useLocation] Setting loading: true");
      setState((prev) => ({ ...prev, loading: true, error: null }));

      console.log("📍 Requesting location permission...");

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("❌ Location permission denied");
        // ✅ DEBUG: Log setting loading false (permission denied)
        console.log(
          "🔍 [useLocation] Permission denied - Setting loading: false"
        );
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied.",
          hasPermission: false,
          location: PASIG_CENTER,
        }));
        return PASIG_CENTER;
      }

      console.log(
        "✅ Location permission granted, getting current position..."
      );

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

      // ✅ CRITICAL DEBUG: Log BEFORE and AFTER setState
      console.log(
        "🔍 [useLocation] BEFORE setState - About to set loading: false"
      );
      setState((prev) => {
        console.log(
          "🔍 [useLocation] INSIDE setState callback - prev.loading:",
          prev.loading
        );
        return {
          ...prev,
          loading: false, // ✅ This should set loading to false
          hasPermission: true,
          location: userLocation,
          error: null,
        };
      });
      console.log(
        "🔍 [useLocation] AFTER setState - loading should now be false"
      );

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

      // ✅ DEBUG: Log setting loading false (error case)
      console.log("🔍 [useLocation] Error occurred - Setting loading: false");
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

  const startWatchingLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("❌ Cannot watch location - permission denied");
        return;
      }

      console.log("🔄 Starting continuous location tracking...");

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3000,
          distanceInterval: 3,
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

          // ✅ IMPORTANT: Don't change loading state during updates
          setState((prev) => ({
            ...prev,
            location: newLocation,
            // loading stays as-is (should already be false)
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

  useEffect(() => {
    let isMounted = true;

    const initializeLocation = async () => {
      console.log("🔍 [useLocation] useEffect - Starting initialization");
      await getCurrentLocation();
      console.log("🔍 [useLocation] useEffect - getCurrentLocation finished");

      if (isMounted) {
        await startWatchingLocation();
        console.log(
          "🔍 [useLocation] useEffect - startWatchingLocation finished"
        );
      }
    };

    initializeLocation();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        console.log("🛑 Stopping location tracking...");
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, []);

  // ✅ CRITICAL DEBUG: Log whenever state changes
  useEffect(() => {
    console.log("🔍 [useLocation] State changed:", {
      hasLocation: !!state.location,
      loading: state.loading,
      hasPermission: state.hasPermission,
      error: state.error,
    });
  }, [state]);

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
