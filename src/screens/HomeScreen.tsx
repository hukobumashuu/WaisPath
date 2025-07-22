import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface HomeScreenProps {
  navigation: any; // Simple typing for now - we'll fix this in Month 2
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  return (
    <ScrollView className="flex-1 bg-white">
      {/* Hero Section */}
      <View className="bg-accessible-blue px-6 py-8 mb-6">
        <Text className="text-6xl font-bold text-white mb-2">WAISPath</Text>
        <Text className="text-touch-optimal text-blue-100 mb-2">
          Accessible navigation para sa Pasig City
        </Text>
        <Text className="text-base text-blue-200">
          Handog namin ang ligtas at accessible na routes para sa mga PWD
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
              Maghanap ng Route
            </Text>
            <Text className="text-base text-green-100">
              Accessible paths sa Pasig
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
              I-report ang Hadlang
            </Text>
            <Text className="text-base text-yellow-100">
              Tulungang i-improve ang accessibility
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>

        {/* Status Cards */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Status ng Sistema
          </Text>

          {/* Community Reports */}
          <View className="bg-gray-50 p-6 rounded-lg mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="people" size={24} color="#6B7280" />
              <View className="flex-1 ml-3">
                <Text className="text-lg font-semibold text-gray-900">
                  Community Reports
                </Text>
                <Text className="text-sm text-accessible-gray">
                  Real-time na mga ulat mula sa community
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-2xl font-bold text-accessible-green">
                  156
                </Text>
                <Text className="text-xs text-accessible-gray">
                  Reports ngayong buwan
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-accessible-yellow">
                  23
                </Text>
                <Text className="text-xs text-accessible-gray">
                  Active obstacles
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-accessible-blue">
                  89%
                </Text>
                <Text className="text-xs text-accessible-gray">
                  Accuracy rate
                </Text>
              </View>
            </View>
          </View>

          {/* System Status */}
          <View className="bg-green-50 p-6 rounded-lg">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <View className="flex-1 ml-3">
                <Text className="text-lg font-semibold text-gray-900">
                  System Status
                </Text>
                <Text className="text-sm text-accessible-gray">
                  Lahat ng serbisyo ay gumagana nang maayos
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Tips */}
        <View className="bg-blue-50 p-6 rounded-lg mb-8">
          <Text className="text-lg font-semibold text-accessible-blue mb-3">
            💡 Tip para sa PWD Navigation
          </Text>
          <Text className="text-base text-gray-700 leading-relaxed">
            I-update mo ang inyong mobility profile sa settings para sa mas
            personalized na routes. Piliin ang tamang mobility aid at
            preferences para sa pinaka-safe na daan.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
