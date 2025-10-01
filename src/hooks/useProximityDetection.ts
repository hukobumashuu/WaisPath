// src/hooks/useProximityDetection.ts
// 🔥 FIXED: Location-driven detection instead of interval-based
// Now matches the working validation system pattern

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

  // 🔥 REMOVED: detectionIntervalRef - No more setInterval!

  // Track last announced obstacles to prevent spam
  const lastCriticalIdsRef = useRef<Set<string>>(new Set());
  const lastLocationRef = useRef<UserLocation | null>(null);

  // 🔥 NEW: Track last detection time to prevent too-frequent checks
  const lastDetectionTimeRef = useRef<number>(0);
  const MIN_DETECTION_INTERVAL = 1500; // 1.5 seconds minimum between detections

  // 🔥 NEW: Update TTS service with user location for distance-based cleanup
  useEffect(() => {
    if (userLocation) {
      textToSpeechService.updateUserLocation(userLocation);
    }
  }, [userLocation]);

  // 🔥 FIXED: Detection function with stable dependencies
  const runDetection = useCallback(async () => {
    if (!userLocation || !isNavigating || !userProfile) {
      return;
    }

    // 🔥 NEW: Throttle detection to prevent excessive API calls
    const now = Date.now();
    const timeSinceLastDetection = now - lastDetectionTimeRef.current;

    if (timeSinceLastDetection < MIN_DETECTION_INTERVAL) {
      // Skip this detection cycle - too soon after last one
      return;
    }

    lastDetectionTimeRef.current = now;

    try {
      console.log("🚨 Running proximity detection...");

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

      // 🔥 CRITICAL: Update UI state IMMEDIATELY
      setState((prev) => ({
        ...prev,
        proximityAlerts: alerts || [],
        criticalAlerts,
        lastDetectionTime: new Date(),
        detectionError: null,
      }));

      console.log(
        `🚨 Detection complete: ${alerts.length} alerts, ${criticalAlerts.length} critical`
      );

      // 🔥 Handle critical obstacle modals for NEW obstacles only
      const currentCriticalIds = new Set(
        criticalAlerts.map((alert) => alert.obstacle.id)
      );

      if (onCriticalObstacle) {
        const newCriticalAlerts = criticalAlerts.filter(
          (alert) => !lastCriticalIdsRef.current.has(alert.obstacle.id)
        );

        // Show modals for new critical obstacles
        for (const alert of newCriticalAlerts) {
          console.log(
            `🚨 NEW CRITICAL: ${alert.obstacle.type} at ${alert.distance}m`
          );
          onCriticalObstacle(alert);
        }
      }

      // 🔥 Process ALL critical alerts for TTS (service handles deduplication)
      if (criticalAlerts.length > 0 && userProfile) {
        console.log(
          `🔊 TTS: Processing ${criticalAlerts.length} critical alerts for announcements`
        );

        for (const alert of criticalAlerts) {
          // Fire-and-forget TTS (non-blocking)
          textToSpeechService
            .announceProximityAlert(alert.obstacle, alert.distance, userProfile)
            .then(() => {
              if (__DEV__) {
                console.log(
                  `🔊 TTS: Announced ${alert.obstacle.type} at ${alert.distance}m`
                );
              }
            })
            .catch((error: unknown) => {
              console.warn("🔊 TTS: Failed to announce obstacle:", error);
            });
        }
      }

      // Update tracking reference for next cycle
      lastCriticalIdsRef.current = currentCriticalIds;
      lastLocationRef.current = userLocation;
    } catch (error) {
      console.error("❌ Proximity detection error:", error);
      setState((prev) => ({
        ...prev,
        detectionError:
          error instanceof Error
            ? error.message
            : "Unknown proximity detection error",
      }));
    }
  }, [
    userLocation,
    routePolyline,
    userProfile,
    isNavigating,
    onCriticalObstacle,
  ]);

  // 🔥 NEW: Location-driven detection (replaces setInterval)
  // This runs EVERY TIME location updates during navigation
  useEffect(() => {
    if (isNavigating && userLocation && userProfile) {
      // Mark as detecting
      if (!state.isDetecting) {
        setState((prev) => ({
          ...prev,
          isDetecting: true,
          detectionError: null,
        }));
        console.log("🚨 Proximity detection ACTIVE (location-driven)");
      }

      // Run detection on every location update
      runDetection();
    } else {
      // Stop detection and reset state
      if (state.isDetecting) {
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          proximityAlerts: [],
          criticalAlerts: [],
        }));

        // Reset tracking
        lastCriticalIdsRef.current.clear();
        lastLocationRef.current = null;
        lastDetectionTimeRef.current = 0;

        console.log("🚨 Proximity detection STOPPED");
      }
    }
  }, [
    isNavigating,
    userLocation,
    userProfile,
    runDetection,
    state.isDetecting,
  ]);

  // 🔥 REMOVED: Cleanup function for interval (no longer needed)

  return state;
}

export type { UseProximityDetectionOptions, ProximityDetectionState };
