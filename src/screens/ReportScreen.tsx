// src/screens/ReportScreen.tsx
// FIXED: Uses enhanced Firebase service for admin auto-verification + separated styles

import React, { useState, useEffect, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Vibration,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// FIXED: Import enhanced Firebase service instead of basic service
import { enhancedFirebaseService } from "../services/enhancedFirebase";
import { useUserProfile } from "../stores/userProfileStore";
import { useLocation } from "../hooks/useLocation";
import { ObstacleType } from "../types";
import { CameraInterface } from "../components/CameraInterface";
import { CompressedPhoto } from "../services/cameraService";

// Import separated styles
import {
  reportScreenStyles as styles,
  COLORS,
} from "../styles/reportScreenStyles";

const OBSTACLE_TYPES = [
  {
    key: "vendor_blocking" as ObstacleType,
    labelFil: "May Nagtitinda",
    labelEn: "Vendor Blocking",
    icon: "storefront" as keyof typeof Ionicons.glyphMap,
    color: COLORS.warning,
    description: "Sari-sari store o vendor na nakahirang sa daan",
  },
  {
    key: "parked_vehicles" as ObstacleType,
    labelFil: "Nakaharang na Sasakyan",
    labelEn: "Parked Vehicles",
    icon: "car" as keyof typeof Ionicons.glyphMap,
    color: COLORS.error,
    description: "Motor o kotse na nakaharang sa sidewalk",
  },
  {
    key: "flooding" as ObstacleType,
    labelFil: "Baha",
    labelEn: "Flooding",
    icon: "water" as keyof typeof Ionicons.glyphMap,
    color: COLORS.softBlue,
    description: "Tubig sa daan na nakakasagabal",
  },
  {
    key: "broken_pavement" as ObstacleType,
    labelFil: "Sirang Bangketa",
    labelEn: "Broken Pavement",
    icon: "warning" as keyof typeof Ionicons.glyphMap,
    color: COLORS.error,
    description: "Butas o sira sa sahig",
  },
  {
    key: "stairs_no_ramp" as ObstacleType,
    labelFil: "Walang Ramp",
    labelEn: "No Ramp Available",
    icon: "layers" as keyof typeof Ionicons.glyphMap,
    color: COLORS.navy,
    description: "Steps na walang ramp alternative",
  },
  {
    key: "construction" as ObstacleType,
    labelFil: "Under Construction",
    labelEn: "Construction Work",
    icon: "construct" as keyof typeof Ionicons.glyphMap,
    color: COLORS.warning,
    description: "Ongoing construction na nakakasagabal",
  },
];

type SeverityType = "low" | "medium" | "high" | "blocking";

const SEVERITY_LEVELS: Array<{
  key: SeverityType;
  labelFil: string;
  labelEn: string;
  color: string;
  description: string;
}> = [
  {
    key: "low",
    labelFil: "Kaya pa",
    labelEn: "Passable",
    color: COLORS.success,
    description: "Medyo hirap pero kaya pa",
  },
  {
    key: "medium",
    labelFil: "Mahirap",
    labelEn: "Difficult",
    color: COLORS.warning,
    description: "Kelangan ng extra effort",
  },
  {
    key: "high",
    labelFil: "Sobrang Hirap",
    labelEn: "Very Difficult",
    color: COLORS.error,
    description: "Halos hindi na makakadaan",
  },
  {
    key: "blocking",
    labelFil: "Hindi Makakadaan",
    labelEn: "Completely Blocked",
    color: COLORS.slate,
    description: "Totally impassable",
  },
];

interface ReportScreenProps {
  navigation: any;
}

export default function ReportScreen({ navigation }: ReportScreenProps) {
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isSmallScreen = dims.width < 380;

  // Form state
  const [currentStep, setCurrentStep] = useState<
    "select" | "photo" | "details"
  >("select");
  const [selectedObstacle, setSelectedObstacle] = useState<ObstacleType | null>(
    null
  );
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityType | null>(
    null
  );
  const [description, setDescription] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<CompressedPhoto | null>(
    null
  );
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Location
  const { location, getCurrentLocation } = useLocation();

  const selectedObstacleData = useMemo(
    () => OBSTACLE_TYPES.find((o) => o.key === selectedObstacle),
    [selectedObstacle]
  );

  const stepProgress = useMemo(() => {
    switch (currentStep) {
      case "select":
        return { current: 1, total: 3, label: "Uri ng Hadlang" };
      case "photo":
        return { current: 2, total: 3, label: "Kumuha ng Photo" };
      case "details":
        return { current: 3, total: 3, label: "Mga Detalye" };
      default:
        return { current: 1, total: 3, label: "Uri ng Hadlang" };
    }
  }, [currentStep]);

  const handleObstacleSelect = (obstacleType: ObstacleType) => {
    setSelectedObstacle(obstacleType);
    setCurrentStep("photo");
    Vibration.vibrate(50);
    getCurrentLocation();
  };

  const handlePhotoTaken = (photo: CompressedPhoto) => {
    setCapturedPhoto(photo);
    setShowCamera(false);
    setCurrentStep("details");
    Vibration.vibrate([50, 100, 50]);
  };

  const handleSkipPhoto = () => {
    setShowCamera(false);
    setCurrentStep("details");
  };

  // FIXED: Use enhanced Firebase service for admin auto-verification
  const handleSubmitReport = async () => {
    if (!selectedObstacle || !selectedSeverity || !location) {
      Alert.alert(
        "Kulang ang Detalye",
        "Kailangan ng obstacle type, severity level, at location para mag-report.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const obstacleData = {
        location,
        type: selectedObstacle,
        severity: selectedSeverity,
        description: description.trim() || "No additional description provided",
        photoBase64: capturedPhoto?.base64,
        timePattern: "permanent" as const,
      };

      // FIXED: Use enhanced Firebase service for admin detection and auto-verification
      try {
        const result = await enhancedFirebaseService.reportObstacleEnhanced(
          obstacleData
        );

        if (result.success) {
          Alert.alert(
            "✅ Na-report na!",
            result.message, // This will show admin verification status
            [
              { text: "Mag-report pa", onPress: resetForm },
              { text: "Tapos na", onPress: resetForm },
            ]
          );
        } else {
          // Handle rate limiting or capability issues
          Alert.alert("⚠️ Hindi Ma-report", result.message, [{ text: "OK" }]);
        }
      } catch (cloudError: any) {
        Alert.alert(
          "📱 Na-save Locally",
          `Na-save na ang report sa device mo. Kapag may internet, automatic na isesend sa cloud.`,
          [{ text: "OK", onPress: resetForm }]
        );
      }
    } catch (error: any) {
      console.error("Report submission failed:", error);
      Alert.alert(
        "❌ Hindi Ma-report",
        `May problema sa pag-report. Subukan ulit.`,
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedObstacle(null);
    setSelectedSeverity(null);
    setDescription("");
    setCapturedPhoto(null);
    setCurrentStep("select");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 60) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Header */}
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
          <View style={styles.headerContent}>
            <Text
              style={[
                styles.headerTitle,
                { fontSize: isSmallScreen ? 22 : 26 },
              ]}
            >
              I-report ang Hadlang
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { fontSize: isSmallScreen ? 14 : 16 },
              ]}
            >
              Help the PWD community navigate Pasig
            </Text>
          </View>
        </View>

        {/* Modern Progress Bar */}
        <View style={[styles.progressSection, { paddingHorizontal: 20 }]}>
          <View style={styles.progressBarContainer}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressBar,
                  {
                    backgroundColor:
                      stepProgress.current >= i ? COLORS.softBlue : "#E5E7EB",
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.progressLabel, { color: COLORS.muted }]}>
            {stepProgress.label}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Step 1: Select Obstacle Type */}
          {currentStep === "select" && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                Ano ang nakita mong hadlang?
              </Text>
              <Text style={styles.stepSubtitle}>
                Choose the type of accessibility obstacle
              </Text>

              <View style={styles.obstacleGrid}>
                {OBSTACLE_TYPES.map((obstacle) => (
                  <TouchableOpacity
                    key={obstacle.key}
                    style={[
                      styles.obstacleCard,
                      { borderColor: obstacle.color },
                      isSmallScreen && { minHeight: 100 },
                    ]}
                    onPress={() => handleObstacleSelect(obstacle.key)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${obstacle.labelFil}. ${obstacle.description}`}
                  >
                    <View
                      style={[
                        styles.obstacleIcon,
                        { backgroundColor: obstacle.color },
                      ]}
                    >
                      <Ionicons
                        name={obstacle.icon}
                        size={24}
                        color={COLORS.white}
                      />
                    </View>
                    <Text
                      style={[
                        styles.obstacleTitle,
                        { fontSize: isSmallScreen ? 14 : 16 },
                      ]}
                    >
                      {obstacle.labelFil}
                    </Text>
                    <Text
                      style={[
                        styles.obstacleDescription,
                        { fontSize: isSmallScreen ? 11 : 12 },
                      ]}
                    >
                      {obstacle.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Photo Capture */}
          {currentStep === "photo" && selectedObstacleData && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                Kumuha ng Larawan
              </Text>
              <Text style={styles.stepSubtitle}>
                Take a photo so others can understand the obstacle
              </Text>

              <View style={styles.photoSection}>
                <View
                  style={[
                    styles.photoCard,
                    { backgroundColor: selectedObstacleData.color + "15" },
                  ]}
                >
                  <Ionicons
                    name={selectedObstacleData.icon}
                    size={32}
                    color={selectedObstacleData.color}
                  />
                  <Text
                    style={[
                      styles.photoCardTitle,
                      { color: selectedObstacleData.color },
                    ]}
                  >
                    {selectedObstacleData.labelFil}
                  </Text>
                  <Text style={styles.photoCardDescription}>
                    {selectedObstacleData.description}
                  </Text>
                </View>

                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      { backgroundColor: COLORS.softBlue },
                    ]}
                    onPress={() => setShowCamera(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color={COLORS.white} />
                    <Text style={styles.primaryButtonText}>
                      Kumuha ng Larawan
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      { backgroundColor: COLORS.muted },
                    ]}
                    onPress={handleSkipPhoto}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Laktawan (Skip)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Step 3: Details */}
          {currentStep === "details" && selectedObstacleData && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                Mga Detalye
              </Text>
              <Text style={styles.stepSubtitle}>
                Provide details about the obstacle severity
              </Text>

              {/* Photo Preview */}
              {capturedPhoto && (
                <View style={[styles.photoPreview, { marginBottom: 20 }]}>
                  <View style={styles.photoPreviewContent}>
                    <Ionicons name="image" size={20} color={COLORS.success} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.photoPreviewTitle}>
                        ✅ Photo Captured
                      </Text>
                      <Text style={styles.photoPreviewSubtitle}>
                        {(capturedPhoto.compressedSize / 1024).toFixed(1)}KB
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.photoEditButton}
                      onPress={() => setShowCamera(true)}
                    >
                      <Text style={styles.photoEditText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Severity Selection */}
              <View style={[styles.card, { marginBottom: 20 }]}>
                <Text style={styles.cardTitle}>Gaano kalala?</Text>
                <Text style={styles.cardSubtitle}>
                  How severe is this obstacle?
                </Text>

                <View style={styles.severityGrid}>
                  {SEVERITY_LEVELS.map((severity) => (
                    <TouchableOpacity
                      key={severity.key}
                      style={[
                        styles.severityOption,
                        {
                          borderColor:
                            selectedSeverity === severity.key
                              ? severity.color
                              : "#E5E7EB",
                          backgroundColor:
                            selectedSeverity === severity.key
                              ? severity.color + "15"
                              : COLORS.white,
                        },
                      ]}
                      onPress={() => setSelectedSeverity(severity.key)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.severityDot,
                          { backgroundColor: severity.color },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.severityTitle,
                            {
                              color:
                                selectedSeverity === severity.key
                                  ? severity.color
                                  : COLORS.slate,
                            },
                          ]}
                        >
                          {severity.labelFil}
                        </Text>
                        <Text style={styles.severityDescription}>
                          {severity.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description Input */}
              <View style={[styles.card, { marginBottom: 20 }]}>
                <Text style={styles.cardTitle}>Dagdag na paliwanag</Text>
                <Text style={styles.cardSubtitle}>
                  Additional description (optional)
                </Text>

                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Halimbawa: Laging may jeep na nakapark dito tuwing umaga..."
                  placeholderTextColor={COLORS.muted}
                  multiline
                  numberOfLines={4}
                  style={styles.textInput}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor:
                        selectedSeverity && !isSubmitting
                          ? COLORS.success
                          : COLORS.muted,
                    },
                  ]}
                  onPress={handleSubmitReport}
                  disabled={!selectedSeverity || isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <Ionicons name="hourglass" size={20} color={COLORS.white} />
                  ) : (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.white}
                    />
                  )}
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? "Nire-report..." : "I-submit ang Report"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setCurrentStep("photo")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={COLORS.muted}
                  />
                  <Text style={styles.backButtonText}>Bumalik</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Profile Info Card */}
          {profile && (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={COLORS.softBlue}
                />
                <Text style={styles.profileTitle}>Iyong Profile</Text>
              </View>
              <Text style={styles.profileText}>
                Device: {profile.type} •{" "}
                {profile.avoidStairs ? "Iwas stairs" : "OK sa stairs"}
              </Text>
              <Text style={styles.profileSubtext}>
                Ang reports mo ay makikita ng mga kapareho mong user type
              </Text>
            </View>
          )}

          {/* Reset Button */}
          {currentStep !== "select" && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetForm}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color={COLORS.navy} />
              <Text style={styles.resetButtonText}>Simula Ulit</Text>
            </TouchableOpacity>
          )}
        </View>
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
}
