// src/screens/HomeScreen.tsx - Updated with User Profile Integration
import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUserProfile } from "../stores/userProfileStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();

  // Get personalized greeting and insights based on user's mobility device
  const getPersonalizedContent = () => {
    if (!profile)
      return {
        greeting: "Welcome",
        deviceInfo: "",
        icon: "🚶‍♂️",
        tips: [],
      };

    const deviceMap = {
      wheelchair: {
        greeting: "Welcome back, wheelchair user!",
        deviceInfo: "Optimized for ramps and wide paths",
        icon: "♿",
        tips: [
          "Check for accessible entrances",
          "Avoid peak vendor hours (8-10am)",
          "Look for covered walkways",
        ],
      },
      walker: {
        greeting: "Hello! Ready to explore safely?",
        deviceInfo: "Routes with gentle slopes and rest areas",
        icon: "🚶‍♂️",
        tips: [
          "Take breaks every 400 meters",
          "Use handrails when available",
          "Avoid wet surfaces during rain",
        ],
      },
      cane: {
        greeting: "Good day! Let's find stable paths",
        deviceInfo: "Stable surfaces with good lighting",
        icon: "🦯",
        tips: [
          "Watch for uneven sidewalks",
          "Use well-lit routes at night",
          "Report loose tiles or obstacles",
        ],
      },
      crutches: {
        greeting: "Ready for your journey?",
        deviceInfo: "Routes with space to maneuver",
        icon: "🩼",
        tips: [
          "Allow extra time for navigation",
          "Avoid crowded areas when possible",
          "Rest frequently to prevent fatigue",
        ],
      },
      none: {
        greeting: "Hello! Let's find comfortable routes",
        deviceInfo: "Shorter distances with rest options",
        icon: "👥",
        tips: [
          "Take frequent breaks",
          "Choose shaded paths",
          "Stay hydrated in Philippine heat",
        ],
      },
    };

    return deviceMap[profile.type] || deviceMap.none;
  };

  const personalizedContent = getPersonalizedContent();

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingBottom: insets.bottom + 60 + 16 }}
    >
      {/* Personalized Hero Section */}
      <View
        className="bg-accessible-blue px-6 mb-6"
        style={{
          paddingTop: Math.max(insets.top, 12) + 20,
          paddingBottom: 32,
        }}
      >
        <View className="flex-row items-center mb-4">
          <Text className="text-4xl mr-3">{personalizedContent.icon}</Text>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">
              {personalizedContent.greeting}
            </Text>
            <Text className="text-base text-blue-100">
              {personalizedContent.deviceInfo}
            </Text>
          </View>
        </View>

        <Text className="text-lg font-semibold text-white mb-2">
          Navigation para sa Pasig City
        </Text>
        <Text className="text-base text-blue-200">
          Personalized routes for your mobility needs
        </Text>
      </View>

      <View className="px-6">
        {/* Quick Actions */}
        <Text className="text-2xl font-bold text-gray-900 mb-6">
          Ano ang kailangan mo?
        </Text>

        {/* Primary Action - Find Route */}
        <TouchableOpacity
          className="bg-accessible-green p-touch-safe rounded-lg mb-4 flex-row items-center min-h-touch-min shadow-sm"
          onPress={() => navigation.navigate("Navigate")}
          accessibilityLabel="Maghanap ng accessible route"
          accessibilityHint="Mag-navigate sa route finder screen"
        >
          <Ionicons name="navigate-circle" size={32} color="white" />
          <View className="flex-1 ml-4">
            <Text className="text-touch-optimal font-semibold text-white">
              Find Accessible Route
            </Text>
            <Text className="text-base text-green-100">
              Personalized for {profile?.type || "your needs"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>

        {/* Secondary Action - Report Problem */}
        <TouchableOpacity
          className="bg-accessible-yellow p-touch-safe rounded-lg mb-6 flex-row items-center min-h-touch-min shadow-sm"
          onPress={() => navigation.navigate("Report")}
          accessibilityLabel="Mag-report ng obstacle"
          accessibilityHint="I-report ang mga hadlang sa daan"
        >
          <Ionicons name="alert-circle" size={32} color="white" />
          <View className="flex-1 ml-4">
            <Text className="text-touch-optimal font-semibold text-white">
              Report Obstacle
            </Text>
            <Text className="text-base text-yellow-100">
              Help the community navigate safely
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>

        {/* Personalized Tips Section */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Tips for {profile?.type || "You"}
          </Text>

          {personalizedContent.tips.map((tip, index) => (
            <View
              key={index}
              className="bg-blue-50 p-4 rounded-lg mb-3 flex-row items-center"
            >
              <View className="w-8 h-8 bg-accessible-blue rounded-full items-center justify-center mr-3">
                <Ionicons name="bulb" size={16} color="white" />
              </View>
              <Text className="flex-1 text-base text-gray-800">{tip}</Text>
            </View>
          ))}
        </View>

        {/* Profile Quick View */}
        <TouchableOpacity
          className="bg-gray-50 p-6 rounded-lg mb-6"
          onPress={() => navigation.navigate("Profile")}
        >
          <View className="flex-row items-center mb-3">
            <Ionicons name="person-circle" size={24} color="#6B7280" />
            <Text className="text-lg font-semibold text-gray-900 ml-3">
              Your Profile
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#6B7280"
              className="ml-auto"
            />
          </View>

          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-sm text-accessible-gray">
                Mobility Device
              </Text>
              <Text className="text-base font-medium text-gray-900 capitalize">
                {profile?.type || "Not set"}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-accessible-gray">Max Slope</Text>
              <Text className="text-base font-medium text-gray-900">
                {profile?.maxRampSlope}°
              </Text>
            </View>
            <View>
              <Text className="text-sm text-accessible-gray">Avoid Stairs</Text>
              <Text className="text-base font-medium text-gray-900">
                {profile?.avoidStairs ? "Yes" : "No"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Status Cards */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Community Status
          </Text>

          {/* Community Reports */}
          <View className="bg-gray-50 p-6 rounded-lg mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="people" size={24} color="#6B7280" />
              <View className="flex-1 ml-3">
                <Text className="text-lg font-semibold text-gray-900">
                  Recent Reports
                </Text>
                <Text className="text-sm text-accessible-gray">
                  Community obstacle reports for {profile?.type || "all users"}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-2xl font-bold text-accessible-green">
                  156
                </Text>
                <Text className="text-xs text-accessible-gray">This month</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-accessible-yellow">
                  23
                </Text>
                <Text className="text-xs text-accessible-gray">Today</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-accessible-red">
                  5
                </Text>
                <Text className="text-xs text-accessible-gray">Blocking</Text>
              </View>
            </View>
          </View>

          {/* Weather-based suggestions */}
          {profile?.preferShade && (
            <View className="bg-yellow-50 p-4 rounded-lg flex-row items-center">
              <Ionicons name="sunny" size={20} color="#F59E0B" />
              <Text className="flex-1 ml-3 text-sm text-gray-700">
                <Text className="font-semibold">Weather tip:</Text> High UV
                index today. Your shaded route preferences will prioritize
                covered walkways.
              </Text>
            </View>
          )}
        </View>

        {/* Quick Stats for User's Device Type */}
        <View className="bg-accessible-blue p-6 rounded-lg mb-8">
          <Text className="text-lg font-semibold text-white mb-4">
            Accessibility Insights
          </Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">
                {profile?.type === "wheelchair"
                  ? "89%"
                  : profile?.type === "walker"
                  ? "92%"
                  : profile?.type === "cane"
                  ? "95%"
                  : "91%"}
              </Text>
              <Text className="text-xs text-blue-200 text-center">
                Routes accessible for your device
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">
                {profile?.preferShade ? "78%" : "85%"}
              </Text>
              <Text className="text-xs text-blue-200 text-center">
                Routes with shade coverage
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">2.3</Text>
              <Text className="text-xs text-blue-200 text-center">
                Avg. accessibility score
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
