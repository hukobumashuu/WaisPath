// src/components/CameraInterface.tsx
// Filipino-First Camera Interface for Obstacle Reporting
// PWD Accessibility Optimized with Large Touch Targets

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
  Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import {
  cameraService,
  CompressedPhoto,
  showPhotoTips,
} from "../services/cameraService";
import { UserMobilityProfile } from "../types";

interface CameraInterfaceProps {
  isVisible: boolean;
  onPhotoTaken: (photo: CompressedPhoto) => void;
  onCancel: () => void;
  userProfile?: UserMobilityProfile;
  obstacleType?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export const CameraInterface: React.FC<CameraInterfaceProps> = ({
  isVisible,
  onPhotoTaken,
  onCancel,
  userProfile,
  obstacleType,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [showTips, setShowTips] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  // Request permissions when component becomes visible
  useEffect(() => {
    if (isVisible && !permission?.granted) {
      requestPermission();
    }
  }, [isVisible]);

  const requestPermissions = async () => {
    try {
      const cameraResult = await requestPermission();

      if (cameraResult.granted) {
        return {
          success: true,
          permissions: { camera: true, mediaLibrary: true },
          message:
            "Lahat ng pahintulot ay nabigay na! (All permissions granted!)",
        };
      } else {
        return {
          success: false,
          permissions: { camera: false, mediaLibrary: false },
          message:
            "Kailangan ng pahintulot para sa camera (Camera permission needed)",
        };
      }
    } catch (error) {
      console.error("Permission request error:", error);
      return {
        success: false,
        permissions: { camera: false, mediaLibrary: false },
        message:
          "Hindi nakuha ang pahintulot. Subukan ulit. (Permission request failed. Please try again.)",
      };
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || isTakingPhoto) return;

    try {
      setIsTakingPhoto(true);

      // Haptic feedback for accessibility
      Vibration.vibrate(50);

      console.log("📸 Taking photo for obstacle report...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8, // Good quality before compression
        base64: false,
        skipProcessing: false,
      });

      console.log("📸 Photo captured, processing...");

      // Process photo (compress, save, validate)
      const result = await cameraService.processPhoto(photo.uri);

      if (result.success && result.compressedPhoto) {
        // Success feedback with Filipino message
        Alert.alert("✅ Nakuha na!", result.message, [
          {
            text: "OK, Gamitin (Use This)",
            onPress: () => onPhotoTaken(result.compressedPhoto!),
          },
        ]);
      } else {
        Alert.alert(
          "❌ May Problema",
          result.message + "\n\nSubukan ulit? (Try again?)",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Subukan Ulit (Retry)",
              onPress: () => setIsTakingPhoto(false),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error("Photo capture failed:", error);
      Alert.alert(
        "Hindi Nakuha",
        "May problema sa pagkuha ng larawan. Subukan ulit.\n(Problem taking photo. Please try again.)",
        [{ text: "OK" }]
      );
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const toggleCameraType = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const handleShowTips = () => {
    if (userProfile?.type) {
      showPhotoTips(userProfile.type);
    } else {
      showPhotoTips("none");
    }
  };

  // Don't render if not visible
  if (!isVisible) return null;

  // Permission loading state
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        <View className="bg-white rounded-xl p-6 mx-4">
          <Text className="text-lg font-semibold text-center mb-2">
            Hinihiling ang Pahintulot...
          </Text>
          <Text className="text-gray-600 text-center">
            Requesting Camera Permissions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Permission denied state
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        <View className="bg-white rounded-xl p-6 mx-4">
          <Text className="text-xl font-bold text-center mb-4 text-red-600">
            Walang Pahintulot sa Camera
          </Text>
          <Text className="text-gray-700 text-center mb-6">
            Kailangan ang access sa camera para sa pag-report ng obstacles.
            {"\n\n"}
            (Camera access needed for obstacle reporting.)
          </Text>

          <View className="space-y-3">
            <TouchableOpacity
              onPress={requestPermission}
              className="bg-blue-500 py-4 px-6 rounded-lg"
            >
              <Text className="text-white text-center font-semibold text-lg">
                Subukan Ulit (Try Again)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCancel}
              className="bg-gray-300 py-4 px-6 rounded-lg"
            >
              <Text className="text-gray-700 text-center font-semibold text-lg">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Main camera interface
  return (
    <SafeAreaView className="flex-1 bg-black">
      <View style={{ flex: 1, position: "relative" }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
          mode="picture"
        />

        {/* Overlay UI - positioned absolutely over camera */}
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Header with obstacle type and tips */}
          <View className="absolute top-0 left-0 right-0 bg-black/50 p-4">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={onCancel}
                className="bg-white/20 rounded-full p-3"
                style={{ minWidth: 48, minHeight: 48 }} // PWD accessibility
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>

              <View className="flex-1 mx-4">
                <Text className="text-white text-center font-semibold">
                  I-camera ang Hadlang
                </Text>
                <Text className="text-white/80 text-center text-sm">
                  Photo the Obstacle
                </Text>
                {obstacleType && (
                  <Text className="text-yellow-300 text-center text-sm mt-1">
                    📍 {obstacleType}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleShowTips}
                className="bg-white/20 rounded-full p-3"
                style={{ minWidth: 48, minHeight: 48 }} // PWD accessibility
              >
                <Ionicons name="help-circle" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Center targeting overlay */}
          <View className="flex-1 justify-center items-center">
            <View className="w-64 h-64 border-2 border-white/50 rounded-lg">
              <View className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-white" />
              <View className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-white" />
              <View className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-white" />
              <View className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-white" />
            </View>
            <Text className="text-white text-center mt-4 bg-black/50 px-3 py-1 rounded">
              Ilagay ang hadlang sa loob ng frame
            </Text>
            <Text className="text-white/80 text-center text-sm">
              Position obstacle inside frame
            </Text>
          </View>

          {/* Bottom controls */}
          <View className="absolute bottom-0 left-0 right-0 bg-black/50 p-6">
            <View className="flex-row justify-center items-center">
              {/* Camera flip button */}
              <TouchableOpacity
                onPress={toggleCameraType}
                className="bg-white/20 rounded-full p-4 mr-8"
                style={{ minWidth: 64, minHeight: 64 }} // PWD accessibility
              >
                <Ionicons name="camera-reverse" size={32} color="white" />
              </TouchableOpacity>

              {/* Main capture button - Extra large for PWD accessibility */}
              <TouchableOpacity
                onPress={takePicture}
                disabled={isTakingPhoto}
                className={`rounded-full border-4 border-white items-center justify-center ${
                  isTakingPhoto ? "bg-gray-400" : "bg-white"
                }`}
                style={{
                  width: 80,
                  height: 80,
                  minWidth: 80,
                  minHeight: 80,
                }} // Extra large for PWD
              >
                {isTakingPhoto ? (
                  <Ionicons name="hourglass" size={32} color="gray" />
                ) : (
                  <View className="w-16 h-16 bg-red-500 rounded-full" />
                )}
              </TouchableOpacity>

              {/* Photo tips button */}
              <TouchableOpacity
                onPress={handleShowTips}
                className="bg-white/20 rounded-full p-4 ml-8"
                style={{ minWidth: 64, minHeight: 64 }} // PWD accessibility
              >
                <Ionicons name="bulb" size={32} color="white" />
              </TouchableOpacity>
            </View>

            {/* Bottom text */}
            <View className="mt-4">
              <Text className="text-white text-center font-semibold text-lg">
                {isTakingPhoto
                  ? "Kinukuha ang Larawan..."
                  : "Pindutin ang Pula para Kumuha"}
              </Text>
              <Text className="text-white/80 text-center">
                {isTakingPhoto
                  ? "Taking Photo..."
                  : "Tap Red Button to Capture"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
