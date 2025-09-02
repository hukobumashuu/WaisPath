// src/components/NavigationControls.tsx
// FIXED: Removed black detection status modal that was appearing behind search bar

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface NavigationControlsProps {
  // FAB props - the only UI element we're keeping for clean interface
  showFAB: boolean;
  onFABPress: () => void;
  fabStyle?: any;
  isCalculating: boolean;

  // Legacy props kept for backwards compatibility but not used in UI
  isNavigating?: boolean;
  isDetecting?: boolean;
  proximityAlertsCount?: number;
  detectionError?: string | null | undefined;
  detectionStatusStyle?: any;
  showAllObstacles?: boolean;
  onToggleObstacles?: () => void;
  validationObstacleCount?: number;
  obstacleToggleStyle?: any;
}

export const NavigationControls = React.memo<NavigationControlsProps>(
  function NavigationControls({
    showFAB,
    onFABPress,
    fabStyle,
    isCalculating,
    isNavigating,
    isDetecting,
    proximityAlertsCount,
    detectionError,
    detectionStatusStyle,
    showAllObstacles = false,
    onToggleObstacles,
    validationObstacleCount = 0,
    obstacleToggleStyle,
  }) {
    return (
      <>
        {/* REMOVED: Obstacle visibility controls to reduce UI clutter */}
        {/* Users can see all relevant obstacles automatically based on their route */}

        {/* REMOVED: Black detection status modal that was causing UI issues */}
        {/* The proximity detection status is now handled by ProximityAlertsOverlay */}

        {/* FLOATING ACTION BUTTON - Properly positioned */}
        {showFAB && (
          <TouchableOpacity
            style={[styles.fab, fabStyle]}
            onPress={onFABPress}
            activeOpacity={0.8}
            accessibilityLabel="Calculate accessible routes"
            accessibilityHint="Find the best accessible route to your destination"
          >
            {isCalculating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="map-outline" size={24} color="white" />
            )}
          </TouchableOpacity>
        )}
      </>
    );
  }
);

const styles = StyleSheet.create({
  obstacleControlsContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 300,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 999, // Below search bar (1000) but above map
  },
  obstacleToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
  },
  obstacleToggleButtonActive: {
    backgroundColor: "#EBF4FF",
  },
  obstacleToggleText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  obstacleToggleTextActive: {
    color: "#3B82F6",
  },
  validationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  validationBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 997, // High enough to be clickable, but below other UI elements
  },
});
