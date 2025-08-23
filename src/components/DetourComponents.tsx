// src/components/DetourComponents.tsx
// UI Components for Micro-Rerouting System - COMPLETED VERSION

import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MicroDetour } from "../services/microReroutingService";
import { ProximityAlert } from "../services/proximityDetectionService";

// ================================================
// 1. DETOUR SUGGESTION MODAL (When detour available)
// ================================================

interface DetourModalProps {
  visible: boolean;
  detour: MicroDetour;
  obstacleAlert: ProximityAlert;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export const DetourSuggestionModal: React.FC<DetourModalProps> = ({
  visible,
  detour,
  obstacleAlert,
  onAccept,
  onDecline,
  onClose,
}) => {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}min`;
  };

  const getDetourIcon = () => {
    if (detour.extraTime <= 30 && detour.safetyRating === "high")
      return "checkmark-circle";
    if (detour.extraTime <= 60) return "time";
    return "warning";
  };

  const getDetourColor = () => {
    if (detour.extraTime <= 30 && detour.safetyRating === "high")
      return "#10B981"; // green
    if (detour.extraTime <= 60) return "#3B82F6"; // blue
    return "#F59E0B"; // amber
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Ionicons
                name={getDetourIcon()}
                size={24}
                color={getDetourColor()}
              />
              <Text style={styles.headerTitle}>Alternative Route</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Obstacle Warning */}
          <View style={styles.obstacleWarning}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.warningTitle}>
                {obstacleAlert.obstacle.type.replace("_", " ")} detected ahead
              </Text>
            </View>
            <Text style={styles.warningSubtitle}>
              Taking detour via {detour.reason}
            </Text>
          </View>

          {/* Detour Statistics */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getDetourColor() }]}>
                +{formatTime(detour.extraTime)}
              </Text>
              <Text style={styles.statLabel}>Extra Time</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#8B5CF6" }]}>
                {Math.round(detour.routeSimilarity * 100)}%
              </Text>
              <Text style={styles.statLabel}>Route Similarity</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#10B981" }]}>
                {Math.round(detour.confidence * 100)}%
              </Text>
              <Text style={styles.statLabel}>Confidence</Text>
            </View>
          </View>

          {/* Route Details */}
          <View style={styles.routeDetails}>
            <Text style={styles.routeTitle}>📍 Route: {detour.reason}</Text>
            <Text style={styles.routeInfo}>
              Safety Rating: {detour.safetyRating.toUpperCase()}
            </Text>
            <Text style={styles.routeInfo}>
              Distance: +{Math.round(detour.extraDistance)}m
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={onAccept}
              style={[
                styles.primaryButton,
                { backgroundColor: getDetourColor() },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {detour.extraTime <= 30 && detour.safetyRating === "high"
                  ? "Apply Detour"
                  : "Take Detour"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onDecline}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Continue Original</Text>
            </TouchableOpacity>
          </View>

          {/* Auto-apply note */}
          {detour.extraTime <= 30 && detour.safetyRating === "high" && (
            <Text style={styles.recommendationNote}>
              ✨ Recommended for quick, safe bypass
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ================================================
// 2. COMPACT OBSTACLE WARNING (When no detour available)
// ================================================

interface ObstacleWarningProps {
  visible: boolean;
  message: string;
  obstacleType: string;
  onDismiss: () => void;
  onReportIncorrect?: () => void;
}

export const CompactObstacleWarning: React.FC<ObstacleWarningProps> = ({
  visible,
  message,
  obstacleType,
  onDismiss,
  onReportIncorrect,
}) => {
  if (!visible) return null;

  const getObstacleIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      stairs_no_ramp: "walk",
      vendor_blocking: "storefront",
      construction: "construct",
      flooding: "water",
      narrow_passage: "resize",
      parked_vehicles: "car",
    };
    return iconMap[type] || "warning";
  };

  return (
    <View style={styles.warningBanner}>
      <View style={styles.warningContainer}>
        <View style={styles.warningTopRow}>
          <View style={styles.warningLeft}>
            <Ionicons
              name={getObstacleIcon(obstacleType)}
              size={20}
              color="#F59E0B"
            />
            <Text style={styles.warningMainText}>⚠️ Obstacle Ahead</Text>
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.warningCloseButton}
          >
            <Ionicons name="close" size={20} color="#92400E" />
          </TouchableOpacity>
        </View>

        <Text style={styles.warningMessage}>{message}</Text>

        {/* Action buttons */}
        <View style={styles.warningActions}>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.warningButtonPrimary}
          >
            <Text style={styles.warningButtonPrimaryText}>Got it</Text>
          </TouchableOpacity>

          {onReportIncorrect && (
            <TouchableOpacity
              onPress={onReportIncorrect}
              style={styles.warningButtonSecondary}
            >
              <Text style={styles.warningButtonSecondaryText}>
                Report Issue
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ================================================
// 3. DETOUR STATUS INDICATOR (Shows during navigation) - COMPLETED
// ================================================

interface DetourStatusProps {
  isActive: boolean;
  detourDescription?: string;
  timeRemaining?: number;
  onCancel?: () => void;
}

export const DetourStatusIndicator: React.FC<DetourStatusProps> = ({
  isActive,
  detourDescription,
  timeRemaining,
  onCancel,
}) => {
  if (!isActive) return null;

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return "";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0
      ? `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
      : `${remainingSeconds}s`;
  };

  return (
    <View style={styles.detourStatusContainer}>
      <View style={styles.detourStatusCard}>
        <View style={styles.detourStatusHeader}>
          <View style={styles.detourStatusLeft}>
            <Ionicons name="swap-horizontal" size={18} color="#3B82F6" />
            <Text style={styles.detourStatusTitle}>Taking Detour</Text>
          </View>

          {onCancel && (
            <TouchableOpacity
              onPress={onCancel}
              style={styles.detourCancelButton}
            >
              <Text style={styles.detourCancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {detourDescription && (
          <Text style={styles.detourDescription}>{detourDescription}</Text>
        )}

        {timeRemaining && timeRemaining > 0 && (
          <Text style={styles.detourTimeRemaining}>
            ETA: {formatTimeRemaining(timeRemaining)} remaining
          </Text>
        )}
      </View>
    </View>
  );
};

// ================================================
// STYLES
// ================================================

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#1F2937",
  },
  closeButton: {
    padding: 4,
  },
  obstacleWarning: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  warningTitle: {
    fontWeight: "600",
    color: "#92400E",
    marginLeft: 8,
  },
  warningSubtitle: {
    color: "#B45309",
    marginTop: 4,
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },
  routeDetails: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  routeTitle: {
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 4,
  },
  routeInfo: {
    color: "#6B7280",
    fontSize: 14,
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 16,
  },
  recommendationNote: {
    textAlign: "center",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 12,
  },

  // Warning Banner Styles
  warningBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 50,
  },
  warningContainer: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  warningTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  warningLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  warningMainText: {
    fontWeight: "600",
    color: "#92400E",
    marginLeft: 8,
    flex: 1,
  },
  warningCloseButton: {
    padding: 4,
  },
  warningMessage: {
    color: "#B45309",
    marginTop: 8,
    fontSize: 14,
  },
  warningActions: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  warningButtonPrimary: {
    flex: 1,
    backgroundColor: "#FCD34D",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  warningButtonPrimaryText: {
    color: "#92400E",
    fontWeight: "500",
    fontSize: 14,
  },
  warningButtonSecondary: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  warningButtonSecondaryText: {
    color: "#374151",
    fontWeight: "500",
    fontSize: 14,
  },

  // Detour Status Indicator Styles
  detourStatusContainer: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    zIndex: 40,
  },
  detourStatusCard: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  detourStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detourStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detourStatusTitle: {
    fontWeight: "600",
    color: "#1E40AF",
    marginLeft: 8,
  },
  detourCancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detourCancelText: {
    color: "#2563EB",
    fontWeight: "500",
    fontSize: 14,
  },
  detourDescription: {
    color: "#1E40AF",
    fontSize: 14,
    marginTop: 4,
  },
  detourTimeRemaining: {
    color: "#3730A3",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
});
