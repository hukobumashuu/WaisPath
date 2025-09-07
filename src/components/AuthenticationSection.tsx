// src/components/AuthenticationSection.tsx
// 🔐 AUTHENTICATION SECTION - FIXED VERSION
// All TypeScript errors resolved, missing styles added

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { enhancedFirebaseService } from "../services/enhancedFirebase"; // Using your file name
import { UserCapabilities } from "../services/UserCapabilitiesService";
import UniversalLoginForm from "./UniversalLoginForm";

const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  lightGray: "#F8FAFC",
  success: "#10B981",
  warning: "#F59E0B",
  chipBg: "#EFF8FF",
};

interface AuthenticationSectionProps {
  onAuthStateChange?: (authType: "anonymous" | "registered" | "admin") => void;
  style?: any;
}

export default function AuthenticationSection({
  onAuthStateChange,
  style,
}: AuthenticationSectionProps) {
  const [userCapabilities, setUserCapabilities] =
    useState<UserCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    loadUserStatus();
  }, []);

  const loadUserStatus = async () => {
    try {
      setIsLoading(true);
      const status = await enhancedFirebaseService.getUserReportingStatus();
      setUserCapabilities(status.capabilities);

      if (onAuthStateChange) {
        onAuthStateChange(status.capabilities.authType);
      }
    } catch (error) {
      console.error("Failed to load user status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (
    userType: "admin" | "registered",
    userInfo: any
  ) => {
    console.log(`Authentication successful: ${userType}`);
    setShowLoginModal(false);
    await loadUserStatus();

    const message =
      userType === "admin"
        ? "Admin access enabled! You now have unlimited reporting and validation powers."
        : "Account linked successfully! You now have unlimited reporting and can track your reports.";

    Alert.alert("Welcome!", message);
  };

  const handleUpgradePrompt = () => {
    if (!userCapabilities) return;

    const benefits = [
      "📊 Track report status and timeline",
      "🔔 Get notified when reports are reviewed",
      "📝 Access your complete reporting history",
      "🚀 Unlimited daily reporting (vs 1 per day)",
      "💾 Sync your profile across all devices",
    ];

    Alert.alert(
      "Upgrade Your Account",
      "Anonymous users can only report 1 obstacle per day.\n\nRegister for unlimited access:\n\n" +
        benefits.join("\n"),
      [
        { text: "Later", style: "cancel" },
        { text: "Sign In / Register", onPress: () => setShowLoginModal(true) },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading account status...</Text>
        </View>
      </View>
    );
  }

  if (!userCapabilities) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorCard}>
          <Ionicons name="warning" size={20} color={COLORS.warning} />
          <Text style={styles.errorText}>Unable to load account status</Text>
          <TouchableOpacity onPress={loadUserStatus} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (userCapabilities.authType === "anonymous") {
    return (
      <View style={[styles.container, style]}>
        <AnonymousUserCard
          capabilities={userCapabilities}
          onUpgrade={handleUpgradePrompt}
          onLogin={() => setShowLoginModal(true)}
        />

        <Modal
          visible={showLoginModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowLoginModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <UniversalLoginForm
              mode="upgrade"
              onLoginSuccess={handleLoginSuccess}
              onCancel={() => setShowLoginModal(false)}
            />
          </SafeAreaView>
        </Modal>
      </View>
    );
  } else {
    return (
      <View style={[styles.container, style]}>
        <AuthenticatedUserCard
          capabilities={userCapabilities}
          onRefresh={loadUserStatus}
        />
      </View>
    );
  }
}

function AnonymousUserCard({
  capabilities,
  onUpgrade,
  onLogin,
}: {
  capabilities: UserCapabilities;
  onUpgrade: () => void;
  onLogin: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            { backgroundColor: capabilities.badgeColor + "20" },
          ]}
        >
          <Text style={styles.badgeEmoji}>👤</Text>
          <Text style={[styles.badgeText, { color: capabilities.badgeColor }]}>
            {capabilities.badgeText}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>Anonymous User</Text>
        <Text style={styles.cardSubtitle}>
          You can report {capabilities.dailyReportLimit} obstacle per day
        </Text>

        <View style={styles.limitInfo}>
          <Ionicons
            name="information-circle"
            size={16}
            color={COLORS.warning}
          />
          <Text style={styles.limitText}>
            Limited features - upgrade for unlimited access
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onLogin}>
          <Ionicons name="log-in" size={16} color={COLORS.white} />
          <Text style={styles.primaryButtonText}>Sign In / Register</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onUpgrade}>
          <Text style={styles.secondaryButtonText}>Learn More</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AuthenticatedUserCard({
  capabilities,
  onRefresh,
}: {
  capabilities: UserCapabilities;
  onRefresh: () => void;
}) {
  const isAdmin = capabilities.authType === "admin";
  const isRegistered = capabilities.authType === "registered";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            { backgroundColor: capabilities.badgeColor + "20" },
          ]}
        >
          <Text style={styles.badgeEmoji}>
            {isAdmin ? "🏛️" : isRegistered ? "✅" : "👤"}
          </Text>
          <Text style={[styles.badgeText, { color: capabilities.badgeColor }]}>
            {capabilities.badgeText}
          </Text>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={16} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>
          {isAdmin ? "Administrator" : "Registered User"}
        </Text>
        <Text style={styles.cardSubtitle}>
          {isAdmin
            ? "Full admin access with unlimited reporting"
            : "Unlimited reporting with report tracking"}
        </Text>

        <View style={styles.featuresGrid}>
          <FeatureItem
            icon="infinite"
            text={
              capabilities.dailyReportLimit === -1
                ? "Unlimited reports"
                : `${capabilities.dailyReportLimit} reports/day`
            }
            enabled={true}
          />
          <FeatureItem
            icon="camera"
            text="Photo uploads"
            enabled={capabilities.canUploadPhotos}
          />
          <FeatureItem
            icon="analytics"
            text="Report tracking"
            enabled={capabilities.canTrackReports}
          />
          {isAdmin && (
            <FeatureItem
              icon="shield-checkmark"
              text="Admin features"
              enabled={capabilities.canAccessAdminFeatures}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function FeatureItem({
  icon,
  text,
  enabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  enabled: boolean;
}) {
  return (
    <View style={styles.featureItem}>
      <Ionicons
        name={icon}
        size={14}
        color={enabled ? COLORS.success : COLORS.muted}
      />
      <Text
        style={[
          styles.featureText,
          { color: enabled ? COLORS.slate : COLORS.muted },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },

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

  loadingCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
  },

  errorCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },

  errorText: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
  },

  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.softBlue,
    borderRadius: 6,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  badgeEmoji: {
    fontSize: 14,
    marginRight: 6,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  refreshButton: {
    padding: 4,
  },

  cardContent: {
    marginBottom: 16,
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
    lineHeight: 18,
    marginBottom: 12,
  },

  limitInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.warning + "10",
    padding: 8,
    borderRadius: 8,
  },

  limitText: {
    fontSize: 12,
    color: COLORS.warning,
    marginLeft: 6,
    fontWeight: "500",
  },

  cardActions: {
    flexDirection: "row",
    gap: 8,
  },

  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.softBlue,
    paddingVertical: 12,
    borderRadius: 8,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },

  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.muted,
    borderRadius: 8,
  },

  secondaryButtonText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500",
  },

  featuresGrid: {
    gap: 8,
  },

  featureItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  featureText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: "500",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
});
