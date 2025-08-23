// src/services/cameraService.ts
// Filipino-First Camera Service for Obstacle Reporting
// PWD Accessibility Optimized with Photo Compression

import { useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { Alert } from "react-native";

export interface CameraPermissions {
  camera: boolean;
  mediaLibrary: boolean;
}

export interface CompressedPhoto {
  uri: string;
  base64: string; // Add Base64 string for Firestore storage
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

export interface CameraServiceConfig {
  compressionQuality: number; // 0.1 to 1.0
  maxWidth: number; // Max width in pixels
  saveToGallery: boolean;
  enableVoiceFeedback: boolean;
}

class CameraService {
  private config: CameraServiceConfig = {
    compressionQuality: 0.3, // Heavy compression for free Firebase storage
    maxWidth: 800, // 800px max width
    saveToGallery: true,
    enableVoiceFeedback: true,
  };

  /**
   * Request all necessary permissions for camera functionality
   * Returns status with Filipino error messages
   * Note: This is now handled by the component using useCameraPermissions
   */
  async requestPermissions(): Promise<{
    success: boolean;
    permissions: CameraPermissions;
    message: string;
  }> {
    try {
      // Request media library permission
      const mediaLibraryPermission =
        await MediaLibrary.requestPermissionsAsync();

      const permissions: CameraPermissions = {
        camera: true, // Camera permission handled by component
        mediaLibrary: mediaLibraryPermission.status === "granted",
      };

      // Check if all required permissions are granted
      if (permissions.camera && permissions.mediaLibrary) {
        return {
          success: true,
          permissions,
          message:
            "Lahat ng pahintulot ay nabigay na! (All permissions granted!)",
        };
      }

      // Generate Filipino error message based on missing permissions
      let message =
        "Kailangan ng pahintulot para sa:\n(Need permission for:)\n";
      if (!permissions.camera) {
        message +=
          "• Camera - Para sa pagkuha ng larawan (For taking photos)\n";
      }
      if (!permissions.mediaLibrary) {
        message +=
          "• Gallery - Para sa pag-save ng larawan (For saving photos)\n";
      }

      return {
        success: false,
        permissions,
        message,
      };
    } catch (error: any) {
      console.error("Permission request failed:", error);
      return {
        success: false,
        permissions: { camera: false, mediaLibrary: false },
        message:
          "Hindi nakuha ang pahintulot. Subukan ulit. (Permission request failed. Please try again.)",
      };
    }
  }

  /**
   * Compress photo with Filipino progress feedback
   * Optimized for Base64 Firestore storage (completely free!)
   */
  async compressPhoto(photoUri: string): Promise<CompressedPhoto | null> {
    try {
      console.log("🗜️ Starting photo compression for Base64 storage...");

      // Get original file info
      const originalFileInfo = await FileSystem.getInfoAsync(photoUri);
      const originalSize =
        originalFileInfo.exists && "size" in originalFileInfo
          ? originalFileInfo.size
          : 0;

      // Compress the image
      const compressedImage = await ImageManipulator.manipulateAsync(
        photoUri,
        [
          // Resize to max width while maintaining aspect ratio
          { resize: { width: this.config.maxWidth } },
        ],
        {
          compress: this.config.compressionQuality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true, // Generate Base64 for Firestore storage
        }
      );

      // Get compressed file info
      const compressedFileInfo = await FileSystem.getInfoAsync(
        compressedImage.uri
      );
      const compressedSize =
        compressedFileInfo.exists && "size" in compressedFileInfo
          ? compressedFileInfo.size
          : 0;

      const compressionRatio =
        originalSize > 0 ? compressedSize / originalSize : 1;
      const base64Size = compressedImage.base64
        ? compressedImage.base64.length * 0.75
        : compressedSize; // Base64 is ~33% larger

      console.log(
        `📸 Photo compressed for Base64: ${(originalSize / 1024).toFixed(
          1
        )}KB → ${(base64Size / 1024).toFixed(1)}KB Base64`
      );

      return {
        uri: compressedImage.uri,
        base64: compressedImage.base64 || "", // Base64 string for Firestore
        originalSize,
        compressedSize,
        compressionRatio,
        width: compressedImage.width,
        height: compressedImage.height,
      };
    } catch (error: any) {
      console.error("Photo compression failed:", error);
      Alert.alert(
        "Error sa Compression",
        "Hindi ma-compress ang larawan. Subukan ulit.\n(Cannot compress photo. Please try again.)"
      );
      return null;
    }
  }

  /**
   * Save photo to device gallery with Filipino feedback
   */
  async saveToGallery(photoUri: string): Promise<boolean> {
    try {
      if (!this.config.saveToGallery) {
        return true; // Skip if disabled
      }

      const asset = await MediaLibrary.createAssetAsync(photoUri);
      console.log("💾 Photo saved to gallery:", asset.id);

      return true;
    } catch (error: any) {
      console.error("Failed to save to gallery:", error);
      Alert.alert(
        "Hindi Ma-save",
        "Hindi ma-save ang larawan sa gallery. Patuloy pa rin ang pag-report.\n(Cannot save photo to gallery. Report will continue.)"
      );
      return false;
    }
  }

  /**
   * Complete photo capture process with compression and saving
   * Filipino-optimized workflow
   */
  async processPhoto(photoUri: string): Promise<{
    success: boolean;
    compressedPhoto?: CompressedPhoto;
    message: string;
  }> {
    try {
      console.log("📸 Processing photo for obstacle report...");

      // Step 1: Compress photo
      const compressedPhoto = await this.compressPhoto(photoUri);
      if (!compressedPhoto) {
        return {
          success: false,
          message: "Hindi ma-compress ang larawan (Cannot compress photo)",
        };
      }

      // Step 2: Save to gallery (optional)
      await this.saveToGallery(compressedPhoto.uri);

      // Step 3: Success feedback
      const sizeSaved =
        compressedPhoto.originalSize - compressedPhoto.compressedSize;
      const message = `✅ Larawan ay handa na!\n(Photo ready!)\n\nNa-compress: ${(
        sizeSaved / 1024
      ).toFixed(1)}KB na-save\n(Compressed: ${(sizeSaved / 1024).toFixed(
        1
      )}KB saved)`;

      return {
        success: true,
        compressedPhoto,
        message,
      };
    } catch (error: any) {
      console.error("Photo processing failed:", error);
      return {
        success: false,
        message:
          "May problema sa pag-process ng larawan (Problem processing photo)",
      };
    }
  }

  /**
   * Validate photo quality for obstacle reporting
   * Ensures photo is suitable for community verification
   */
  validatePhotoQuality(photo: CompressedPhoto): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if photo is too small
    if (photo.width < 300 || photo.height < 300) {
      issues.push("Masyadong maliit ang larawan (Photo too small)");
      suggestions.push(
        "Kumuha ng mas malapit na larawan (Take a closer photo)"
      );
    }

    // Check if compression is too extreme
    if (photo.compressionRatio < 0.1) {
      issues.push("Masyadong blurry ang larawan (Photo too blurry)");
      suggestions.push(
        "Subukan ulit na hindi masyado compressed (Try again with less compression)"
      );
    }

    // Check file size - too big for free Firebase
    if (photo.compressedSize > 1024 * 1024) {
      // 1MB limit
      issues.push("Masyadong malaki pa rin ang file (File still too large)");
      suggestions.push(
        "Automatic na ma-compress pa ito (Will be compressed further automatically)"
      );
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Get camera service configuration
   */
  getConfig(): CameraServiceConfig {
    return { ...this.config };
  }

  /**
   * Update camera service configuration
   */
  updateConfig(newConfig: Partial<CameraServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("📷 Camera config updated:", this.config);
  }

  /**
   * Generate helpful tips for PWD users taking obstacle photos
   */
  getPhotoTips(
    userType: "wheelchair" | "walker" | "cane" | "crutches" | "none"
  ): string[] {
    const commonTips = [
      "Ipakita ang buong hadlang sa larawan (Show the entire obstacle in the photo)",
      "Kasama ang katabing daan para makita ang laki (Include nearby path to show scale)",
      "Malinaw na larawan para sa iba (Clear photo for others to understand)",
    ];

    const deviceSpecificTips: Record<string, string[]> = {
      wheelchair: [
        "Ipakita kung gaano kakitid ang daan (Show how narrow the path is)",
        "Larawan ang height ng obstacle (Photo the height of obstacle)",
      ],
      walker: [
        "Ipakita ang surface na hindi safe (Show unsafe surface)",
        "Kasama ang mga support na pwedeng gamitin (Include supports that can be used)",
      ],
      cane: [
        "Focus sa mga obstacle sa sahig (Focus on ground-level obstacles)",
        "Ipakita ang mga hazard na hindi makikita ng cane (Show hazards cane cannot detect)",
      ],
      crutches: [
        "Ipakita ang mga hindi stable na surface (Show unstable surfaces)",
        "Focus sa mga obstacle na makakasabay ng crutches (Focus on obstacles at crutch level)",
      ],
      none: [
        "Tingnan kung accessible ba sa lahat (Check if accessible to everyone)",
        "Isaalang-alang ang iba (Consider others)",
      ],
    };

    return [...commonTips, ...deviceSpecificTips[userType]];
  }
}

// Export singleton instance
export const cameraService = new CameraService();

// Export types for use in components
export { CameraService };

// Helper function to show Filipino photo tips
export const showPhotoTips = (
  userType: "wheelchair" | "walker" | "cane" | "crutches" | "none"
) => {
  const tips = cameraService.getPhotoTips(userType);
  const message = `📸 Mga Tip sa Pagkuha ng Larawan:\n(Photo Taking Tips:)\n\n${tips
    .map((tip, index) => `${index + 1}. ${tip}`)
    .join("\n\n")}`;

  Alert.alert("Photo Tips", message, [{ text: "OK, Salamat! (OK, Thanks!)" }]);
};
