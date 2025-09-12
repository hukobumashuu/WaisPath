// src/hooks/useProximityDetection.ts
// Complete React Hook for integrating proximity detection into NavigationScreen
// Extracted from NavigationScreen to reduce complexity and improve reusability

import { useState, useEffect, useRef, useCallback } from "react";
import {
  proximityDetectionService,
  ProximityAlert,
} from "../services/proximityDetectionService";
import { UserLocation, UserMobilityProfile } from "../types";
import { textToSpeechService } from "../services/textToSpeechService";

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

      // Filter critical alerts (within 50m and high severity) - EXISTING CODE
      const criticalAlerts = alerts.filter(
        (alert) =>
          alert.distance < 50 &&
          (alert.severity === "blocking" || alert.severity === "high")
      );

      // NEW: Add TTS announcements for new critical alerts
      for (const alert of criticalAlerts) {
        const isNewAlert = !lastCriticalIdsRef.current.has(alert.obstacle.id);
        if (isNewAlert && userProfile) {
          try {
            await textToSpeechService.announceProximityAlert(
              alert.obstacle,
              alert.distance,
              userProfile
            );
            console.log(
              `🔊 TTS: Announced obstacle ${alert.obstacle.type} at ${alert.distance}m`
            );
          } catch (ttsError) {
            console.warn("🔊 TTS: Failed to announce obstacle:", ttsError);
            // Don't break proximity detection if TTS fails
          }
        }
      }

      // EXISTING CODE continues unchanged...
      setState((prev) => ({
        ...prev,
        proximityAlerts: alerts || [],
        criticalAlerts,
        lastDetectionTime: new Date(),
        detectionError: null,
      }));

      // Update critical obstacle tracking - EXISTING CODE
      const currentCriticalIds = new Set(
        criticalAlerts.map((alert) => alert.obstacle.id)
      );

      // Trigger critical obstacle callback for new alerts - EXISTING CODE
      if (onCriticalObstacle) {
        const newCriticalAlerts = criticalAlerts.filter(
          (alert) => !lastCriticalIdsRef.current.has(alert.obstacle.id)
        );

        for (const alert of newCriticalAlerts) {
          onCriticalObstacle(alert);
        }
      }

      // Update tracking reference - EXISTING CODE
      lastCriticalIdsRef.current = currentCriticalIds;
      lastLocationRef.current = userLocation;

      if (__DEV__ && alerts.length > 0) {
        console.log(
          `🚨 Proximity: ${alerts.length} alerts, ${criticalAlerts.length} critical`
        );
      }
    } catch (error) {
      console.error("❌ Proximity detection error:", error);
      setState((prev) => ({
        ...prev,
        detectionError:
          error instanceof Error ? error.message : "Unknown error",
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
