// src/screens/ReportScreen.tsx
// Obstacle Reporting Screen with Firebase Test Integration

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { firebaseServices, checkFirebaseHealth } from "../services/firebase";
import { createProfileWithDefaults } from "../stores/userProfileStore";
import { useLocation } from "../hooks/useLocation";
import { ObstacleType } from "../types";

const OBSTACLE_TYPES: Array<{
  key: ObstacleType;
  labelEn: string;
  labelFil: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  {
    key: "vendor_blocking",
    labelEn: "Vendor Blocking",
    labelFil: "May Nagtitinda",
    icon: "storefront",
    color: "#F59E0B",
  },
  {
    key: "parked_vehicles",
    labelEn: "Parked Vehicles",
    labelFil: "Nakaharang na Sasakyan",
    icon: "car",
    color: "#EF4444",
  },
  {
    key: "flooding",
    labelEn: "Flooding",
    labelFil: "Baha",
    icon: "water",
    color: "#3B82F6",
  },
  {
    key: "broken_pavement",
    labelEn: "Broken Pavement",
    labelFil: "Sirang Bangketa",
    icon: "warning",
    color: "#DC2626",
  },
  {
    key: "stairs_no_ramp",
    labelEn: "No Ramp Available",
    labelFil: "Walang Ramp",
    icon: "arrow-up",
    color: "#7C2D12",
  },
  {
    key: "narrow_passage",
    labelEn: "Too Narrow",
    labelFil: "Masyadong Makitid",
    icon: "resize",
    color: "#059669",
  },
];

const ReportScreen: React.FC = () => {
  const { location, getCurrentLocation } = useLocation();
  const [showFirebaseTest, setShowFirebaseTest] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [selectedObstacle, setSelectedObstacle] = useState<ObstacleType | null>(
    null
  );

  const addTestResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const runFirebaseTest = async () => {
    setIsTestLoading(true);
    setTestResults([]);

    try {
      // Test 1: Check Firebase Health
      addTestResult("🔥 Checking Firebase health...");
      const health = await checkFirebaseHealth();
      addTestResult(`✅ Firebase Health: ${health}`);

      if (health === "failed") {
        addTestResult("❌ Firebase health check failed");
        return;
      }

      // Test 2: Create and save test profile
      addTestResult("📝 Creating test profile...");
      const testProfile = createProfileWithDefaults("wheelchair", {
        preferShade: true,
        maxWalkingDistance: 500,
      });
      addTestResult(`✅ Test profile created: ${testProfile.id}`);

      // Test 3: Save to Firebase
      addTestResult("☁️ Attempting to save to Firebase...");
      await firebaseServices.profile.saveProfile(testProfile);
      addTestResult("✅ Profile saved to Firebase successfully!");

      // Test 4: Retrieve from Firebase
      addTestResult("📥 Attempting to retrieve from Firebase...");
      const retrievedProfile = await firebaseServices.profile.getProfile();

      if (retrievedProfile) {
        addTestResult("✅ Profile retrieved successfully!");
        addTestResult(`📋 Retrieved type: ${retrievedProfile.type}`);
      } else {
        addTestResult("⚠️ No profile found (might be normal for new setup)");
      }

      // Test 5: Test obstacle service
      addTestResult("🚧 Testing obstacle service (mock)...");
      const mockObstacles = await firebaseServices.obstacle.getObstaclesInArea(
        14.5547,
        121.0244,
        5
      );
      addTestResult(`✅ Retrieved ${mockObstacles.length} mock obstacles`);

      Alert.alert(
        "🎉 Firebase Test Complete!",
        `Your Firebase storage is working! Found ${health} service running.`,
        [{ text: "Great!" }]
      );
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      addTestResult(`❌ Error: ${errorMsg}`);
      Alert.alert("Firebase Test Failed", errorMsg);
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleObstacleSelect = (obstacleType: ObstacleType) => {
    setSelectedObstacle(obstacleType);

    // Get current location for obstacle reporting
    getCurrentLocation();

    Alert.alert(
      "Obstacle Report",
      `Ready to report: ${
        OBSTACLE_TYPES.find((o) => o.key === obstacleType)?.labelEn
      }\n\nNext: Photo capture + GPS tagging\n(Coming in next session!)`,
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-gray-900">
            Report Issues
          </Text>
          <Text className="text-base text-gray-600 mt-1">
            Tumulong sa community by reporting accessibility obstacles
          </Text>
        </View>

        {/* Firebase Test Section */}
        <View className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-semibold text-gray-800">
              🔥 Firebase Storage Test
            </Text>
            <TouchableOpacity
              onPress={() => setShowFirebaseTest(!showFirebaseTest)}
              className="p-2"
            >
              <Ionicons
                name={showFirebaseTest ? "chevron-up" : "chevron-down"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {showFirebaseTest && (
            <>
              <TouchableOpacity
                onPress={runFirebaseTest}
                disabled={isTestLoading}
                className={`p-4 rounded-lg mb-4 ${
                  isTestLoading
                    ? "bg-gray-400"
                    : "bg-blue-500 active:bg-blue-600"
                }`}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {isTestLoading ? "⏳ Testing..." : "🚀 Test Firebase Storage"}
                </Text>
              </TouchableOpacity>

              {testResults.length > 0 && (
                <View className="bg-gray-50 p-3 rounded-lg">
                  <Text className="font-semibold mb-2">Test Results:</Text>
                  {testResults.map((result, index) => (
                    <Text key={index} className="text-sm text-gray-700 mb-1">
                      {result}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Current Location Status */}
        <View className="bg-blue-50 rounded-xl p-4 mb-6 flex-row items-center">
          <Ionicons name="location" size={24} color="#3B82F6" />
          <View className="flex-1 ml-3">
            <Text className="font-semibold text-blue-900">
              Current Location
            </Text>
            <Text className="text-blue-700 text-sm">
              {location
                ? `📍 ${location.latitude.toFixed(
                    4
                  )}, ${location.longitude.toFixed(4)}`
                : "Getting location..."}
            </Text>
          </View>
          {!location && (
            <TouchableOpacity
              onPress={getCurrentLocation}
              className="bg-blue-500 px-3 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">Get GPS</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Obstacle Type Selection */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-900 mb-4">
            What kind of obstacle? / Anong uri ng hadlang?
          </Text>

          <View className="space-y-3">
            {OBSTACLE_TYPES.map((obstacle) => (
              <TouchableOpacity
                key={obstacle.key}
                onPress={() => handleObstacleSelect(obstacle.key)}
                className={`p-4 rounded-xl flex-row items-center min-h-[64] ${
                  selectedObstacle === obstacle.key
                    ? "bg-blue-100 border-2 border-blue-500"
                    : "bg-white border border-gray-200"
                }`}
                style={{
                  borderColor:
                    selectedObstacle === obstacle.key
                      ? obstacle.color
                      : "#E5E7EB",
                }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: `${obstacle.color}20` }}
                >
                  <Ionicons
                    name={obstacle.icon}
                    size={24}
                    color={obstacle.color}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900">
                    {obstacle.labelEn}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {obstacle.labelFil}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Coming Soon Section */}
        <View className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <View className="flex-row items-center mb-2">
            <Ionicons name="construct" size={20} color="#F59E0B" />
            <Text className="font-semibold text-yellow-800 ml-2">
              Coming Next Session
            </Text>
          </View>
          <Text className="text-yellow-700 text-sm">
            📷 Photo capture with camera{"\n"}
            📍 Automatic GPS tagging{"\n"}
            📝 Description form{"\n"}
            💾 Local storage + Firebase sync{"\n"}
            👥 Community obstacle list
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportScreen;
