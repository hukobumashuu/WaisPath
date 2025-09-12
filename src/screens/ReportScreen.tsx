// src/screens/ReportScreen.tsx
// COMPLETE: Enhanced ReportScreen with admin obstacle report logging

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

  // ENHANCED: Obstacle report submission with admin logging
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

        Alert.alert("✅ Na-report na!", result.message, [
          {
            text: "Mag-report Ulit",
            style: "default",
            onPress: resetForm,
          },
          {
            text: "Bumalik sa Home",
            style: "default",
            onPress: () => navigation.goBack(),
          },
        ]);

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

  const resetForm = () => {
    setCurrentStep("select");
    setSelectedObstacle(null);
    setSelectedSeverity(null);
    setDescription("");
    setCapturedPhoto(null);
    setShowCamera(false);
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
                    step <= stepProgress.current ? COLORS.softBlue : "#E5E7EB",
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.progressLabel, { paddingHorizontal: 20 }]}>
          Step {stepProgress.current} ng {stepProgress.total}:{" "}
          {stepProgress.label}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* Step 1: Select Obstacle Type */}
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
                Piliin ang pinaka-angkop na uri ng accessibility obstacle na
                nakita mo
              </Text>

              {OBSTACLE_TYPES.map((obstacle) => (
                <TouchableOpacity
                  key={obstacle.key}
                  style={[
                    styles.card,
                    {
                      borderColor: obstacle.color,
                      borderWidth: 1,
                      marginBottom: 12,
                    },
                  ]}
                  onPress={() => handleObstacleSelect(obstacle.key)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: obstacle.color + "20",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 16,
                      }}
                    >
                      <Ionicons
                        name={obstacle.icon}
                        size={24}
                        color={obstacle.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: COLORS.slate,
                          marginBottom: 4,
                        }}
                      >
                        {obstacle.labelFil}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: COLORS.muted,
                          lineHeight: 18,
                        }}
                      >
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

          {/* Step 2: Take Photo */}
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
                Larawan ng {selectedObstacleData.labelFil.toLowerCase()} para sa
                mas malinaw na report
              </Text>

              <View
                style={[styles.card, { alignItems: "center", padding: 32 }]}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: selectedObstacleData.color + "20",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Ionicons
                    name={selectedObstacleData.icon}
                    size={32}
                    color={selectedObstacleData.color}
                  />
                </View>

                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: COLORS.slate,
                    marginBottom: 8,
                  }}
                >
                  {selectedObstacleData.labelFil}
                </Text>

                <Text
                  style={{
                    fontSize: 14,
                    color: COLORS.muted,
                    textAlign: "center",
                    marginBottom: 24,
                  }}
                >
                  {selectedObstacleData.description}
                </Text>

                {capturedPhoto ? (
                  <View style={{ alignItems: "center", marginBottom: 24 }}>
                    <Ionicons
                      name="checkmark-circle"
                      size={48}
                      color={COLORS.success}
                      style={{ marginBottom: 8 }}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        color: COLORS.success,
                        fontWeight: "500",
                      }}
                    >
                      Photo na-capture na!
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: COLORS.softBlue,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                    onPress={() => setShowCamera(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={16} color={COLORS.white} />
                    <Text
                      style={{
                        color: COLORS.white,
                        fontWeight: "600",
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
                      borderWidth: selectedSeverity === level.key ? 2 : 0,
                      borderColor:
                        selectedSeverity === level.key
                          ? level.color
                          : "transparent",
                    }}
                    onPress={() => setSelectedSeverity(level.key)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: level.color,
                        backgroundColor:
                          selectedSeverity === level.key
                            ? level.color
                            : "transparent",
                        marginRight: 12,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
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
                        }}
                      >
                        {level.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description Input */}
              <View style={[styles.card, { marginBottom: 16 }]}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: COLORS.slate,
                    marginBottom: 12,
                  }}
                >
                  Dagdagang Detalye (Optional)
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 8,
                    padding: 12,
                    minHeight: 80,
                    textAlignVertical: "top",
                    fontSize: 14,
                    color: COLORS.slate,
                  }}
                  multiline
                  placeholder="Halimbawa: 'May nakaharang na tricycle tapat ng Jollibee'"
                  placeholderTextColor={COLORS.muted}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.muted,
                    textAlign: "right",
                    marginTop: 4,
                  }}
                >
                  {description.length}/500
                </Text>
              </View>

              {/* Location Info */}
              {location && (
                <View style={[styles.card, { marginBottom: 24 }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons
                      name="location"
                      size={16}
                      color={COLORS.success}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: COLORS.slate,
                        marginLeft: 8,
                      }}
                    >
                      Location Confirmed
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.muted }}>
                    Lat: {location.latitude.toFixed(6)}, Long:{" "}
                    {location.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              {/* Submit Button */}
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: selectedSeverity
                      ? COLORS.softBlue
                      : COLORS.muted,
                    paddingVertical: 16,
                    borderRadius: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
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
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 16,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    {isSubmitting ? "Nire-report..." : "I-submit ang Report"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 12,
                  }}
                  onPress={handleBack}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={COLORS.muted}
                  />
                  <Text style={{ color: COLORS.muted, marginLeft: 4 }}>
                    Bumalik
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Profile Info Card */}
          {profile && (
            <View style={[styles.card, { marginTop: 20 }]}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={COLORS.softBlue}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: COLORS.slate,
                    marginLeft: 8,
                  }}
                >
                  Inyong Profile
                </Text>
              </View>
              <Text
                style={{ fontSize: 14, color: COLORS.slate, marginBottom: 4 }}
              >
                Device: {profile.type} •{" "}
                {profile.avoidStairs ? "Iwas stairs" : "OK sa stairs"}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                Ang reports mo ay makikita ng mga kapareho mong user type
              </Text>
            </View>
          )}

          {/* Reset Button */}
          {currentStep !== "select" && (
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 16,
                marginTop: 16,
              }}
              onPress={resetForm}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color={COLORS.navy} />
              <Text
                style={{ color: COLORS.navy, marginLeft: 8, fontWeight: "500" }}
              >
                Simula Ulit
              </Text>
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
