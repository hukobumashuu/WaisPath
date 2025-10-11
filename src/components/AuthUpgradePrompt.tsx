// src/components/AuthUpgradePrompt.tsx
// FIXED: Prompt for anonymous users to register for report tracking features

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Styles
import {
  reportScreenStyles as styles,
  COLORS,
} from "../styles/reportScreenStyles";

const UPGRADE_BENEFITS = [
  {
    icon: "analytics" as keyof typeof Ionicons.glyphMap,
    title: "Track Your Reports",
    description:
      "See the status of all your submitted reports with timeline updates",
    color: COLORS.softBlue,
  },
  {
    icon: "infinite" as keyof typeof Ionicons.glyphMap,
    title: "Unlimited Reports",
    description: "No daily limits - report as many obstacles as you find",
    color: COLORS.warning,
  },
  {
    icon: "sync" as keyof typeof Ionicons.glyphMap,
    title: "Sync Across Devices",
    description: "Access your profile and reports from any device",
    color: COLORS.muted,
  },
];

export const AuthUpgradePrompt: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 375;

  const handleRegisterPress = () => {
    navigation.navigate("Settings");
  };

  const handleLearnMorePress = () => {
    navigation.navigate("Settings");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.upgradePromptContainer,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View style={styles.upgradeHeroSection}>
        <View style={styles.upgradeIconContainer}>
          <Ionicons name="analytics" size={48} color={COLORS.softBlue} />
        </View>
        <Text
          style={[
            styles.upgradeHeroTitle,
            { fontSize: isSmallScreen ? 24 : 28 },
          ]}
        >
          Track Your Impact
        </Text>
        <Text style={styles.upgradeHeroSubtitle}>
          Register to see the status of your reports and track how you're
          helping make Pasig more accessible
        </Text>
      </View>

      {/* Current Status Info */}
      <View style={styles.currentStatusInfo}>
        <View style={styles.currentStatusIcon}>
          <Ionicons name="person-outline" size={24} color={COLORS.warning} />
        </View>
        <View style={styles.currentStatusText}>
          <Text style={styles.currentStatusTitle}>Anonymous User</Text>
          <Text style={styles.currentStatusDescription}>
            You can report obstacles but can't track their progress
          </Text>
        </View>
      </View>

      {/* Benefits Grid */}
      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsSectionTitle}>
          What you'll get with registration:
        </Text>

        <View style={styles.benefitsGrid}>
          {UPGRADE_BENEFITS.map((benefit, index) => (
            <View key={index} style={styles.benefitCard}>
              <View
                style={[
                  styles.benefitIcon,
                  { backgroundColor: `${benefit.color}15` },
                ]}
              >
                <Ionicons name={benefit.icon} size={24} color={benefit.color} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>
                  {benefit.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Registration CTA */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: COLORS.softBlue }]}
          onPress={handleRegisterPress}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={20} color={COLORS.white} />
          <Text style={styles.primaryButtonText}>Register Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: COLORS.muted }]}
          onPress={handleLearnMorePress}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryButtonText, { color: COLORS.muted }]}>
            Learn More About WAISPATH
          </Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Note */}
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
        <Text style={styles.privacyText}>
          Your privacy is protected. Registration only requires basic info and
          helps us provide better accessibility services.
        </Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>Join the community</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>150+</Text>
            <Text style={styles.statLabel}>Active users</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>500+</Text>
            <Text style={styles.statLabel}>Reports tracked</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>85%</Text>
            <Text style={styles.statLabel}>Issues resolved</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
