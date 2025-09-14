// src/screens/ReportScreen.tsx
// FIXED: Enhanced ReportScreen with automatic form reset after submission and correct styles

import React, { useState, useEffect, useMemo, useCallback } from "react";
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

// FIXED: Import enhanced Firebase service
import { enhancedFirebaseService } from "../services/enhancedFirebase";

// 🔥 NEW: Import mobile admin logger
import { logAdminObstacleReport } from "../services/mobileAdminLogger";

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

  // 🔥 FIXED: Complete form reset function
  const resetForm = useCallback(() => {
    setCurrentStep("select");
    setSelectedObstacle(null);
    setSelectedSeverity(null);
    setDescription("");
    setCapturedPhoto(null);
    setShowCamera(false);
    setIsSubmitting(false);
    console.log("🔄 Report form reset to initial state");
  }, []);

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

  // 🔥 FIXED: Enhanced obstacle report submission with automatic form reset
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

      // Submit obstacle report using enhanced Firebase service
      const result = await enhancedFirebaseService.reportObstacleEnhanced(
        obstacleData
      );

      if (result.success) {
        // 🔥 NEW: Log admin obstacle report if user is admin
        try {
          await logAdminObstacleReport(
            result.obstacleId || "unknown_id",
            selectedObstacle,
            selectedSeverity,
            location
          );
        } catch (logError) {
          console.warn("Failed to log admin obstacle report:", logError);
          // Don't fail the report submission if logging fails
        }

        // 🔥 FIXED: Automatically reset form after successful submission
        Alert.alert("✅ Na-report na!", result.message, [
          {
            text: "Mag-report Ulit",
            style: "default",
            onPress: () => {
              resetForm();
              // Small delay to ensure form reset completes
              setTimeout(() => getCurrentLocation(), 100);
            },
          },
          {
            text: "Bumalik sa Home",
            style: "default",
            onPress: () => {
              resetForm(); // Reset form before navigating
              navigation.goBack();
            },
          },
        ]);

        // 🔥 NEW: Auto-reset form immediately after successful submission
        // This ensures the form is reset regardless of which button the user chooses
        setTimeout(() => {
          resetForm();
          console.log("🔄 Form auto-reset after successful submission");
        }, 500); // Small delay to allow alert to show

        // Show success vibration
        Vibration.vibrate([100, 200, 100]);
      } else {
        Alert.alert("❌ Hindi Maayos ang Report", result.message, [
          { text: "Subukan Muli" },
        ]);
      }
    } catch (error: any) {
      console.error("Report submission failed:", error);
      Alert.alert(
        "❌ May Error",
        `Hindi na-submit ang report: ${error.message}`,
        [{ text: "Subukan Muli" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "photo":
        setCurrentStep("select");
        setSelectedObstacle(null);
        break;
      case "details":
        setCurrentStep("photo");
        setCapturedPhoto(null);
        break;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerContent,
            { paddingHorizontal: 20, paddingVertical: 16 },
          ]}
        >
          <Text
            style={[styles.headerTitle, { fontSize: isSmallScreen ? 20 : 24 }]}
          >
            I-report ang Hadlang
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { fontSize: isSmallScreen ? 14 : 16 },
            ]}
          >
            Tulungang gawing accessible ang inyong komunidad
          </Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={[styles.progressBarContainer, { paddingHorizontal: 20 }]}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.progressBar,
                {
                  backgroundColor:
                    step <= stepProgress.current
                      ? COLORS.softBlue
                      : COLORS.muted,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.progressLabel, { paddingHorizontal: 20 }]}>
          Step {stepProgress.current} of {stepProgress.total}:{" "}
          {stepProgress.label}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
          {/* Step 1: Obstacle Type Selection */}
          {currentStep === "select" && (
            <View>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                Anong uri ng hadlang?
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
              >
                Piliin ang pinakamalapit na description
              </Text>

              {OBSTACLE_TYPES.map((obstacle) => (
                <TouchableOpacity
                  key={obstacle.key}
                  style={[styles.obstacleCard]}
                  onPress={() => handleObstacleSelect(obstacle.key)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
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

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.obstacleTitle}>
                        {obstacle.labelFil}
                      </Text>
                      <Text style={styles.obstacleDescription}>
                        {obstacle.description}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.muted}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 2: Photo Capture */}
          {currentStep === "photo" && selectedObstacleData && (
            <View>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                Kumuha ng Photo
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
              >
                Para sa {selectedObstacleData.labelFil.toLowerCase()}
              </Text>

              <View style={[styles.card, { alignItems: "center" }]}>
                <View
                  style={[
                    styles.obstacleIcon,
                    {
                      backgroundColor: selectedObstacleData.color,
                      width: 60,
                      height: 60,
                      marginBottom: 16,
                    },
                  ]}
                >
                  <Ionicons
                    name={selectedObstacleData.icon}
                    size={30}
                    color={COLORS.white}
                  />
                </View>

                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: COLORS.slate,
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  {selectedObstacleData.labelFil}
                </Text>

                <Text
                  style={{
                    fontSize: 14,
                    color: COLORS.muted,
                    marginBottom: 24,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Ang photo ay makakatulong sa iba na makita ang hadlang. Hindi
                  required pero recommended.
                </Text>

                {capturedPhoto ? (
                  <View style={{ width: "100%", alignItems: "center" }}>
                    <View
                      style={{
                        width: "100%",
                        height: 200,
                        borderRadius: 12,
                        backgroundColor: COLORS.lightGray,
                        marginBottom: 16,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={48}
                        color={COLORS.success}
                      />
                      <Text
                        style={{
                          color: COLORS.success,
                          fontWeight: "600",
                          marginTop: 8,
                        }}
                      >
                        Photo Saved!
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    width: "100%",
                  }}
                >
                  <TouchableOpacity
                    style={{
                      backgroundColor: COLORS.softBlue,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                      justifyContent: "center",
                    }}
                    onPress={() => setShowCamera(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color={COLORS.white} />
                    <Text
                      style={{
                        color: COLORS.white,
                        fontWeight: "500",
                        marginLeft: 8,
                      }}
                    >
                      {capturedPhoto ? "Palitan" : "Kumuha"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      borderWidth: 1,
                      borderColor: COLORS.muted,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                    onPress={handleSkipPhoto}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: COLORS.muted, fontWeight: "500" }}>
                      Skip
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 16,
                }}
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={16} color={COLORS.muted} />
                <Text style={{ color: COLORS.muted, marginLeft: 4 }}>
                  Palitan ang obstacle type
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Details Form */}
          {currentStep === "details" && selectedObstacleData && (
            <View>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                Mga Detalye ng Report
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
              >
                Dagdagan ng information para sa mas comprehensive na report
              </Text>

              {/* Severity Selection */}
              <View style={[styles.card, { marginBottom: 16 }]}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: COLORS.slate,
                    marginBottom: 16,
                  }}
                >
                  Gaano kahirap dumaan? *
                </Text>

                {SEVERITY_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      marginBottom: 8,
                      backgroundColor:
                        selectedSeverity === level.key
                          ? level.color + "20"
                          : COLORS.lightGray,
                      borderWidth: selectedSeverity === level.key ? 2 : 1,
                      borderColor:
                        selectedSeverity === level.key
                          ? level.color
                          : COLORS.muted,
                    }}
                    onPress={() => setSelectedSeverity(level.key)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor:
                          selectedSeverity === level.key
                            ? level.color
                            : COLORS.white,
                        borderWidth: 2,
                        borderColor:
                          selectedSeverity === level.key
                            ? level.color
                            : COLORS.muted,
                        marginRight: 12,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: COLORS.slate,
                        }}
                      >
                        {level.labelFil}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: COLORS.muted,
                          marginTop: 2,
                        }}
                      >
                        {level.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <View style={[styles.card, { marginBottom: 24 }]}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: COLORS.slate,
                    marginBottom: 12,
                  }}
                >
                  Additional Details (Optional)
                </Text>
                <TextInput
                  style={styles.textInput}
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Dagdagan ng detalye tungkol sa hadlang..."
                  placeholderTextColor={COLORS.muted}
                />
              </View>

              {/* Submit Button */}
              <View style={{ marginBottom: 24 }}>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor:
                        selectedSeverity && !isSubmitting
                          ? COLORS.softBlue
                          : COLORS.muted,
                      opacity: isSubmitting ? 0.7 : 1,
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
                  onPress={handleBack}
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
                <Text style={styles.profileTitle}>Inyong Profile</Text>
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
