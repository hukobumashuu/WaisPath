// src/components/ValidationPrompt.tsx
// User-friendly validation prompt component for obstacle verification

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Vibration,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
// Remove LinearGradient import - we'll use regular View instead
import {
  obstacleValidationService,
  type ValidationPrompt,
} from "../services/obstacleValidationService";

interface ValidationPromptProps {
  prompt: ValidationPrompt;
  onResponse: (response: "still_there" | "cleared" | "skip") => void;
  onDismiss: () => void;
}

export function ValidationPrompt({
  prompt,
  onResponse,
  onDismiss,
}: ValidationPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  React.useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleResponse = async (
    response: "still_there" | "cleared" | "skip"
  ) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Haptic feedback
    Vibration.vibrate(50);

    try {
      await obstacleValidationService.processValidationResponse(
        prompt.obstacleId,
        response
      );

      // Success feedback
      if (response !== "skip") {
        Vibration.vibrate([50, 100, 50]);
      }

      onResponse(response);
    } catch (error) {
      console.error("Validation error:", error);
      Alert.alert(
        "Validation Failed",
        "Hindi ma-record ang validation. Subukan ulit.\n\n(Could not record validation. Please try again.)",
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getObstacleIcon = (type: string) => {
    const icons: Record<string, string> = {
      vendor_blocking: "storefront",
      parked_vehicles: "car",
      construction: "construct",
      electrical_post: "flash",
      tree_roots: "leaf",
      no_sidewalk: "warning",
      flooding: "water",
      stairs_no_ramp: "arrow-up",
      narrow_passage: "resize",
      broken_pavement: "warning",
      steep_slope: "trending-up",
      other: "help-circle",
    };
    return icons[type] || "help-circle";
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        position: "absolute",
        bottom: 96, // 24 * 4 for bottom-24
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      <View
        style={{
          borderRadius: 16,
          padding: 16,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#E5E7EB",
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#DBEAFE",
                padding: 8,
                borderRadius: 20,
                marginRight: 12,
              }}
            >
              <Ionicons
                name={getObstacleIcon(prompt.obstacleType) as any}
                size={20}
                color="#3B82F6"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}
              >
                Community Check
              </Text>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>
                {prompt.reportCount} report{prompt.reportCount > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Question */}
        <Text
          style={{
            fontSize: 18,
            color: "#1F2937",
            marginBottom: 16,
            lineHeight: 26,
          }}
        >
          {prompt.message}
        </Text>

        {/* Action Buttons - FIXED: Remove gap, use marginRight */}
        <View style={{ flexDirection: "row" }}>
          {/* Still There Button */}
          <TouchableOpacity
            onPress={() => handleResponse("still_there")}
            disabled={isSubmitting}
            style={{
              flex: 1,
              backgroundColor: "#EF4444",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              marginRight: 8,
            }}
            accessibilityLabel="Confirm obstacle is still there"
          >
            <Ionicons name="alert-circle" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Still There
            </Text>
          </TouchableOpacity>

          {/* Cleared Button */}
          <TouchableOpacity
            onPress={() => handleResponse("cleared")}
            disabled={isSubmitting}
            style={{
              flex: 1,
              backgroundColor: "#22C55E",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              marginRight: 8,
            }}
            accessibilityLabel="Report obstacle is cleared"
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
              Cleared
            </Text>
          </TouchableOpacity>

          {/* Skip Button */}
          <TouchableOpacity
            onPress={() => handleResponse("skip")}
            disabled={isSubmitting}
            style={{
              backgroundColor: "#E5E7EB",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityLabel="Skip this validation"
          >
            <Text style={{ color: "#374151", fontWeight: "500" }}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Helper Text */}
        <Text
          style={{
            fontSize: 12,
            color: "#6B7280",
            textAlign: "center",
            marginTop: 12,
          }}
        >
          Your input helps keep navigation accurate for the PWD community
        </Text>

        {/* Loading Overlay */}
        {isSubmitting && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.75)",
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "white",
                padding: 16,
                borderRadius: 12,
                elevation: 4,
              }}
            >
              <Text style={{ color: "#6B7280" }}>Recording...</Text>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// Enhanced obstacle marker component that shows validation status
interface ObstacleMarkerProps {
  obstacle: any; // Your existing AccessibilityObstacle type
  onPress?: () => void;
}

export function EnhancedObstacleMarker({
  obstacle,
  onPress,
}: ObstacleMarkerProps) {
  const validationStatus =
    obstacleValidationService.getValidationStatus(obstacle);
  const displayStyle =
    obstacleValidationService.getObstacleDisplayStyle(obstacle);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ opacity: displayStyle.opacity }}
      accessibilityLabel={`${obstacle.type} obstacle - ${validationStatus.displayLabel}`}
    >
      <View style={{ alignItems: "center" }}>
        {/* Main Obstacle Icon */}
        <View
          style={{
            backgroundColor: displayStyle.color,
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: "center",
            alignItems: "center",
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          }}
        >
          <Ionicons name={displayStyle.icon as any} size={20} color="white" />
        </View>

        {/* Validation Status Badge */}
        <View
          style={{
            backgroundColor: "white",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            marginTop: 4,
            minWidth: 60,
            borderWidth: 1,
            borderColor: displayStyle.color,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: displayStyle.color,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {validationStatus.tier === "single_report" && "UNVERIFIED"}
            {validationStatus.tier === "community_verified" && "VERIFIED"}
            {validationStatus.tier === "admin_resolved" && "OFFICIAL"}
          </Text>
        </View>

        {/* Conflicting Reports Indicator */}
        {validationStatus.conflictingReports && (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              backgroundColor: "#F59E0B",
              width: 16,
              height: 16,
              borderRadius: 8,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="warning" size={10} color="white" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
