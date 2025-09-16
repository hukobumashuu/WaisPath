// src/components/SubmitReportTab.tsx
// CLEAN: Complete reporting functionality as a tab component

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
    labelFil: "Maliit na Problem",
    labelEn: "Minor Issue",
    color: COLORS.success,
    description: "Pwedeng ma-navigate pero may konting hirap",
  },
  {
    key: "medium" as const,
    labelFil: "Katamtamang Problem",
    labelEn: "Moderate Issue",
    color: COLORS.warning,
    description: "Mahirap ma-navigate, kailangan ng tulong",
  },
  {
    key: "high" as const,
    labelFil: "Malaking Problem",
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
        return { current: 2, total: 3, label: "Kumuha ng Photo" };
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
    setCurrentStep("details");
    Vibration.vibrate([50, 100, 50]);
  };

  const handleSkipPhoto = () => {
    setShowCamera(false);
    setCurrentStep("details");
  };

  // Enhanced obstacle report submission with automatic form reset
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
        // Log admin obstacle report if user is admin
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

        // Automatically reset form after successful submission
        Alert.alert("✅ Na-report na!", result.message, [
          {
            text: "OK",
            onPress: () => {
              resetForm(); // Reset to step 1
              Vibration.vibrate([100, 50, 100]);
            },
          },
        ]);
      } else {
        // Handle rate limits and other failures
        if (result.rateLimitInfo && !result.rateLimitInfo.allowed) {
          enhancedFirebaseService.showRateLimitAlert(
            result.rateLimitInfo,
            () => navigation.navigate("Profile"), // Navigate to registration
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

  const renderObstacleSelection = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
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
                backgroundColor: `${obstacle.color}10`,
              },
            ]}
            onPress={() => handleObstacleSelect(obstacle.key)}
            activeOpacity={0.8}
          >
            <View
              style={[styles.obstacleIcon, { backgroundColor: obstacle.color }]}
            >
              <Ionicons name={obstacle.icon} size={24} color={COLORS.white} />
            </View>
            <View style={styles.obstacleTextContainer}>
              <Text style={styles.obstacleTitle}>{obstacle.labelFil}</Text>
              <Text style={styles.obstacleDescription}>
                {obstacle.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderPhotoCapture = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { fontSize: isSmallScreen ? 20 : 24 }]}>
        Kumuha ng Photo
      </Text>
      <Text style={styles.stepDescription}>
        Mag-picture para mas malinaw ang report (optional)
      </Text>

      {capturedPhoto ? (
        <View style={styles.photoPreviewContainer}>
          <View style={styles.photoPreview}>
            <Text style={styles.photoPreviewText}>📸 Photo na-capture na!</Text>
            <Text style={styles.photoPreviewSize}>
              Size: {(capturedPhoto.compressedSize / 1024).toFixed(1)}KB
            </Text>
          </View>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => setShowCamera(true)}
          >
            <Ionicons name="camera" size={20} color={COLORS.white} />
            <Text style={styles.retakeButtonText}>I-retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraActions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: COLORS.softBlue }]}
            onPress={() => setShowCamera(true)}
          >
            <Ionicons name="camera" size={24} color={COLORS.white} />
            <Text style={styles.primaryButtonText}>Mag-picture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: COLORS.muted }]}
            onPress={handleSkipPhoto}
          >
            <Text style={[styles.secondaryButtonText, { color: COLORS.muted }]}>
              Skip Photo
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderDetailsInput = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { fontSize: isSmallScreen ? 20 : 24 }]}>
        Mga Detalye
      </Text>
      <Text style={styles.stepDescription}>
        I-describe ang obstacle at piliin kung gaano ka-severe
      </Text>

      {/* Severity Selection */}
      <Text style={styles.inputLabel}>Severity Level:</Text>
      <View style={styles.severityGrid}>
        {SEVERITY_LEVELS.map((severity) => (
          <TouchableOpacity
            key={severity.key}
            style={[
              styles.severityCard,
              selectedSeverity === severity.key && {
                borderColor: severity.color,
                backgroundColor: `${severity.color}15`,
              },
            ]}
            onPress={() => setSelectedSeverity(severity.key)}
          >
            <View
              style={[styles.severityDot, { backgroundColor: severity.color }]}
            />
            <View style={styles.severityTextContainer}>
              <Text style={styles.severityTitle}>{severity.labelFil}</Text>
              <Text style={styles.severityDescription}>
                {severity.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description Input */}
      <Text style={styles.inputLabel}>Dagdag na Detalye (Optional):</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="I-describe kung ano pa ang makikita mo dito..."
        placeholderTextColor={COLORS.muted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Location Info */}
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
      {renderStepContent()}

      {/* Navigation Buttons */}
      <View
        style={[
          styles.navigationButtons,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        {currentStep !== "select" && (
          <TouchableOpacity
            style={[styles.navButton, styles.backButton]}
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
        )}

        {currentStep === "details" && (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.submitButton,
              {
                backgroundColor: isSubmitting ? COLORS.muted : COLORS.softBlue,
              },
            ]}
            onPress={handleSubmitReport}
            disabled={isSubmitting || !selectedSeverity}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Nag-i-submit..." : "I-submit Report"}
            </Text>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>

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
