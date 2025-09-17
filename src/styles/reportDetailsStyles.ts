// src/styles/reportDetailsStyles.ts
// Isolated styles specifically for ReportDetailsScreen

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

export const reportDetailsStyles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },

  // Header Section
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20, // Extra top padding for better spacing
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    elevation: 2,
  },
  backButton: {
    padding: 8, // Increased padding for easier touch
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    minWidth: 44, // Minimum touch target size
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsHeaderTitle: {
    fontWeight: "700",
    color: COLORS.slate,
    flex: 1,
    textAlign: "center",
    fontSize: 20,
  },
  headerSpacer: {
    width: 44, // Match back button width for proper centering
  },

  // Scroll View
  detailsScrollView: {
    flex: 1,
  },
  detailsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Loading and Error States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: "center",
  },

  // Report Summary Card
  reportSummaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  reportSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  reportSummaryType: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 6,
    lineHeight: 28,
  },
  reportSummaryDate: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: "500",
  },

  // Status Badge
  currentStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  currentStatusBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Report Details Rows
  reportSummaryRow: {
    marginBottom: 16,
  },
  reportSummaryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 6,
  },
  reportSummaryValue: {
    fontSize: 15,
    color: COLORS.slate,
    lineHeight: 22,
  },
  reportSummaryDescription: {
    fontSize: 15,
    color: COLORS.slate,
    lineHeight: 24,
  },

  // Timeline Section
  timelineSection: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  timelineSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 20,
  },

  // Timeline Components
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
  },
  timelineLineContainer: {
    alignItems: "center",
    marginRight: 20,
    width: 40,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineLine: {
    width: 3,
    flex: 1,
    minHeight: 20,
    borderRadius: 2,
  },

  // Timeline Content
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineEventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timelineEventDate: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  timelineEventTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 6,
    lineHeight: 24,
  },
  timelineEventDescription: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
  },

  // Additional Actions Section (removed map feature)
  // This section can be used for future features like "Report an Update" or "Add Photos"
  actionsSection: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionsSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 16,
  },

  // Utility Styles
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  spacer: {
    height: 20,
  },

  // Responsive Text Sizes
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },

  // Helper Styles for Status Colors
  pendingColor: {
    color: COLORS.warning,
  },
  verifiedColor: {
    color: COLORS.softBlue,
  },
  resolvedColor: {
    color: COLORS.success,
  },
  rejectedColor: {
    color: COLORS.muted,
  },
});
