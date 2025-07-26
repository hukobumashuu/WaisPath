// src/screens/SidewalkTestScreen.tsx
// Test screen for revolutionary sidewalk-aware route analysis

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUserProfile } from "../stores/userProfileStore";
import { useLocation } from "../hooks/useLocation";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";

const SidewalkTestScreen = () => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const { profile } = useUserProfile();
  const { location, pasigCenter } = useLocation();

  // Test locations - Pasig City Hall to Rizal Medical Center
  const TEST_ROUTE = {
    start: { latitude: 14.5764, longitude: 121.0851 }, // Pasig City Hall
    end: { latitude: 14.5739, longitude: 121.0892 }, // Rizal Medical Center
    name: "City Hall → Rizal Medical Center",
  };

  const addResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const testSidewalkRouteAnalysis = async () => {
    if (!profile) {
      Alert.alert(
        "Setup Required",
        "Please set up your user profile first in the Profile tab"
      );
      return;
    }

    setLoading(true);
    setTestResults([]);

    try {
      addResult("🚶‍♂️ Starting Revolutionary Sidewalk Route Analysis...");
      addResult(`👤 User Profile: ${profile.type} device`);
      addResult(`📍 Test Route: ${TEST_ROUTE.name}`);

      // Step 1: Analyze routes with sidewalk intelligence
      addResult("🧠 Analyzing sidewalks along route...");
      const analysis = await sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
        TEST_ROUTE.start,
        TEST_ROUTE.end,
        profile
      );

      addResult("✅ Sidewalk analysis complete!");

      // Step 2: Show standard route results
      const standard = analysis.standardRoute;
      addResult(`📊 STANDARD ROUTE:`);
      addResult(`   ├─ Time: ${Math.round(standard.totalTime / 60)}min`);
      addResult(
        `   ├─ Distance: ${(standard.totalDistance / 1000).toFixed(1)}km`
      );
      addResult(`   ├─ Obstacles: ${standard.segments[0].obstacles.length}`);
      addResult(`   ├─ Grade: ${standard.overallScore.grade}`);
      addResult(`   └─ Score: ${standard.overallScore.overall.toFixed(0)}/100`);

      // Step 3: Show optimized route results
      const optimized = analysis.optimizedRoute;
      addResult(`🌟 OPTIMIZED SIDEWALK ROUTE:`);
      addResult(`   ├─ Time: ${Math.round(optimized.totalTime / 60)}min`);
      addResult(
        `   ├─ Distance: ${(optimized.totalDistance / 1000).toFixed(1)}km`
      );
      addResult(`   ├─ Obstacles: ${optimized.segments[0].obstacles.length}`);
      addResult(`   ├─ Crossings: ${optimized.crossingPoints.length}`);
      addResult(`   ├─ Grade: ${optimized.overallScore.grade}`);
      addResult(
        `   └─ Score: ${optimized.overallScore.overall.toFixed(0)}/100`
      );

      // Step 4: Show comparison insights
      const comp = analysis.comparison;
      addResult(`📈 COMPARISON:`);
      addResult(`   ├─ Time difference: ${Math.round(comp.timeDifference)}s`);
      addResult(
        `   ├─ Accessibility gain: ${comp.accessibilityImprovement.toFixed(
          0
        )} points`
      );
      addResult(`   ├─ Obstacles avoided: ${comp.obstacleReduction}`);
      addResult(`   └─ Crossings needed: ${comp.crossingCount}`);

      // Step 5: Show route reasons
      addResult(`💡 OPTIMIZATION REASONS:`);
      optimized.routeReasons.forEach((reason, index) => {
        addResult(`   ${index + 1}. ${reason}`);
      });

      // Step 6: Show recommendation
      addResult(`🎯 RECOMMENDATION:`);
      addResult(`   ${comp.recommendation}`);

      // Show success alert
      Alert.alert(
        "🎉 SIDEWALK ANALYSIS SUCCESS!",
        `Revolutionary sidewalk-aware routing working!\n\n` +
          `📊 Results:\n` +
          `• Standard: ${Math.round(standard.totalTime / 60)}min, Grade ${
            standard.overallScore.grade
          }, ${standard.segments[0].obstacles.length} obstacles\n` +
          `• Optimized: ${Math.round(optimized.totalTime / 60)}min, Grade ${
            optimized.overallScore.grade
          }, ${optimized.segments[0].obstacles.length} obstacles\n\n` +
          `🌟 Improvement: ${comp.accessibilityImprovement.toFixed(
            0
          )} points more accessible!\n` +
          `🚦 Strategy: ${comp.crossingCount} strategic crossings\n\n` +
          `${comp.recommendation}`,
        [{ text: "Amazing! 🚀" }]
      );
    } catch (error: any) {
      console.error("❌ Sidewalk test failed:", error);
      addResult(`❌ ERROR: ${error.message}`);

      Alert.alert(
        "Test Failed",
        `Error: ${error.message}\n\nTry:\n• Check internet connection\n• Verify user profile setup\n• Create test data first`,
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const createSidewalkTestData = async () => {
    setLoading(true);
    try {
      addResult("🧪 Creating sidewalk-aware test obstacles...");
      await sidewalkRouteAnalysisService.createSidewalkTestData();
      addResult("✅ Sidewalk test data created!");

      Alert.alert(
        "🎯 Sidewalk Test Data Created!",
        "Created obstacles on different sides of C. Raymundo Avenue:\n\n" +
          "NORTH SIDE (more obstacles):\n" +
          "• City Hall stairs (blocks wheelchair)\n" +
          "• Parked motorcycles\n\n" +
          "SOUTH SIDE (clearer path):\n" +
          "• Food vendors (navigable)\n" +
          "• Minor pavement damage\n\n" +
          "This enables testing:\n" +
          "• Crossing recommendations\n" +
          "• Side-of-street optimization\n" +
          "• User-specific obstacle filtering\n\n" +
          "Now test the sidewalk route analysis!",
        [{ text: "Test Now!", onPress: testSidewalkRouteAnalysis }]
      );
    } catch (error: any) {
      addResult(`❌ Failed to create test data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-accessible-blue px-6 py-4">
        <Text className="text-2xl font-bold text-white">
          🚶‍♂️ Sidewalk Route Analysis Test
        </Text>
        <Text className="text-blue-200 mt-1">
          Revolutionary PWD navigation testing
        </Text>
      </View>

      {/* Profile Status */}
      <View className="px-6 py-4 bg-gray-50">
        <Text className="text-lg font-semibold text-gray-900">
          User Profile: {profile ? `${profile.type} device` : "Not set up"}
        </Text>
        <Text className="text-sm text-gray-600">
          Test Route: {TEST_ROUTE.name} (737m)
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="px-6 py-4 space-y-3">
        <TouchableOpacity
          onPress={createSidewalkTestData}
          disabled={loading}
          className="bg-yellow-500 py-4 px-6 rounded-xl flex-row items-center justify-center"
        >
          <Ionicons name="construct" size={24} color="white" />
          <Text className="text-white font-bold ml-2 text-lg">
            1. Create Sidewalk Test Data
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={testSidewalkRouteAnalysis}
          disabled={loading || !profile}
          className={`py-4 px-6 rounded-xl flex-row items-center justify-center ${
            !profile || loading ? "bg-gray-400" : "bg-blue-500"
          }`}
        >
          <Ionicons name="analytics" size={24} color="white" />
          <Text className="text-white font-bold ml-2 text-lg">
            2. Test Sidewalk Analysis
          </Text>
        </TouchableOpacity>

        {testResults.length > 0 && (
          <TouchableOpacity
            onPress={clearResults}
            className="bg-gray-500 py-3 px-6 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Clear Results</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View className="px-6 py-4">
          <View className="bg-blue-100 rounded-xl p-4 flex-row items-center">
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text className="text-blue-800 font-semibold ml-3">
              Running sidewalk analysis...
            </Text>
          </View>
        </View>
      )}

      {/* Results */}
      {testResults.length > 0 && (
        <View className="flex-1 px-6">
          <Text className="text-xl font-bold text-gray-900 mb-3">
            🧪 Test Results
          </Text>
          <ScrollView
            className="flex-1 bg-gray-50 rounded-xl p-4"
            showsVerticalScrollIndicator={false}
          >
            {testResults.map((result, index) => (
              <Text
                key={index}
                className="text-sm text-gray-800 mb-1 font-mono"
              >
                {result}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Instructions */}
      {testResults.length === 0 && !loading && (
        <View className="flex-1 px-6 py-8">
          <View className="bg-blue-50 rounded-xl p-6">
            <Text className="text-lg font-bold text-blue-900 mb-3">
              🌟 Revolutionary Sidewalk Navigation
            </Text>
            <Text className="text-blue-800 mb-4">
              This test demonstrates WAISPATH's breakthrough approach: treating
              sidewalks as separate navigation entities!
            </Text>

            <Text className="text-blue-900 font-semibold mb-2">
              What this tests:
            </Text>
            <Text className="text-blue-700 mb-1">
              • Different sides of the same street
            </Text>
            <Text className="text-blue-700 mb-1">
              • Strategic crossing recommendations
            </Text>
            <Text className="text-blue-700 mb-1">
              • User-specific obstacle filtering
            </Text>
            <Text className="text-blue-700 mb-4">
              • Accessibility vs time trade-offs
            </Text>

            <Text className="text-blue-900 font-semibold mb-2">
              Revolutionary because:
            </Text>
            <Text className="text-blue-700 mb-1">
              • First system to understand sidewalk reality
            </Text>
            <Text className="text-blue-700 mb-1">
              • PWD-focused, not car-focused navigation
            </Text>
            <Text className="text-blue-700 mb-1">
              • Microgeography intelligence for accessibility
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SidewalkTestScreen;
