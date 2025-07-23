// src/components/FirebaseTestComponent.tsx
// Temporary Firebase Storage Test Component

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { firebaseServices, checkFirebaseHealth } from "../services/firebase";
import { createProfileWithDefaults } from "../stores/userProfileStore";

export const FirebaseTestComponent: React.FC = () => {
  const [testStatus, setTestStatus] = useState<string>("Ready to test");
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const runFirebaseTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    setTestStatus("Testing Firebase...");

    try {
      // Test 1: Check Firebase Health
      addResult("🔥 Checking Firebase health...");
      const health = await checkFirebaseHealth();
      addResult(`✅ Firebase Health: ${health}`);

      if (health === "failed") {
        setTestStatus("❌ Firebase health check failed");
        return;
      }

      // Test 2: Create a test profile
      addResult("📝 Creating test profile...");
      const testProfile = createProfileWithDefaults("wheelchair", {
        preferShade: true,
        maxWalkingDistance: 500,
      });
      addResult(`✅ Test profile created: ${testProfile.id}`);

      // Test 3: Save profile to Firebase
      addResult("☁️ Attempting to save to Firebase...");
      await firebaseServices.profile.saveProfile(testProfile);
      addResult("✅ Profile saved to Firebase successfully!");

      // Test 4: Retrieve profile from Firebase
      addResult("📥 Attempting to retrieve from Firebase...");
      const retrievedProfile = await firebaseServices.profile.getProfile();

      if (retrievedProfile) {
        addResult("✅ Profile retrieved successfully!");
        addResult(`📋 Profile type: ${retrievedProfile.type}`);
        addResult(`📋 Max ramp slope: ${retrievedProfile.maxRampSlope}°`);
        addResult(`📋 Prefer shade: ${retrievedProfile.preferShade}`);
      } else {
        addResult("⚠️ No profile found in Firebase (this might be normal)");
      }

      // Test 5: Test obstacle mock service
      addResult("🚧 Testing obstacle service...");
      const mockObstacles = await firebaseServices.obstacle.getObstaclesInArea(
        14.5547, // Pasig City coordinates
        121.0244,
        5 // 5km radius
      );
      addResult(`✅ Retrieved ${mockObstacles.length} mock obstacles`);

      setTestStatus("✅ All tests completed successfully!");
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      addResult(`❌ Error: ${errorMsg}`);
      setTestStatus(`❌ Test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setTestStatus("Ready to test");
  };

  return (
    <View className="flex-1 p-4 bg-gray-50">
      <Text className="text-2xl font-bold text-gray-800 mb-4">
        🔥 Firebase Storage Test
      </Text>

      <Text className="text-lg text-gray-600 mb-4">Status: {testStatus}</Text>

      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity
          onPress={runFirebaseTest}
          disabled={isLoading}
          className={`flex-1 p-4 rounded-lg ${
            isLoading ? "bg-gray-400" : "bg-blue-500 active:bg-blue-600"
          }`}
        >
          <Text className="text-white text-center font-semibold">
            {isLoading ? "⏳ Testing..." : "🚀 Run Firebase Test"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={clearResults}
          className="px-4 py-2 bg-gray-300 rounded-lg active:bg-gray-400"
        >
          <Text className="text-gray-700 font-semibold">Clear</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-lg font-semibold text-gray-800 mb-2">
        Test Results:
      </Text>

      <ScrollView className="flex-1 bg-white p-4 rounded-lg border border-gray-200">
        {testResults.length === 0 ? (
          <Text className="text-gray-500 italic">
            No test results yet. Tap "Run Firebase Test" to begin.
          </Text>
        ) : (
          testResults.map((result, index) => (
            <Text key={index} className="text-sm text-gray-800 mb-2">
              {result}
            </Text>
          ))
        )}
      </ScrollView>

      <View className="mt-4 p-3 bg-blue-50 rounded-lg">
        <Text className="text-sm text-blue-800">
          💡 <Text className="font-semibold">What this test does:</Text>
          {"\n"}• Checks if Firebase services are available
          {"\n"}• Creates and saves a test user profile
          {"\n"}• Retrieves the profile from cloud storage
          {"\n"}• Tests obstacle service functionality
          {"\n"}• Shows whether you're using real Firebase or mock services
        </Text>
      </View>
    </View>
  );
};
