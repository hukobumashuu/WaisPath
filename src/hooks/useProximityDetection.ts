// src/hooks/useProximityDetection.ts
// FIXED: Priority-based TTS with distance sorting + immediate modal display

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

      // Filter critical alerts (within 50m and high severity)
      const criticalAlerts = alerts.filter(
        (alert) =>
          alert.distance < 50 &&
          (alert.severity === "blocking" || alert.severity === "high")
      );

      // 🔥 CRITICAL FIX: Update UI state IMMEDIATELY - don't wait for TTS
      setState((prev) => ({
        ...prev,
        proximityAlerts: alerts || [],
        criticalAlerts,
        lastDetectionTime: new Date(),
        detectionError: null,
      }));

      // 🔥 FIXED: Handle modal display FIRST, then TTS in background
      const currentCriticalIds = new Set(
        criticalAlerts.map((alert) => alert.obstacle.id)
      );

      // Trigger critical obstacle callback for new alerts IMMEDIATELY
      if (onCriticalObstacle) {
        const newCriticalAlerts = criticalAlerts.filter(
          (alert) => !lastCriticalIdsRef.current.has(alert.obstacle.id)
        );

        // 🔥 SHOW MODALS IMMEDIATELY - don't wait for TTS
        for (const alert of newCriticalAlerts) {
          onCriticalObstacle(alert);
        }
      }

      // 🔥 PRIORITY FIX: Sort new alerts by distance (closest first) for TTS priority
      const newCriticalAlerts = criticalAlerts
        .filter((alert) => !lastCriticalIdsRef.current.has(alert.obstacle.id))
        .sort((a, b) => a.distance - b.distance); // Closest obstacles announced first

      // 🔥 FIXED: Only process NEW alerts once, not all critical alerts
      if (newCriticalAlerts.length > 0 && userProfile) {
        console.log(
          `🔊 TTS: Processing ${newCriticalAlerts.length} new alerts sorted by distance`
        );

        // 🔥 CRITICAL FIX: Process each NEW alert only once
        for (const alert of newCriticalAlerts) {
          // 🔥 NON-BLOCKING: Fire and forget TTS (no await, no setTimeout delays)
          textToSpeechService
            .announceProximityAlert(alert.obstacle, alert.distance, userProfile)
            .then(() => {
              // FIXED: Log AFTER the announcement actually completes
              console.log(
                `🔊 TTS: Queue processed for ${alert.obstacle.type} at ${alert.distance}m`
              );
            })
            .catch((error: unknown) => {
              console.warn("🔊 TTS: Failed to announce obstacle:", error);
              // Don't break proximity detection if TTS fails
            });
        }
      }

      // Update tracking reference
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
        // Run initial detection
        await runDetection();

        // Set up interval for continuous monitoring (every 3 seconds)
        detectionIntervalRef.current = setInterval(runDetection, 3000);

        console.log("🔍 Proximity detection started");
      } catch (error) {
        console.error("❌ Failed to start proximity detection:", error);
        setState((prev) => ({
          ...prev,
          detectionError:
            error instanceof Error
              ? error.message
              : "Failed to start detection",
          isDetecting: false,
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

      setState((prev) => ({
        ...prev,
        isDetecting: false,
      }));

      console.log("🔍 Proximity detection stopped");
    };
  }, [isNavigating, userLocation, routePolyline, userProfile, runDetection]);

  return state;
}

export type { UseProximityDetectionOptions, ProximityDetectionState };
