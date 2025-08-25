// src/components/EnhancedObstacleMarker.tsx
// Extracted obstacle marker component with validation status and accessibility features
// Optimized for PWD users with proper color contrast and semantic information

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker, Callout } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { AccessibilityObstacle, ObstacleType } from "../types";
import { obstacleValidationService } from "../services/obstacleValidationService";

interface EnhancedObstacleMarkerProps {
  obstacle: AccessibilityObstacle;
  onPress: () => void;
}

// Utility function for obstacle display properties
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

export const EnhancedObstacleMarker = React.memo<EnhancedObstacleMarkerProps>(
  function EnhancedObstacleMarker({ obstacle, onPress }) {
    const validationStatus =
      obstacleValidationService.getValidationStatus(obstacle);
    const obstacleDisplay = getObstacleDisplay(obstacle.type);

    const getValidationUI = (status: any) => {
      switch (status.tier) {
        case "admin_resolved":
          return { badgeColor: "#3B82F6", badgeText: "OFFICIAL" };
        case "community_verified":
          const hasDisputes = (obstacle.downvotes || 0) > 0;
          return {
            badgeColor: hasDisputes ? "#F59E0B" : "#10B981",
            badgeText: hasDisputes ? "DISPUTED" : "VERIFIED",
          };
        case "needs_validation":
        default:
          return { badgeColor: "#EF4444", badgeText: "UNVERIFIED" };
      }
    };

    const uiProps = getValidationUI(validationStatus);

    return (
      <Marker
        coordinate={obstacle.location}
        onPress={onPress}
        tracksViewChanges={false}
        accessible={true}
        accessibilityLabel={`${
          obstacleDisplay.title
        } obstacle, ${uiProps.badgeText.toLowerCase()}`}
        accessibilityHint="Tap for details and options"
      >
        <View
          style={[
            styles.obstacleMarker,
            { backgroundColor: uiProps.badgeColor },
          ]}
        >
          <Ionicons name={obstacleDisplay.icon} size={16} color="white" />
        </View>
        <Callout>
          <View style={styles.calloutContainer}>
            <View style={styles.calloutHeader}>
              <Text style={styles.calloutTitle}>{obstacleDisplay.title}</Text>
              <View
                style={[
                  styles.validationBadge,
                  { backgroundColor: uiProps.badgeColor },
                ]}
              >
                <Text style={styles.validationBadgeText}>
                  {uiProps.badgeText}
                </Text>
              </View>
            </View>
            <Text style={styles.calloutDescription}>
              {obstacle.description}
            </Text>
            <Text style={styles.calloutMeta}>
              {obstacle.upvotes || 0}↑ {obstacle.downvotes || 0}↓ •{" "}
              {new Date(obstacle.reportedAt).toLocaleDateString()}
            </Text>
          </View>
        </Callout>
      </Marker>
    );
  }
);

const styles = StyleSheet.create({
  obstacleMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
  },
  calloutDescription: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  validationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validationBadgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "white",
  },
});
