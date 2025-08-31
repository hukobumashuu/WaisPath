// src/components/RouteInfoPanel.tsx
// CLEAN VERSION: Minimizable panel with obstacle counts instead of grades

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RouteInfo {
  fastestRoute: {
    duration: number;
    distance: number;
    grade: string;
    polyline: any[];
    obstacles?: any[];
  };
  accessibleRoute: {
    duration: number;
    distance: number;
    grade: string;
    polyline: any[];
    obstacles?: any[];
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
  style?: any;
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
    const [isMinimized, setIsMinimized] = useState(false);

    if (!routeAnalysis) return null;

    const fastestObstacles = routeAnalysis.fastestRoute.obstacles?.length || 0;
    const accessibleObstacles =
      routeAnalysis.accessibleRoute.obstacles?.length || 0;

    // Minimized view - just the essential info
    if (isMinimized) {
      return (
        <View style={[styles.routeInfoContainer, style]}>
          <View style={styles.routeInfoMinimized}>
            <TouchableOpacity
              style={styles.minimizedContent}
              onPress={() => setIsMinimized(false)}
            >
              <Text style={styles.minimizedTitle}>
                Routes to {destinationName}
              </Text>
              <View style={styles.minimizedRoutes}>
                <Text style={styles.minimizedRoute}>
                  🔴{" "}
                  {Math.round(
                    (routeAnalysis.fastestRoute.duration || 600) / 60
                  )}
                  min • {fastestObstacles} obstacles
                </Text>
                <Text style={styles.minimizedRoute}>
                  🟢{" "}
                  {Math.round(
                    (routeAnalysis.accessibleRoute.duration || 600) / 60
                  )}
                  min • {accessibleObstacles} obstacles
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.minimizedButton}
              onPress={() => onStartNavigation("accessible")}
            >
              <Ionicons name="navigate" size={20} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Full view
    return (
      <View style={[styles.routeInfoContainer, style]}>
        <View style={styles.routeInfo}>
          {/* Header with minimize button */}
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Routes to {destinationName}</Text>
            <TouchableOpacity
              style={styles.minimizeButton}
              onPress={() => setIsMinimized(true)}
            >
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Route Comparison */}
          <View style={styles.routeComparison}>
            {/* Fastest Route */}
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
                km • {fastestObstacles} obstacles
              </Text>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => onStartNavigation("fastest")}
              >
                <Ionicons name="navigate" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Accessible Route */}
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
                km • {accessibleObstacles} obstacles
              </Text>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => onStartNavigation("accessible")}
              >
                <Ionicons name="navigate" size={16} color="#22C55E" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={onRecalculate}
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
  routeInfoMinimized: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  minimizeButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
  },
  minimizedContent: {
    flex: 1,
  },
  minimizedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  minimizedRoutes: {
    gap: 2,
  },
  minimizedRoute: {
    fontSize: 12,
    color: "#6B7280",
  },
  minimizedButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F0FDF4",
    marginLeft: 12,
  },
  routeComparison: {
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    minHeight: 48,
  },
  routeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
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
    fontSize: 13,
    color: "#1F2937",
    marginLeft: 12,
  },
  navigateBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
    minWidth: 40,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    minHeight: 40,
  },
  controlButtonText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
  },
});
