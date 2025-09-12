// src/services/textToSpeechService.ts
// Text-to-Speech service for WAISPATH obstacle announcements

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
   * Main method: Announce proximity alert for obstacles ahead
   */
  async announceProximityAlert(
    obstacle: AccessibilityObstacle,
    distance: number,
    userProfile: UserMobilityProfile
  ): Promise<void> {
    // Skip if TTS is disabled
    if (!this.settings.enabled) return;

    // Skip if already speaking
    if (this.isSpeaking) return;

    // Skip if not relevant for this user type
    if (!this.isObstacleRelevantForUser(obstacle, userProfile)) return;

    // Prevent duplicate announcements for same obstacle
    const obstacleKey = `${obstacle.id}_${Math.floor(distance / 10) * 10}`; // Group by 10m intervals
    const now = Date.now();

    if (
      this.lastAnnouncedObstacle === obstacleKey &&
      now - this.lastAnnouncementTime < this.MIN_ANNOUNCEMENT_INTERVAL
    ) {
      return;
    }

    // Generate and speak announcement
    const announcement = this.generateAnnouncement(
      obstacle,
      distance,
      userProfile
    );
    await this.speak(announcement);

    // Track to prevent duplicates
    this.lastAnnouncedObstacle = obstacleKey;
    this.lastAnnouncementTime = now;
  }

  /**
   * Generate contextual announcement based on obstacle and user profile
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
   * Get user-specific guidance for different obstacle types
   */
  private getUserSpecificGuidance(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): string {
    switch (obstacle.type) {
      case "stairs_no_ramp":
        if (userProfile.type === "wheelchair") {
          return "Look for alternative path.";
        }
        return "Use caution.";

      case "flooding":
        return "Path may be wet.";

      case "broken_pavement":
        return "Uneven surface ahead.";

      case "narrow_passage":
        if (userProfile.type === "wheelchair") {
          return "May be too narrow for wheelchair.";
        }
        return "Narrow path ahead.";

      case "construction":
        return "Construction zone ahead.";

      default:
        return "Proceed with caution.";
    }
  }

  /**
   * Core speech function with error handling
   */
  private async speak(text: string): Promise<void> {
    try {
      console.log(`🔊 TTS: Speaking: "${text}"`);
      this.isSpeaking = true;

      await Speech.speak(text, {
        language: "en-US",
        pitch: 1.0,
        rate: this.settings.rate,
        volume: this.settings.volume,
        onDone: () => {
          this.isSpeaking = false;
        },
        onStopped: () => {
          this.isSpeaking = false;
        },
        onError: (error) => {
          console.error("🔊 TTS: Speech error:", error);
          this.isSpeaking = false;
        },
      });
    } catch (error) {
      console.error("🔊 TTS: Speak failed:", error);
      this.isSpeaking = false;
    }
  }

  /**
   * Check if obstacle is relevant for user's mobility type
   * Uses same logic as your existing proximity detection
   */
  private isObstacleRelevantForUser(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): boolean {
    const relevantObstacles: Record<string, string[]> = {
      wheelchair: [
        "stairs_no_ramp",
        "narrow_passage",
        "broken_pavement",
        "flooding",
        "parked_vehicles",
        "construction",
      ],
      walker: [
        "stairs_no_ramp",
        "narrow_passage",
        "broken_pavement",
        "flooding",
        "construction",
      ],
      crutches: [
        "broken_pavement",
        "flooding",
        "narrow_passage",
        "stairs_no_ramp",
      ],
      cane: ["broken_pavement", "flooding", "stairs_no_ramp"],
      none: ["flooding", "construction"],
    };

    return (
      relevantObstacles[userProfile.type]?.includes(obstacle.type) || false
    );
  }

  /**
   * Convert obstacle type to readable English
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
    Speech.stop();
    this.isSpeaking = false;
    console.log("🔊 TTS: Speech stopped");
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
   * Test TTS functionality
   */
  async testTTS(): Promise<void> {
    await this.speak(
      "Text to speech is working correctly for WAISPATH navigation."
    );
  }
}

// Export singleton instance
export const textToSpeechService = new TextToSpeechService();
export type { TTSSettings };
