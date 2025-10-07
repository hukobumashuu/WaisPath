// src/hooks/useProximityDetection.ts
// 🔥 UPDATED: Integration with improved TTS service

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

  // 🔥 NEW: Update TTS service with user location for distance-based cleanup
  useEffect(() => {
    if (userLocation) {
      textToSpeechService.updateUserLocation(userLocation);
    }
  }, [userLocation]);

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

      // 🔥 IMPROVED: Handle modal display FIRST, then TTS in background
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

      // 🔥 IMPROVED: Process ALL critical alerts (both new and existing) for TTS
      // This ensures consistent announcements even if detection timing varies
      if (criticalAlerts.length > 0 && userProfile) {
        console.log(
          `🔊 TTS: Processing ${criticalAlerts.length} critical alerts for announcements`
        );

        // 🔥 CRITICAL IMPROVEMENT: Let TTS service handle deduplication
        // We pass ALL critical alerts and let the improved TTS service decide what to announce
        for (const alert of criticalAlerts) {
          // 🔥 NON-BLOCKING: Fire and forget TTS (no await, no setTimeout delays)
          textToSpeechService
            .announceProximityAlert(alert.obstacle, alert.distance, userProfile)
            .then(() => {
              // Success logging handled in TTS service
              if (__DEV__) {
                console.log(
                  `🔊 TTS: Processed announcement for ${alert.obstacle.type} at ${alert.distance}m`
                );
              }
            })
            .catch((error: unknown) => {
              console.warn(
                "🔊 TTS: Failed to process obstacle announcement:",
                error
              );
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

        // 🔥 NEW: Debug TTS state
        const ttsDebug = textToSpeechService.getDebugInfo();
        console.log(
          `🔊 TTS State: Queue: ${ttsDebug.queueLength}, Tracked: ${ttsDebug.trackedObstacles}, Processing: ${ttsDebug.isProcessing}, Speaking: ${ttsDebug.isSpeaking}`
        );
      }
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

  // Start/stop detection based on navigation state
  useEffect(() => {
    if (isNavigating && userLocation && userProfile) {
      // Start periodic detection
      setState((prev) => ({
        ...prev,
        isDetecting: true,
        detectionError: null,
      }));

      // Run initial detection
      runDetection();

      // Set up periodic detection every 2 seconds
      detectionIntervalRef.current = setInterval(runDetection, 5000);

      console.log("🚨 Proximity detection started");
    } else {
      // Stop detection
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        isDetecting: false,
        proximityAlerts: [],
        criticalAlerts: [],
      }));

      // Reset tracking
      lastCriticalIdsRef.current.clear();
      lastLocationRef.current = null;

      console.log("🚨 Proximity detection stopped");
    }

    // Cleanup on unmount
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isNavigating, userLocation, userProfile, runDetection]);

  // 🔥 KEEP IT SIMPLE: Just return the state as before
  return state;
}

export type { UseProximityDetectionOptions, ProximityDetectionState };
