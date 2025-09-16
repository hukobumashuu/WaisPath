// src/styles/reportScreenStyles.ts
// ENHANCED: Added styles for My Reports tab, timeline, and upgrade prompt

import { StyleSheet } from "react-native";

export const COLORS = {
  // Pasig Brand Colors
  navy: "#08345A",
  softBlue: "#2BA4FF",
  slate: "#0F172A",
  muted: "#6B7280",
  white: "#FFFFFF",
  bg: "#F8FAFC",
  card: "#FFFFFF",

  // Status Colors
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",

  // Additional
  subtleBorder: "#E6EEF8",
};

export const reportScreenStyles = StyleSheet.create({
  // Base container styles
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },

  loadingText: {
    fontSize: 16,
    color: COLORS.muted,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },

  // Progress bar styles (existing)
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.subtleBorder,
  },

  progressBar: {
    height: 4,
    backgroundColor: COLORS.subtleBorder,
    borderRadius: 2,
    marginBottom: 8,
  },

  progressFill: {
    height: "100%",
    borderRadius: 2,
  },

  progressText: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: "500",
  },

  // Step content styles (existing)
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  stepTitle: {
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 8,
    marginTop: 16,
  },

  stepDescription: {
    fontSize: 16,
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 24,
  },

  // Obstacle grid styles (existing)
  obstacleGrid: {
    gap: 12,
  },

  obstacleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.subtleBorder,
    flexDirection: "row",
    alignItems: "center",
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

  // Navigation styles (existing)
  navigationButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.subtleBorder,
    gap: 12,
  },

  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },

  backButton: {
    borderWidth: 1,
    borderColor: COLORS.muted,
  },

  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.muted,
  },

  submitButton: {
    backgroundColor: COLORS.softBlue,
  },

  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },

  // Photo styles (existing)
  photoPreviewContainer: {
    alignItems: "center",
    gap: 16,
  },

  photoPreview: {
    backgroundColor: COLORS.success + "15",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.success + "30",
  },

  photoPreviewText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.success,
  },

  photoPreviewSize: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 4,
  },

  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },

  retakeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
  },

  cameraActions: {
    alignItems: "center",
    gap: 16,
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },

  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Severity styles (existing)
  severityGrid: {
    gap: 12,
    marginBottom: 24,
  },

  severityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.subtleBorder,
    flexDirection: "row",
    alignItems: "center",
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

  // Input styles (existing)
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 12,
  },

  textArea: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.subtleBorder,
    fontSize: 16,
    color: COLORS.slate,
    minHeight: 100,
    marginBottom: 16,
  },

  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.softBlue + "10",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },

  locationText: {
    fontSize: 12,
    color: COLORS.softBlue,
    fontWeight: "500",
  },

  // ================================
  // NEW STYLES FOR MY REPORTS TAB
  // ================================

  // Tab Header
  tabHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.subtleBorder,
  },

  tabHeaderTitle: {
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 4,
  },

  tabHeaderSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Reports List
  reportsScrollView: {
    flex: 1,
  },

  reportsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Individual Report Card
  reportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.subtleBorder,
  },

  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  reportTypeSection: {
    flex: 1,
  },

  reportTypeText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },

  reportDateText: {
    fontSize: 12,
    color: COLORS.muted,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Current Status Section
  currentStatusSection: {
    marginBottom: 8,
  },

  currentStatusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 2,
  },

  currentStatusDescription: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },

  // Report Description Preview
  reportDescriptionPreview: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 12,
  },

  // Report Card Footer
  reportCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.subtleBorder,
  },

  severityText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "500",
  },

  viewDetailsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  viewDetailsText: {
    fontSize: 14,
    color: COLORS.softBlue,
    fontWeight: "600",
  },

  // Empty State
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.slate,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },

  emptyStateDescription: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
  },

  // ================================
  // UPGRADE PROMPT STYLES
  // ================================

  upgradePromptContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Hero Section
  upgradeHeroSection: {
    alignItems: "center",
    marginBottom: 32,
  },

  upgradeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.softBlue + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  upgradeHeroTitle: {
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 8,
    textAlign: "center",
  },

  upgradeHeroSubtitle: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
  },

  // Current Status Info
  currentStatusInfo: {
    flexDirection: "row",
    backgroundColor: COLORS.warning + "10",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.warning + "20",
  },

  currentStatusIcon: {
    marginRight: 12,
  },

  currentStatusText: {
    flex: 1,
  },

  currentStatusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.warning,
    marginBottom: 4,
  },

  // Benefits Section
  benefitsSection: {
    marginBottom: 32,
  },

  benefitsSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 16,
  },

  benefitsGrid: {
    gap: 12,
  },

  benefitCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.subtleBorder,
    alignItems: "center",
  },

  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  benefitContent: {
    flex: 1,
  },

  benefitTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },

  benefitDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 18,
  },

  // CTA Section
  ctaSection: {
    gap: 12,
    marginBottom: 24,
  },

  // Privacy Note
  privacyNote: {
    flexDirection: "row",
    backgroundColor: COLORS.success + "10",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },

  privacyText: {
    fontSize: 13,
    color: COLORS.success,
    flex: 1,
    lineHeight: 18,
  },

  // Stats Section
  statsSection: {
    alignItems: "center",
  },

  statsSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 16,
  },

  statsGrid: {
    flexDirection: "row",
    gap: 20,
  },

  statItem: {
    alignItems: "center",
  },

  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.softBlue,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
  },

  // ================================
  // REPORT DETAILS SCREEN STYLES
  // ================================

  // Details Header
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.subtleBorder,
  },

  detailsHeaderTitle: {
    fontWeight: "600",
    color: COLORS.slate,
    flex: 1,
    textAlign: "center",
  },

  headerSpacer: {
    width: 24, // Same as back button to center title
  },

  detailsScrollView: {
    flex: 1,
  },

  detailsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Report Summary Card
  reportSummaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.subtleBorder,
  },

  reportSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  reportSummaryType: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 4,
  },

  reportSummaryDate: {
    fontSize: 14,
    color: COLORS.muted,
  },

  currentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  currentStatusBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },

  reportSummaryRow: {
    marginBottom: 12,
  },

  reportSummaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },

  reportSummaryValue: {
    fontSize: 16,
    color: COLORS.muted,
  },

  reportSummaryDescription: {
    fontSize: 16,
    color: COLORS.muted,
    lineHeight: 22,
  },

  // Timeline Section
  timelineSection: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.subtleBorder,
  },

  timelineSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 20,
  },

  timelineContainer: {
    gap: 0,
  },

  // Timeline Item
  timelineItem: {
    flexDirection: "row",
    minHeight: 80,
  },

  timelineLineContainer: {
    alignItems: "center",
    marginRight: 16,
  },

  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
    minHeight: 40,
  },

  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },

  timelineEventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  timelineEventDate: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "500",
  },

  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusTagText: {
    fontSize: 12,
    fontWeight: "600",
  },

  timelineEventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },

  timelineEventDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },

  // Actions Section
  actionsSection: {
    gap: 12,
  },

  // ================================
  // RESPONSIVE LAYOUT FIXES
  // ================================

  reportScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // FIXED: Custom tab header with proper positioning
  customTabHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.subtleBorder,
    paddingHorizontal: 20,
    paddingBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  tabContentContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row",
    justifyContent: "center",
  },

  tabButtonActive: {
    borderBottomColor: COLORS.softBlue,
  },

  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },

  tabButtonTextActive: {
    color: COLORS.softBlue,
  },

  tabButtonTextDisabled: {
    color: COLORS.muted,
    opacity: 0.6,
  },

  // Placeholder styles for tab content
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    backgroundColor: COLORS.bg,
  },

  placeholderText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.slate,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },

  placeholderSubtext: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
  },
});
