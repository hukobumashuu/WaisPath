// src/components/SubmitReportTab.tsx
// SIMPLIFIED: Android-focused reporting with fixed bottom navigation

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Vibration,
  useWindowDimensions,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Enhanced Firebase service
import { enhancedFirebaseService } from "../services/enhancedFirebase";

// Mobile admin logger
import { logAdminObstacleReport } from "../services/mobileAdminLogger";

import { useUserProfile } from "../stores/userProfileStore";
import { useLocation } from "../hooks/useLocation";
import { ObstacleType } from "../types";
import { CameraInterface } from "./CameraInterface";
import { CompressedPhoto } from "../services/cameraService";

// Import dedicated styles for SubmitReportTab
import {
  submitReportTabStyles as styles,
  COLORS,
} from "../styles/submitReportTabStyles";

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
    color: COLORS.danger,
    description: "Mga sasakyan na nakapark sa sidewalk o ramp",
  },
  {
    key: "construction" as ObstacleType,
    labelFil: "Konstruksiyon",
    labelEn: "Construction",
    icon: "construct" as keyof typeof Ionicons.glyphMap,
    color: COLORS.warning,
    description: "Ongoing construction na humaharang sa daan",
  },
  {
    key: "broken_infrastructure" as ObstacleType,
    labelFil: "Sirang Infrastructure",
    labelEn: "Broken Infrastructure",
    icon: "warning" as keyof typeof Ionicons.glyphMap,
    color: COLORS.danger,
    description: "Sirang ramp, sidewalk, o iba pang facilities",
  },
  {
    key: "debris" as ObstacleType,
    labelFil: "Kalat o Debris",
    labelEn: "Debris",
    icon: "trash" as keyof typeof Ionicons.glyphMap,
    color: COLORS.muted,
    description: "Mga basura, debris, o kalat sa daan",
  },
  {
    key: "other" as ObstacleType,
    labelFil: "Iba Pa",
    labelEn: "Other",
    icon: "help-circle" as keyof typeof Ionicons.glyphMap,
    color: COLORS.softBlue,
    description: "Ibang uri ng obstacle na hindi kasama sa list",
  },
];

const SEVERITY_LEVELS = [
  {
    key: "low" as const,
    labelFil: "Maliit na Problema",
    labelEn: "Minor Issue",
    color: COLORS.success,
    description: "Pwedeng ma-navigate pero may konting hirap",
  },
  {
    key: "medium" as const,
    labelFil: "Katamtamang Problema",
    labelEn: "Moderate Issue",
    color: COLORS.warning,
    description: "Mahirap ma-navigate, kailangan ng tulong",
  },
  {
    key: "high" as const,
    labelFil: "Malaking Problema",
    labelEn: "Major Issue",
    color: COLORS.danger,
    description: "Napaka-hirap ma-navigate, delikado",
  },
  {
    key: "blocking" as const,
    labelFil: "Completely Blocked",
    labelEn: "Cannot Pass",
    color: COLORS.slate,
    description: "Hindi talaga makakalampas, kailangan umikot",
  },
];

type ReportStep = "select" | "photo" | "details";

interface SubmitReportTabProps {
  navigation: any;
}

export const SubmitReportTab: React.FC<SubmitReportTabProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 375;

  // Calculate tab bar height for Android
  const tabBarHeight = 60 + insets.bottom;

  // Form state
  const [currentStep, setCurrentStep] = useState<ReportStep>("select");
  const [selectedObstacle, setSelectedObstacle] = useState<ObstacleType | null>(
    null
  );
  const [selectedSeverity, setSelectedSeverity] = useState<
    "low" | "medium" | "high" | "blocking" | null
  >(null);
  const [description, setDescription] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<CompressedPhoto | null>(
    null
  );
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Location and profile
  const { location, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();

  // Progress indicator
  const progress = useMemo(() => {
    switch (currentStep) {
      case "select":
        return { current: 1, total: 3, label: "Uri ng Hadlang" };
      case "photo":
        return { current: 2, total: 3, label: "Kumuha ng Larawan" };
      case "details":
        return { current: 3, total: 3, label: "Mga Detalye" };
      default:
        return { current: 1, total: 3, label: "Uri ng Hadlang" };
    }
  }, [currentStep]);

  // Complete form reset function
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
    Vibration.vibrate([50, 100, 50]); // Success feedback
  };

  const handleSkipPhoto = () => {
    setShowCamera(false);
    setCurrentStep("details");
  };

  // Enhanced obstacle report submission
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

      const result = await enhancedFirebaseService.reportObstacleEnhanced(
        obstacleData
      );

      if (result.success) {
        try {
          await logAdminObstacleReport(
            result.obstacleId || "unknown_id",
            selectedObstacle,
            selectedSeverity,
            location
          );
        } catch (logError) {
          console.warn("Failed to log admin obstacle report:", logError);
        }

        Alert.alert("✅ Na-report na!", result.message, [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              Vibration.vibrate([100, 50, 100]);
            },
          },
        ]);
      } else {
        if (result.rateLimitInfo && !result.rateLimitInfo.allowed) {
          enhancedFirebaseService.showRateLimitAlert(
            result.rateLimitInfo,
            () => navigation.navigate("Profile"),
            undefined
          );
        } else {
          Alert.alert("❌ Hindi Ma-report", result.message, [{ text: "OK" }]);
        }
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      Alert.alert(
        "❌ May Error",
        `Hindi na-submit ang report: ${error.message}`,
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "select":
        return renderObstacleSelection();
      case "photo":
        return renderPhotoCapture();
      case "details":
        return renderDetailsInput();
    }
  };

  const renderObstacleSelection = () => {
    // Calculate proper padding to clear all bottom UI elements
    const scrollPadding =
      80 + // Navigation buttons height
      60 + // Tab bar base height
      insets.bottom + // Device-specific bottom inset
      20; // Extra safety margin

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={{ paddingBottom: scrollPadding }} // 🔧 FIXED
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.stepTitle, { fontSize: isSmallScreen ? 20 : 24 }]}>
          Anong uri ng hadlang?
        </Text>
        <Text style={styles.stepDescription}>
          Piliin ang obstacle na nakita mo para ma-report natin
        </Text>

        <View style={styles.obstacleGrid}>
          {OBSTACLE_TYPES.map((obstacle) => (
            <TouchableOpacity
              key={obstacle.key}
              style={[
                styles.obstacleCard,
                selectedObstacle === obstacle.key && {
                  borderColor: obstacle.color,
                  backgroundColor: COLORS.white,
                  borderWidth: 3,
                  shadowColor: obstacle.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 6,
                },
              ]}
              onPress={() => handleObstacleSelect(obstacle.key)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.obstacleIcon,
                  {
                    backgroundColor: obstacle.color,
                    ...(selectedObstacle === obstacle.key && {
                      shadowColor: obstacle.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 8,
                    }),
                  },
                ]}
              >
                <Ionicons name={obstacle.icon} size={24} color={COLORS.white} />
              </View>
              <View style={styles.obstacleTextContainer}>
                <Text
                  style={[
                    styles.obstacleTitle,
                    selectedObstacle === obstacle.key && {
                      color: obstacle.color,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {obstacle.labelFil}
                </Text>
                <Text style={styles.obstacleDescription}>
                  {obstacle.description}
                </Text>
              </View>
              {selectedObstacle === obstacle.key && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={obstacle.color}
                  style={{ marginLeft: 8 }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderPhotoCapture = () => {
    // Calculate proper padding to clear all bottom UI elements
    const scrollPadding =
      80 + // Navigation buttons height
      60 + // Tab bar base height
      insets.bottom + // Device-specific bottom inset
      20; // Extra safety margin

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={{ paddingBottom: scrollPadding }} // 🔧 FIXED
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.stepTitle, { fontSize: isSmallScreen ? 20 : 24 }]}>
          Kumuha ng Photo
        </Text>
        <Text style={styles.stepDescription}>
          Mag-picture para mas malinaw ang report (optional)
        </Text>

        {/* 🆕 ENHANCED: Photo Preview with Actual Image */}
        {capturedPhoto ? (
          <View style={styles.photoPreviewContainer}>
            {/* Image Display with Metadata Overlay */}
            <View style={{ position: "relative" }}>
              <Image
                source={{ uri: capturedPhoto.uri }}
                style={styles.photoPreviewImage}
                resizeMode="cover"
                accessibilityLabel="Captured obstacle photo preview"
              />

              {/* Metadata Badge - Top Right Corner */}
              <View style={styles.photoMetadataOverlay}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={COLORS.white}
                />
                <Text style={styles.photoMetadataText}>
                  {(capturedPhoto.compressedSize / 1024).toFixed(1)}KB
                </Text>
              </View>
            </View>

            {/* Action Buttons - Side by Side */}
            <View style={styles.photoActionsContainer}>
              {/* Retake Button */}
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => setShowCamera(true)}
                activeOpacity={0.8}
                accessibilityLabel="Retake photo"
                accessibilityHint="Opens camera to take a new photo"
              >
                <Ionicons name="camera" size={20} color={COLORS.white} />
                <Text style={styles.retakeButtonText}>I-retake</Text>
              </TouchableOpacity>

              {/* Confirm Button */}
              <TouchableOpacity
                style={styles.confirmPhotoButton}
                onPress={() => {
                  setCurrentStep("details"); // ✅ Only navigate when user confirms
                  Vibration.vibrate([50, 100, 50]);
                }}
                activeOpacity={0.8}
                accessibilityLabel="Confirm photo"
                accessibilityHint="Use this photo and proceed to next step"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.confirmPhotoButtonText}>Okay na ito</Text>
              </TouchableOpacity>
            </View>

            {/* Helper Text */}
            <Text style={styles.photoHelperText}>
              Tingnan muna kung malinaw ang larawan
            </Text>
          </View>
        ) : (
          /* Original Camera Buttons - UNCHANGED */
          <View style={styles.cameraActions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: COLORS.softBlue },
              ]}
              onPress={() => setShowCamera(true)}
            >
              <Ionicons name="camera" size={24} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Mag-picture</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: COLORS.muted }]}
              onPress={handleSkipPhoto}
            >
              <Text
                style={[styles.secondaryButtonText, { color: COLORS.muted }]}
              >
                Skip Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };
  const renderDetailsInput = () => {
    // Calculate proper padding to clear all bottom UI elements
    const scrollPadding =
      80 + // Navigation buttons height
      60 + // Tab bar base height
      insets.bottom + // Device-specific bottom inset
      20; // Extra safety margin

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={{ paddingBottom: scrollPadding }} // 🔧 FIXED
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.stepTitle, { fontSize: isSmallScreen ? 20 : 24 }]}>
          Mga Detalye ng Report
        </Text>
        <Text style={styles.stepDescription}>
          Magdagdag ng karagdagang impormasyon tungkol sa hadlang
        </Text>

        {/* Severity Selection */}
        <Text style={styles.inputLabel}>Gaano kalala? (Severity Level)</Text>
        <View style={styles.severityGrid}>
          {SEVERITY_LEVELS.map((severity) => (
            <TouchableOpacity
              key={severity.key}
              style={[
                styles.severityCard,
                selectedSeverity === severity.key && {
                  borderColor: severity.color,
                  borderWidth: 3,
                  backgroundColor: `${severity.color}10`,
                },
              ]}
              onPress={() => {
                setSelectedSeverity(severity.key);
                Vibration.vibrate(30);
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.severityDot,
                  { backgroundColor: severity.color },
                ]}
              />
              <View style={styles.severityTextContainer}>
                <Text
                  style={[
                    styles.severityTitle,
                    selectedSeverity === severity.key && {
                      color: severity.color,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {severity.labelFil}
                </Text>
                <Text style={styles.severityDescription}>
                  {severity.description}
                </Text>
              </View>
              {selectedSeverity === severity.key && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={severity.color}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Description Input */}
        <Text style={styles.inputLabel}>Dagdag na Detalye (Optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Halimbawa: 'May nagtitinda ng taho malapit sa bangketa' o 'Butas sa kalsada malapit sa waiting shed'"
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        {/* Location Display */}
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={16} color={COLORS.softBlue} />
          <Text style={styles.locationText}>
            {location
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(
                  6
                )}`
              : "Getting location..."}
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(progress.current / progress.total) * 100}%`,
                backgroundColor: COLORS.softBlue,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Step {progress.current} of {progress.total}: {progress.label}
        </Text>
      </View>

      {/* Step Content */}
      <View style={{ flex: 1 }}>{renderStepContent()}</View>

      {/* Fixed Navigation Buttons - Only show on steps 2 and 3 */}
      {currentStep !== "select" && (
        <View
          style={[
            styles.navigationButtons,
            {
              paddingBottom: Math.max(insets.bottom + 16, 24), // Ensure it's always above tab bar
              minHeight: 80, // Minimum height for buttons
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (currentStep === "details") {
                setCurrentStep("photo");
              } else if (currentStep === "photo") {
                setCurrentStep("select");
              }
            }}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.muted} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          {currentStep === "details" && (
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: isSubmitting
                    ? COLORS.muted
                    : COLORS.softBlue,
                  opacity: !selectedSeverity || isSubmitting ? 0.6 : 1,
                },
              ]}
              onPress={handleSubmitReport}
              disabled={isSubmitting || !selectedSeverity}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Nag-i-submit..." : "I-submit Report"}
              </Text>
              <Ionicons
                name={isSubmitting ? "hourglass" : "checkmark-circle"}
                size={20}
                color={COLORS.white}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <CameraInterface
          isVisible={showCamera}
          onPhotoTaken={handlePhotoTaken}
          onCancel={() => setShowCamera(false)}
        />
      </Modal>
    </View>
  );
};
