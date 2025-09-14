// src/services/textToSpeechService.ts
// CRITICAL FIX: TTS announcements missing speech content for all obstacle types
// Fixed to ensure ALL obstacles get proper voice announcements

import * as Speech from "expo-speech";
import { AccessibilityObstacle, UserMobilityProfile } from "../types";

interface TTSSettings {
  enabled: boolean;
  rate: number;
  volume: number;
}

class TextToSpeechService {
  private settings: TTSSettings = {
    enabled: true, // Default enabled for accessibility
    rate: 0.6, // Slightly slower for better comprehension
    volume: 1.0, // Loud enough but not overwhelming
  };

  private isSpeaking = false;
  private lastAnnouncedObstacle: string | null = null;
  private lastAnnouncementTime = 0;
  private readonly MIN_ANNOUNCEMENT_INTERVAL = 10000; // 10 seconds between same obstacle

  /**
   * Initialize TTS and check availability
   */
  async initialize(): Promise<boolean> {
    try {
      // Test if TTS is available on this device
      const voices = await Speech.getAvailableVoicesAsync();
      console.log("🔊 TTS: Available voices found:", voices.length);
      return true;
    } catch (error) {
      console.error("🔊 TTS: Initialization failed:", error);
      return false;
    }
  }

  /**
   * FIXED: Main method - Announce proximity alert for obstacles ahead
   * Now ensures ALL obstacle types get voice announcements
   */
  async announceProximityAlert(
    obstacle: AccessibilityObstacle,
    distance: number,
    userProfile: UserMobilityProfile
  ): Promise<void> {
    try {
      // Skip if TTS is disabled
      if (!this.settings.enabled) {
        console.log("🔊 TTS: Disabled, skipping announcement");
        return;
      }

      // Skip if already speaking
      if (this.isSpeaking) {
        console.log("🔊 TTS: Already speaking, skipping announcement");
        return;
      }

      // Skip if not relevant for this user type
      if (!this.isObstacleRelevantForUser(obstacle, userProfile)) {
        console.log(
          `🔊 TTS: Obstacle ${obstacle.type} not relevant for ${userProfile.type}`
        );
        return;
      }

      // Prevent duplicate announcements for same obstacle
      const obstacleKey = `${obstacle.id}_${Math.floor(distance / 10) * 10}`; // Group by 10m intervals
      const now = Date.now();

      if (
        this.lastAnnouncedObstacle === obstacleKey &&
        now - this.lastAnnouncementTime < this.MIN_ANNOUNCEMENT_INTERVAL
      ) {
        console.log(
          `🔊 TTS: Skipping duplicate announcement for ${obstacleKey}`
        );
        return;
      }

      // 🔥 CRITICAL FIX: Generate announcement and ALWAYS call speak()
      const announcement = this.generateAnnouncement(
        obstacle,
        distance,
        userProfile
      );

      console.log(`🔊 TTS: Generated announcement: "${announcement}"`);

      // 🔥 FIX: Ensure speak() is ALWAYS called
      await this.speak(announcement);

      // Track to prevent duplicates
      this.lastAnnouncedObstacle = obstacleKey;
      this.lastAnnouncementTime = now;
    } catch (error) {
      console.error("🔊 TTS: announceProximityAlert failed:", error);
      // Don't throw - TTS failures shouldn't break proximity detection
    }
  }

  /**
   * FIXED: Generate contextual announcement based on obstacle and user profile
   * Added comprehensive obstacle type coverage
   */
  private generateAnnouncement(
    obstacle: AccessibilityObstacle,
    distance: number,
    userProfile: UserMobilityProfile
  ): string {
    const distanceText = Math.round(distance);
    const obstacleType = this.getObstacleTypeInEnglish(obstacle.type);

    // Add user-specific guidance
    const guidance = this.getUserSpecificGuidance(obstacle, userProfile);

    return `${obstacleType} in ${distanceText} meters. ${guidance}`;
  }

  /**
   * FIXED: Generate user-specific guidance for each obstacle type
   * Added comprehensive coverage for ALL obstacle types
   */
  private getUserSpecificGuidance(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): string {
    const userType = userProfile.type;

    switch (obstacle.type) {
      case "stairs_no_ramp":
        if (userType === "wheelchair") {
          return "Find alternative route with ramp access.";
        }
        if (userType === "walker" || userType === "crutches") {
          return "Stairs ahead. Proceed with caution.";
        }
        return "Steps ahead.";

      case "vendor_blocking":
        if (userType === "wheelchair") {
          return "Path blocked by vendor. Look for alternative route.";
        }
        return "Blocked path ahead. Navigate around vendor.";

      case "parked_vehicles":
        if (userType === "wheelchair") {
          return "Parked vehicles blocking path. Find alternate route.";
        }
        return "Vehicles blocking sidewalk.";

      case "flooding":
        return "Path may be wet. Consider alternate route.";

      case "broken_pavement":
        if (userType === "wheelchair") {
          return "Damaged pavement ahead. May be difficult to navigate.";
        }
        if (userType === "walker" || userType === "crutches") {
          return "Uneven surface ahead. Use caution.";
        }
        return "Uneven surface ahead.";

      case "narrow_passage":
        if (userType === "wheelchair") {
          return "Narrow passage. May be too narrow for wheelchair.";
        }
        return "Narrow path ahead.";

      case "construction":
        return "Construction zone ahead. Proceed with caution.";

      case "electrical_post":
        return "Utility pole ahead. Navigate around carefully.";

      case "tree_roots":
        return "Uneven surface from tree roots. Use caution.";

      case "no_sidewalk":
        return "No sidewalk ahead. Find alternative route.";

      case "steep_slope":
        if (userType === "wheelchair") {
          return "Steep slope ahead. Consider alternative route.";
        }
        return "Steep incline ahead.";

      case "other":
        return "Obstacle detected. Navigate around carefully.";

      default:
        console.warn(`🔊 TTS: Unknown obstacle type: ${obstacle.type}`);
        return "Obstacle ahead. Proceed with caution.";
    }
  }

  /**
   * FIXED: Core speech function with enhanced error handling and logging
   */
  private async speak(text: string): Promise<void> {
    try {
      console.log(`🔊 TTS: Speaking: "${text}"`);
      this.isSpeaking = true;

      // 🔥 CRITICAL FIX: Use proper Promise handling for Speech.speak
      return new Promise((resolve, reject) => {
        Speech.speak(text, {
          language: "en-US",
          pitch: 1.0,
          rate: this.settings.rate,
          volume: this.settings.volume,
          onDone: () => {
            console.log("🔊 TTS: Speech completed successfully");
            this.isSpeaking = false;
            resolve();
          },
          onStopped: () => {
            console.log("🔊 TTS: Speech stopped");
            this.isSpeaking = false;
            resolve();
          },
          onError: (error) => {
            console.error("🔊 TTS: Speech error:", error);
            this.isSpeaking = false;
            reject(error);
          },
        });
      });
    } catch (error) {
      console.error("🔊 TTS: Speak failed:", error);
      this.isSpeaking = false;
      throw error;
    }
  }

  /**
   * FIXED: Check if obstacle is relevant for user's mobility type
   * Updated with comprehensive obstacle type coverage
   */
  private isObstacleRelevantForUser(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): boolean {
    // 🔥 FIX: ALL obstacles are relevant to ALL users for safety
    // But we can still provide user-specific guidance in the announcement
    const allObstacleTypes = [
      "stairs_no_ramp",
      "narrow_passage",
      "broken_pavement",
      "flooding",
      "construction",
      "vendor_blocking",
      "parked_vehicles",
      "electrical_post",
      "tree_roots",
      "no_sidewalk",
      "steep_slope",
      "other",
    ];

    // Always announce obstacles that could affect navigation
    return allObstacleTypes.includes(obstacle.type);
  }

  /**
   * FIXED: Convert obstacle type to readable English with comprehensive coverage
   */
  private getObstacleTypeInEnglish(type: string): string {
    const types: Record<string, string> = {
      stairs_no_ramp: "Stairs without ramp",
      narrow_passage: "Narrow passage",
      broken_pavement: "Broken pavement",
      flooding: "Flooding",
      construction: "Construction",
      vendor_blocking: "Blocked path",
      parked_vehicles: "Parked vehicles",
      electrical_post: "Utility pole",
      tree_roots: "Tree roots",
      no_sidewalk: "No sidewalk",
      steep_slope: "Steep slope",
      other: "Obstacle",
    };

    return types[type] || type.replace("_", " ");
  }

  /**
   * Toggle TTS on/off
   */
  toggleEnabled(): void {
    this.settings.enabled = !this.settings.enabled;
    console.log(`🔊 TTS ${this.settings.enabled ? "enabled" : "disabled"}`);

    // Stop current speech when disabling
    if (!this.settings.enabled && this.isSpeaking) {
      this.stopSpeaking();
    }
  }

  /**
   * Get current enabled status
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Stop current speech immediately
   */
  stopSpeaking(): void {
    try {
      Speech.stop();
      this.isSpeaking = false;
      console.log("🔊 TTS: Speech stopped");
    } catch (error) {
      console.error("🔊 TTS: Failed to stop speech:", error);
      this.isSpeaking = false;
    }
  }

  /**
   * Update TTS settings
   */
  updateSettings(newSettings: Partial<TTSSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log("🔊 TTS: Settings updated:", this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): TTSSettings {
    return { ...this.settings };
  }

  /**
   * Test TTS functionality with comprehensive obstacle types
   */
  async testTTS(): Promise<void> {
    await this.speak(
      "Text to speech is working correctly for WAISPATH navigation. Testing obstacle announcements."
    );
  }

  /**
   * 🧪 TESTING: Test specific obstacle announcement
   */
  async testObstacleAnnouncement(
    obstacleType: string,
    distance: number = 10
  ): Promise<void> {
    const mockObstacle = {
      id: "test_" + Date.now(),
      type: obstacleType,
      severity: "medium" as const,
      description: "Test obstacle",
      location: { latitude: 0, longitude: 0 },
    } as AccessibilityObstacle;

    const mockProfile = {
      type: "cane" as const,
      maxRampSlope: 8.3,
      minPathWidth: 0.9,
      avoidStairs: true,
      avoidCrowds: false,
      preferShade: false,
      maxWalkingDistance: 1000,
    } as UserMobilityProfile;

    console.log(`🧪 Testing TTS for ${obstacleType} at ${distance}m`);
    await this.announceProximityAlert(mockObstacle, distance, mockProfile);
  }
}

// Export singleton instance
export const textToSpeechService = new TextToSpeechService();
export type { TTSSettings };
