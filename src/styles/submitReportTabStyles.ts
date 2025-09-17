// src/styles/submitReportTabStyles.ts
// Dedicated styles for SubmitReportTab component

import { StyleSheet } from "react-native";

/* Pasig City color scheme */
export const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  chipBg: "#EFF8FF",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  lightGray: "#F8FAFC",
};

export const submitReportTabStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },

  // Progress Section
  progressSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    elevation: 2,
  },

  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginBottom: 12,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
    textAlign: "center",
  },

  // Step Content
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  stepTitle: {
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 8,
    lineHeight: 28,
  },

  stepDescription: {
    fontSize: 16,
    color: COLORS.muted,
    marginBottom: 24,
    lineHeight: 22,
  },

  // Obstacle Selection
  obstacleGrid: {
    gap: 12,
  },

  obstacleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    minHeight: 72,
  },

  obstacleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  obstacleTextContainer: {
    flex: 1,
  },

  obstacleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },

  obstacleDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 18,
  },

  // Photo Capture
  photoPreviewContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 1,
  },

  photoPreview: {
    backgroundColor: `${COLORS.success}15`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },

  photoPreviewText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.success,
    marginBottom: 4,
  },

  photoPreviewSize: {
    fontSize: 14,
    color: COLORS.success,
    opacity: 0.8,
  },

  retakeButton: {
    backgroundColor: COLORS.softBlue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "center",
  },

  retakeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },

  cameraActions: {
    gap: 16,
    alignItems: "center",
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    elevation: 3,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },

  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },

  // Details Input
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 12,
    marginTop: 8,
  },

  severityGrid: {
    gap: 12,
    marginBottom: 24,
  },

  severityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    elevation: 1,
  },

  severityDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 16,
  },

  severityTextContainer: {
    flex: 1,
  },

  severityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },

  severityDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 18,
  },

  textArea: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.slate,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 20,
    elevation: 1,
  },

  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: `${COLORS.softBlue}30`,
  },

  locationText: {
    fontSize: 14,
    color: COLORS.softBlue,
    fontWeight: "500",
    marginLeft: 8,
    fontFamily: "monospace",
  },

  // Navigation Buttons - Fixed at bottom
  navigationButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    elevation: 8,
    position: "absolute",
    bottom: 60, // Changed from 0 to 80 - pushes buttons above tab bar
    left: 0,
    right: 0,
  },

  backButton: {
    flex: 0.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 48,
  },

  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
    marginLeft: 4,
  },

  submitButton: {
    flex: 0.6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 3,
    minHeight: 48,
  },

  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});
