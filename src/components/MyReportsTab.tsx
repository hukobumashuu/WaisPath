// src/components/MyReportsTab.tsx
// FIXED: Report tracking and status timeline for registered users and admins

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Firebase services
import { firebaseServices } from "../services/firebase";
import { enhancedFirebaseService } from "../services/enhancedFirebase";

// Types
import { AccessibilityObstacle } from "../types";

// Styles
import {
  reportScreenStyles as styles,
  COLORS,
} from "../styles/reportScreenStyles";

interface UserReport extends AccessibilityObstacle {
  statusHistory?: StatusUpdate[];
}

interface StatusUpdate {
  status: "pending" | "verified" | "resolved" | "false_report";
  timestamp: Date;
  updatedBy?: string;
  notes?: string;
}

const STATUS_CONFIG = {
  pending: {
    label: "Under Review",
    tagLabel: "Pending",
    color: COLORS.warning,
    icon: "time-outline" as keyof typeof Ionicons.glyphMap,
    description: "Your report is being reviewed.",
  },
  verified: {
    label: "In Progress",
    tagLabel: "Under Review",
    color: COLORS.softBlue,
    icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    description: "We're working on the issue.",
  },
  resolved: {
    label: "Resolved",
    tagLabel: "Resolved",
    color: COLORS.success,
    icon: "checkmark-done-circle" as keyof typeof Ionicons.glyphMap,
    description: "Issue has been fixed!",
  },
  false_report: {
    label: "Rejected",
    tagLabel: "Rejected",
    color: COLORS.muted,
    icon: "close-circle" as keyof typeof Ionicons.glyphMap,
    description: "Report could not be verified.",
  },
};

// FIXED: Complete obstacle type labels
const OBSTACLE_TYPE_LABELS = {
  vendor_blocking: "May Nagtitinda",
  parked_vehicles: "Nakaharang na Sasakyan",
  construction: "Konstruksiyon",
  broken_infrastructure: "Sirang Infrastructure",
  debris: "Kalat o Debris",
  electrical_post: "Poste sa Daan",
  tree_roots: "Sirang Sidewalk",
  no_sidewalk: "Walang Sidewalk",
  flooding: "Baha",
  stairs_no_ramp: "May Hagdan, Walang Ramp",
  narrow_passage: "Masikip na Daan",
  broken_pavement: "Sirang Semento",
  steep_slope: "Matarik na Daan",
  other: "Iba Pa",
};

export const MyReportsTab: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 375;

  const [reports, setReports] = useState<UserReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load user reports
  const loadMyReports = useCallback(async () => {
    try {
      const context = await enhancedFirebaseService.getCurrentUserContext();

      if (!context.uid || context.authType === "anonymous") {
        console.log("Anonymous user - no reports to load");
        setReports([]);
        return;
      }

      console.log("Loading reports for user:", context.uid);

      // FIXED: Use the correct method path
      const userReports = await firebaseServices.obstacle.getUserReports(
        context.uid
      );

      // FIXED: Type the sort parameters properly
      const sortedReports = userReports.sort(
        (a: AccessibilityObstacle, b: AccessibilityObstacle) =>
          b.reportedAt.getTime() - a.reportedAt.getTime()
      );

      setReports(sortedReports);
      console.log(`Loaded ${sortedReports.length} reports`);
    } catch (error) {
      console.error("Failed to load user reports:", error);
      Alert.alert("Error", "Failed to load your reports. Please try again.");
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadInitialReports = async () => {
      setIsLoading(true);
      await loadMyReports();
      setIsLoading(false);
    };

    loadInitialReports();
  }, [loadMyReports]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMyReports();
    setIsRefreshing(false);
  }, [loadMyReports]);

  // FIXED: Navigate to report details using the root navigator
  const handleReportPress = (report: UserReport) => {
    try {
      // Use the root navigator to navigate to ReportDetails
      const rootNavigation = navigation.getParent();
      if (rootNavigation) {
        rootNavigation.navigate("ReportDetails", { reportId: report.id });
      } else {
        // Fallback to regular navigation
        navigation.navigate("ReportDetails", { reportId: report.id });
      }
    } catch (error) {
      console.error("Navigation error:", error);
      // Fallback to showing details in alert if navigation fails
      Alert.alert(
        "Report Details",
        `${OBSTACLE_TYPE_LABELS[report.type] || report.type}\n\nStatus: ${
          report.status || "pending"
        }\n\nDescription: ${report.description}`,
        [{ text: "OK" }]
      );
    }
  };

  // Generate timeline for report status
  const generateStatusTimeline = (report: UserReport) => {
    const timeline = [];

    // Always start with submitted
    timeline.push({
      status: "submitted",
      timestamp: report.reportedAt,
      label: "Report received!",
      description: "We'll update you soon.",
      color: COLORS.success,
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    });

    // Add current status
    if (report.status === "verified") {
      timeline.push({
        status: "verified",
        timestamp: report.lastVerifiedAt || new Date(),
        label: "Your report is being reviewed.",
        description:
          "The team may reach out to confirm or request more details if needed.",
        color: COLORS.softBlue,
        icon: "search" as keyof typeof Ionicons.glyphMap,
      });
    } else if (report.status === "resolved") {
      timeline.push({
        status: "verified",
        timestamp: new Date(report.reportedAt.getTime() + 24 * 60 * 60 * 1000), // +1 day estimate
        label: "Your report is being reviewed.",
        description:
          "The team may reach out to confirm or request more details if needed.",
        color: COLORS.muted,
        icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
      });

      // FIXED: Use lastVerifiedAt instead of resolvedAt since resolvedAt doesn't exist
      timeline.push({
        status: "resolved",
        timestamp: report.lastVerifiedAt || new Date(),
        label: "We're working on the issue.",
        description: "Issue has been resolved!",
        color: COLORS.success,
        icon: "checkmark-done-circle" as keyof typeof Ionicons.glyphMap,
      });
    }

    return timeline.reverse(); // Most recent first
  };

  const renderReportCard = (report: UserReport) => {
    const statusConfig = STATUS_CONFIG[report.status || "pending"];
    const timeline = generateStatusTimeline(report);
    const currentStatus = timeline[0]; // Most recent status

    return (
      <TouchableOpacity
        key={report.id}
        style={styles.reportCard}
        onPress={() => handleReportPress(report)}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.reportCardHeader}>
          <View style={styles.reportTypeSection}>
            <Text style={styles.reportTypeText}>
              {OBSTACLE_TYPE_LABELS[report.type] || report.type}
            </Text>
            <Text style={styles.reportDateText}>
              {report.reportedAt.toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${currentStatus.color}20` },
            ]}
          >
            <Ionicons
              name={currentStatus.icon}
              size={16}
              color={currentStatus.color}
            />
            <Text
              style={[styles.statusBadgeText, { color: currentStatus.color }]}
            >
              {statusConfig.tagLabel}
            </Text>
          </View>
        </View>

        {/* Current Status */}
        <View style={styles.currentStatusSection}>
          <Text style={styles.currentStatusLabel}>{currentStatus.label}</Text>
          <Text style={styles.currentStatusDescription}>
            {currentStatus.description}
          </Text>
        </View>

        {/* Location Preview */}
        {report.description && (
          <Text style={styles.reportDescriptionPreview} numberOfLines={2}>
            {report.description}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.reportCardFooter}>
          <Text style={styles.severityText}>
            Severity: {report.severity?.toUpperCase() || "UNKNOWN"}
          </Text>
          <View style={styles.viewDetailsSection}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.softBlue}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="document-outline" size={64} color={COLORS.muted} />
      <Text style={styles.emptyStateTitle}>Walang Reports Pa</Text>
      <Text style={styles.emptyStateDescription}>
        Mag-report ng mga accessibility obstacles para makita mo dito ang
        progress
      </Text>
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: COLORS.softBlue, marginTop: 16 },
        ]}
        onPress={() => {
          // Navigate to the Submit tab instead of going back
          navigation.getParent()?.setParams({ initialTab: "submit" });
        }}
      >
        <Ionicons name="add-circle" size={20} color={COLORS.white} />
        <Text style={styles.primaryButtonText}>Mag-report Ngayon</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading your reports...</Text>
    </View>
  );

  if (isLoading) {
    return <View style={styles.container}>{renderLoadingState()}</View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.tabHeader}>
        <Text
          style={[styles.tabHeaderTitle, { fontSize: isSmallScreen ? 20 : 24 }]}
        >
          Mga Na-report Mo
        </Text>
        <Text style={styles.tabHeaderSubtitle}>
          {reports.length === 0
            ? "Wala pang reports"
            : `${reports.length} report${reports.length > 1 ? "s" : ""}`}
        </Text>
      </View>

      {/* Reports List */}
      {reports.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          style={styles.reportsScrollView}
          contentContainerStyle={[
            styles.reportsContainer,
            { paddingBottom: insets.bottom + 100 }, // Increased padding to clear tab bar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.softBlue}
              title="Pull to refresh"
            />
          }
        >
          {reports.map(renderReportCard)}
        </ScrollView>
      )}
    </View>
  );
};
