// src/styles/userProfileStyles.ts
// Separated styles for UserProfileScreen

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
  error: "#EF4444",
  lightGray: "#F8FAFC",
};

export const userProfileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },

  // Header
  header: {
    backgroundColor: COLORS.navy,
  },
  headerTitle: {
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 8,
  },
  headerSubtitle: {
    color: COLORS.white,
    opacity: 0.9,
    lineHeight: 22,
  },

  // Progress Section
  progressSection: {
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
    textAlign: "center",
  },

  // Steps
  stepTitle: {
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 8,
  },
  stepSubtitle: {
    color: COLORS.muted,
    marginBottom: 24,
    lineHeight: 20,
  },

  // Device Selection
  deviceGrid: {
    gap: 12,
  },
  deviceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  deviceContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  deviceEmoji: {
    fontSize: 24,
  },
  deviceTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  deviceSubtitle: {
    color: COLORS.muted,
    marginBottom: 4,
  },
  deviceDescription: {
    color: COLORS.muted,
    lineHeight: 16,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  summaryContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryEmoji: {
    fontSize: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Preferences
  preferenceSection: {
    marginBottom: 16,
  },
  preferenceTitle: {
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 6,
  },
  preferenceSubtitle: {
    color: COLORS.muted,
    marginBottom: 16,
    fontSize: 14,
  },

  // Options
  optionGrid: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 16,
  },
  optionLabel: {
    fontWeight: "500",
    marginBottom: 2,
  },
  optionDescription: {
    color: COLORS.muted,
  },

  // Toggles
  toggleGrid: {
    gap: 12,
  },
  toggleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontWeight: "500",
    marginBottom: 2,
  },
  toggleDescription: {
    color: COLORS.muted,
  },

  // Footer
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backButtonText: {
    fontWeight: "600",
    color: COLORS.muted,
    marginLeft: 4,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontWeight: "600",
    color: COLORS.white,
  },
});
