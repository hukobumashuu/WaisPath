// src/components/RouteInfoPanel.tsx
// SIMPLIFIED: Show obstacle counts instead of mysterious grades!
// Clean, user-friendly interface that PWDs can actually understand

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccessibilityObstacle } from "../types";

const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  lightGray: "#F8FAFC",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  chipBg: "#EFF8FF",
};

// SIMPLIFIED: What the panel actually needs - no more complex scoring!
interface SimpleRouteInfo {
  fastestRoute: {
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  clearestRoute: {
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  summary: {
    recommendation: string;
    timeDifference: number; // seconds
    obstacleDifference: number;
    fastestIsAlsoClearest: boolean;
  };
}

interface RouteInfoPanelProps {
  routeAnalysis: SimpleRouteInfo | null;
  isVisible: boolean;
  onClose: () => void;
  onSelectRoute: (routeType: "fastest" | "clearest") => void;
}

export function RouteInfoPanel({
  routeAnalysis,
  isVisible,
  onClose,
  onSelectRoute,
}: RouteInfoPanelProps) {
  if (!isVisible || !routeAnalysis) {
    return null;
  }

  const { fastestRoute, clearestRoute, summary } = routeAnalysis;

  // Helper functions for clean display
  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min${minutes === 1 ? "" : "s"}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  const getObstacleCountColor = (count: number): string => {
    if (count === 0) return COLORS.success;
    if (count <= 2) return COLORS.warning;
    return COLORS.error;
  };

  const getObstacleIcon = (count: number): keyof typeof Ionicons.glyphMap => {
    if (count === 0) return "checkmark-circle";
    if (count <= 2) return "alert-circle";
    return "warning";
  };

  // Get most common obstacle types for quick preview
  const getMostCommonObstacles = (
    obstacles: AccessibilityObstacle[]
  ): string[] => {
    const obstacleTypes = obstacles.map((obs) => obs.type.replace("_", " "));
    const counts = obstacleTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([type]) => type);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Route Options</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close route options"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Perfect Scenario - Same route is fastest AND clearest */}
          {summary.fastestIsAlsoClearest && (
            <View style={styles.perfectScenarioCard}>
              <View style={styles.perfectIcon}>
                <Ionicons name="star" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.perfectTitle}>Perfect Route! 🎉</Text>
              <Text style={styles.perfectSubtitle}>
                The fastest route also has the fewest obstacles
              </Text>

              <View style={styles.routeStats}>
                <Text style={styles.routeTime}>
                  {formatDuration(fastestRoute.duration)}
                </Text>
                <Text style={styles.routeDistance}>
                  {formatDistance(fastestRoute.distance)}
                </Text>
                <View style={styles.obstacleCount}>
                  <Ionicons
                    name={getObstacleIcon(fastestRoute.obstacleCount)}
                    size={16}
                    color={getObstacleCountColor(fastestRoute.obstacleCount)}
                  />
                  <Text
                    style={[
                      styles.obstacleText,
                      {
                        color: getObstacleCountColor(
                          fastestRoute.obstacleCount
                        ),
                      },
                    ]}
                  >
                    {fastestRoute.obstacleCount === 0
                      ? "No obstacles!"
                      : `${fastestRoute.obstacleCount} obstacle${
                          fastestRoute.obstacleCount === 1 ? "" : "s"
                        }`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.selectButtonPerfect}
                onPress={() => onSelectRoute("fastest")}
                accessibilityLabel="Select the perfect route"
                accessibilityRole="button"
              >
                <Text style={styles.selectButtonTextPerfect}>
                  Use This Route
                </Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}

          {/* Two Different Routes - User needs to choose */}
          {!summary.fastestIsAlsoClearest && (
            <>
              {/* Fastest Route Card */}
              <View style={styles.routeCard}>
                <View style={styles.routeCardHeader}>
                  <View style={styles.routeTypeIcon}>
                    <Ionicons name="flash" size={20} color={COLORS.softBlue} />
                  </View>
                  <Text style={styles.routeCardTitle}>Fastest Route</Text>
                </View>

                <View style={styles.routeStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="time" size={16} color={COLORS.muted} />
                    <Text style={styles.statText}>
                      {formatDuration(fastestRoute.duration)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="map" size={16} color={COLORS.muted} />
                    <Text style={styles.statText}>
                      {formatDistance(fastestRoute.distance)}
                    </Text>
                  </View>
                </View>

                <View style={styles.obstacleInfo}>
                  <View style={styles.obstacleCount}>
                    <Ionicons
                      name={getObstacleIcon(fastestRoute.obstacleCount)}
                      size={16}
                      color={getObstacleCountColor(fastestRoute.obstacleCount)}
                    />
                    <Text
                      style={[
                        styles.obstacleText,
                        {
                          color: getObstacleCountColor(
                            fastestRoute.obstacleCount
                          ),
                        },
                      ]}
                    >
                      {fastestRoute.obstacleCount === 0
                        ? "No obstacles!"
                        : `${fastestRoute.obstacleCount} obstacle${
                            fastestRoute.obstacleCount === 1 ? "" : "s"
                          }`}
                    </Text>
                  </View>
                  {fastestRoute.obstacleCount > 0 && (
                    <Text style={styles.obstacleTypes}>
                      {getMostCommonObstacles(fastestRoute.obstacles).join(
                        ", "
                      )}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => onSelectRoute("fastest")}
                  accessibilityLabel={`Select fastest route: ${formatDuration(
                    fastestRoute.duration
                  )} with ${fastestRoute.obstacleCount} obstacles`}
                  accessibilityRole="button"
                >
                  <Text style={styles.selectButtonText}>Choose Fast Route</Text>
                  <Ionicons name="flash" size={16} color={COLORS.softBlue} />
                </TouchableOpacity>
              </View>

              {/* Clearest Route Card */}
              <View style={styles.routeCard}>
                <View style={styles.routeCardHeader}>
                  <View style={styles.routeTypeIcon}>
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={COLORS.success}
                    />
                  </View>
                  <Text style={styles.routeCardTitle}>Clearest Route</Text>
                </View>

                <View style={styles.routeStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="time" size={16} color={COLORS.muted} />
                    <Text style={styles.statText}>
                      {formatDuration(clearestRoute.duration)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="map" size={16} color={COLORS.muted} />
                    <Text style={styles.statText}>
                      {formatDistance(clearestRoute.distance)}
                    </Text>
                  </View>
                </View>

                <View style={styles.obstacleInfo}>
                  <View style={styles.obstacleCount}>
                    <Ionicons
                      name={getObstacleIcon(clearestRoute.obstacleCount)}
                      size={16}
                      color={getObstacleCountColor(clearestRoute.obstacleCount)}
                    />
                    <Text
                      style={[
                        styles.obstacleText,
                        {
                          color: getObstacleCountColor(
                            clearestRoute.obstacleCount
                          ),
                        },
                      ]}
                    >
                      {clearestRoute.obstacleCount === 0
                        ? "No obstacles!"
                        : `${clearestRoute.obstacleCount} obstacle${
                            clearestRoute.obstacleCount === 1 ? "" : "s"
                          }`}
                    </Text>
                  </View>
                  {clearestRoute.obstacleCount > 0 && (
                    <Text style={styles.obstacleTypes}>
                      {getMostCommonObstacles(clearestRoute.obstacles).join(
                        ", "
                      )}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.selectButton, styles.selectButtonClearest]}
                  onPress={() => onSelectRoute("clearest")}
                  accessibilityLabel={`Select clearest route: ${formatDuration(
                    clearestRoute.duration
                  )} with ${clearestRoute.obstacleCount} obstacles`}
                  accessibilityRole="button"
                >
                  <Text style={styles.selectButtonText}>
                    Choose Clear Route
                  </Text>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={COLORS.success}
                  />
                </TouchableOpacity>
              </View>

              {/* Comparison Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Route Comparison</Text>
                <Text style={styles.summaryText}>{summary.recommendation}</Text>

                {Math.abs(summary.timeDifference) > 60 && (
                  <Text style={styles.summaryDetail}>
                    Time difference:{" "}
                    {formatDuration(Math.abs(summary.timeDifference))}
                  </Text>
                )}

                {summary.obstacleDifference > 0 && (
                  <Text style={styles.summaryDetail}>
                    Obstacle difference: {Math.abs(summary.obstacleDifference)}{" "}
                    fewer obstacles
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  panel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    minHeight: "50%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.slate,
  },
  closeButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
  },

  // Perfect scenario styles
  perfectScenarioCard: {
    backgroundColor: "#F0FDF4", // Light green background
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  perfectIcon: {
    marginBottom: 8,
  },
  perfectTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.success,
    marginBottom: 4,
  },
  perfectSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 16,
  },

  // Route card styles
  routeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  routeTypeIcon: {
    marginRight: 8,
  },
  routeCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
  },
  routeStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.slate,
    marginLeft: 4,
  },
  routeTime: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
  },
  routeDistance: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Obstacle info styles
  obstacleInfo: {
    marginBottom: 16,
  },
  obstacleCount: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  obstacleText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  obstacleTypes: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 20,
    fontStyle: "italic",
  },

  // Button styles
  selectButton: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.softBlue,
  },
  selectButtonClearest: {
    borderColor: COLORS.success,
  },
  selectButtonPerfect: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.softBlue,
    marginRight: 4,
  },
  selectButtonTextPerfect: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginRight: 8,
  },

  // Summary styles
  summaryCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  summaryDetail: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
    fontStyle: "italic",
  },
});
