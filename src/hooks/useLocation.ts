// src/hooks/useLocation.ts
// FIXED: Proper error handling and location permissions

import { useState, useEffect } from "react";
import * as Location from "expo-location";
import { UserLocation } from "../types";

// Pasig City center coordinates for fallback
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

  // Get user location with Pasig fallback
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
          error: "Location permission denied. Using Pasig City center.",
          hasPermission: false,
          location: PASIG_CENTER,
        }));
        return PASIG_CENTER;
      }

      console.log(
        "✅ Location permission granted, getting current position..."
      );

      // Get current position with longer timeout for Filipino networks
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000, // 15 seconds timeout for slow networks
      });

      console.log(
        `📍 Got location: ${position.coords.latitude}, ${position.coords.longitude}`
      );

      const userLocation: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined,
      };

      // Check if user is reasonably near Pasig (for development/testing)
      const isInPasigArea = isNearPasig(userLocation);
      console.log(`🗺️ Is in Pasig area: ${isInPasigArea}`);

      const finalLocation = isInPasigArea ? userLocation : PASIG_CENTER;

      // FIXED: Only show demo message if using fallback location
      const locationNote = !isInPasigArea
        ? "Using Pasig City center for demo purposes"
        : null;

      setState((prev) => ({
        ...prev,
        loading: false,
        hasPermission: true,
        location: finalLocation,
        error: locationNote, // This is just informational, not an error
      }));

      console.log("✅ Location successfully set:", finalLocation);
      return finalLocation;
    } catch (error: any) {
      console.log("❌ Location error:", error.message);

      // Provide more specific error messages
      let errorMessage = "Could not get location. Using Pasig City center.";

      if (
        error.message?.includes("timeout") ||
        error.message?.includes("Location request timed out")
      ) {
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
        hasPermission: true, // FIXED: We still have permission, just couldn't get location
        location: PASIG_CENTER,
      }));

      return PASIG_CENTER;
    }
  };

  // Simple check if coordinates are near Pasig City (rough bounds)
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

  // Watch location updates (for when user is moving)
  const watchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 50, // Update when moved 50 meters
        },
        (position) => {
          const newLocation: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || undefined,
          };

          console.log("📍 Location update:", newLocation);

          setState((prev) => ({
            ...prev,
            location: newLocation,
          }));
        }
      );
    } catch (error) {
      console.log("Watch location error:", error);
    }
  };

  // Initialize location on hook mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    ...state,
    getCurrentLocation,
    watchLocation,
    pasigCenter: PASIG_CENTER,
    isNearPasig,
  };
}
