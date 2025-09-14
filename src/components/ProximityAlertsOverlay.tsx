// src/components/ProximityAlertsOverlay.tsx
// ENHANCED: Persistent proximity alerts with longer display duration
// Alerts stay visible longer for better PWD accessibility

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ProximityAlert } from "../services/proximityDetectionService";

interface ProximityAlertsOverlayProps {
  alerts: ProximityAlert[];
  onAlertPress: (alert: ProximityAlert) => void;
}

export const ProximityAlertsOverlay = React.memo<ProximityAlertsOverlayProps>(
  function ProximityAlertsOverlay({ alerts, onAlertPress }) {
    // 🔥 NEW: Persistent alerts state with longer display duration
    const [displayedAlerts, setDisplayedAlerts] = useState<ProximityAlert[]>(
      []
    );
    const [alertTimestamps, setAlertTimestamps] = useState<Map<string, number>>(
      new Map()
    );

    const ALERT_DISPLAY_DURATION = 10000; // 15 seconds display time
    const ALERT_FADE_THRESHOLD = 8000; // Start fading after 12 seconds

    useEffect(() => {
      const now = Date.now();

      // Add new alerts to displayed alerts
      const newAlerts = alerts.filter(
        (alert) => !alertTimestamps.has(alert.obstacle.id)
      );

      if (newAlerts.length > 0) {
        console.log(
          `📱 Adding ${newAlerts.length} new proximity alerts to display`
        );

        const newTimestamps = new Map(alertTimestamps);
        const updatedDisplayed = [...displayedAlerts];

        newAlerts.forEach((alert) => {
          newTimestamps.set(alert.obstacle.id, now);
          // Replace if exists, otherwise add
          const existingIndex = updatedDisplayed.findIndex(
            (existing) => existing.obstacle.id === alert.obstacle.id
          );
          if (existingIndex >= 0) {
            updatedDisplayed[existingIndex] = alert;
          } else {
            updatedDisplayed.push(alert);
          }
        });

        setAlertTimestamps(newTimestamps);
        setDisplayedAlerts(updatedDisplayed);
      }

      // Set up cleanup timer to remove old alerts
      const cleanupTimer = setTimeout(() => {
        const currentTime = Date.now();
        const updatedTimestamps = new Map();
        const filteredAlerts: ProximityAlert[] = [];

        displayedAlerts.forEach((alert) => {
          const timestamp = alertTimestamps.get(alert.obstacle.id);
          if (timestamp && currentTime - timestamp < ALERT_DISPLAY_DURATION) {
            updatedTimestamps.set(alert.obstacle.id, timestamp);
            filteredAlerts.push(alert);
          } else {
            console.log(
              `📱 Removing expired proximity alert: ${alert.obstacle.type}`
            );
          }
        });

        if (filteredAlerts.length !== displayedAlerts.length) {
          setAlertTimestamps(updatedTimestamps);
          setDisplayedAlerts(filteredAlerts);
        }
      }, 1000); // Check every second for cleanup

      return () => clearTimeout(cleanupTimer);
    }, [alerts, displayedAlerts, alertTimestamps]);

    // Function to get alert opacity based on age
    const getAlertOpacity = (obstacleId: string): number => {
      const timestamp = alertTimestamps.get(obstacleId);
      if (!timestamp) return 1;

      const age = Date.now() - timestamp;
      if (age < ALERT_FADE_THRESHOLD) {
        return 1; // Full opacity
      } else {
        // Fade from 1 to 0.7 over the remaining time
        const fadeProgress =
          (age - ALERT_FADE_THRESHOLD) /
          (ALERT_DISPLAY_DURATION - ALERT_FADE_THRESHOLD);
        return Math.max(0.7, 1 - fadeProgress * 0.3);
      }
    };

    // Manual dismiss function
    const handleDismissAlert = (obstacleId: string, event: any) => {
      event.stopPropagation(); // Prevent triggering onAlertPress

      console.log(`📱 Manually dismissing proximity alert: ${obstacleId}`);

      const updatedTimestamps = new Map(alertTimestamps);
      updatedTimestamps.delete(obstacleId);

      const filteredAlerts = displayedAlerts.filter(
        (alert) => alert.obstacle.id !== obstacleId
      );

      setAlertTimestamps(updatedTimestamps);
      setDisplayedAlerts(filteredAlerts);
    };

    // Don't show if no displayed alerts
    if (!displayedAlerts || displayedAlerts.length === 0) return null;

    return (
      <View style={styles.proximityAlertsContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.alertsTitle}>⚠️ Obstacles Ahead</Text>
          <Text style={styles.alertCount}>{displayedAlerts.length}</Text>
        </View>

        {displayedAlerts.slice(0, 3).map((alert, index) => {
          const opacity = getAlertOpacity(alert.obstacle.id);
          const isExpiring = opacity < 1;

          return (
            <View
              key={alert.obstacle.id}
              style={[
                styles.alertItemContainer,
                { opacity },
                isExpiring && styles.expiringAlert,
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.alertItem,
                  alert.severity === "blocking" && styles.blockingAlert,
                  index === displayedAlerts.slice(0, 3).length - 1 &&
                    styles.lastAlertItem,
                ]}
                onPress={() => onAlertPress(alert)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${alert.obstacle.type.replace(
                  "_",
                  " "
                )} obstacle ${Math.round(alert.distance)} meters ahead`}
                accessibilityHint="Tap for details and alternative routes"
              >
                <View style={styles.alertMainContent}>
                  <View style={styles.alertTextContainer}>
                    <Text style={styles.alertType}>
                      {alert.obstacle.type.replace("_", " ")}
                    </Text>
                    <Text style={styles.alertDistance}>
                      {Math.round(alert.distance)}m ahead
                    </Text>
                  </View>

                  <View style={styles.urgencyContainer}>
                    <View
                      style={[
                        styles.urgencyIndicator,
                        {
                          backgroundColor:
                            alert.urgency > 70
                              ? "#EF4444"
                              : alert.urgency > 40
                              ? "#F59E0B"
                              : "#10B981",
                        },
                      ]}
                    />
                    <Text style={styles.urgencyText}>
                      {alert.urgency > 70
                        ? "High"
                        : alert.urgency > 40
                        ? "Med"
                        : "Low"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}

        {displayedAlerts.length > 3 && (
          <View style={styles.moreAlertsIndicator}>
            <Text style={styles.moreAlertsText}>
              +{displayedAlerts.length - 3} more obstacles
            </Text>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  proximityAlertsContainer: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  alertsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F59E0B",
  },

  alertCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: "hidden",
  },

  // 🔥 NEW: Container for alert item with dismiss button
  alertItemContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  alertItem: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    minHeight: 48,
  },

  lastAlertItem: {
    borderBottomWidth: 0,
  },

  blockingAlert: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    paddingLeft: 12,
    borderRadius: 8,
    marginVertical: 2,
  },

  // 🔥 NEW: Styling for expiring alerts
  expiringAlert: {
    borderWidth: 1,
    borderColor: "#FEF3C7",
    borderRadius: 8,
  },

  alertMainContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  alertTextContainer: {
    flex: 1,
    marginRight: 12,
  },

  alertType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    textTransform: "capitalize",
    lineHeight: 20,
  },

  alertDistance: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },

  urgencyContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
  },

  urgencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 2,
  },

  urgencyText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },

  // 🔥 REMOVED: Dismiss button styles - not needed
  moreAlertsIndicator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    alignItems: "center",
  },

  moreAlertsText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
});
