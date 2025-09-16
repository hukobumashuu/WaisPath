// src/screens/ReportDetailsScreen.tsx
// FIXED: Detailed view of user's report with status timeline (like the mockup image)

import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";

// Firebase services
import { firebaseServices } from "../services/firebase";

// Types
import { AccessibilityObstacle } from "../types";

// Styles
import {
  reportScreenStyles as styles,
  COLORS,
} from "../styles/reportScreenStyles";

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

// FIXED: Complete obstacle type labels (same as MyReportsTab)
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
  low: "Maliit na Problem",
  medium: "Katamtamang Problem",
  high: "Malaking Problem",
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
          Alert.alert("Error", "Report not found");
          navigation.goBack();
          return;
        }

        setReport(reportData);
        setTimeline(generateTimeline(reportData));
      } catch (error) {
        console.error("Failed to load report details:", error);
        Alert.alert("Error", "Failed to load report details");
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    loadReportDetails();
  }, [reportId, navigation]);

  // Generate timeline based on report status (matching mockup design)
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
      description: "We'll update you soon.",
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
        title: "Your report is being reviewed.",
        description:
          "The team may reach out to confirm or request more details if needed.",
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
        ), // +2 days
        title: "We're working on the issue.",
        description: "Issue is being addressed by the relevant team.",
        icon: "construct",
        color: COLORS.warning,
        isCompleted: true,
      });
    }

    // 4. Resolved (if status is resolved) - FIXED: Use lastVerifiedAt instead of resolvedAt
    if (reportData.status === "resolved") {
      events.push({
        id: "resolved",
        status: "resolved",
        timestamp: reportData.lastVerifiedAt || new Date(),
        title: "Issue resolved!",
        description: "Thank you for helping make Pasig more accessible.",
        icon: "checkmark-done-circle",
        color: COLORS.success,
        isCompleted: true,
      });
    }

    return events.reverse(); // Most recent first (matching mockup)
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
      pending: { label: "Pending", color: COLORS.warning },
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading report details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text>Report not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.detailsHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
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
            <View>
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
            <Text style={styles.reportSummaryLabel}>Severity:</Text>
            <Text style={styles.reportSummaryValue}>
              {SEVERITY_LABELS[report.severity] ||
                report.severity?.toUpperCase()}
            </Text>
          </View>

          {/* Description */}
          {report.description && (
            <View style={styles.reportSummaryRow}>
              <Text style={styles.reportSummaryLabel}>Description:</Text>
              <Text style={styles.reportSummaryDescription}>
                {report.description}
              </Text>
            </View>
          )}

          {/* Location */}
          <View style={styles.reportSummaryRow}>
            <Text style={styles.reportSummaryLabel}>Location:</Text>
            <Text style={styles.reportSummaryValue}>
              {report.location.latitude.toFixed(6)},{" "}
              {report.location.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Report Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.timelineSectionTitle}>Report Timeline</Text>

          <View style={styles.timelineContainer}>
            {timeline.map((event, index) => (
              <View key={event.id} style={styles.timelineItem}>
                {/* Timeline Line */}
                <View style={styles.timelineLineContainer}>
                  <View
                    style={[
                      styles.timelineIcon,
                      {
                        backgroundColor: event.isCompleted
                          ? event.color
                          : COLORS.muted + "40",
                        borderColor: event.color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={event.icon}
                      size={16}
                      color={event.isCompleted ? COLORS.white : COLORS.muted}
                    />
                  </View>
                  {index < timeline.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor: event.isCompleted
                            ? event.color
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

        {/* Additional Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: COLORS.softBlue }]}
            onPress={() => {
              // Navigate to map location
              Alert.alert(
                "Feature Coming Soon",
                "View on map feature will be available in the next update."
              );
            }}
          >
            <Ionicons name="map" size={20} color={COLORS.softBlue} />
            <Text
              style={[styles.secondaryButtonText, { color: COLORS.softBlue }]}
            >
              View on Map
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
