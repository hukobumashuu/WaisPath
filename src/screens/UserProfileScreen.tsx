// src/screens/UserProfileScreen.tsx
// PASIG COLORS VERSION: Modern design with navy hero + soft blue accents

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  useWindowDimensions,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useUserProfile,
  createProfileWithDefaults,
} from "../stores/userProfileStore";
import { UserMobilityProfile } from "../types";

/* Pasig City color scheme - matching HomeScreen */
const COLORS = {
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

interface ProfileSetupProps {
  navigation: any;
  onComplete?: () => void;
}

export default function UserProfileScreen({
  navigation,
  onComplete,
}: ProfileSetupProps) {
  const { setProfile, completeOnboarding } = useUserProfile();
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isSmallScreen = dims.width < 380;

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState<
    UserMobilityProfile["type"] | null
  >(null);
  const [preferences, setPreferences] = useState({
    rampTolerance: "conservative" as "conservative" | "standard" | "steep",
    stairPreference: "avoid" as "avoid" | "ok",
    shadePreference: true,
    restNeeds: false,
    walkingDistance: "default" as "short" | "default" | "long",
  });

  const mobilityDevices = useMemo(
    () => [
      {
        type: "wheelchair" as const,
        icon: "♿",
        title: "Wheelchair",
        tagalogTitle: "Silyang de Gulong",
        subtitle: "Manual o electric",
        description: "Kailangan: ramp, malawak na daan, makinis na surface",
        color: COLORS.softBlue,
      },
      {
        type: "walker" as const,
        icon: "🚶‍♂️",
        title: "Walker/Rollator",
        tagalogTitle: "Walker",
        subtitle: "Walking frame na may gulong",
        description: "Kailangan: pantay na daan, banayad na slope",
        color: COLORS.success,
      },
      {
        type: "cane" as const,
        icon: "🦯",
        title: "Walking Cane",
        tagalogTitle: "Tungkod",
        subtitle: "Single o quad cane",
        description: "Kailangan: stable surface, kaya ang hagdan",
        color: COLORS.warning,
      },
      {
        type: "crutches" as const,
        icon: "🩼",
        title: "Crutches",
        tagalogTitle: "Saklay",
        subtitle: "Underarm o forearm crutches",
        description: "Kailangan: space para sa pag-move, kaya ang hagdan",
        color: COLORS.navy,
      },
      {
        type: "none" as const,
        icon: "👥",
        title: "Hirap Maglakad",
        tagalogTitle: "Walking Difficulties",
        subtitle: "Walang mobility aid pero limited sa paglalakad",
        description: "Baka kailangan: mas maikling route, madalas na pahinga",
        color: COLORS.muted,
      },
    ],
    []
  );

  const handleDeviceSelect = (deviceType: UserMobilityProfile["type"]) => {
    setSelectedDevice(deviceType);
    setCurrentStep(2);
  };

  const handleComplete = () => {
    if (!selectedDevice) {
      Alert.alert("Kailangan Piliin", "Pumili muna ng mobility type mo.");
      return;
    }

    const profilePreferences: Partial<UserMobilityProfile> = {
      maxRampSlope:
        preferences.rampTolerance === "conservative"
          ? 5
          : preferences.rampTolerance === "standard"
          ? 10
          : 15,
      avoidStairs: preferences.stairPreference === "avoid",
      preferShade: preferences.shadePreference,
    };

    if (preferences.restNeeds) {
      profilePreferences.maxWalkingDistance = 200;
    } else if (preferences.walkingDistance !== "default") {
      const distanceMultipliers = {
        short: 0.5,
        long: 1.5,
      };

      const deviceDefaults = {
        wheelchair: 800,
        walker: 400,
        cane: 600,
        crutches: 300,
        none: 1000,
      };

      const baseDistance = deviceDefaults[selectedDevice];
      const multiplier = distanceMultipliers[preferences.walkingDistance];

      profilePreferences.maxWalkingDistance = Math.round(
        baseDistance * multiplier
      );
    }

    const newProfile = createProfileWithDefaults(
      selectedDevice,
      profilePreferences
    );

    setProfile(newProfile);
    completeOnboarding();

    Alert.alert(
      "Profile Created!",
      "Na-save na ang accessibility preferences mo. Maghahanap na si WAISPATH ng best routes para sa'yo.",
      [
        {
          text: "Simulan! (Start)",
          onPress: () => {
            if (onComplete) {
              onComplete();
            }
          },
        },
      ]
    );
  };

  const renderStep1 = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 60) + 32, // Reduced from 120
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 20 }}>
        {/* Step Content */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={[styles.stepTitle, { fontSize: isSmallScreen ? 18 : 20 }]}
          >
            Ano ang ginagamit mo sa pag-galaw?
          </Text>
          <Text style={styles.stepSubtitle}>
            Choose your mobility aid to personalize routes
          </Text>

          <View style={styles.deviceGrid}>
            {mobilityDevices.map((device) => (
              <TouchableOpacity
                key={device.type}
                onPress={() => handleDeviceSelect(device.type)}
                style={[
                  styles.deviceCard,
                  {
                    borderColor:
                      selectedDevice === device.type
                        ? COLORS.softBlue
                        : "#E5E7EB",
                    backgroundColor:
                      selectedDevice === device.type
                        ? COLORS.chipBg
                        : COLORS.white,
                  },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Piliin ang ${device.tagalogTitle}`}
              >
                <View style={styles.deviceContent}>
                  <View
                    style={[
                      styles.deviceIcon,
                      { backgroundColor: device.color },
                    ]}
                  >
                    <Text style={styles.deviceEmoji}>{device.icon}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.deviceTitle,
                        {
                          fontSize: isSmallScreen ? 14 : 16,
                          color:
                            selectedDevice === device.type
                              ? COLORS.softBlue
                              : COLORS.slate,
                        },
                      ]}
                    >
                      {device.tagalogTitle}
                    </Text>
                    <Text
                      style={[
                        styles.deviceSubtitle,
                        { fontSize: isSmallScreen ? 12 : 13 },
                      ]}
                    >
                      {device.subtitle}
                    </Text>
                    <Text
                      style={[
                        styles.deviceDescription,
                        { fontSize: isSmallScreen ? 11 : 12 },
                      ]}
                    >
                      {device.description}
                    </Text>
                  </View>

                  {selectedDevice === device.type && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={COLORS.softBlue}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => {
    const selectedDeviceInfo = mobilityDevices.find(
      (d) => d.type === selectedDevice
    );

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 60) + 32, // Reduced from 120
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {/* Selected Device Summary */}
          <View style={[styles.summaryCard, { marginBottom: 24 }]}>
            <View style={styles.summaryContent}>
              <View
                style={[
                  styles.summaryIcon,
                  { backgroundColor: selectedDeviceInfo?.color },
                ]}
              >
                <Text style={styles.summaryEmoji}>
                  {selectedDeviceInfo?.icon}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>
                  Para sa {selectedDeviceInfo?.tagalogTitle} mo
                </Text>
                <Text style={styles.summarySubtitle}>
                  I-customize natin ang preferences mo
                </Text>
              </View>
            </View>
          </View>

          {/* Preferences */}
          <View style={{ marginBottom: 24 }}>
            {/* Ramp Tolerance */}
            <View style={[styles.preferenceSection, { marginBottom: 24 }]}>
              <Text
                style={[
                  styles.preferenceTitle,
                  { fontSize: isSmallScreen ? 16 : 18 },
                ]}
              >
                Gaano ka-steep na ramp ang kaya mo?
              </Text>
              <Text style={styles.preferenceSubtitle}>
                Ramp tolerance for accessible routing
              </Text>

              <View style={styles.optionGrid}>
                {[
                  {
                    key: "conservative",
                    label: "Conservative",
                    desc: "Banayad lang na slope",
                  },
                  {
                    key: "standard",
                    label: "Standard",
                    desc: "Normal na ramp sa buildings",
                  },
                  {
                    key: "steep",
                    label: "Steep",
                    desc: "Medyo matarik, kaya pa",
                  },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() =>
                      setPreferences((prev) => ({
                        ...prev,
                        rampTolerance: option.key as any,
                      }))
                    }
                    style={[
                      styles.optionCard,
                      {
                        borderColor:
                          preferences.rampTolerance === option.key
                            ? COLORS.softBlue
                            : "#E5E7EB",
                        backgroundColor:
                          preferences.rampTolerance === option.key
                            ? COLORS.chipBg
                            : COLORS.white,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.radioButton,
                          {
                            borderColor:
                              preferences.rampTolerance === option.key
                                ? COLORS.softBlue
                                : "#D1D5DB",
                            backgroundColor:
                              preferences.rampTolerance === option.key
                                ? COLORS.softBlue
                                : "transparent",
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionLabel,
                            {
                              fontSize: isSmallScreen ? 14 : 15,
                              color:
                                preferences.rampTolerance === option.key
                                  ? COLORS.softBlue
                                  : COLORS.slate,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.optionDescription,
                            { fontSize: isSmallScreen ? 12 : 13 },
                          ]}
                        >
                          {option.desc}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Stairs Preference */}
            <View style={[styles.preferenceSection, { marginBottom: 24 }]}>
              <Text
                style={[
                  styles.preferenceTitle,
                  { fontSize: isSmallScreen ? 16 : 18 },
                ]}
              >
                Okay ka ba sa hagdan?
              </Text>
              <Text style={styles.preferenceSubtitle}>
                Stairs preference for route planning
              </Text>

              <View style={styles.optionGrid}>
                {[
                  {
                    key: "avoid",
                    label: "Iwasan (Avoid)",
                    desc: "Hanapin ang may ramp",
                  },
                  {
                    key: "ok",
                    label: "Okay lang",
                    desc: "Kaya ko naman ang hagdan",
                  },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() =>
                      setPreferences((prev) => ({
                        ...prev,
                        stairPreference: option.key as any,
                      }))
                    }
                    style={[
                      styles.optionCard,
                      {
                        borderColor:
                          preferences.stairPreference === option.key
                            ? COLORS.softBlue
                            : "#E5E7EB",
                        backgroundColor:
                          preferences.stairPreference === option.key
                            ? COLORS.chipBg
                            : COLORS.white,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.radioButton,
                          {
                            borderColor:
                              preferences.stairPreference === option.key
                                ? COLORS.softBlue
                                : "#D1D5DB",
                            backgroundColor:
                              preferences.stairPreference === option.key
                                ? COLORS.softBlue
                                : "transparent",
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionLabel,
                            {
                              fontSize: isSmallScreen ? 14 : 15,
                              color:
                                preferences.stairPreference === option.key
                                  ? COLORS.softBlue
                                  : COLORS.slate,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.optionDescription,
                            { fontSize: isSmallScreen ? 12 : 13 },
                          ]}
                        >
                          {option.desc}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comfort Preferences */}
            <View style={styles.preferenceSection}>
              <Text
                style={[
                  styles.preferenceTitle,
                  { fontSize: isSmallScreen ? 16 : 18 },
                ]}
              >
                Para sa init dito sa Pilipinas 🌞
              </Text>
              <Text style={styles.preferenceSubtitle}>
                Climate and comfort preferences
              </Text>

              <View style={styles.toggleGrid}>
                <TouchableOpacity
                  onPress={() =>
                    setPreferences((prev) => ({
                      ...prev,
                      shadePreference: !prev.shadePreference,
                    }))
                  }
                  style={[
                    styles.toggleCard,
                    {
                      borderColor: preferences.shadePreference
                        ? COLORS.softBlue
                        : "#E5E7EB",
                      backgroundColor: preferences.shadePreference
                        ? COLORS.chipBg
                        : COLORS.white,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.toggleContent}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: preferences.shadePreference
                            ? COLORS.softBlue
                            : "#D1D5DB",
                          backgroundColor: preferences.shadePreference
                            ? COLORS.softBlue
                            : "transparent",
                        },
                      ]}
                    >
                      {preferences.shadePreference && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.white}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.toggleLabel,
                          {
                            fontSize: isSmallScreen ? 14 : 15,
                            color: preferences.shadePreference
                              ? COLORS.softBlue
                              : COLORS.slate,
                          },
                        ]}
                      >
                        Gusto ng shaded routes
                      </Text>
                      <Text
                        style={[
                          styles.toggleDescription,
                          { fontSize: isSmallScreen ? 12 : 13 },
                        ]}
                      >
                        May takip, may puno, hindi mainit
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setPreferences((prev) => ({
                      ...prev,
                      restNeeds: !prev.restNeeds,
                    }))
                  }
                  style={[
                    styles.toggleCard,
                    {
                      borderColor: preferences.restNeeds
                        ? COLORS.softBlue
                        : "#E5E7EB",
                      backgroundColor: preferences.restNeeds
                        ? COLORS.chipBg
                        : COLORS.white,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.toggleContent}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: preferences.restNeeds
                            ? COLORS.softBlue
                            : "#D1D5DB",
                          backgroundColor: preferences.restNeeds
                            ? COLORS.softBlue
                            : "transparent",
                        },
                      ]}
                    >
                      {preferences.restNeeds && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.white}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.toggleLabel,
                          {
                            fontSize: isSmallScreen ? 14 : 15,
                            color: preferences.restNeeds
                              ? COLORS.softBlue
                              : COLORS.slate,
                          },
                        ]}
                      >
                        Kailangan ng madalas na rest
                      </Text>
                      <Text
                        style={[
                          styles.toggleDescription,
                          { fontSize: isSmallScreen ? 12 : 13 },
                        ]}
                      >
                        Mas maikling distance, may upuan
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Navy Hero Section */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 20) + 16,
            paddingHorizontal: 20,
            paddingBottom: 20,
          },
        ]}
      >
        <Text
          style={[styles.headerTitle, { fontSize: isSmallScreen ? 22 : 26 }]}
        >
          Welcome sa WAISPATH!
        </Text>
        <Text
          style={[styles.headerSubtitle, { fontSize: isSmallScreen ? 14 : 16 }]}
        >
          Maligayang pagdating! I-personalize natin ang accessibility experience
          mo sa Pasig City 🇵🇭
        </Text>
      </View>

      {/* Modern Progress Bar */}
      <View style={[styles.progressSection, { paddingHorizontal: 20 }]}>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: currentStep >= 1 ? COLORS.softBlue : "#E5E7EB",
              },
            ]}
          />
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: currentStep >= 2 ? COLORS.softBlue : "#E5E7EB",
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          Step {currentStep} of 2 •{" "}
          {currentStep === 1 ? "Mobility Type" : "Preferences"}
        </Text>
      </View>

      {/* Content */}
      {currentStep === 1 ? renderStep1() : renderStep2()}

      {/* Footer Navigation */}
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 60) + 12,
            paddingTop: 16,
          },
        ]}
      >
        {currentStep === 2 && (
          <TouchableOpacity
            style={[styles.backButton, { flex: 1, marginRight: 12 }]}
            onPress={() => setCurrentStep(1)}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={16} color={COLORS.muted} />
            <Text
              style={[
                styles.backButtonText,
                { fontSize: isSmallScreen ? 14 : 16 },
              ]}
            >
              Bumalik
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              flex: currentStep === 2 ? 2 : 1,
              backgroundColor:
                (currentStep === 1 && selectedDevice) || currentStep === 2
                  ? COLORS.softBlue
                  : COLORS.muted,
            },
          ]}
          onPress={
            currentStep === 1
              ? () => {
                  if (selectedDevice) {
                    setCurrentStep(2);
                  } else {
                    Alert.alert(
                      "Kailangan Piliin",
                      "Pumili muna ng mobility type mo."
                    );
                  }
                }
              : handleComplete
          }
          disabled={currentStep === 1 && !selectedDevice}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.primaryButtonText,
              { fontSize: isSmallScreen ? 14 : 16 },
            ]}
          >
            {currentStep === 1 ? "Susunod (Next)" : "Tapos na! (Done)"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },

  // Header
  header: {
    backgroundColor: COLORS.navy,
  },
  headerTitle: {
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 8,
  },
  headerSubtitle: {
    color: COLORS.white,
    opacity: 0.9,
    lineHeight: 22,
  },

  // Progress Section
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
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
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
    marginBottom: 24,
    lineHeight: 20,
  },

  // Device Selection
  deviceGrid: {
    gap: 12,
  },
  deviceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  deviceContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  deviceEmoji: {
    fontSize: 24,
  },
  deviceTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  deviceSubtitle: {
    color: COLORS.muted,
    marginBottom: 4,
  },
  deviceDescription: {
    color: COLORS.muted,
    lineHeight: 16,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  summaryContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryEmoji: {
    fontSize: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Preferences
  preferenceSection: {
    marginBottom: 16,
  },
  preferenceTitle: {
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 6,
  },
  preferenceSubtitle: {
    color: COLORS.muted,
    marginBottom: 16,
    fontSize: 14,
  },

  // Options
  optionGrid: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 16,
  },
  optionLabel: {
    fontWeight: "500",
    marginBottom: 2,
  },
  optionDescription: {
    color: COLORS.muted,
  },

  // Toggles
  toggleGrid: {
    gap: 12,
  },
  toggleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontWeight: "500",
    marginBottom: 2,
  },
  toggleDescription: {
    color: COLORS.muted,
  },

  // Footer
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backButtonText: {
    fontWeight: "600",
    color: COLORS.muted,
    marginLeft: 4,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontWeight: "600",
    color: COLORS.white,
  },
});
