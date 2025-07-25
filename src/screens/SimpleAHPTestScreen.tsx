// src/screens/SimpleAHPTestScreen.tsx
// Enhanced version with Google Maps + AHP integration test

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
import { firebaseServices } from "../services/firebase";
// ADD THESE NEW IMPORTS for Google Maps integration testing
import { routeAnalysisService } from "../services/routeAnalysisService";
import { googleMapsService } from "../services/googleMapsService";
import { enhancedRouteAnalysisService } from "../services/enhancedRouteAnalysisService";

const SimpleAHPTestScreen = () => {
  const [obstacles, setObstacles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [locationMode, setLocationMode] = useState<"pasig" | "current">(
    "pasig"
  );
  // ADD NEW STATE for integration testing
  const [integrationResults, setIntegrationResults] = useState<string[]>([]);

  const { profile } = useUserProfile();
  const { location, pasigCenter } = useLocation();

  // Use your existing Pasig POIs from NavigationScreen
  const pasigPOIs = [
    {
      id: "1",
      name: "Pasig City Hall",
      lat: 14.5764,
      lng: 121.0851,
      type: "government",
    },
    { id: "2", name: "The Podium", lat: 14.5657, lng: 121.0644, type: "mall" },
    {
      id: "3",
      name: "Rizal Medical Center",
      lat: 14.5739,
      lng: 121.0892,
      type: "hospital",
    },
    {
      id: "4",
      name: "Pasig General Hospital",
      lat: 14.5858,
      lng: 121.0907,
      type: "hospital",
    },
  ];
  const createDiverseObstacles = async () => {
    setLoading(true);
    try {
      console.log("🌍 Creating diverse obstacles for better route testing...");
      await enhancedRouteAnalysisService.createDiverseTestData();

      Alert.alert(
        "🎯 Diverse Test Data Created!",
        "Created obstacles along different route paths to enable better route comparison.\n\n" +
          "This includes:\n" +
          "• Multiple path options\n" +
          "• Varied obstacle types\n" +
          "• Different severity levels\n" +
          "• Strategic locations for route differentiation\n\n" +
          "Now test the enhanced route analysis!",
        [{ text: "Test Enhanced Routes" }]
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        `Failed to create diverse obstacles: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const testEnhancedRouteAnalysis = async () => {
    setLoading(true);
    setIntegrationResults([]);

    const addResult = (result: string) => {
      setIntegrationResults((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString()}: ${result}`,
      ]);
    };

    try {
      addResult("🚀 Testing Enhanced Route Analysis with Alternatives...");

      if (!profile) {
        addResult("❌ No user profile found");
        Alert.alert("Error", "Please set up your profile first");
        return;
      }

      addResult(`👤 User Profile: ${profile.type} device`);

      const coords = getSearchCoordinates();
      addResult(`📍 Test location: ${coords.label}`);

      // Test enhanced route analysis
      addResult(
        "🧠 Testing enhanced route analysis with artificial alternatives..."
      );
      const start = { latitude: coords.lat, longitude: coords.lng };
      const end = { latitude: pasigPOIs[0].lat, longitude: pasigPOIs[0].lng }; // Pasig City Hall

      const analysis = await enhancedRouteAnalysisService.analyzeRoutes(
        start,
        end,
        profile
      );
      addResult("✅ Enhanced route analysis working!");

      // Show detailed results
      addResult(
        `⚡ Fastest Route: ${Math.round(
          analysis.fastestRoute.googleRoute.duration / 60
        )}min (Grade ${analysis.fastestRoute.accessibilityScore.grade})`
      );
      addResult(
        `   └─ Obstacles: ${
          analysis.fastestRoute.obstacleCount
        } | Score: ${analysis.fastestRoute.accessibilityScore.overall.toFixed(
          0
        )}/100`
      );
      addResult(
        `   └─ ${
          analysis.fastestRoute.isAlternative
            ? "Artificial Alternative"
            : "Real Google Route"
        }`
      );

      addResult(
        `♿ Accessible Route: ${Math.round(
          analysis.accessibleRoute.googleRoute.duration / 60
        )}min (Grade ${analysis.accessibleRoute.accessibilityScore.grade})`
      );
      addResult(
        `   └─ Obstacles: ${
          analysis.accessibleRoute.obstacleCount
        } | Score: ${analysis.accessibleRoute.accessibilityScore.overall.toFixed(
          0
        )}/100`
      );
      addResult(
        `   └─ ${
          analysis.accessibleRoute.isAlternative
            ? "Artificial Alternative"
            : "Real Google Route"
        }`
      );

      const timeDiff = Math.round(
        (analysis.accessibleRoute.googleRoute.duration -
          analysis.fastestRoute.googleRoute.duration) /
          60
      );
      const scoreDiff =
        analysis.accessibleRoute.accessibilityScore.overall -
        analysis.fastestRoute.accessibilityScore.overall;

      addResult(`📊 Time difference: ${timeDiff} minutes`);
      addResult(`📈 Accessibility improvement: ${scoreDiff.toFixed(0)} points`);
      addResult(`💡 ${analysis.routeComparison.recommendation}`);

      Alert.alert(
        "🎉 Enhanced Route Analysis SUCCESS!",
        `Routes now show meaningful differences!\n\n` +
          `⚡ Fastest: ${Math.round(
            analysis.fastestRoute.googleRoute.duration / 60
          )}min (Grade ${analysis.fastestRoute.accessibilityScore.grade}) - ${
            analysis.fastestRoute.obstacleCount
          } obstacles\n` +
          `♿ Accessible: ${Math.round(
            analysis.accessibleRoute.googleRoute.duration / 60
          )}min (Grade ${
            analysis.accessibleRoute.accessibilityScore.grade
          }) - ${analysis.accessibleRoute.obstacleCount} obstacles\n\n` +
          `${
            timeDiff > 0
              ? `Accessible route is ${timeDiff} min longer but `
              : ""
          }${scoreDiff.toFixed(0)} points more accessible!\n\n` +
          `🎯 Ready for real route comparison in NavigationScreen!`,
        [{ text: "Awesome! 🌟" }]
      );
    } catch (error: any) {
      console.error("❌ Enhanced route test failed:", error);
      addResult(`❌ ERROR: ${error.message}`);

      Alert.alert(
        "Enhanced Route Test Failed",
        `Error: ${error.message}\n\nTry:\n• Create diverse obstacles first\n• Check internet connection\n• Verify user profile setup`,
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // ADD NEW INTEGRATION TEST FUNCTION
  const testGoogleMapsIntegration = async () => {
    setLoading(true);
    setIntegrationResults([]);

    const addResult = (result: string) => {
      setIntegrationResults((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString()}: ${result}`,
      ]);
    };

    try {
      addResult("🚀 Starting Google Maps + AHP Integration Test...");

      if (!profile) {
        addResult("❌ No user profile found");
        Alert.alert(
          "Error",
          "Please set up your profile first in the Profile tab"
        );
        return;
      }

      addResult(`👤 User Profile: ${profile.type} device`);

      // Check API key
      if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
        addResult("❌ Google Maps API key not found in .env");
        Alert.alert(
          "Setup Required",
          "Please add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file"
        );
        return;
      }
      addResult("✅ Google Maps API key configured");

      const coords = getSearchCoordinates();
      addResult(`📍 Test location: ${coords.label}`);

      // Test 1: Google Maps API
      addResult("🗺️ Testing Google Maps Directions API...");
      const start = { latitude: coords.lat, longitude: coords.lng };
      const end = { latitude: pasigPOIs[0].lat, longitude: pasigPOIs[0].lng }; // Pasig City Hall

      const routes = await googleMapsService.getRoutes(start, end);
      addResult(`✅ Google Maps API working! Found ${routes.length} routes`);

      routes.forEach((route, index) => {
        addResult(
          `  Route ${index + 1}: ${Math.round(route.duration / 60)}min, ${(
            route.distance / 1000
          ).toFixed(1)}km`
        );
      });

      // Test 2: AHP Integration
      addResult("🧠 Testing AHP route analysis integration...");
      const analysis = await routeAnalysisService.analyzeRoutes(
        start,
        end,
        profile
      );
      addResult("✅ AHP route analysis working!");

      addResult(
        `⚡ Fastest Route: ${Math.round(
          analysis.fastestRoute.googleRoute.duration / 60
        )}min (Grade ${analysis.fastestRoute.accessibilityScore.grade})`
      );
      addResult(
        `♿ Accessible Route: ${Math.round(
          analysis.accessibleRoute.googleRoute.duration / 60
        )}min (Grade ${analysis.accessibleRoute.accessibilityScore.grade})`
      );
      addResult(
        `📊 Obstacles: Fast=${analysis.fastestRoute.obstacleCount}, Accessible=${analysis.accessibleRoute.obstacleCount}`
      );
      addResult(`💡 ${analysis.routeComparison.recommendation}`);

      // Test 3: Route comparison validation
      const timeDiff = Math.round(
        (analysis.accessibleRoute.googleRoute.duration -
          analysis.fastestRoute.googleRoute.duration) /
          60
      );
      const distanceDiff =
        (analysis.accessibleRoute.googleRoute.distance -
          analysis.fastestRoute.googleRoute.distance) /
        1000;
      addResult(`📈 Time difference: ${timeDiff} minutes`);
      addResult(`📏 Distance difference: ${distanceDiff.toFixed(1)} km`);

      Alert.alert(
        "🎉 Integration Test SUCCESS!",
        `All systems working perfectly!\n\n` +
          `✅ Google Maps API: ${routes.length} routes found\n` +
          `✅ AHP Analysis: Routes scored\n` +
          `✅ Route Comparison: Working\n\n` +
          `Results:\n` +
          `⚡ Fastest: ${Math.round(
            analysis.fastestRoute.googleRoute.duration / 60
          )}min (Grade ${analysis.fastestRoute.accessibilityScore.grade})\n` +
          `♿ Accessible: ${Math.round(
            analysis.accessibleRoute.googleRoute.duration / 60
          )}min (Grade ${
            analysis.accessibleRoute.accessibilityScore.grade
          })\n\n` +
          `🎯 Ready for NavigationScreen integration!`,
        [{ text: "Awesome! 🌟" }]
      );
    } catch (error: any) {
      console.error("❌ Integration test failed:", error);
      addResult(`❌ ERROR: ${error.message}`);

      let errorHelp = "Check:\n";
      if (error.message.includes("API key") || error.message.includes("key")) {
        errorHelp += "• Google Maps API key in .env file\n";
      }
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorHelp += "• Internet connection\n";
      }
      if (error.message.includes("profile")) {
        errorHelp += "• User profile setup\n";
      }
      errorHelp += "• API key has Directions API enabled\n";
      errorHelp += "• Try running on physical device if using emulator";

      Alert.alert(
        "Integration Test Failed",
        `Error: ${error.message}\n\n${errorHelp}`,
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Simple AHP calculation function (your existing code)
  const calculateSimpleAHPScore = (obstacle: any, userProfile: any) => {
    let traversability = 100;
    let safety = 100;
    let comfort = 100;

    // Basic obstacle penalties
    const obstaclePenalties: Record<string, number> = {
      vendor_blocking: 15,
      parked_vehicles: 20,
      stairs_no_ramp: 50,
      narrow_passage: 25,
      broken_pavement: 20,
      flooding: 30,
      construction: 35,
      no_sidewalk: 40,
      other: 10,
    };

    // Apply basic penalty
    const basePenalty = obstaclePenalties[obstacle.type] || 10;

    // Severity multiplier
    const severityMultipliers: Record<string, number> = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      blocking: 2.5,
    };
    const severityMultiplier = severityMultipliers[obstacle.severity] || 1.0;

    const penalty = basePenalty * severityMultiplier;

    // Apply to traversability (most affected)
    traversability -= penalty;

    // Apply smaller penalties to safety and comfort
    safety -= penalty * 0.3;
    comfort -= penalty * 0.2;

    // User-specific adjustments
    if (
      userProfile?.type === "wheelchair" &&
      obstacle.type === "stairs_no_ramp"
    ) {
      traversability -= 30; // Extra penalty for wheelchair users
    }

    if (userProfile?.preferShade && obstacle.type === "vendor_blocking") {
      comfort += 10; // Vendors often provide shade
    }

    // Calculate weighted overall score (AHP weights)
    const overall = traversability * 0.7 + safety * 0.2 + comfort * 0.1;

    // Convert to grade
    let grade = "F";
    if (overall >= 85) grade = "A";
    else if (overall >= 70) grade = "B";
    else if (overall >= 55) grade = "C";
    else if (overall >= 40) grade = "D";

    return {
      traversability: Math.max(0, Math.min(100, traversability)),
      safety: Math.max(0, Math.min(100, safety)),
      comfort: Math.max(0, Math.min(100, comfort)),
      overall: Math.max(0, Math.min(100, overall)),
      grade,
    };
  };

  const getSearchCoordinates = () => {
    if (locationMode === "pasig") {
      return {
        lat: pasigCenter.latitude,
        lng: pasigCenter.longitude,
        label: "Pasig City Center",
      };
    } else {
      return {
        lat: location?.latitude || pasigCenter.latitude,
        lng: location?.longitude || pasigCenter.longitude,
        label: location
          ? "Your Current Location"
          : "Pasig City Center (fallback)",
      };
    }
  };

  const loadObstacles = async () => {
    setLoading(true);
    try {
      const coords = getSearchCoordinates();

      console.log(
        `🔍 Searching for obstacles near ${coords.label}: ${coords.lat}, ${coords.lng}`
      );

      // Get obstacles from your existing Firebase service
      const obstacleData = await firebaseServices.obstacle.getObstaclesInArea(
        coords.lat,
        coords.lng,
        5 // 5km radius
      );

      setObstacles(obstacleData);

      // Calculate AHP scores for each obstacle
      if (profile) {
        const results = obstacleData.map((obstacle) => {
          const ahpScore = calculateSimpleAHPScore(obstacle, profile);
          return {
            obstacle,
            ahpScore,
            affectsUser: isObstacleRelevantToUser(obstacle, profile),
          };
        });

        // Sort by AHP score (worst first)
        results.sort((a, b) => a.ahpScore.overall - b.ahpScore.overall);
        setTestResults(results);
      }

      Alert.alert(
        "Obstacles Loaded",
        `Found ${obstacleData.length} obstacles near ${coords.label}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Failed to load obstacles:", error);
      Alert.alert("Error", "Hindi nakuha ang obstacles. Subukan ulit.");
    } finally {
      setLoading(false);
    }
  };

  const createTestObstacles = async () => {
    setLoading(true);
    try {
      const coords = getSearchCoordinates();

      console.log(
        `🧪 Creating test obstacles around ${coords.label}: ${coords.lat}, ${coords.lng}`
      );

      // Create realistic Pasig obstacles around your existing POIs
      const testObstacles = [
        // Near Pasig City Hall
        {
          location: {
            latitude: pasigPOIs[0].lat + 0.001,
            longitude: pasigPOIs[0].lng,
          },
          type: "stairs_no_ramp" as any,
          severity: "blocking" as any,
          description: "Pasig City Hall entrance walang wheelchair ramp",
          timePattern: "permanent" as any,
        },
        // Near The Podium
        {
          location: {
            latitude: pasigPOIs[1].lat,
            longitude: pasigPOIs[1].lng + 0.001,
          },
          type: "vendor_blocking" as any,
          severity: "medium" as any,
          description: "Food vendors sa tabi ng Podium mall",
          timePattern: "evening" as any,
        },
        // Near Rizal Medical Center
        {
          location: {
            latitude: pasigPOIs[2].lat - 0.001,
            longitude: pasigPOIs[2].lng,
          },
          type: "parked_vehicles" as any,
          severity: "high" as any,
          description: "Mga sasakyan nakaharang sa hospital entrance",
          timePattern: "morning" as any,
        },
        // Near Pasig General Hospital
        {
          location: {
            latitude: pasigPOIs[3].lat,
            longitude: pasigPOIs[3].lng - 0.001,
          },
          type: "broken_pavement" as any,
          severity: "high" as any,
          description: "Sirang bangketa malapit sa hospital",
          timePattern: "permanent" as any,
        },
        // General Pasig area obstacle
        {
          location: {
            latitude: coords.lat + 0.002,
            longitude: coords.lng + 0.002,
          },
          type: "flooding" as any,
          severity: "medium" as any,
          description: "Baha tuwing umuulan sa Pasig area",
          timePattern: "permanent" as any,
        },
      ];

      console.log("🧪 Creating test obstacles for AHP demo...");

      let successCount = 0;
      // Add each test obstacle to Firebase
      for (const obstacleData of testObstacles) {
        try {
          await firebaseServices.obstacle.reportObstacle(obstacleData);
          console.log(`✅ Test obstacle created: ${obstacleData.type}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to create ${obstacleData.type}:`, error);
        }
      }

      Alert.alert(
        "Test Data Created!",
        `${successCount} test obstacles added around ${coords.label}. Now tap "Load & Analyze Obstacles" to see AHP scoring in action!`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Failed to create test data:", error);
      Alert.alert("Error", "Hindi nakagawa ng test data.");
    } finally {
      setLoading(false);
    }
  };

  const isObstacleRelevantToUser = (
    obstacle: any,
    userProfile: any
  ): boolean => {
    const affectedTypes: Record<string, string[]> = {
      stairs_no_ramp: ["wheelchair", "walker"],
      narrow_passage: ["wheelchair", "walker"],
      broken_pavement: ["wheelchair", "walker", "cane", "crutches"],
      flooding: ["wheelchair", "walker", "crutches"],
      vendor_blocking: ["wheelchair", "walker"],
      parked_vehicles: ["wheelchair", "walker"],
      construction: ["wheelchair", "walker", "crutches"],
      no_sidewalk: ["wheelchair", "walker"],
    };

    const relevantTypes = affectedTypes[obstacle.type] || [];
    return relevantTypes.includes(userProfile.type);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return "#10B981"; // Green
    if (score >= 70) return "#84CC16"; // Light green
    if (score >= 55) return "#F59E0B"; // Yellow
    if (score >= 40) return "#EF4444"; // Red
    return "#DC2626"; // Dark red
  };

  const getObstacleIcon = (type: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      vendor_blocking: "storefront",
      parked_vehicles: "car",
      flooding: "water",
      broken_pavement: "warning",
      stairs_no_ramp: "walk",
      narrow_passage: "resize",
      construction: "construct",
      no_sidewalk: "trail-sign",
      other: "help-circle",
    };
    return icons[type] || "alert-circle";
  };

  const showDetailedBreakdown = (result: any) => {
    const { obstacle, ahpScore } = result;
    Alert.alert(
      "AHP Score Breakdown",
      `Obstacle: ${obstacle.type}\n` +
        `Severity: ${obstacle.severity}\n\n` +
        `AHP Analysis:\n` +
        `• Traversability (70%): ${ahpScore.traversability.toFixed(0)}/100\n` +
        `• Safety (20%): ${ahpScore.safety.toFixed(0)}/100\n` +
        `• Comfort (10%): ${ahpScore.comfort.toFixed(0)}/100\n\n` +
        `Overall Score: ${ahpScore.overall.toFixed(0)}/100\n` +
        `Grade: ${ahpScore.grade}\n\n` +
        `User Type: ${profile?.type || "none"}\n` +
        `Affects You: ${result.affectsUser ? "Yes" : "No"}\n\n` +
        `Location: ${obstacle.description}`
    );
  };

  const coords = getSearchCoordinates();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            AHP Algorithm Test
          </Text>
          <Text className="text-base text-gray-600">
            Testing accessibility scoring with Pasig City obstacles
          </Text>
        </View>

        {/* NEW: Integration Test Status */}
        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-2">
            Integration Status
          </Text>
          <Text className="text-sm text-gray-600">
            Location: {location ? "✅ Available" : "❌ Not available"}
          </Text>
          <Text className="text-sm text-gray-600">
            Profile: {profile ? `✅ ${profile.type} device` : "❌ Not set"}
          </Text>
          <Text className="text-sm text-gray-600">
            Google API:{" "}
            {process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
              ? "✅ Configured"
              : "❌ Missing API key"}
          </Text>
        </View>

        {/* Location Mode Switcher */}
        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">
            📍 Test Location
          </Text>

          <View className="flex-row mb-3">
            <TouchableOpacity
              onPress={() => setLocationMode("pasig")}
              className={`flex-1 mr-2 px-4 py-3 rounded-lg ${
                locationMode === "pasig" ? "bg-blue-500" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  locationMode === "pasig" ? "text-white" : "text-gray-700"
                }`}
              >
                Pasig Demo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLocationMode("current")}
              className={`flex-1 ml-2 px-4 py-3 rounded-lg ${
                locationMode === "current" ? "bg-green-500" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  locationMode === "current" ? "text-white" : "text-gray-700"
                }`}
              >
                Your Location
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-gray-600">Current: {coords.label}</Text>
          <Text className="text-xs text-gray-500">
            Coordinates: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        </View>

        {/* Current User Profile */}
        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-2">
            Current User Profile
          </Text>
          <Text className="text-sm text-gray-600">
            Device Type: {profile?.type || "Not set"}
          </Text>
          <Text className="text-sm text-gray-600">
            Avoid Stairs: {profile?.avoidStairs ? "Yes" : "No"}
          </Text>
          <Text className="text-sm text-gray-600">
            Prefer Shade: {profile?.preferShade ? "Yes" : "No"}
          </Text>
          <Text className="text-sm text-gray-600">
            Max Walking Distance: {profile?.maxWalkingDistance || "Not set"}m
          </Text>
        </View>

        {/* Action Buttons */}
        {/* NEW: Google Maps + AHP Integration Test Button */}
        <TouchableOpacity
          onPress={testGoogleMapsIntegration}
          disabled={loading}
          className={`py-3 rounded-lg mb-4 ${
            loading ? "bg-gray-400" : "bg-purple-500"
          }`}
        >
          <View className="flex-row items-center justify-center">
            {loading && <ActivityIndicator size="small" color="white" />}
            <Text className="text-white font-semibold text-center ml-1">
              {loading
                ? "Testing Integration..."
                : "🚀 Test Google Maps + AHP Integration"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={createDiverseObstacles}
          disabled={loading}
          className={`py-3 rounded-lg mb-4 ${
            loading ? "bg-gray-400" : "bg-yellow-500"
          }`}
        >
          <Text className="text-white font-semibold text-center">
            {loading
              ? "Creating Diverse Data..."
              : "🌍 Create Diverse Test Obstacles"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={testEnhancedRouteAnalysis}
          disabled={loading}
          className={`py-3 rounded-lg mb-4 ${
            loading ? "bg-gray-400" : "bg-purple-600"
          }`}
        >
          <View className="flex-row items-center justify-center">
            {loading && <ActivityIndicator size="small" color="white" />}
            <Text className="text-white font-semibold text-center ml-1">
              {loading
                ? "Testing Enhanced Analysis..."
                : "🎯 Test Enhanced Route Analysis"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={createTestObstacles}
          disabled={loading}
          className={`py-3 rounded-lg mb-4 ${
            loading ? "bg-gray-400" : "bg-green-500"
          }`}
        >
          <Text className="text-white font-semibold text-center">
            {loading ? "Creating Test Data..." : "🧪 Create Test Obstacles"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={loadObstacles}
          disabled={loading}
          className={`py-3 rounded-lg mb-4 ${
            loading ? "bg-gray-400" : "bg-blue-500"
          }`}
        >
          <Text className="text-white font-semibold text-center">
            {loading ? "Loading Obstacles..." : "🔍 Load & Analyze Obstacles"}
          </Text>
        </TouchableOpacity>

        {/* NEW: Integration Test Results */}
        {integrationResults.length > 0 && (
          <View className="bg-white rounded-lg p-4 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-bold text-gray-900">
                🚀 Integration Test Results
              </Text>
              <TouchableOpacity
                onPress={() => setIntegrationResults([])}
                className="px-2 py-1 rounded bg-gray-200"
              >
                <Text className="text-xs text-gray-600">Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-48">
              {integrationResults.map((result, index) => (
                <Text
                  key={index}
                  className="text-xs text-gray-700 mb-1 font-mono"
                >
                  {result}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Results Summary */}
        {testResults.length > 0 && (
          <View className="bg-white rounded-lg p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-2">
              AHP Analysis Results
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-2xl font-bold text-blue-600">
                  {testResults.length}
                </Text>
                <Text className="text-xs text-gray-600">Total Obstacles</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-600">
                  {
                    testResults.filter(
                      (r) =>
                        r.ahpScore.grade === "F" || r.ahpScore.grade === "D"
                    ).length
                  }
                </Text>
                <Text className="text-xs text-gray-600">Poor Scores</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-orange-600">
                  {testResults.filter((r) => r.affectsUser).length}
                </Text>
                <Text className="text-xs text-gray-600">Affects You</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-green-600">
                  {(
                    testResults.reduce(
                      (sum, r) => sum + r.ahpScore.overall,
                      0
                    ) / testResults.length
                  ).toFixed(0)}
                </Text>
                <Text className="text-xs text-gray-600">Avg Score</Text>
              </View>
            </View>
          </View>
        )}

        {/* Obstacle Results */}
        {testResults.map((result, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => showDetailedBreakdown(result)}
            className={`bg-white rounded-lg p-4 mb-3 shadow ${
              result.affectsUser ? "border-l-4 border-orange-400" : ""
            }`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name={getObstacleIcon(result.obstacle.type)}
                  size={24}
                  color="#6B7280"
                />
                <Text
                  className="text-lg font-semibold ml-2 flex-1"
                  numberOfLines={1}
                >
                  {result.obstacle.type.replace("_", " ")}
                </Text>
              </View>

              <View className="items-center">
                <Text
                  className="text-2xl font-bold"
                  style={{ color: getScoreColor(result.ahpScore.overall) }}
                >
                  {result.ahpScore.grade}
                </Text>
                <Text className="text-xs text-gray-500">
                  {result.ahpScore.overall.toFixed(0)}/100
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-sm text-gray-600 mr-4">
                  Severity: {result.obstacle.severity}
                </Text>
                {result.affectsUser && (
                  <View className="bg-orange-100 px-2 py-1 rounded">
                    <Text className="text-xs text-orange-800 font-medium">
                      Affects You
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-xs text-gray-500">Tap for breakdown</Text>
            </View>

            <Text className="text-xs text-gray-600 mt-1" numberOfLines={1}>
              📍 {result.obstacle.description}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Academic Info */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <Text className="text-sm font-semibold text-blue-800 mb-2">
            🎓 AHP Algorithm Demo - Enhanced with Google Maps Integration
          </Text>
          <Text className="text-xs text-blue-700">
            • Weights: Traversability (70%), Safety (20%), Comfort (10%){"\n"}•
            User-specific penalties based on mobility device{"\n"}• Severity
            multipliers for obstacle impact{"\n"}• Integrated with Google Maps
            Directions API{"\n"}• Real route analysis with dual path comparison
            {"\n"}• Ready for NavigationScreen deployment{"\n"}• Academic
            methodology validated for defense
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SimpleAHPTestScreen;
