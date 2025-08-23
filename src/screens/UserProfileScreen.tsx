// src/screens/UserProfileScreen.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useUserProfile,
  createProfileWithDefaults,
} from "../stores/userProfileStore";
import { UserMobilityProfile } from "../types";

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
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState<
    UserMobilityProfile["type"] | null
  >(null);
  const [preferences, setPreferences] = useState({
    rampTolerance: "conservative" as "conservative" | "standard" | "steep",
    stairPreference: "avoid" as "avoid" | "ok",
    shadePreference: true,
    restNeeds: false,
  });

  // Mobility device options with Filipino context
  const mobilityDevices = [
    {
      type: "wheelchair" as const,
      icon: "♿" as any,
      title: "Wheelchair",
      subtitle: "Manual or electric wheelchair",
      description: "Needs ramps, wide paths, smooth surfaces",
    },
    {
      type: "walker" as const,
      icon: "walk-outline" as any,
      title: "Walker/Rollator",
      subtitle: "Walking frame with wheels",
      description: "Needs level surfaces, gentle slopes",
    },
    {
      type: "cane" as const,
      icon: "accessibility-outline" as any,
      title: "Walking Cane/Stick",
      subtitle: "Single or quad cane",
      description: "Needs stable surfaces, can handle stairs",
    },
    {
      type: "crutches" as const,
      icon: "fitness-outline" as any,
      title: "Crutches",
      subtitle: "Underarm or forearm crutches",
      description: "Needs space to maneuver, can handle stairs",
    },
    {
      type: "none" as const,
      icon: "person-outline" as any,
      title: "Walking Difficulties",
      subtitle: "No mobility aid but limited walking",
      description: "May need shorter routes, frequent rests",
    },
  ];

  const handleDeviceSelect = (deviceType: UserMobilityProfile["type"]) => {
    setSelectedDevice(deviceType);
    setCurrentStep(2);
  };

  const handleComplete = () => {
    if (!selectedDevice) {
      Alert.alert(
        "Selection Required",
        "Please select your mobility type first."
      );
      return;
    }

    // Convert UI preferences to profile settings
    const profilePreferences = {
      maxRampSlope:
        preferences.rampTolerance === "conservative"
          ? 5
          : preferences.rampTolerance === "standard"
          ? 10
          : 15,
      avoidStairs: preferences.stairPreference === "avoid",
      preferShade: preferences.shadePreference,
      maxWalkingDistance: preferences.restNeeds ? 300 : undefined, // Override default if frequent rests needed
    };

    // Create profile with smart defaults + user preferences
    const newProfile = createProfileWithDefaults(
      selectedDevice,
      profilePreferences
    );

    setProfile(newProfile);
    completeOnboarding();

    Alert.alert(
      "Profile Created!",
      "Your accessibility preferences have been saved. WAISPATH will now find the best routes for you.",
      [
        {
          text: "Start Exploring",
          onPress: () => {
            // The profile setup is complete, App.tsx will automatically
            // switch to the main tab navigator since isFirstTime is now false
            // No need to manually navigate - the app will re-render with tabs
            if (onComplete) {
              onComplete();
            }
            // Note: Don't call navigation.navigate here since we're switching
            // from Stack to Tab navigator - App.tsx handles this transition
          },
        },
      ]
    );
  };

  const renderStep1 = () => (
    <View className="flex-1">
      <View className="mb-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to WAISPATH!
        </Text>
        <Text className="text-lg text-gray-600 mb-1">
          Maligayang pagdating! 🇵🇭
        </Text>
        <Text className="text-base text-gray-600">
          Let's personalize your accessibility experience in Pasig City
        </Text>
      </View>

      <Text className="text-xl font-semibold text-gray-900 mb-4">
        What do you primarily use for mobility?
      </Text>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {mobilityDevices.map((device) => (
          <TouchableOpacity
            key={device.type}
            className="bg-white p-6 rounded-xl mb-4 border border-gray-200 shadow-sm"
            onPress={() => handleDeviceSelect(device.type)}
            accessibilityLabel={`Select ${device.title}`}
            accessibilityHint={device.description}
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-accessible-blue rounded-full items-center justify-center mr-4">
                {typeof device.icon === "string" && device.icon.length === 1 ? (
                  <Text className="text-2xl">{device.icon}</Text>
                ) : (
                  <Ionicons name={device.icon} size={24} color="white" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900">
                  {device.title}
                </Text>
                <Text className="text-sm text-gray-600 mb-1">
                  {device.subtitle}
                </Text>
                <Text className="text-xs text-accessible-gray">
                  {device.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text className="text-xs text-center text-accessible-gray mt-4">
        Don't worry - you can change these settings anytime in your profile
      </Text>
    </View>
  );

  const renderStep2 = () => (
    <View className="flex-1">
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => setCurrentStep(1)} className="mr-4">
          <Ionicons name="chevron-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">
            Quick Preferences
          </Text>
          <Text className="text-sm text-gray-600">
            Help us personalize your routes (2 minutes)
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Ramp Tolerance */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            How do you handle slopes and ramps?
          </Text>
          <View className="space-y-3">
            {[
              {
                key: "conservative",
                label: "I prefer gentle slopes",
                desc: "Avoid steep ramps when possible",
              },
              {
                key: "standard",
                label: "Standard slopes are OK",
                desc: "Can handle moderate ramps",
              },
              {
                key: "steep",
                label: "I can handle steep ramps",
                desc: "No problem with inclines",
              },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                className={`p-4 rounded-lg border ${
                  preferences.rampTolerance === option.key
                    ? "border-accessible-blue bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
                onPress={() =>
                  setPreferences((prev) => ({
                    ...prev,
                    rampTolerance: option.key as any,
                  }))
                }
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-4 h-4 rounded-full border-2 mr-3 ${
                      preferences.rampTolerance === option.key
                        ? "border-accessible-blue bg-accessible-blue"
                        : "border-gray-300"
                    }`}
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900">
                      {option.label}
                    </Text>
                    <Text className="text-sm text-gray-600">{option.desc}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stairs Preference */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            How about stairs?
          </Text>
          <View className="space-y-3">
            {[
              {
                key: "avoid",
                label: "Please avoid stairs",
                desc: "Find alternative routes",
              },
              {
                key: "ok",
                label: "Stairs are OK if needed",
                desc: "Can use stairs when necessary",
              },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                className={`p-4 rounded-lg border ${
                  preferences.stairPreference === option.key
                    ? "border-accessible-blue bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
                onPress={() =>
                  setPreferences((prev) => ({
                    ...prev,
                    stairPreference: option.key as any,
                  }))
                }
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-4 h-4 rounded-full border-2 mr-3 ${
                      preferences.stairPreference === option.key
                        ? "border-accessible-blue bg-accessible-blue"
                        : "border-gray-300"
                    }`}
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900">
                      {option.label}
                    </Text>
                    <Text className="text-sm text-gray-600">{option.desc}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Philippine Context Preferences */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Comfort preferences for Philippine weather
          </Text>

          <TouchableOpacity
            className={`p-4 rounded-lg border flex-row items-center mb-3 ${
              preferences.shadePreference
                ? "border-accessible-blue bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
            onPress={() =>
              setPreferences((prev) => ({
                ...prev,
                shadePreference: !prev.shadePreference,
              }))
            }
          >
            <View
              className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                preferences.shadePreference
                  ? "border-accessible-blue bg-accessible-blue"
                  : "border-gray-300"
              }`}
            >
              {preferences.shadePreference && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-medium text-gray-900">
                Prefer shaded routes
              </Text>
              <Text className="text-sm text-gray-600">
                Prioritize covered walkways and tree-lined paths
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className={`p-4 rounded-lg border flex-row items-center ${
              preferences.restNeeds
                ? "border-accessible-blue bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
            onPress={() =>
              setPreferences((prev) => ({
                ...prev,
                restNeeds: !prev.restNeeds,
              }))
            }
          >
            <View
              className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                preferences.restNeeds
                  ? "border-accessible-blue bg-accessible-blue"
                  : "border-gray-300"
              }`}
            >
              {preferences.restNeeds && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-medium text-gray-900">
                I need frequent rest stops
              </Text>
              <Text className="text-sm text-gray-600">
                Find shorter routes with benches or rest areas
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Complete Button */}
      <TouchableOpacity
        className="bg-accessible-green p-4 rounded-xl mt-6"
        onPress={handleComplete}
        style={{ minHeight: 48 }}
        accessibilityRole="button"
        accessibilityLabel="Complete profile setup"
      >
        <Text className="text-center text-white font-semibold text-lg">
          Complete Setup
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View 
        className="flex-1 px-6" 
        style={{ 
          paddingTop: Math.max(insets.top, 12) + 12,
          paddingBottom: Math.max(insets.bottom, 12) + 12
        }}
      >
        {currentStep === 1 ? renderStep1() : renderStep2()}
      </View>
    </View>
  );
}
