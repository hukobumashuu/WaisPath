// src/components/EnhancedObstacleMarker.tsx
// SAFE UPDATE: Adding admin badge without breaking existing functionality

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker, Callout } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { AccessibilityObstacle, ObstacleType } from "../types";
import { obstacleValidationService } from "../services/obstacleValidationService";

interface EnhancedObstacleMarkerProps {
  obstacle: AccessibilityObstacle;
  onPress: () => void;
  isOnRoute?: boolean;
  routeType?: "fastest" | "clearest" | "both";
  opacity?: number;
}

function getObstacleDisplay(type: ObstacleType) {
  const displays = {
    vendor_blocking: {
      icon: "storefront-outline" as keyof typeof Ionicons.glyphMap,
      title: "Vendor Blocking Path",
      color: "#F59E0B",
    },
    parked_vehicles: {
      icon: "car-outline" as keyof typeof Ionicons.glyphMap,
      title: "Parked Vehicle",
      color: "#EF4444",
    },
    stairs_no_ramp: {
      icon: "layers-outline" as keyof typeof Ionicons.glyphMap,
      title: "Stairs No Ramp",
      color: "#DC2626",
    },
    narrow_passage: {
      icon: "resize-outline" as keyof typeof Ionicons.glyphMap,
      title: "Narrow Passage",
      color: "#F59E0B",
    },
    broken_pavement: {
      icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
      title: "Broken Pavement",
      color: "#EF4444",
    },
    flooding: {
      icon: "water-outline" as keyof typeof Ionicons.glyphMap,
      title: "Flooding",
      color: "#3B82F6",
    },
    construction: {
      icon: "construct-outline" as keyof typeof Ionicons.glyphMap,
      title: "Construction",
      color: "#F59E0B",
    },
    electrical_post: {
      icon: "flash-outline" as keyof typeof Ionicons.glyphMap,
      title: "Electrical Post",
      color: "#6B7280",
    },
    tree_roots: {
      icon: "leaf-outline" as keyof typeof Ionicons.glyphMap,
      title: "Tree Roots",
      color: "#059669",
    },
    no_sidewalk: {
      icon: "trail-sign-outline" as keyof typeof Ionicons.glyphMap,
      title: "No Sidewalk",
      color: "#DC2626",
    },
    steep_slope: {
      icon: "trending-up-outline" as keyof typeof Ionicons.glyphMap,
      title: "Steep Slope",
      color: "#F59E0B",
    },
    other: {
      icon: "help-circle-outline" as keyof typeof Ionicons.glyphMap,
      title: "Other Obstacle",
      color: "#6B7280",
    },
  };

  return displays[type] || displays.other;
}

export function EnhancedObstacleMarker({
  obstacle,
  onPress,
  isOnRoute = false,
  routeType,
  opacity = 1.0,
}: EnhancedObstacleMarkerProps) {
  const display = getObstacleDisplay(obstacle.type);
  const validationStatus =
    obstacleValidationService.getValidationStatus(obstacle);

  // NEW: Admin badge logic
  const isAdminReport = obstacle.adminReported === true;
  const adminRole = obstacle.adminRole;

  // Determine final color priority: Route status vs Validation status vs Admin status
  const getMarkerColor = () => {
    // Admin reports get special colors
    if (isAdminReport) {
      return "#3B82F6"; // Official blue for admin reports
    }

    if (isOnRoute) {
      // Route obstacles use obstacle type color for visibility
      return display.color;
    } else {
      // Nearby obstacles use validation-based color
      switch (validationStatus.tier) {
        case "admin_resolved":
          return obstacle.status === "resolved" ? "#22C55E" : "#3B82F6";
        case "community_verified":
          return validationStatus.conflictingReports ? "#F59E0B" : "#10B981";
        case "single_report":
        default:
          return "#9CA3AF";
      }
    }
  };

  const getMarkerStyle = () => {
    const baseStyle = {
      width: isOnRoute ? 28 : 24,
      height: isOnRoute ? 28 : 24,
      borderRadius: isOnRoute ? 14 : 12,
      backgroundColor: getMarkerColor(),
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: isOnRoute ? 3 : 2,
      borderColor: "#FFFFFF",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
      opacity: opacity,
    };

    // Admin reports get gold border
    if (isAdminReport) {
      baseStyle.borderColor = "#F59E0B"; // Gold border for admin reports
      baseStyle.borderWidth = 3;
    }

    // Route type specific border colors (if not admin)
    if (isOnRoute && routeType && !isAdminReport) {
      switch (routeType) {
        case "both":
          baseStyle.borderColor = "#8B5CF6"; // Purple for both routes
          break;
        case "fastest":
          baseStyle.borderColor = "#EF4444"; // Red for fastest route
          break;
        case "clearest":
          baseStyle.borderColor = "#22C55E"; // Green for accessible route
          break;
      }
    }

    return baseStyle;
  };

  // Get validation badge (updated for admin reports)
  const getValidationBadge = () => {
    // Admin reports override validation status
    if (isAdminReport) {
      return {
        color: "#3B82F6",
        text: "OFFICIAL",
        icon: "shield-checkmark" as any,
      };
    }

    // Regular validation status
    switch (validationStatus.tier) {
      case "admin_resolved":
        return {
          color: "#3B82F6",
          text: obstacle.status === "resolved" ? "CLEARED" : "OFFICIAL",
          icon: "shield-checkmark" as any,
        };
      case "community_verified":
        return {
          color: validationStatus.conflictingReports ? "#F59E0B" : "#10B981",
          text: validationStatus.conflictingReports ? "DISPUTED" : "VERIFIED",
          icon: validationStatus.conflictingReports
            ? ("warning" as any)
            : ("checkmark-circle" as any),
        };
      case "single_report":
      default:
        return {
          color: "#6B7280",
          text: "UNVERIFIED",
          icon: "help-circle" as any,
        };
    }
  };

  const validationBadge = getValidationBadge();

  return (
    <Marker
      coordinate={{
        latitude: obstacle.location.latitude,
        longitude: obstacle.location.longitude,
      }}
      onPress={onPress}
      accessibilityLabel={`${display.title} obstacle - ${
        isAdminReport
          ? "Official government report"
          : validationStatus.displayLabel
      }`}
      tracksViewChanges={false}
    >
      <View style={styles.markerContainer}>
        {/* Main Obstacle Marker */}
        <View style={getMarkerStyle()}>
          <Ionicons
            name={display.icon}
            size={isOnRoute ? 16 : 14}
            color="white"
          />

          {/* NEW: Admin shield overlay */}
          {isAdminReport && (
            <View style={styles.adminShield}>
              <Ionicons name="shield-checkmark" size={8} color="#F59E0B" />
            </View>
          )}

          {/* Route indicator badge */}
          {isOnRoute && routeType && !isAdminReport && (
            <View style={styles.routeIndicator}>
              <Text style={styles.routeIndicatorText}>
                {routeType === "both"
                  ? "!"
                  : routeType === "fastest"
                  ? "F"
                  : "A"}
              </Text>
            </View>
          )}
        </View>

        {/* Validation Status Badge (updated for admin) */}
        <View
          style={[
            styles.validationBadge,
            { backgroundColor: validationBadge.color },
          ]}
        >
          <Ionicons
            name={validationBadge.icon}
            size={8}
            color="white"
            style={{ marginRight: 2 }}
          />
          <Text style={styles.badgeText}>{validationBadge.text}</Text>
        </View>

        {/* NEW: Admin role indicator */}
        {isAdminReport && adminRole && (
          <View style={styles.adminRoleIndicator}>
            <Text style={styles.adminRoleText}>
              {adminRole === "super_admin"
                ? "SA"
                : adminRole === "lgu_admin"
                ? "LGU"
                : adminRole === "field_admin"
                ? "FA"
                : "ADM"}
            </Text>
          </View>
        )}

        {/* Conflicting Reports Indicator */}
        {validationStatus.conflictingReports && !isAdminReport && (
          <View style={styles.conflictIndicator}>
            <Ionicons name="warning" size={10} color="white" />
          </View>
        )}
      </View>

      {/* Enhanced Callout with Admin Info */}
      <Callout style={styles.callout}>
        <View style={styles.calloutContent}>
          <Text style={styles.calloutTitle}>{display.title}</Text>
          <Text style={styles.calloutDescription}>{obstacle.description}</Text>

          {/* NEW: Admin report indicator in callout */}
          {isAdminReport && (
            <View style={styles.adminCalloutBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#3B82F6" />
              <Text style={styles.adminCalloutText}>
                Official Report{" "}
                {adminRole
                  ? `(${adminRole.replace("_", " ").toUpperCase()})`
                  : ""}
              </Text>
            </View>
          )}

          <Text style={styles.calloutMeta}>
            {validationStatus.displayLabel} •{" "}
            {new Date(obstacle.reportedAt).toLocaleDateString()}
          </Text>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    position: "relative",
  },
  routeIndicator: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#1F2937",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  routeIndicatorText: {
    color: "white",
    fontSize: 8,
    fontWeight: "bold",
  },
  // NEW: Admin shield overlay
  adminShield: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  validationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
    minWidth: 50,
    justifyContent: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  // NEW: Admin role indicator
  adminRoleIndicator: {
    position: "absolute",
    bottom: -8,
    left: -8,
    backgroundColor: "#F59E0B",
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  adminRoleText: {
    color: "white",
    fontSize: 6,
    fontWeight: "bold",
  },
  conflictIndicator: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#F59E0B",
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  callout: {
    width: 200,
    padding: 0,
  },
  calloutContent: {
    padding: 8,
  },
  calloutTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 6,
  },
  // NEW: Admin badge in callout
  adminCalloutBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  adminCalloutText: {
    fontSize: 10,
    color: "#3B82F6",
    fontWeight: "600",
    marginLeft: 4,
  },
  calloutMeta: {
    fontSize: 10,
    color: "#6B7280",
    fontStyle: "italic",
  },
});
