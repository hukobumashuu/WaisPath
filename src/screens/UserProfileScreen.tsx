// src/screens/UserProfileScreen.tsx
// UPDATED VERSION: Added AuthenticationSection + Separated Styles

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
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

// NEW: Import separated styles and AuthenticationSection
import {
  userProfileStyles as styles,
  COLORS,
} from "../styles/userProfileStyles";
import AuthenticationSection from "../components/AuthenticationSection";

interface ProfileSetupProps {
  navigation: any;
  onComplete?: () => void;
}

export default function UserProfileScreen({
  navigation,
  onComplete,
}: ProfileSetupProps) {
  const { profile, setProfile, completeOnboarding } = useUserProfile();
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

  // NEW: Authentication state handler
  const handleAuthStateChange = (
    authType: "anonymous" | "registered" | "admin"
  ) => {
    console.log("User auth state changed to:", authType);
    // Optionally refresh profile data or update UI based on auth type
  };

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
        paddingBottom: Math.max(insets.bottom, 60) + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 20 }}>
        {/* NEW: Authentication Section */}
        <AuthenticationSection
          onAuthStateChange={handleAuthStateChange}
          style={{ marginBottom: 24 }}
        />

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
          paddingBottom: Math.max(insets.bottom, 60) + 32,
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
