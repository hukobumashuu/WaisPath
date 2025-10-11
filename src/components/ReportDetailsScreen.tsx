// src/screens/ReportDetailsScreen.tsx
// IMPROVED: Detailed view of user's report with status timeline and isolated styles

import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";

// Firebase services
import { firebaseServices } from "../services/firebase";

// Types
import { AccessibilityObstacle } from "../types";

// Isolated Styles
import {
  reportDetailsStyles as styles,
  COLORS,
} from "../styles/reportDetailsStyles";

interface RouteParams {
  reportId: string;
}

interface TimelineEvent {
  id: string;
  status: "submitted" | "pending" | "verified" | "resolved";
  timestamp: Date;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  isCompleted: boolean;
}

// Complete obstacle type labels
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

const SEVERITY_LABELS = {
  low: "Maliit na Problema",
  medium: "Katamtamang Problema",
  high: "Malaking Problema",
  blocking: "Completely Blocked",
};

export const ReportDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 375;

  const { reportId } = route.params as RouteParams;

  const [report, setReport] = useState<AccessibilityObstacle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // Load report details
  useEffect(() => {
    const loadReportDetails = async () => {
      try {
        console.log("Loading report details for:", reportId);
        const reportData = await firebaseServices.obstacle.getObstacleById(
          reportId
        );

        if (!reportData) {
          Alert.alert("Error", "Report not found", [
            { text: "OK", onPress: () => navigation.goBack() },
          ]);
          return;
        }

        setReport(reportData);
        setTimeline(generateTimeline(reportData));
      } catch (error) {
        console.error("Failed to load report details:", error);
        Alert.alert("Error", "Failed to load report details", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadReportDetails();
  }, [reportId, navigation]);

  // Generate timeline based on report status
  const generateTimeline = (
    reportData: AccessibilityObstacle
  ): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // 1. Submitted (always present)
    events.push({
      id: "submitted",
      status: "submitted",
      timestamp: reportData.reportedAt,
      title: "Report received!",
      description:
        "Your accessibility report has been successfully submitted to our system.",
      icon: "checkmark-circle",
      color: COLORS.success,
      isCompleted: true,
    });

    // 2. Under Review (if status is verified or resolved)
    if (reportData.status === "verified" || reportData.status === "resolved") {
      events.push({
        id: "under_review",
        status: "verified",
        timestamp:
          reportData.lastVerifiedAt ||
          new Date(reportData.reportedAt.getTime() + 24 * 60 * 60 * 1000),
        title: "Report under review",
        description:
          "Our accessibility team is reviewing your report and may reach out for additional details.",
        icon: "search",
        color: COLORS.softBlue,
        isCompleted:
          reportData.status === "verified" || reportData.status === "resolved",
      });
    }

    // 3. In Progress (if status is resolved)
    if (reportData.status === "resolved") {
      events.push({
        id: "in_progress",
        status: "verified",
        timestamp: new Date(
          reportData.reportedAt.getTime() + 2 * 24 * 60 * 60 * 1000
        ),
        title: "Issue being addressed",
        description:
          "The relevant team has been notified and is working on resolving this accessibility issue.",
        icon: "construct",
        color: COLORS.warning,
        isCompleted: true,
      });
    }

    // 4. Resolved (if status is resolved)
    if (reportData.status === "resolved") {
      events.push({
        id: "resolved",
        status: "resolved",
        timestamp: reportData.lastVerifiedAt || new Date(),
        title: "Issue resolved!",
        description:
          "Thank you for helping make Pasig more accessible for persons with disabilities.",
        icon: "checkmark-done-circle",
        color: COLORS.success,
        isCompleted: true,
      });
    }

    return events.reverse(); // Most recent first
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrentStatusBadge = () => {
    if (!report) return null;

    const statusConfig = {
      pending: { label: "Pending Review", color: COLORS.warning },
      verified: { label: "Under Review", color: COLORS.softBlue },
      resolved: { label: "Resolved", color: COLORS.success },
      false_report: { label: "Rejected", color: COLORS.muted },
    };

    const config = statusConfig[report.status || "pending"];

    return (
      <View
        style={[
          styles.currentStatusBadge,
          { backgroundColor: `${config.color}20` },
        ]}
      >
        <Text style={[styles.currentStatusBadgeText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.softBlue} />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>
            Report not found or could not be loaded
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: COLORS.softBlue,
              borderRadius: 8,
            }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: COLORS.white, fontWeight: "600" }}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with proper safe area */}
      <View
        style={[
          styles.detailsHeader,
          { paddingTop: Math.max(insets.top + 10, 20) },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.slate} />
        </TouchableOpacity>
        <Text
          style={[
            styles.detailsHeaderTitle,
            { fontSize: isSmallScreen ? 18 : 20 },
          ]}
        >
          Report Details
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.detailsScrollView}
        contentContainerStyle={[
          styles.detailsContainer,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Report Summary Card */}
        <View style={styles.reportSummaryCard}>
          <View style={styles.reportSummaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportSummaryType}>
                {OBSTACLE_TYPE_LABELS[report.type] || report.type}
              </Text>
              <Text style={styles.reportSummaryDate}>
                Reported on {formatFullDate(report.reportedAt)}
              </Text>
            </View>
            {getCurrentStatusBadge()}
          </View>

          {/* Severity */}
          <View style={styles.reportSummaryRow}>
            <Text style={styles.reportSummaryLabel}>Severity Level</Text>
            <Text style={styles.reportSummaryValue}>
              {SEVERITY_LABELS[report.severity] ||
                report.severity?.toUpperCase() ||
                "Not specified"}
            </Text>
          </View>

          {/* Description */}
          {report.description && (
            <View style={styles.reportSummaryRow}>
              <Text style={styles.reportSummaryLabel}>Description</Text>
              <Text style={styles.reportSummaryDescription}>
                {report.description}
              </Text>
            </View>
          )}

          {/* Location */}
          <View style={styles.reportSummaryRow}>
            <Text style={styles.reportSummaryLabel}>Location Coordinates</Text>
            <Text
              style={[styles.reportSummaryValue, { fontFamily: "monospace" }]}
            >
              {report.location.latitude.toFixed(6)},{" "}
              {report.location.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Report Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.timelineSectionTitle}>Report Progress</Text>

          <View style={styles.timelineContainer}>
            {timeline.map((event, index) => (
              <View key={event.id} style={styles.timelineItem}>
                {/* Timeline Icon and Line */}
                <View style={styles.timelineLineContainer}>
                  <View
                    style={[
                      styles.timelineIcon,
                      {
                        backgroundColor: event.isCompleted
                          ? event.color
                          : COLORS.lightGray,
                        borderColor: event.color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={event.icon}
                      size={20}
                      color={event.isCompleted ? COLORS.white : COLORS.muted}
                    />
                  </View>
                  {index < timeline.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor: event.isCompleted
                            ? event.color + "60"
                            : COLORS.muted + "40",
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Event Content */}
                <View style={styles.timelineContent}>
                  <View style={styles.timelineEventHeader}>
                    <Text style={styles.timelineEventDate}>
                      {formatDate(event.timestamp)}
                    </Text>
                    {event.isCompleted && (
                      <View
                        style={[
                          styles.statusTag,
                          { backgroundColor: `${event.color}20` },
                        ]}
                      >
                        <Text
                          style={[styles.statusTagText, { color: event.color }]}
                        >
                          {event.status === "submitted"
                            ? "Submitted"
                            : event.status === "verified"
                            ? "In Progress"
                            : event.status === "resolved"
                            ? "Resolved"
                            : "Completed"}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.timelineEventTitle}>{event.title}</Text>
                  <Text style={styles.timelineEventDescription}>
                    {event.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Additional Information Section */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsSectionTitle}>Report Information</Text>

          <View style={styles.reportSummaryRow}>
            <Text style={styles.reportSummaryLabel}>Report ID</Text>
            <Text
              style={[
                styles.reportSummaryValue,
                { fontFamily: "monospace", fontSize: 14 },
              ]}
            >
              {report.id}
            </Text>
          </View>

          {report.reportedBy && (
            <View style={styles.reportSummaryRow}>
              <Text style={styles.reportSummaryLabel}>Reported By</Text>
              <Text style={styles.reportSummaryValue}>
                User ID: {report.reportedBy.substring(0, 8)}...
              </Text>
            </View>
          )}

          <View style={styles.reportSummaryRow}>
            <Text style={styles.reportSummaryLabel}>Last Updated</Text>
            <Text style={styles.reportSummaryValue}>
              {formatFullDate(report.lastVerifiedAt || report.reportedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};
