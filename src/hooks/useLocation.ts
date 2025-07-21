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
  const getCurrentLocation = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied. Using Pasig City center.",
          hasPermission: false,
          location: PASIG_CENTER,
        }));
        return PASIG_CENTER;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Good balance for Filipino mobile networks
        timeInterval: 10000, // 10 seconds timeout
      });

      const userLocation: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined,
      };

      // Check if user is reasonably near Pasig (for development/testing)
      const isInPasigArea = isNearPasig(userLocation);

      const finalLocation = isInPasigArea ? userLocation : PASIG_CENTER;
      const locationNote = isInPasigArea
        ? null
        : "Using Pasig City center for demo";

      setState((prev) => ({
        ...prev,
        loading: false,
        hasPermission: true,
        location: finalLocation,
        error: locationNote,
      }));

      return finalLocation;
    } catch (error) {
      console.log("Location error:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Could not get location. Using Pasig City center.",
        hasPermission: false,
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
