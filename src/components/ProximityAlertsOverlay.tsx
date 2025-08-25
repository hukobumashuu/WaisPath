// src/components/ProximityAlertsOverlay.tsx
// Extracted component for displaying proximity alerts during navigation
// Optimized for PWD accessibility with proper contrast and touch targets

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ProximityAlert } from "../services/proximityDetectionService";

interface ProximityAlertsOverlayProps {
  alerts: ProximityAlert[];
  onAlertPress: (alert: ProximityAlert) => void;
}

export const ProximityAlertsOverlay = React.memo<ProximityAlertsOverlayProps>(
  function ProximityAlertsOverlay({ alerts, onAlertPress }) {
    if (!alerts || alerts.length === 0) return null;

    return (
      <View style={styles.proximityAlertsContainer}>
        <Text style={styles.alertsTitle}>⚠️ Obstacles Ahead</Text>
        {alerts.slice(0, 2).map((alert) => (
          <TouchableOpacity
            key={alert.obstacle.id}
            style={[
              styles.alertItem,
              alert.severity === "blocking" && styles.blockingAlert,
            ]}
            onPress={() => onAlertPress(alert)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${alert.obstacle.type.replace(
              "_",
              " "
            )} obstacle ${alert.distance} meters ahead`}
            accessibilityHint="Tap for details and alternative routes"
          >
            <View style={styles.alertContent}>
              <Text style={styles.alertType}>
                {alert.obstacle.type.replace("_", " ")}
              </Text>
              <Text style={styles.alertDistance}>{alert.distance}m ahead</Text>
            </View>
            <View
              style={[
                styles.urgencyIndicator,
                {
                  backgroundColor: alert.urgency > 70 ? "#EF4444" : "#F59E0B",
                },
              ]}
            />
          </TouchableOpacity>
        ))}
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
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 9,
  },

  alertsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#F59E0B",
    marginBottom: 8,
  },

  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    minHeight: 44, // PWD accessibility - minimum touch target size
  },

  blockingAlert: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    paddingLeft: 8,
    borderRadius: 4,
  },

  alertContent: {
    flex: 1,
  },

  alertType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textTransform: "capitalize",
  },

  alertDistance: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  urgencyIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
