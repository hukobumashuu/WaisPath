// src/components/RouteInfoPanel.tsx
// 🔥 BEAST MODE: Complete Route Information Display Panel
// Extracted from NavigationScreen for better reusability and organization
// PWD-optimized with accessibility features and smart route recommendations

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RouteInfo {
  fastestRoute: {
    duration: number;
    distance: number;
    grade: string;
    polyline: any[];
  };
  accessibleRoute: {
    duration: number;
    distance: number;
    grade: string;
    polyline: any[];
  };
  comparison: {
    recommendation: string;
  };
}

interface RouteInfoPanelProps {
  routeAnalysis: RouteInfo;
  destinationName: string;
  onStartNavigation: (routeType: "fastest" | "accessible") => void;
  onToggleSidewalks: () => void;
  onRecalculate: () => void;
  showSidewalks: boolean;
  style?: any; // For positioning from parent
}

export const RouteInfoPanel = React.memo<RouteInfoPanelProps>(
  function RouteInfoPanel({
    routeAnalysis,
    destinationName,
    onStartNavigation,
    onToggleSidewalks,
    onRecalculate,
    showSidewalks,
    style,
  }) {
    if (!routeAnalysis) return null;

    return (
      <View style={[styles.routeInfoContainer, style]}>
        <View style={styles.routeInfo}>
          {/* 🎯 ROUTE TITLE */}
          <Text style={styles.routeTitle}>🗺️ Routes to {destinationName}</Text>

          {/* 🔥 ROUTE COMPARISON DISPLAY */}
          <View style={styles.routeComparison}>
            {/* FASTEST ROUTE ROW */}
            <View style={styles.routeRow}>
              <View style={styles.routeIndicator}>
                <View
                  style={[styles.routeColor, { backgroundColor: "#EF4444" }]}
                />
                <Text style={styles.routeLabel}>Fastest</Text>
              </View>
              <Text style={styles.routeDetails}>
                {Math.round((routeAnalysis.fastestRoute.duration || 600) / 60)}
                min •{" "}
                {((routeAnalysis.fastestRoute.distance || 1000) / 1000).toFixed(
                  1
                )}
                km • Grade {routeAnalysis.fastestRoute.grade || "B"}
              </Text>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => onStartNavigation("fastest")}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Start fastest route navigation, ${Math.round(
                  (routeAnalysis.fastestRoute.duration || 600) / 60
                )} minutes, grade ${routeAnalysis.fastestRoute.grade || "B"}`}
              >
                <Ionicons name="navigate" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* ACCESSIBLE ROUTE ROW */}
            <View style={styles.routeRow}>
              <View style={styles.routeIndicator}>
                <View
                  style={[styles.routeColor, { backgroundColor: "#22C55E" }]}
                />
                <Text style={styles.routeLabel}>Accessible</Text>
              </View>
              <Text style={styles.routeDetails}>
                {Math.round(
                  (routeAnalysis.accessibleRoute.duration || 600) / 60
                )}
                min •{" "}
                {(
                  (routeAnalysis.accessibleRoute.distance || 1000) / 1000
                ).toFixed(1)}
                km • Grade {routeAnalysis.accessibleRoute.grade || "A"}
              </Text>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => onStartNavigation("accessible")}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Start accessible route navigation, ${Math.round(
                  (routeAnalysis.accessibleRoute.duration || 600) / 60
                )} minutes, grade ${
                  routeAnalysis.accessibleRoute.grade || "A"
                }`}
              >
                <Ionicons name="navigate" size={16} color="#22C55E" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 🧠 INTELLIGENT RECOMMENDATION */}
          <Text style={styles.recommendation}>
            💡 {routeAnalysis.comparison.recommendation}
          </Text>

          {/* 🎮 CONTROL BUTTONS */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={onToggleSidewalks}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={
                showSidewalks
                  ? "Hide sidewalks on map"
                  : "Show sidewalks on map"
              }
            >
              <Ionicons
                name={showSidewalks ? "eye" : "eye-off"}
                size={16}
                color="#6B7280"
              />
              <Text style={styles.controlButtonText}>
                {showSidewalks ? "Hide" : "Show"} Sidewalks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={onRecalculate}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Recalculate routes"
            >
              <Ionicons name="refresh" size={16} color="#6B7280" />
              <Text style={styles.controlButtonText}>Recalculate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  routeInfoContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  routeInfo: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  routeComparison: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    minHeight: 44, // PWD accessibility - minimum touch target
  },
  routeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    width: 90,
  },
  routeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  routeDetails: {
    flex: 1,
    fontSize: 12,
    color: "#1F2937",
    marginLeft: 8,
  },
  navigateBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
    minWidth: 44, // PWD accessibility - minimum touch target
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  recommendation: {
    fontSize: 12,
    color: "#059669",
    fontStyle: "italic",
    marginBottom: 12,
    textAlign: "center",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    minHeight: 44, // PWD accessibility - minimum touch target
  },
  controlButtonText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
});
