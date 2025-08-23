// src/screens/SimpleAHPTestScreen.tsx
// ENHANCED: Now includes test data generation for empty Firestore

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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserProfile } from "../stores/userProfileStore";
import { useLocation } from "../hooks/useLocation";
import { firebaseServices, checkFirebaseHealth } from "../services/firebase";
import { testDataUtils } from "../utils/generateTestData"; // NEW IMPORT

const SimpleAHPTestScreen = () => {
  const insets = useSafeAreaInsets();
  const [obstacles, setObstacles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [locationMode, setLocationMode] = useState<"pasig" | "current">(
    "pasig"
  );
  const [firebaseStatus, setFirebaseStatus] = useState<string>("checking...");

  const { profile } = useUserProfile();
  const { location, pasigCenter } = useLocation();

  // Check Firebase health on component mount
  React.useEffect(() => {
    checkFirebaseHealth().then((health) => {
      setFirebaseStatus(health.message);
    });
  }, []);

  // NEW: Generate test data for empty Firestore
  const handleGenerateTestData = async () => {
    try {
      setLoading(true);

      Alert.alert(
        "Generate Test Data",
        "This will create realistic obstacles around Pasig City for testing the validation system. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Generate",
            onPress: async () => {
              const result = await testDataUtils.generateTestData();

              Alert.alert(
                result.success ? "Success!" : "Error",
                result.message,
                [{ text: "OK" }]
              );

              // Reload obstacles if successful
              if (result.success) {
                await loadObstacles();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Error", `Failed to generate test data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Generate validation test scenarios
  const handleGenerateValidationTests = async () => {
    try {
      setLoading(true);

      await testDataUtils.generateValidationTestScenarios();

      Alert.alert(
        "Validation Test Scenarios Created!",
        "Created specific obstacles with different validation states:\n\n" +
          "• Single report (needs validation)\n" +
          "• Community verified (confirmed)\n" +
          "• Disputed obstacle (conflicting reports)\n" +
          "• Recently cleared obstacle\n\n" +
          "Perfect for testing the validation system!",
        [{ text: "OK" }]
      );

      await loadObstacles();
    } catch (error: any) {
      Alert.alert(
        "Error",
        `Failed to create validation tests: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Load obstacles from Firebase
  const loadObstacles = async () => {
    try {
      setLoading(true);

      const currentLocation =
        locationMode === "current" && location ? location : pasigCenter;

      console.log("🗺️ Loading obstacles for testing...");
      const obstacleData = await firebaseServices.obstacle.getObstaclesInArea(
        currentLocation.latitude,
        currentLocation.longitude,
        10 // 10km radius
      );

      setObstacles(obstacleData);

      Alert.alert(
        "Obstacles Loaded",
        `Found ${obstacleData.length} obstacles in the area.\n\n` +
          `Location: ${currentLocation.latitude.toFixed(
            4
          )}, ${currentLocation.longitude.toFixed(4)}\n` +
          `Mode: ${
            locationMode === "current" ? "Your Location" : "Pasig Center"
          }`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      Alert.alert("Error", `Failed to load obstacles: ${error.message}`);
      console.error("Failed to load obstacles:", error);
    } finally {
      setLoading(false);
    }
  };

  // Test validation system
  const testValidationSystem = async () => {
    if (obstacles.length === 0) {
      Alert.alert(
        "No Obstacles",
        "Load obstacles first to test validation system."
      );
      return;
    }

    try {
      setLoading(true);

      // Test validation on first obstacle
      const testObstacle = obstacles[0];

      console.log("🧪 Testing validation system...");

      // Test upvote
      await firebaseServices.obstacle.verifyObstacle(testObstacle.id, "upvote");
      console.log("✅ Upvote test successful");

      // Test downvote
      await firebaseServices.obstacle.verifyObstacle(
        testObstacle.id,
        "downvote"
      );
      console.log("✅ Downvote test successful");

      Alert.alert(
        "Validation Test Complete!",
        `Successfully tested validation on obstacle: "${testObstacle.description}"\n\n` +
          "Both upvote and downvote operations completed successfully.\n\n" +
          "Check the NavigationScreen to see the validation prompts in action!",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      Alert.alert("Validation Test Failed", error.message);
      console.error("Validation test failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Clear all test data
  const handleClearTestData = () => {
    Alert.alert(
      "Clear Test Data",
      "This will remove all test obstacles. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await testDataUtils.clearTestData();
            setObstacles([]);
            Alert.alert(
              "Cleared",
              "Test data cleared (note: manual Firestore cleanup may be needed)"
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#F9FAFB",
        paddingTop: insets.top,
      }}
    >
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: "#1F2937",
              marginBottom: 8,
            }}
          >
            🧪 WAISPATH Testing Lab
          </Text>
          <Text style={{ fontSize: 16, color: "#6B7280", marginBottom: 12 }}>
            Test data generation and validation system testing
          </Text>

          {/* Firebase Status */}
          <View
            style={{
              backgroundColor: "#EBF8FF",
              padding: 12,
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: "#3B82F6",
            }}
          >
            <Text style={{ fontSize: 12, color: "#1E40AF" }}>
              🔥 Firebase Status: {firebaseStatus}
            </Text>
          </View>
        </View>

        {/* Test Data Generation Section */}
        <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#1F2937",
              marginBottom: 12,
            }}
          >
            📝 Test Data Generation
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: "#10B981",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleGenerateTestData}
            disabled={loading}
          >
            <Ionicons name="add-circle" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Generate Test Obstacles
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#8B5CF6",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleGenerateValidationTests}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Create Validation Test Cases
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>
            Generates realistic obstacles around Pasig City landmarks
          </Text>
        </View>

        {/* Location Mode Selection */}
        <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#1F2937",
              marginBottom: 12,
            }}
          >
            📍 Location Mode
          </Text>

          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor:
                  locationMode === "pasig" ? "#3B82F6" : "#F3F4F6",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                marginRight: 8,
              }}
              onPress={() => setLocationMode("pasig")}
            >
              <Text
                style={{
                  color: locationMode === "pasig" ? "white" : "#6B7280",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Pasig Center
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor:
                  locationMode === "current" ? "#3B82F6" : "#F3F4F6",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                marginLeft: 8,
              }}
              onPress={() => setLocationMode("current")}
            >
              <Text
                style={{
                  color: locationMode === "current" ? "white" : "#6B7280",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Your Location
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>
            {locationMode === "current" && location
              ? `Using: ${location.latitude.toFixed(
                  4
                )}, ${location.longitude.toFixed(4)}`
              : `Using: ${pasigCenter.latitude}, ${pasigCenter.longitude}`}
          </Text>
        </View>

        {/* Testing Actions */}
        <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#1F2937",
              marginBottom: 12,
            }}
          >
            🧪 Testing Actions
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: "#3B82F6",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={loadObstacles}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Load Obstacles ({obstacles.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#F59E0B",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={testValidationSystem}
            disabled={loading || obstacles.length === 0}
          >
            <Ionicons name="flask" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Test Validation System
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#EF4444",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleClearTestData}
            disabled={loading}
          >
            <Ionicons name="trash" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Clear Test Data
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results Display */}
        {obstacles.length > 0 && (
          <View
            style={{
              backgroundColor: "white",
              padding: 16,
              borderRadius: 12,
              marginBottom: 16,
              elevation: 2,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "#1F2937",
                marginBottom: 12,
              }}
            >
              📊 Loaded Obstacles ({obstacles.length})
            </Text>

            {obstacles.slice(0, 5).map((obstacle, index) => (
              <View
                key={obstacle.id}
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor:
                    obstacle.status === "community_verified"
                      ? "#10B981"
                      : obstacle.status === "disputed"
                      ? "#F59E0B"
                      : "#6B7280",
                  paddingLeft: 12,
                  paddingVertical: 8,
                  marginBottom: 8,
                  backgroundColor: "#F9FAFB",
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontWeight: "600", color: "#1F2937" }}>
                  {obstacle.type.replace(/_/g, " ").toUpperCase()}
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>
                  {obstacle.description.substring(0, 60)}...
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 10 }}>
                  ↑{obstacle.upvotes || 0} ↓{obstacle.downvotes || 0} •{" "}
                  {obstacle.status}
                </Text>
              </View>
            ))}

            {obstacles.length > 5 && (
              <Text
                style={{ color: "#6B7280", fontSize: 12, textAlign: "center" }}
              >
                ... and {obstacles.length - 5} more obstacles
              </Text>
            )}
          </View>
        )}

        {/* Instructions */}
        <View
          style={{
            backgroundColor: "#FEF3C7",
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#F59E0B",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: "#92400E",
              marginBottom: 8,
            }}
          >
            🚀 Testing Instructions
          </Text>
          <Text style={{ color: "#92400E", fontSize: 14, lineHeight: 20 }}>
            1. Generate test obstacles for empty Firestore{"\n"}
            2. Load obstacles to verify they exist{"\n"}
            3. Test validation system functionality{"\n"}
            4. Go to NavigationScreen to see validation prompts{"\n"}
            5. Walk near obstacles to trigger proximity-based validation
          </Text>
        </View>

        {loading && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{ marginTop: 16, color: "#6B7280" }}>
              Processing...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SimpleAHPTestScreen;
