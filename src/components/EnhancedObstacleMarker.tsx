// src/components/EnhancedObstacleMarker.tsx
// COMPLETE: Route visualization + Validation status + Crowdsourcing indicators

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
  routeType?: "fastest" | "accessible" | "both";
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

  // Determine final color priority: Route status vs Validation status
  const getMarkerColor = () => {
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

    // Route type specific border colors
    if (isOnRoute && routeType) {
      switch (routeType) {
        case "both":
          baseStyle.borderColor = "#8B5CF6"; // Purple for both routes
          break;
        case "fastest":
          baseStyle.borderColor = "#EF4444"; // Red for fastest route
          break;
        case "accessible":
          baseStyle.borderColor = "#22C55E"; // Green for accessible route
          break;
      }
    }

    return baseStyle;
  };

  // Get validation UI elements
  const getValidationBadge = () => {
    switch (validationStatus.tier) {
      case "admin_resolved":
        return {
          color: "#3B82F6",
          text: obstacle.status === "resolved" ? "CLEARED" : "OFFICIAL",
        };
      case "community_verified":
        return {
          color: validationStatus.conflictingReports ? "#F59E0B" : "#10B981",
          text: validationStatus.conflictingReports ? "DISPUTED" : "VERIFIED",
        };
      case "single_report":
      default:
        return {
          color: "#6B7280",
          text: "UNVERIFIED",
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
      accessibilityLabel={`${display.title} obstacle - ${validationStatus.displayLabel}`}
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

          {/* Route indicator badge */}
          {isOnRoute && routeType && (
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

          {/* Conflicting reports warning */}
          {validationStatus.conflictingReports && (
            <View style={styles.conflictIndicator}>
              <Ionicons name="warning" size={8} color="white" />
            </View>
          )}
        </View>

        {/* Validation Status Badge */}
        <View
          style={[
            styles.validationBadge,
            { backgroundColor: "white", borderColor: validationBadge.color },
          ]}
        >
          <Text
            style={[styles.validationText, { color: validationBadge.color }]}
          >
            {validationBadge.text}
          </Text>
        </View>
      </View>

      <Callout>
        <View style={styles.calloutContainer}>
          <View style={styles.calloutHeader}>
            <Text style={styles.calloutTitle}>{display.title}</Text>
            <View
              style={[
                styles.calloutBadge,
                { backgroundColor: validationBadge.color },
              ]}
            >
              <Text style={styles.calloutBadgeText}>
                {validationBadge.text}
              </Text>
            </View>
          </View>

          {obstacle.description && (
            <Text style={styles.calloutDescription}>
              {obstacle.description}
            </Text>
          )}

          <View style={styles.calloutMeta}>
            <Text style={styles.metaText}>
              {obstacle.upvotes || 0} confirms • {obstacle.downvotes || 0}{" "}
              disputes
            </Text>
            <Text style={styles.metaDate}>
              {new Date(obstacle.reportedAt).toLocaleDateString()}
            </Text>
          </View>

          {isOnRoute && routeType && (
            <Text style={styles.routeInfo}>
              📍 On{" "}
              {routeType === "both" ? "both routes" : `${routeType} route`}
            </Text>
          )}

          <Text style={styles.calloutAction}>
            Tap to validate or report changes
          </Text>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
  },
  routeIndicator: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  routeIndicatorText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1F2937",
  },
  conflictIndicator: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
  },
  validationBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
  },
  validationText: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
  },
  calloutContainer: {
    width: 220,
    padding: 10,
  },
  calloutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  calloutBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  calloutBadgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "white",
  },
  calloutDescription: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 6,
    lineHeight: 16,
  },
  calloutMeta: {
    marginBottom: 4,
  },
  metaText: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
  },
  metaDate: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  routeInfo: {
    fontSize: 11,
    color: "#8B5CF6",
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 4,
  },
  calloutAction: {
    fontSize: 11,
    color: "#3B82F6",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 6,
  },
});
