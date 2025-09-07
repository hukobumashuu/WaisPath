// src/styles/reportScreenStyles.ts
import { StyleSheet } from "react-native";

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

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },

  // Header
  header: {
    backgroundColor: COLORS.navy,
    marginBottom: 0,
  },
  headerContent: {
    alignItems: "flex-start",
  },
  headerTitle: {
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: COLORS.white,
    opacity: 0.85,
  },

  // Progress Section - Below Hero
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
    minWidth: 40,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "500",
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
    marginBottom: 20,
    lineHeight: 20,
  },

  // Cards
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  obstacleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  obstacleTitle: {
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },
  obstacleDescription: {
    color: COLORS.muted,
    lineHeight: 16,
  },

  // Photo Section
  photoSection: {
    alignItems: "center",
  },
  photoCard: {
    width: "100%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  photoCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  photoCardDescription: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  photoActions: {
    width: "100%",
    gap: 12,
  },

  // Buttons
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
  },

  // Photo Preview
  photoPreview: {
    backgroundColor: COLORS.success + "15",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.success + "30",
  },
  photoPreviewContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  photoPreviewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.success,
  },
  photoPreviewSubtitle: {
    fontSize: 12,
    color: COLORS.success,
    opacity: 0.8,
  },
  photoEditButton: {
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  photoEditText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.white,
  },

  // Severity Selection
  severityGrid: {
    gap: 12,
  },
  severityOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  severityTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  severityDescription: {
    fontSize: 13,
    color: COLORS.muted,
  },

  // Text Input
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.slate,
    minHeight: 100,
    textAlignVertical: "top",
    backgroundColor: COLORS.white,
  },

  // Action Buttons
  actionButtons: {
    gap: 12,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
    marginLeft: 4,
  },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  profileTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.softBlue,
    marginLeft: 8,
  },
  profileText: {
    fontSize: 14,
    color: COLORS.slate,
    marginBottom: 4,
  },
  profileSubtext: {
    fontSize: 12,
    color: COLORS.muted,
  },

  // Reset Button
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
    marginLeft: 8,
  },
});
