// src/services/textToSpeechService.ts
// COMPLETE FIXED: Queue-based TTS system - ensures all obstacles get announced

import * as Speech from "expo-speech";
import { AccessibilityObstacle, UserMobilityProfile } from "../types";

interface TTSSettings {
  enabled: boolean;
  rate: number;
  volume: number;
}

// Queue item interface for TypeScript
interface QueueItem {
  obstacle: AccessibilityObstacle;
  distance: number;
  userProfile: UserMobilityProfile;
  priority: number; // Lower number = higher priority
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

  // 🔥 NEW: TTS Queue system to ensure all obstacles get announced
  private announcementQueue: QueueItem[] = [];
  private isProcessingQueue = false;

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
   * ENHANCED: Main method - Queue-based announcement system
   * Ensures all critical obstacles get announced, prioritized by distance
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

      // Skip if not relevant for this user type
      if (!this.isObstacleRelevantForUser(obstacle, userProfile)) {
        console.log(
          `🔊 TTS: Obstacle ${obstacle.type} not relevant for ${userProfile.type}`
        );
        return;
      }

      // Prevent duplicate announcements for same obstacle
      const obstacleKey = `${obstacle.id}_${Math.floor(distance / 10) * 10}`;
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

      // 🔥 NEW: Add to queue instead of skipping
      const priority = distance < 3 ? 1 : distance < 10 ? 2 : 3; // Closer = higher priority

      // 🔥 REMOVED: No need to check alreadyQueued since we check above
      this.announcementQueue.push({
        obstacle,
        distance,
        userProfile,
        priority,
      });

      // Sort queue by priority (lower number = higher priority)
      this.announcementQueue.sort(
        (a: QueueItem, b: QueueItem) =>
          a.priority - b.priority || a.distance - b.distance
      );

      console.log(
        `🔊 TTS: Added ${obstacle.type} at ${distance}m to queue (priority ${priority})`
      );

      // Start processing queue
      this.processAnnouncementQueue();
    } catch (error) {
      console.error("🔊 TTS: announceProximityAlert failed:", error);
    }
  }

  /**
   * 🔥 NEW: Process the announcement queue
   */
  private async processAnnouncementQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.announcementQueue.length > 0) {
      // If currently speaking, wait for it to finish
      if (this.isSpeaking) {
        // For very urgent obstacles (< 3m), interrupt current speech
        const nextItem = this.announcementQueue[0];
        if (nextItem.distance < 3) {
          console.log(
            `🚨 URGENT: Interrupting TTS for obstacle at ${nextItem.distance}m`
          );
          this.stopSpeaking();
          await new Promise((resolve) => setTimeout(resolve, 200));
        } else {
          // Wait for current speech to finish
          await new Promise<void>((resolve) => {
            const checkSpeaking = () => {
              if (!this.isSpeaking) {
                resolve();
              } else {
                setTimeout(checkSpeaking, 100);
              }
            };
            checkSpeaking();
          });
        }
      }

      // Get next item from queue
      const item = this.announcementQueue.shift();
      if (!item) break;

      try {
        // Generate and speak announcement
        const announcement = this.generateSimplifiedAnnouncement(
          item.obstacle,
          item.distance
        );

        console.log(`🔊 TTS: Generated announcement: "${announcement}"`);
        await this.speak(announcement);

        // Track to prevent duplicates
        const obstacleKey = `${item.obstacle.id}_${
          Math.floor(item.distance / 10) * 10
        }`;
        this.lastAnnouncedObstacle = obstacleKey;
        this.lastAnnouncementTime = Date.now();

        console.log(
          `🔊 TTS: Announced obstacle ${item.obstacle.type} at ${item.distance}m`
        );

        // Small delay between announcements to prevent rushing
        if (this.announcementQueue.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error("🔊 TTS: Failed to announce queued obstacle:", error);
        // Continue with next item in queue
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 🔥 NEW: Simplified announcement generation - removes duplicate text
   * Just says obstacle type + distance, no extra descriptive text
   */
  private generateSimplifiedAnnouncement(
    obstacle: AccessibilityObstacle,
    distance: number
  ): string {
    const distanceText = Math.round(distance);
    const obstacleType = this.getObstacleTypeInEnglish(obstacle.type);

    // 🔥 SIMPLIFIED: Just obstacle and distance - user can see details on screen
    return `${obstacleType} in ${distanceText} meters ahead.`;
  }

  /**
   * FIXED: Core speech function with enhanced error handling and logging
   */
  private async speak(text: string): Promise<void> {
    try {
      console.log(`🔊 TTS: Speaking: "${text}"`);
      this.isSpeaking = true;

      // 🔥 CRITICAL FIX: Use proper Promise handling for Speech.speak
      return new Promise<void>((resolve, reject) => {
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
      vendor_blocking: "Vendors",
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

    // Stop current speech when disabling and clear queue
    if (!this.settings.enabled) {
      this.stopSpeaking();
      this.clearQueue();
    }
  }

  /**
   * Get current enabled status
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Stop current speech immediately and clear queue
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
   * 🔥 NEW: Clear the announcement queue
   */
  private clearQueue(): void {
    this.announcementQueue = [];
    this.isProcessingQueue = false;
    console.log("🔊 TTS: Queue cleared");
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
