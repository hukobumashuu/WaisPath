// src/components/ProximityAlertsOverlay.tsx
// FIXED: Simple display that trusts the hook's data

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ProximityAlert } from "../services/proximityDetectionService";

interface ProximityAlertsOverlayProps {
  alerts: ProximityAlert[];
  onAlertPress: (alert: ProximityAlert) => void;
}

export const ProximityAlertsOverlay = React.memo<ProximityAlertsOverlayProps>(
  function ProximityAlertsOverlay({ alerts, onAlertPress }) {
    // Simple manual dismiss tracking
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const handleDismissAlert = (obstacleId: string, event: any) => {
      event.stopPropagation();
      console.log(`📱 Manually dismissing: ${obstacleId}`);
      setDismissedIds((prev) => new Set(prev).add(obstacleId));
    };

    // Filter out dismissed alerts
    const visibleAlerts = (alerts || []).filter(
      (alert) => !dismissedIds.has(alert.obstacle.id)
    );

    if (visibleAlerts.length === 0) return null;

    return (
      <View style={styles.proximityAlertsContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.alertsTitle}>⚠️ Obstacles Ahead</Text>
          <Text style={styles.alertCount}>{visibleAlerts.length}</Text>
        </View>

        {visibleAlerts.slice(0, 3).map((alert, index) => (
          <View key={alert.obstacle.id} style={styles.alertItemContainer}>
            <TouchableOpacity
              style={[
                styles.alertItem,
                alert.severity === "blocking" && styles.blockingAlert,
                index === visibleAlerts.slice(0, 3).length - 1 &&
                  styles.lastAlertItem,
              ]}
              onPress={() => onAlertPress(alert)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${alert.obstacle.type.replace(
                "_",
                " "
              )} obstacle ${Math.round(alert.distance)} meters ahead`}
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

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={(e) => handleDismissAlert(alert.obstacle.id, e)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {visibleAlerts.length > 3 && (
          <View style={styles.moreAlertsIndicator}>
            <Text style={styles.moreAlertsText}>
              +{visibleAlerts.length - 3} more obstacles
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
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
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
