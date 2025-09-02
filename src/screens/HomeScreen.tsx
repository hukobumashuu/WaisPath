// src/screens/HomeScreen.tsx
// CLEAN VERSION: Better hero layout + Pasig colors + responsive

import React, { useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUserProfile } from "../stores/userProfileStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* Pasig City color scheme */
const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  chipBg: "#EFF8FF",
};

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isSmallScreen = dims.width < 380;

  // Personalized content based on mobility profile
  const personalizedContent = useMemo(() => {
    if (!profile) {
      return {
        greeting: "Welcome sa WAISPATH!",
        deviceInfo: "I-set up ang profile mo para sa personalized routes",
        icon: "🗺️",
        tips: [
          "Kumpletuhin ang profile mo",
          "Mag-explore ng Pasig City",
          "I-report ang mga obstacles",
        ],
      };
    }

    const deviceMap = {
      wheelchair: {
        greeting: "Kumusta! Ready to roll?",
        deviceInfo: "Mga ramp at malawak na daan para sa wheelchair",
        icon: "♿",
        tips: [
          "Check accessible entrances",
          "Prefer covered walkways",
          "Avoid vendor-heavy times",
        ],
      },
      walker: {
        greeting: "Hello! Safe exploration ahead",
        deviceInfo: "Steady routes para sa walker mo",
        icon: "🚶‍♂️",
        tips: [
          "Rest every 400m",
          "Use handrails when available",
          "Avoid slippery surfaces",
        ],
      },
      cane: {
        greeting: "Magandang araw! Let's navigate safely",
        deviceInfo: "Stable paths para sa walking cane",
        icon: "🦯",
        tips: [
          "Watch for uneven sidewalks",
          "Use well-lit routes at night",
          "Report loose tiles",
        ],
      },
      crutches: {
        greeting: "Ready ka na? Let's go!",
        deviceInfo: "Space para sa crutches mo",
        icon: "🩼",
        tips: ["Allow extra time", "Avoid crowded areas", "Rest frequently"],
      },
      none: {
        greeting: "Kumusta! Comfortable routes para sa'yo",
        deviceInfo: "Short distances with rest stops",
        icon: "👥",
        tips: ["Take frequent breaks", "Choose shaded paths", "Stay hydrated"],
      },
    };

    return deviceMap[profile.type] || deviceMap.none;
  }, [profile]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 60) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Hero Section */}
        <View
          style={[
            styles.heroSection,
            {
              paddingTop: Math.max(insets.top, 20) + 24,
              paddingHorizontal: 20,
              paddingBottom: 32,
            },
          ]}
        >
          <View style={styles.heroContent}>
            <Text style={styles.heroIcon}>{personalizedContent.icon}</Text>
            <View style={styles.heroText}>
              <Text
                style={[
                  styles.heroTitle,
                  { fontSize: isSmallScreen ? 22 : 26 },
                ]}
              >
                {personalizedContent.greeting}
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
              >
                {personalizedContent.deviceInfo}
              </Text>
            </View>
          </View>

          <View style={styles.locationBadge}>
            <Ionicons name="location" size={14} color={COLORS.softBlue} />
            <Text style={styles.locationText}>Pasig City, Philippines</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* Primary Actions */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={[
                styles.sectionTitle,
                { fontSize: isSmallScreen ? 20 : 24, marginBottom: 16 },
              ]}
            >
              Ano ang kailangan mo?
            </Text>

            {/* Navigate Button - Primary */}
            <TouchableOpacity
              style={[
                styles.primaryAction,
                { backgroundColor: COLORS.softBlue },
              ]}
              onPress={() => navigation.navigate("Navigate")}
              activeOpacity={0.8}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="navigate" size={24} color={COLORS.white} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.primaryActionTitle}>Maghanap ng Route</Text>
                <Text style={styles.primaryActionSubtitle}>
                  Find accessible paths sa Pasig
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>

            {/* Secondary Actions */}
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={[
                  styles.secondaryAction,
                  { backgroundColor: COLORS.navy },
                ]}
                onPress={() => navigation.navigate("Report")}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={20} color={COLORS.white} />
                <Text style={styles.secondaryActionText}>
                  I-report ang Obstacle
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryAction,
                  { backgroundColor: COLORS.muted },
                ]}
                onPress={() => navigation.navigate("Profile")}
                activeOpacity={0.8}
              >
                <Ionicons name="person" size={20} color={COLORS.white} />
                <Text style={styles.secondaryActionText}>Profile Settings</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tips Section */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={[
                styles.sectionTitle,
                { fontSize: isSmallScreen ? 18 : 20, marginBottom: 12 },
              ]}
            >
              Tips para sa'yo
            </Text>

            <View style={styles.tipsContainer}>
              {personalizedContent.tips.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <View style={styles.tipBullet} />
                  <Text
                    style={[
                      styles.tipText,
                      { fontSize: isSmallScreen ? 14 : 15 },
                    ]}
                  >
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Profile Summary */}
          {profile && (
            <TouchableOpacity
              style={styles.profileCard}
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.9}
            >
              <View style={styles.profileHeader}>
                <Ionicons name="person-circle" size={40} color={COLORS.navy} />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileTitle}>Profile mo</Text>
                  <Text style={styles.profileSubtitle}>
                    {profile.type} •{" "}
                    {profile.avoidStairs ? "Iwas stairs" : "OK sa stairs"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.muted}
                />
              </View>
            </TouchableOpacity>
          )}

          {/* Community Stats */}
          <View style={styles.statsCard}>
            <Text
              style={[styles.statsTitle, { fontSize: isSmallScreen ? 16 : 18 }]}
            >
              Community Impact
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statNumber,
                    { fontSize: isSmallScreen ? 20 : 24 },
                  ]}
                >
                  47+
                </Text>
                <Text style={styles.statLabel}>Obstacles na-report</Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statNumber,
                    { fontSize: isSmallScreen ? 20 : 24 },
                  ]}
                >
                  150+
                </Text>
                <Text style={styles.statLabel}>Routes calculated</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Clean Hero Section
  heroSection: {
    backgroundColor: COLORS.navy,
    marginBottom: 24,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 48,
    marginRight: 16,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: COLORS.white,
    opacity: 0.85,
    lineHeight: 20,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  locationText: {
    color: COLORS.softBlue,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },

  // Sections
  sectionTitle: {
    fontWeight: "700",
    color: COLORS.slate,
  },

  // Primary Action
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    marginRight: 14,
  },
  actionText: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 2,
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
  },

  // Secondary Actions
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },

  // Tips
  tipsContainer: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.softBlue,
    marginTop: 6,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    color: COLORS.slate,
    lineHeight: 20,
  },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
  },

  // Stats
  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F8FAFC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statsTitle: {
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 16,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontWeight: "700",
    color: COLORS.softBlue,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
  },
});
