// src/components/RouteInfoPanel.tsx
// CLEAN UX VERSION: Spacious design with proper button layout

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

    // Minimized view - compact with essential info
    if (isMinimized) {
      return (
        <View style={[styles.routeInfoContainer, style]}>
          <View style={styles.routeInfoMinimized}>
            <TouchableOpacity
              style={styles.minimizedHeader}
              onPress={() => setIsMinimized(false)}
            >
              <Text style={styles.minimizedTitle}>
                Routes to {destinationName}
              </Text>
              <Ionicons name="chevron-up" size={16} color="#6B7280" />
            </TouchableOpacity>

            {/* Compact navigation buttons */}
            <View style={styles.minimizedButtons}>
              <TouchableOpacity
                style={[styles.navigationButton, styles.fastestButton]}
                onPress={() => onStartNavigation("fastest")}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonLabel}>Fastest</Text>
                  <Text style={styles.buttonDetails}>
                    {Math.round(
                      (routeAnalysis.fastestRoute.duration || 600) / 60
                    )}
                    min • {fastestObstacles} obstacles
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navigationButton, styles.accessibleButton]}
                onPress={() => onStartNavigation("accessible")}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonLabel}>Accessible</Text>
                  <Text style={styles.buttonDetails}>
                    {Math.round(
                      (routeAnalysis.accessibleRoute.duration || 600) / 60
                    )}
                    min • {accessibleObstacles} obstacles
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Expanded view - no recalculate button for cleaner interface
    return (
      <View style={[styles.routeInfoContainer, style]}>
        <View style={styles.routeInfo}>
          {/* Clean header */}
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Routes to {destinationName}</Text>
            <TouchableOpacity
              style={styles.minimizeButton}
              onPress={() => setIsMinimized(true)}
            >
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Spacious route comparison */}
          <View style={styles.routeComparison}>
            {/* Fastest Route */}
            <TouchableOpacity
              style={styles.routeCard}
              onPress={() => onStartNavigation("fastest")}
            >
              <View style={styles.routeCardHeader}>
                <View style={styles.routeIndicator}>
                  <Ionicons name="flash" size={20} color="#EF4444" />
                  <Text style={[styles.routeLabel, { color: "#EF4444" }]}>
                    Fastest Route
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
              </View>

              <View style={styles.routeStats}>
                <Text style={styles.primaryStat}>
                  {Math.round(
                    (routeAnalysis.fastestRoute.duration || 600) / 60
                  )}{" "}
                  min
                </Text>
                <Text style={styles.secondaryStat}>
                  {(
                    (routeAnalysis.fastestRoute.distance || 1000) / 1000
                  ).toFixed(1)}{" "}
                  km
                </Text>
                <Text style={styles.secondaryStat}>
                  {fastestObstacles} obstacles
                </Text>
              </View>
            </TouchableOpacity>

            {/* Accessible Route */}
            <TouchableOpacity
              style={styles.routeCard}
              onPress={() => onStartNavigation("accessible")}
            >
              <View style={styles.routeCardHeader}>
                <View style={styles.routeIndicator}>
                  <Ionicons name="accessibility" size={20} color="#22C55E" />
                  <Text style={[styles.routeLabel, { color: "#22C55E" }]}>
                    Accessible Route
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#22C55E" />
              </View>

              <View style={styles.routeStats}>
                <Text style={styles.primaryStat}>
                  {Math.round(
                    (routeAnalysis.accessibleRoute.duration || 600) / 60
                  )}{" "}
                  min
                </Text>
                <Text style={styles.secondaryStat}>
                  {(
                    (routeAnalysis.accessibleRoute.distance || 1000) / 1000
                  ).toFixed(1)}{" "}
                  km
                </Text>
                <Text style={styles.secondaryStat}>
                  {accessibleObstacles} obstacles
                </Text>
              </View>
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

  // Expanded view styles
  routeInfo: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  minimizeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  routeComparison: {
    gap: 16,
  },
  routeCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  routeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  routeStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  primaryStat: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  secondaryStat: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Minimized view styles - more compact
  routeInfoMinimized: {
    backgroundColor: "white",
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "hidden",
  },
  minimizedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#FAFAFA",
  },
  minimizedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  minimizedButtons: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  navigationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fastestButton: {
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  accessibleButton: {
    borderColor: "#DCFCE7",
    backgroundColor: "#F0FDF4",
  },
  buttonContent: {
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  buttonDetails: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
});
