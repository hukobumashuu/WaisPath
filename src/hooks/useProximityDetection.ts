// src/hooks/useProximityDetection.ts
// Complete React Hook for integrating proximity detection into NavigationScreen
// Extracted from NavigationScreen to reduce complexity and improve reusability

import { useState, useEffect, useRef, useCallback } from "react";
import {
  proximityDetectionService,
  ProximityAlert,
} from "../services/proximityDetectionService";
import { UserLocation, UserMobilityProfile } from "../types";

interface UseProximityDetectionOptions {
  isNavigating: boolean;
  userLocation: UserLocation | null;
  routePolyline: UserLocation[];
  userProfile: UserMobilityProfile | null;
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
  const lastCriticalIdsRef = useRef<Set<string>>(new Set());
  const lastLocationRef = useRef<UserLocation | null>(null);

  // Detection function - memoized to prevent unnecessary re-renders
  const runDetection = useCallback(async () => {
    if (!userLocation || !isNavigating || !userProfile) return;

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
        proximityAlerts: alerts || [],
        criticalAlerts,
        lastDetectionTime: new Date(),
        detectionError: null,
      }));

      // Handle critical obstacles - prevent spam notifications
      if (criticalAlerts.length > 0 && onCriticalObstacle) {
        const mostCritical = criticalAlerts[0]; // Highest urgency (already sorted by service)

        // Check if this is a new critical obstacle using ref (avoids stale closure issues)
        if (!lastCriticalIdsRef.current.has(mostCritical.obstacle.id)) {
          if (__DEV__) {
            console.log(
              "🚨 New critical obstacle detected:",
              mostCritical.obstacle.type,
              `at ${mostCritical.distance}m`
            );
          }
          lastCriticalIdsRef.current.add(mostCritical.obstacle.id);
          onCriticalObstacle(mostCritical);
        }
      }

      // Clean up old critical IDs when obstacles are no longer critical (reset logic)
      const currentCriticalIds = new Set(
        criticalAlerts.map((alert) => alert.obstacle.id)
      );

      // Remove IDs that are no longer critical
      const idsToRemove: string[] = [];
      lastCriticalIdsRef.current.forEach((id) => {
        if (!currentCriticalIds.has(id)) {
          idsToRemove.push(id);
        }
      });
      idsToRemove.forEach((id) => lastCriticalIdsRef.current.delete(id));

      lastLocationRef.current = userLocation;
    } catch (error) {
      console.error("❌ Proximity detection error:", error);
      setState((prev) => ({
        ...prev,
        detectionError: "Detection failed - using cached data",
        isDetecting: false,
      }));
    }
  }, [
    userLocation,
    isNavigating,
    userProfile,
    routePolyline,
    onCriticalObstacle,
  ]);

  // Main detection effect
  useEffect(() => {
    if (
      !isNavigating ||
      !userLocation ||
      routePolyline.length < 2 ||
      !userProfile
    ) {
      // Stop detection when not navigating
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }

      // Clear critical obstacle tracking
      lastCriticalIdsRef.current.clear();

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
        if (__DEV__) {
          console.log("🔍 Starting proximity detection monitoring...");
        }

        // Run initial detection
        await runDetection();

        // Use service config for poll interval (default 5 seconds)
        const pollInterval =
          proximityDetectionService.getConfig().updateInterval || 5000;

        // Set up periodic detection
        detectionIntervalRef.current = setInterval(runDetection, pollInterval);
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
      lastCriticalIdsRef.current.clear();
    };
  }, [isNavigating, userLocation, routePolyline, userProfile, runDetection]);

  return state;
}

// ================================================
// BONUS: Additional utility hook for obstacle warnings UI
// ================================================

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
  const markWarningShown = useCallback((obstacleId: string) => {
    setShownWarnings((prev) => new Set([...prev, obstacleId]));
  }, []);

  // Clear shown warnings (call when navigation ends)
  const clearShownWarnings = useCallback(() => {
    setShownWarnings(new Set());
  }, []);

  return {
    newWarnings,
    markWarningShown,
    clearShownWarnings,
  };
}
