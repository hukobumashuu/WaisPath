// src/components/NavigationControls.tsx
// 🔥 BEAST MODE: Complete Navigation Controls (Search, FAB, Detection Status)
// Extracted from NavigationScreen for better organization and reusability
// PWD-optimized with accessibility features and semantic information

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
  detectionError: string | null;
  detectionStatusStyle?: any;
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
  }) {
    return (
      <>
        {/* 🔍 SEARCH BAR */}
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

        {/* 🎯 PROXIMITY DETECTION STATUS */}
        {isNavigating && (
          <View style={[styles.detectionStatusContainer, detectionStatusStyle]}>
            <Text style={styles.detectionStatus}>
              {isDetecting
                ? `🔍 Scanning ahead... (${proximityAlertsCount} obstacles)`
                : "⏸️ Detection paused"}
            </Text>

            {detectionError && (
              <Text style={styles.detectionError}>⚠️ {detectionError}</Text>
            )}
          </View>
        )}

        {/* 🚀 FLOATING ACTION BUTTON */}
        {showFAB && (
          <TouchableOpacity
            style={[styles.fab, fabStyle]}
            onPress={onFABPress}
            disabled={isCalculating}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Calculate route"
            accessibilityHint="Tap to calculate routes to your destination"
          >
            {isCalculating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="navigate-circle" size={24} color="white" />
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
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1F2937",
    minHeight: 20, // PWD accessibility
  },

  detectionStatusContainer: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 8,
    zIndex: 8,
  },

  detectionStatus: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
  },

  detectionError: {
    color: "#FCD34D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },

  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
