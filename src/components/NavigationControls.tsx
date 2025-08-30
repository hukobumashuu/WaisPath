// src/components/NavigationControls.tsx
// FIXED: UI overlap issue with proximity alerts

import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface NavigationControlsProps {
  // Search props
  destination: string;
  onDestinationChange: (text: string) => void;
  isCalculating: boolean;
  searchContainerStyle?: any;

  // FAB props
  showFAB: boolean;
  onFABPress: () => void;
  fabStyle?: any;

  // Detection status props
  isNavigating: boolean;
  isDetecting: boolean;
  proximityAlertsCount: number;
  detectionError: string | null | undefined;
  detectionStatusStyle?: any;

  // Obstacle visibility props
  showAllObstacles?: boolean;
  onToggleObstacles?: () => void;
  validationObstacleCount?: number;
}

export const NavigationControls = React.memo<NavigationControlsProps>(
  function NavigationControls({
    destination,
    onDestinationChange,
    isCalculating,
    searchContainerStyle,
    showFAB,
    onFABPress,
    fabStyle,
    isNavigating,
    isDetecting,
    proximityAlertsCount,
    detectionError,
    detectionStatusStyle,
    showAllObstacles = false,
    onToggleObstacles,
    validationObstacleCount = 0,
  }) {
    // Calculate base top position from searchContainer
    const baseTop = searchContainerStyle?.top || 0;

    return (
      <>
        {/* SEARCH BAR */}
        <View style={[styles.searchContainer, searchContainerStyle]}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Where do you want to go?"
              value={destination}
              onChangeText={onDestinationChange}
              placeholderTextColor="#6B7280"
              accessible={true}
              accessibilityLabel="Destination search input"
              accessibilityHint="Enter where you want to navigate to"
            />
            {isCalculating && (
              <ActivityIndicator size="small" color="#3B82F6" />
            )}
          </View>
        </View>

        {/* OBSTACLE VISIBILITY CONTROLS - FIXED: Only show when NOT navigating to avoid overlap */}
        {onToggleObstacles && !isNavigating && (
          <View
            style={[styles.obstacleControlsContainer, { top: baseTop + 70 }]}
          >
            <TouchableOpacity
              style={[
                styles.obstacleToggleButton,
                showAllObstacles && styles.obstacleToggleButtonActive,
              ]}
              onPress={onToggleObstacles}
              accessibilityLabel={`${
                showAllObstacles ? "Hide" : "Show"
              } all obstacles`}
              accessibilityHint="Toggle visibility of obstacles on the map"
            >
              <Ionicons
                name={showAllObstacles ? "eye" : "eye-off"}
                size={16}
                color={showAllObstacles ? "#3B82F6" : "#6B7280"}
              />
              <Text
                style={[
                  styles.obstacleToggleText,
                  showAllObstacles && styles.obstacleToggleTextActive,
                ]}
              >
                All Obstacles
              </Text>
            </TouchableOpacity>

            {/* Validation info badge */}
            {validationObstacleCount > 0 && (
              <View style={styles.validationBadge}>
                <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                <Text style={styles.validationBadgeText}>
                  {validationObstacleCount} nearby
                </Text>
              </View>
            )}
          </View>
        )}

        {/* PROXIMITY DETECTION STATUS - FIXED: Position based on whether obstacle controls are visible */}
        {isNavigating && (
          <View
            style={[
              styles.detectionStatusContainer,
              detectionStatusStyle,
              {
                top: baseTop + (onToggleObstacles && !isNavigating ? 120 : 70),
              },
            ]}
          >
            <Text style={styles.detectionStatus}>
              {isDetecting
                ? `Detecting obstacles${
                    proximityAlertsCount > 0
                      ? ` (${proximityAlertsCount} alerts)`
                      : ""
                  }`
                : "Proximity detection paused"}
            </Text>
            {detectionError && (
              <Text style={styles.detectionError}>Error: {detectionError}</Text>
            )}
          </View>
        )}

        {/* FAB */}
        {showFAB && (
          <TouchableOpacity
            style={[styles.fab, fabStyle]}
            onPress={onFABPress}
            disabled={isCalculating}
            accessible={true}
            accessibilityLabel="Calculate accessible routes"
            accessibilityHint="Find the best routes for your accessibility needs"
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
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "white",
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1F2937",
  },
  obstacleControlsContainer: {
    position: "absolute",
    left: 16,
    right: 16,
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
    zIndex: 999,
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
  detectionStatusContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 998,
  },
  detectionStatus: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  detectionError: {
    color: "#FCA5A5",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
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
    zIndex: 997,
  },
});
