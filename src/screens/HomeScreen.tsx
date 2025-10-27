// hukobumashuu/waispath/WaisPath-21ce4a07421d2a631c4b49b0aae1df2184ccb345/src/screens/HomeScreen.tsx
// CONTRAST-OPTIMIZED VERSION: Stronger Text Hierarchy & Better Readability

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

/* Optimized Color Palette - Better Contrast */
const COLORS = {
  // Primary Brand Colors
  deepNavy: "#08345A", // Back to original darker navy (better contrast)
  primaryBlue: "#1565C0", // Slightly darker blue (was #1976D2)
  accentAmber: "#F59E0B", // Kept amber

  // Backgrounds
  softGray: "#F5F5F5", // Slightly darker gray for better card contrast
  cardWhite: "#FFFFFF",

  // Supporting Colors
  lightBlue: "#E3F2FD", // Kept
  borderLight: "#D1D5DB", // Light border

  // Text (STRONGER CONTRAST)
  darkText: "#0F172A", // Darker text (was #111827)
  mediumText: "#475569", // New: For subtitles (darker than muted)
  mutedText: "#64748B", // For labels only

  // Status
  successGreen: "#059669", // Darker green (was #10B981)

  // Shadows
  shadowLight: "rgba(0, 0, 0, 0.08)",
  shadowMedium: "rgba(0, 0, 0, 0.15)",
};

interface HomeScreenProps {
  navigation: any;
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isSmallScreen = dims.width < 380;

  const personalizedContent = useMemo(() => {
    if (!profile) {
      return {
        greeting: "Welcome to WAISPATH",
        deviceInfo: "Set up your profile for personalized routes",
        iconName: "map-outline" as IoniconName,
      };
    }

    const deviceMap: {
      [key: string]: {
        greeting: string;
        deviceInfo: string;
        iconName: IoniconName;
      };
    } = {
      wheelchair: {
        greeting: "Kumusta! Ready to roll?",
        deviceInfo: "Routes with ramps and wide paths",
        iconName: "accessibility-outline" as IoniconName,
      },
      walker: {
        greeting: "Hello! Safe journey ahead.",
        deviceInfo: "Steady routes for walker users",
        iconName: "walk-outline" as IoniconName,
      },
      cane: {
        greeting: "Magandang araw! Navigate safely.",
        deviceInfo: "Stable paths for cane users",
        iconName: "walk-outline" as IoniconName,
      },
      crutches: {
        greeting: "Ready ka na? Let's go!",
        deviceInfo: "Accessible routes for crutches",
        iconName: "walk-outline" as IoniconName,
      },
      none: {
        greeting: "Kumusta! Comfortable routes.",
        deviceInfo: "Short distances with rest stops",
        iconName: "walk-outline" as IoniconName,
      },
    };

    return deviceMap[profile.type] || deviceMap.none;
  }, [profile]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 60) + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View
          style={[
            styles.heroSection,
            {
              paddingTop: Math.max(insets.top, 20) + 20,
              paddingHorizontal: 20,
              paddingBottom: 28,
            },
          ]}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconContainer}>
              <Ionicons
                name={personalizedContent.iconName}
                size={42}
                color={COLORS.cardWhite}
              />
            </View>
            <View style={styles.heroText}>
              <Text
                style={[
                  styles.heroTitle,
                  { fontSize: isSmallScreen ? 23 : 27 },
                ]}
              >
                {personalizedContent.greeting}
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { fontSize: isSmallScreen ? 15 : 17 },
                ]}
              >
                {personalizedContent.deviceInfo}
              </Text>
            </View>
          </View>

          <View style={styles.locationBadge}>
            <Ionicons name="location" size={16} color={COLORS.primaryBlue} />
            <Text style={styles.locationText}>Pasig City, Philippines</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Section Title */}
          <Text
            style={[styles.sectionTitle, { fontSize: isSmallScreen ? 21 : 25 }]}
          >
            Ano ang kailangan mo?
          </Text>

          {/* Primary Actions */}
          <View style={styles.actionsContainer}>
            {/* Navigate Button */}
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => navigation.navigate("Navigate")}
              activeOpacity={0.85}
              accessibilityLabel="Find accessible route"
              accessibilityRole="button"
            >
              <View style={styles.buttonIconCircle}>
                <Ionicons
                  name="navigate-circle"
                  size={30}
                  color={COLORS.cardWhite}
                />
              </View>
              <View style={styles.buttonTextArea}>
                <Text style={styles.buttonTitle}>Find Accessible Route</Text>
                <Text style={styles.buttonSubtitle}>
                  Navigate Pasig with confidence
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={COLORS.cardWhite}
              />
            </TouchableOpacity>

            {/* Report Button */}
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => navigation.navigate("Report")}
              activeOpacity={0.85}
              accessibilityLabel="Report obstacle"
              accessibilityRole="button"
            >
              <View style={styles.buttonIconCircle}>
                <Ionicons
                  name="alert-circle"
                  size={30}
                  color={COLORS.cardWhite}
                />
              </View>
              <View style={styles.buttonTextArea}>
                <Text style={styles.buttonTitle}>Report Obstacle</Text>
                <Text style={styles.buttonSubtitle}>
                  Help improve accessibility
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={COLORS.cardWhite}
              />
            </TouchableOpacity>
          </View>

          {/* Profile Card */}
          {profile && (
            <TouchableOpacity
              style={styles.profileCard}
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.9}
              accessibilityLabel="View your mobility profile"
              accessibilityRole="button"
            >
              <View style={styles.profileRow}>
                <View style={styles.profileIconCircle}>
                  <Ionicons
                    name="person-circle"
                    size={48}
                    color={COLORS.primaryBlue}
                  />
                </View>
                <View style={styles.profileTextArea}>
                  <Text style={styles.profileLabel}>YOUR PROFILE</Text>
                  <Text style={styles.profileType}>
                    {profile.type === "wheelchair"
                      ? "Wheelchair User"
                      : profile.type === "walker"
                      ? "Walker User"
                      : profile.type === "cane"
                      ? "Cane User"
                      : profile.type === "crutches"
                      ? "Crutches User"
                      : "Mobility Profile"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={COLORS.mediumText}
                />
              </View>
            </TouchableOpacity>
          )}

          {/* Community Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.statsHeader}>Community Impact</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={styles.statIconBadge}>
                  <Ionicons
                    name="alert-circle"
                    size={24}
                    color={COLORS.accentAmber}
                  />
                </View>
                <Text style={styles.statNumber}>47+</Text>
                <Text style={styles.statLabel}>Obstacles{"\n"}Reported</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={styles.statIconBadge}>
                  <Ionicons
                    name="people"
                    size={24}
                    color={COLORS.successGreen}
                  />
                </View>
                <Text style={styles.statNumber}>150+</Text>
                <Text style={styles.statLabel}>People{"\n"}Assisted</Text>
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
    backgroundColor: COLORS.softGray,
  },

  // Hero Section
  heroSection: {
    backgroundColor: COLORS.deepNavy,
    marginBottom: 16,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontWeight: "800",
    color: COLORS.cardWhite,
    marginBottom: 6,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontWeight: "500",
    color: COLORS.cardWhite,
    lineHeight: 24,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardWhite,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  locationText: {
    color: COLORS.primaryBlue,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },

  // Main Content
  mainContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontWeight: "800",
    color: COLORS.darkText,
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  // Actions Container
  actionsContainer: {
    gap: 14,
    marginBottom: 20,
  },

  // Buttons (Both Navigate & Report)
  navigateButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 84,
    shadowColor: COLORS.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  reportButton: {
    backgroundColor: COLORS.accentAmber,
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 84,
    shadowColor: COLORS.accentAmber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  buttonTextArea: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.cardWhite,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  buttonSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.cardWhite,
  },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 84,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileIconCircle: {
    marginRight: 14,
  },
  profileTextArea: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.mutedText,
    letterSpacing: 1,
    marginBottom: 5,
  },
  profileType: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.darkText,
    letterSpacing: -0.3,
  },

  // Stats Card
  statsCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.darkText,
    textAlign: "center",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.lightBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.darkText,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.mediumText,
    textAlign: "center",
    lineHeight: 18,
  },
  statDivider: {
    width: 1.5,
    height: 72,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 16,
  },
});
