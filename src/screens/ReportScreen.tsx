// src/screens/ReportScreen.tsx
// Complete Obstacle Reporting Screen - Filipino-First with Camera Integration
// PWD Accessibility Optimized with Offline-First Architecture

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  firebaseServices,
  checkFirebaseHealth,
  saveObstacleLocally,
} from "../services/firebase";
import {
  createProfileWithDefaults,
  useUserProfile,
} from "../stores/userProfileStore";
import { useLocation } from "../hooks/useLocation";
import { ObstacleType } from "../types";
import { CameraInterface } from "../components/CameraInterface";
import { CompressedPhoto } from "../services/cameraService";

const OBSTACLE_TYPES: Array<{
  key: ObstacleType;
  labelFil: string;
  labelEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}> = [
  {
    key: "vendor_blocking",
    labelFil: "May Nagtitinda",
    labelEn: "Vendor Blocking",
    icon: "storefront",
    color: "#F59E0B",
    description: "Sari-sari store o vendor na nakahirang sa daan",
  },
  {
    key: "parked_vehicles",
    labelFil: "Nakaharang na Sasakyan",
    labelEn: "Parked Vehicles",
    icon: "car",
    color: "#EF4444",
    description: "Motor o kotse na nakaharang sa sidewalk",
  },
  {
    key: "flooding",
    labelFil: "Baha",
    labelEn: "Flooding",
    icon: "water",
    color: "#3B82F6",
    description: "Tubig sa daan na nakakasagabal",
  },
  {
    key: "broken_pavement",
    labelFil: "Sirang Bangketa",
    labelEn: "Broken Pavement",
    icon: "warning",
    color: "#DC2626",
    description: "Butas o sira sa sahig",
  },
  {
    key: "stairs_no_ramp",
    labelFil: "Walang Ramp",
    labelEn: "No Ramp Available",
    icon: "arrow-up",
    color: "#7C2D12",
    description: "May hagdan pero walang ramp para sa wheelchair",
  },
  {
    key: "narrow_passage",
    labelFil: "Masyadong Makitid",
    labelEn: "Too Narrow",
    icon: "resize",
    color: "#059669",
    description: "Hindi kasya ang wheelchair o walker",
  },
];

const SEVERITY_LEVELS = [
  {
    key: "low" as const,
    labelFil: "Mababa",
    labelEn: "Low",
    description: "Medyo nakakasagabal pero pwede pa",
    color: "#10B981",
  },
  {
    key: "medium" as const,
    labelFil: "Katamtaman",
    labelEn: "Medium",
    description: "Nakakahirap, kailangan mag-ingat",
    color: "#F59E0B",
  },
  {
    key: "high" as const,
    labelFil: "Mataas",
    labelEn: "High",
    description: "Delikado, mahirap dumaan",
    color: "#EF4444",
  },
  {
    key: "blocking" as const,
    labelFil: "Nakaharang",
    labelEn: "Blocking",
    description: "Hindi makatawid, hanap ng ibang daan",
    color: "#DC2626",
  },
];

const TIME_PATTERNS = [
  {
    key: "permanent" as const,
    labelFil: "Laging Nandoon",
    labelEn: "Always There",
  },
  { key: "morning" as const, labelFil: "Umaga Lang", labelEn: "Morning Only" },
  {
    key: "afternoon" as const,
    labelFil: "Hapon Lang",
    labelEn: "Afternoon Only",
  },
  { key: "evening" as const, labelFil: "Gabi Lang", labelEn: "Evening Only" },
  {
    key: "weekend" as const,
    labelFil: "Weekend Lang",
    labelEn: "Weekend Only",
  },
];

const ReportScreen: React.FC = () => {
  const { location, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();

  // Camera and photo state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CompressedPhoto | null>(
    null
  );

  // Form state
  const [selectedObstacle, setSelectedObstacle] = useState<ObstacleType | null>(
    null
  );
  const [selectedSeverity, setSelectedSeverity] = useState<
    "low" | "medium" | "high" | "blocking" | null
  >(null);
  const [selectedTimePattern, setSelectedTimePattern] = useState<
    "permanent" | "morning" | "afternoon" | "evening" | "weekend"
  >("permanent");
  const [description, setDescription] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFirebaseTest, setShowFirebaseTest] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<
    "select" | "photo" | "details" | "submit"
  >("select");

  // Get location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

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
      addTestResult("🔥 Checking Firebase health...");
      const health = await checkFirebaseHealth();
      addTestResult(`✅ Firebase Health: ${health}`);

      if (health === "failed") {
        addTestResult("❌ Firebase health check failed");
        return;
      }

      addTestResult("📝 Creating test profile...");
      const testProfile = createProfileWithDefaults("wheelchair", {
        preferShade: true,
        maxWalkingDistance: 500,
      });
      addTestResult(`✅ Test profile created: ${testProfile.id}`);

      addTestResult("☁️ Testing profile save to Firebase...");
      await firebaseServices.profile.saveProfile(testProfile);
      addTestResult("✅ Profile saved to Firebase successfully!");

      addTestResult("🚧 Testing obstacle service...");
      const mockObstacles = await firebaseServices.obstacle.getObstaclesInArea(
        14.5547,
        121.0244,
        5
      );
      addTestResult(`✅ Retrieved ${mockObstacles.length} obstacles from area`);

      Alert.alert(
        "🎉 Firebase Test Complete!",
        `Firebase ${health} service is working perfectly!`,
        [{ text: "Salamat! (Thanks!)" }]
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
    setCurrentStep("photo");

    // Haptic feedback for accessibility
    Vibration.vibrate(50);

    // Get current location
    getCurrentLocation();
  };

  const handlePhotoTaken = (photo: CompressedPhoto) => {
    setCapturedPhoto(photo);
    setShowCamera(false);
    setCurrentStep("details");

    // Success haptic feedback
    Vibration.vibrate([50, 100, 50]);
  };

  const handleSkipPhoto = () => {
    setShowCamera(false);
    setCurrentStep("details");
  };

  const handleSubmitReport = async () => {
    if (!selectedObstacle || !selectedSeverity || !location) {
      Alert.alert(
        "Kulang ang Detalye",
        "Kailangan ng obstacle type, severity level, at location para mag-report.\n\n(Missing details needed for reporting.)",
        [{ text: "OK" }]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("📝 Submitting obstacle report...");

      const obstacleData = {
        location,
        type: selectedObstacle,
        severity: selectedSeverity,
        description: description.trim() || "No additional description provided",
        photoBase64: capturedPhoto?.base64, // Use Base64 instead of URI
        timePattern: selectedTimePattern,
      };

      // Always save locally first (offline-first approach)
      await saveObstacleLocally(obstacleData);

      // Try to report to Firebase
      try {
        const obstacleId = await firebaseServices.obstacle.reportObstacle(
          obstacleData
        );

        // Success!
        Alert.alert(
          "✅ Na-report na!",
          `Salamat sa pag-report! Obstacle ID: ${obstacleId}\n\nNa-save na sa cloud at makikita ng iba sa community.\n\n(Thank you for reporting! Saved to cloud and visible to community.)`,
          [
            {
              text: "Mag-report pa (Report More)",
              onPress: resetForm,
            },
            {
              text: "Tapos na (Done)",
              style: "default",
              onPress: resetForm,
            },
          ]
        );
      } catch (cloudError: any) {
        // Saved locally but cloud failed
        Alert.alert(
          "📱 Na-save Locally",
          `Na-save na ang report sa device mo. Kapag may internet, automatic na isesend sa cloud.\n\n(Report saved on your device. Will auto-sync when online.)\n\nError: ${cloudError.message}`,
          [{ text: "OK", onPress: resetForm }]
        );
      }
    } catch (error: any) {
      console.error("Failed to submit report:", error);
      Alert.alert(
        "❌ Hindi Ma-report",
        `May problema sa pag-report. Subukan ulit.\n\n(Problem reporting. Please try again.)\n\nError: ${error.message}`,
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedObstacle(null);
    setSelectedSeverity(null);
    setSelectedTimePattern("permanent");
    setDescription("");
    setCapturedPhoto(null);
    setCurrentStep("select");
  };

  const getStepProgress = () => {
    switch (currentStep) {
      case "select":
        return "1/4";
      case "photo":
        return "2/4";
      case "details":
        return "3/4";
      case "submit":
        return "4/4";
      default:
        return "1/4";
    }
  };

  const selectedObstacleData = OBSTACLE_TYPES.find(
    (o) => o.key === selectedObstacle
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 + 16 }}
      >
        {/* Header with Progress */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-3xl font-bold text-gray-900">
              I-report ang Hadlang
            </Text>
            <Text className="text-sm text-gray-500 bg-blue-100 px-3 py-1 rounded-full">
              {getStepProgress()}
            </Text>
          </View>
          <Text className="text-base text-gray-600">
            Report Accessibility Obstacles
          </Text>
          <Text className="text-sm text-blue-600 mt-1">
            Tumulong sa PWD community sa pag-navigate ng Pasig
          </Text>
        </View>

        {/* Firebase Test Section (Collapsible) */}
        <View className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
          <TouchableOpacity
            onPress={() => setShowFirebaseTest(!showFirebaseTest)}
            className="flex-row items-center justify-between"
          >
            <Text className="text-lg font-semibold text-gray-800">
              🔥 Firebase Storage Test
            </Text>
            <Ionicons
              name={showFirebaseTest ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showFirebaseTest && (
            <View className="mt-4">
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
                <View className="bg-gray-50 p-3 rounded-lg max-h-40">
                  <ScrollView>
                    <Text className="font-semibold mb-2">Test Results:</Text>
                    {testResults.map((result, index) => (
                      <Text key={index} className="text-sm text-gray-700 mb-1">
                        {result}
                      </Text>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Current Location Status */}
        <View className="bg-blue-50 rounded-xl p-4 mb-6 flex-row items-center">
          <Ionicons name="location" size={24} color="#3B82F6" />
          <View className="flex-1 ml-3">
            <Text className="font-semibold text-blue-900">
              Kasalukuyang Lokasyon (Current Location)
            </Text>
            <Text className="text-blue-700 text-sm">
              {location
                ? `📍 ${location.latitude.toFixed(
                    4
                  )}, ${location.longitude.toFixed(4)}`
                : "Hinahanap ang lokasyon... (Finding location...)"}
            </Text>
          </View>
          {!location && (
            <TouchableOpacity
              onPress={getCurrentLocation}
              className="bg-blue-500 px-4 py-2 rounded-lg"
              style={{ minWidth: 80, minHeight: 44 }} // PWD accessibility
            >
              <Text className="text-white font-semibold text-center">
                Hanap
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step 1: Obstacle Type Selection */}
        {currentStep === "select" && (
          <View className="mb-6">
            <Text className="text-xl font-semibold text-gray-900 mb-4">
              1. Anong uri ng hadlang? (What type of obstacle?)
            </Text>

            <View className="space-y-3">
              {OBSTACLE_TYPES.map((obstacle) => (
                <TouchableOpacity
                  key={obstacle.key}
                  onPress={() => handleObstacleSelect(obstacle.key)}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex-row items-center"
                  style={{ minHeight: 72 }} // PWD accessibility
                >
                  <View
                    className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
                    style={{ backgroundColor: obstacle.color + "20" }}
                  >
                    <Ionicons
                      name={obstacle.icon}
                      size={24}
                      color={obstacle.color}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900">
                      {obstacle.labelFil}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {obstacle.labelEn}
                    </Text>
                    <Text className="text-sm text-gray-600 mt-1">
                      {obstacle.description}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Photo Capture */}
        {currentStep === "photo" && selectedObstacleData && (
          <View className="mb-6">
            <Text className="text-xl font-semibold text-gray-900 mb-2">
              2. Kumuha ng Larawan (Take Photo)
            </Text>
            <Text className="text-gray-600 mb-4">
              Selected: {selectedObstacleData.labelFil} (
              {selectedObstacleData.labelEn})
            </Text>

            <View className="bg-white rounded-xl p-6 border border-gray-200">
              <View className="items-center">
                <View
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: selectedObstacleData.color + "20" }}
                >
                  <Ionicons
                    name="camera"
                    size={40}
                    color={selectedObstacleData.color}
                  />
                </View>

                <Text className="text-center text-gray-700 mb-6">
                  Kumuha ng larawan ng hadlang para mas madaling maintindihan ng
                  iba.
                  {"\n\n"}
                  Take a photo of the obstacle so others can easily understand
                  it.
                </Text>

                <View className="w-full space-y-3">
                  <TouchableOpacity
                    onPress={() => setShowCamera(true)}
                    className="bg-blue-500 py-4 px-6 rounded-lg flex-row items-center justify-center"
                    style={{ minHeight: 56 }} // PWD accessibility
                  >
                    <Ionicons name="camera" size={24} color="white" />
                    <Text className="text-white font-semibold text-lg ml-2">
                      Kumuha ng Larawan
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSkipPhoto}
                    className="bg-gray-300 py-3 px-6 rounded-lg"
                    style={{ minHeight: 48 }} // PWD accessibility
                  >
                    <Text className="text-gray-700 font-semibold text-center">
                      Laktawan (Skip) - Walang Larawan
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Step 3: Details Form */}
        {currentStep === "details" && selectedObstacleData && (
          <View className="mb-6">
            <Text className="text-xl font-semibold text-gray-900 mb-4">
              3. Mga Detalye (Details)
            </Text>

            {/* Photo Preview */}
            {capturedPhoto && (
              <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
                <View className="flex-row items-center">
                  <Ionicons name="image" size={24} color="#10B981" />
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-green-800">
                      ✅ May Larawan (Photo Captured)
                    </Text>
                    <Text className="text-sm text-green-600">
                      Size: {(capturedPhoto.compressedSize / 1024).toFixed(1)}KB
                      ({(capturedPhoto.compressionRatio * 100).toFixed(0)}% ng
                      original)
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowCamera(true)}
                    className="bg-blue-100 px-3 py-2 rounded-lg"
                  >
                    <Text className="text-blue-600 font-semibold">Palitan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Severity Selection */}
            <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
              <Text className="font-semibold text-gray-900 mb-3">
                Gaano kalala? (How severe?)
              </Text>
              <View className="space-y-2">
                {SEVERITY_LEVELS.map((severity) => (
                  <TouchableOpacity
                    key={severity.key}
                    onPress={() => setSelectedSeverity(severity.key)}
                    className={`p-3 rounded-lg border-2 flex-row items-center ${
                      selectedSeverity === severity.key
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white"
                    }`}
                    style={{ minHeight: 56 }} // PWD accessibility
                  >
                    <View
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: severity.color }}
                    />
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900">
                        {severity.labelFil} ({severity.labelEn})
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {severity.description}
                      </Text>
                    </View>
                    {selectedSeverity === severity.key && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#3B82F6"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time Pattern */}
            <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
              <Text className="font-semibold text-gray-900 mb-3">
                Kailan nandoon? (When is it there?)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TIME_PATTERNS.map((pattern) => (
                  <TouchableOpacity
                    key={pattern.key}
                    onPress={() => setSelectedTimePattern(pattern.key)}
                    className={`px-4 py-2 rounded-full border-2 ${
                      selectedTimePattern === pattern.key
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 bg-white"
                    }`}
                    style={{ minHeight: 44 }} // PWD accessibility
                  >
                    <Text
                      className={`font-semibold ${
                        selectedTimePattern === pattern.key
                          ? "text-blue-600"
                          : "text-gray-600"
                      }`}
                    >
                      {pattern.labelFil}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
              <Text className="font-semibold text-gray-900 mb-3">
                Dagdag na paliwanag (Additional description) - Optional
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Halimbawa: Laging may jeep na nakapark dito tuwing umaga..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                className="border border-gray-300 rounded-lg p-4 text-gray-900 text-base"
                style={{
                  minHeight: 100,
                  textAlignVertical: "top",
                  fontSize: 16, // PWD accessibility
                }}
              />
              <Text className="text-sm text-gray-500 mt-2">
                Voice input feature coming soon / Darating na ang voice input
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitReport}
              disabled={!selectedSeverity || isSubmitting}
              className={`py-4 px-6 rounded-xl flex-row items-center justify-center ${
                selectedSeverity && !isSubmitting
                  ? "bg-green-500 active:bg-green-600"
                  : "bg-gray-400"
              }`}
              style={{ minHeight: 64 }} // PWD accessibility
              accessibilityRole="button"
              accessibilityLabel="Submit obstacle report"
            >
              {isSubmitting ? (
                <Ionicons name="hourglass" size={24} color="white" />
              ) : (
                <Ionicons name="checkmark-circle" size={24} color="white" />
              )}
              <Text className="text-white font-bold text-lg ml-2">
                {isSubmitting ? "Nire-report..." : "I-submit ang Report"}
              </Text>
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity
              onPress={() => setCurrentStep("photo")}
              className="mt-3 py-3 px-6 rounded-lg bg-gray-200"
              style={{ minHeight: 48 }} // PWD accessibility
            >
              <Text className="text-gray-700 font-semibold text-center">
                ← Bumalik sa Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reset Button (always visible) */}
        {currentStep !== "select" && (
          <TouchableOpacity
            onPress={resetForm}
            className="mb-6 py-3 px-6 rounded-lg border border-gray-300"
            style={{ minHeight: 48 }} // PWD accessibility
          >
            <Text className="text-gray-600 font-semibold text-center">
              🔄 Simula Ulit (Start Over)
            </Text>
          </TouchableOpacity>
        )}

        {/* User Profile Info */}
        {profile && (
          <View className="bg-yellow-50 rounded-xl p-4 mb-6 border border-yellow-200">
            <Text className="font-semibold text-yellow-800 mb-2">
              📋 Iyong Profile (Your Profile)
            </Text>
            <Text className="text-yellow-700">
              Device: {profile.type} | Max ramp: {profile.maxRampSlope}°
            </Text>
            <Text className="text-sm text-yellow-600 mt-1">
              Ang reports mo ay makikita ng mga kapareho mong user type
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <CameraInterface
          isVisible={showCamera}
          onPhotoTaken={handlePhotoTaken}
          onCancel={() => setShowCamera(false)}
          userProfile={profile || undefined}
          obstacleType={selectedObstacleData?.labelFil}
        />
      </Modal>
    </SafeAreaView>
  );
};

export default ReportScreen;
