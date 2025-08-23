// src/hooks/useProximityDetection.ts
// React Hook for integrating proximity detection into NavigationScreen

import { useState, useEffect, useRef } from "react";
import {
  proximityDetectionService,
  ProximityAlert,
} from "../services/proximityDetectionService";
import { UserLocation, UserMobilityProfile } from "../types";

interface UseProximityDetectionOptions {
  isNavigating: boolean;
  userLocation: UserLocation | null;
  routePolyline: UserLocation[];
  userProfile: UserMobilityProfile;
  onCriticalObstacle?: (alert: ProximityAlert) => void;
}

interface ProximityDetectionState {
  proximityAlerts: ProximityAlert[];
  isDetecting: boolean;
  lastDetectionTime: Date | null;
  criticalAlerts: ProximityAlert[];
  detectionError: string | null;
}

export function useProximityDetection({
  isNavigating,
  userLocation,
  routePolyline,
  userProfile,
  onCriticalObstacle,
}: UseProximityDetectionOptions): ProximityDetectionState {
  const [state, setState] = useState<ProximityDetectionState>({
    proximityAlerts: [],
    isDetecting: false,
    lastDetectionTime: null,
    criticalAlerts: [],
    detectionError: null,
  });

  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<UserLocation | null>(null);

  // Main detection effect
  useEffect(() => {
    if (!isNavigating || !userLocation || routePolyline.length < 2) {
      // Stop detection when not navigating
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        proximityAlerts: [],
        isDetecting: false,
        criticalAlerts: [],
      }));

      return;
    }

    // Start proximity detection monitoring
    const startDetection = async () => {
      setState((prev) => ({
        ...prev,
        isDetecting: true,
        detectionError: null,
      }));

      try {
        console.log("🔍 Starting proximity detection monitoring...");

        // Run initial detection
        await runDetection();

        // Set up periodic detection
        detectionIntervalRef.current = setInterval(async () => {
          await runDetection();
        }, 5000); // Every 5 seconds
      } catch (error) {
        console.error("❌ Failed to start proximity detection:", error);
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          detectionError: "Failed to start obstacle detection",
        }));
      }
    };

    startDetection();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isNavigating, userLocation, routePolyline, userProfile]);

  // Detection function
  const runDetection = async () => {
    if (!userLocation || !isNavigating) return;

    try {
      const alerts = await proximityDetectionService.detectObstaclesAhead(
        userLocation,
        routePolyline,
        userProfile
      );

      // Filter critical alerts (within 50m and high severity)
      const criticalAlerts = alerts.filter(
        (alert) =>
          alert.distance < 50 &&
          (alert.severity === "blocking" || alert.severity === "high")
      );

      setState((prev) => ({
        ...prev,
        proximityAlerts: alerts,
        criticalAlerts,
        lastDetectionTime: new Date(),
        detectionError: null,
      }));

      // Handle critical obstacles
      if (criticalAlerts.length > 0 && onCriticalObstacle) {
        const mostCritical = criticalAlerts[0]; // Highest urgency (already sorted)

        // Check if this is a new critical obstacle (avoid spam)
        const wasAlreadyCritical = state.criticalAlerts.some(
          (existing) => existing.obstacle.id === mostCritical.obstacle.id
        );

        if (!wasAlreadyCritical) {
          console.log(
            "🚨 New critical obstacle detected:",
            mostCritical.obstacle.type
          );
          onCriticalObstacle(mostCritical);
        }
      }

      lastLocationRef.current = userLocation;
    } catch (error) {
      console.error("❌ Proximity detection error:", error);
      setState((prev) => ({
        ...prev,
        detectionError: "Detection failed - using cached data",
        isDetecting: false,
      }));
    }
  };

  return state;
}

// Additional utility hook for obstacle warnings
export function useObstacleWarnings(proximityAlerts: ProximityAlert[]) {
  const [shownWarnings, setShownWarnings] = useState<Set<string>>(new Set());

  // Get new warnings that haven't been shown yet
  const newWarnings = proximityAlerts.filter(
    (alert) =>
      !shownWarnings.has(alert.obstacle.id) &&
      alert.distance < 100 &&
      alert.urgency > 50
  );

  // Mark warnings as shown
  const markWarningShown = (obstacleId: string) => {
    setShownWarnings((prev) => new Set([...prev, obstacleId]));
  };

  // Clear shown warnings (call when navigation ends)
  const clearShownWarnings = () => {
    setShownWarnings(new Set());
  };

  return {
    newWarnings,
    markWarningShown,
    clearShownWarnings,
  };
}
