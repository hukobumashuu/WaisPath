// src/services/textToSpeechService.ts
// 🔥 COMPLETE FIX: Multi-obstacle tracking with distance-based expiration

import * as Speech from "expo-speech";
import {
  AccessibilityObstacle,
  UserMobilityProfile,
  UserLocation,
} from "../types";

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
  queuedAt: number; // Timestamp when added to queue
}

// 🔥 NEW: Track multiple obstacles with timestamps and locations
interface AnnouncedObstacle {
  obstacleId: string;
  announcedAt: number;
  announcedDistance: number;
  location: { latitude: number; longitude: number };
}

class TextToSpeechService {
  private settings: TTSSettings = {
    enabled: true, // Default enabled for accessibility
    rate: 0.6, // Slightly slower for better comprehension
    volume: 1.0, // Loud enough but not overwhelming
  };

  private isSpeaking = false;

  // 🔥 REPLACED: Single obstacle tracking with multi-obstacle Map
  private recentlyAnnouncedObstacles = new Map<string, AnnouncedObstacle>();

  // 🔥 NEW: More granular timing controls
  private readonly OBSTACLE_COOLDOWN_TIME = 12000; // 5 seconds between same obstacle
  private readonly DISTANCE_MOVEMENT_THRESHOLD = 15; // 15 meters movement resets announcements
  private readonly MAX_TRACKED_OBSTACLES = 50; // Prevent memory leaks

  // TTS Queue system
  private announcementQueue: QueueItem[] = [];
  private isProcessingQueue = false;

  // 🔥 NEW: Track user location for distance-based expiration
  private lastUserLocation: UserLocation | null = null;

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
   * 🔥 NEW: Update user location for distance-based obstacle expiration
   */
  updateUserLocation(location: UserLocation): void {
    const previousLocation = this.lastUserLocation;
    this.lastUserLocation = location;

    // If user moved significantly, clean up distant obstacle tracking
    if (previousLocation) {
      const distanceMoved = this.calculateDistance(previousLocation, location);
      if (distanceMoved > this.DISTANCE_MOVEMENT_THRESHOLD) {
        this.cleanupDistantObstacles(location);
      }
    }

    // Periodic cleanup to prevent memory leaks
    this.cleanupExpiredObstacles();
  }

  /**
   * 🔥 ENHANCED: Main method with improved duplicate detection
   * Now supports multiple obstacles with individual tracking
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

      // 🔥 IMPROVED: More specific duplicate detection with individual obstacle tracking
      if (this.isDuplicateAnnouncement(obstacle, distance)) {
        console.log(
          `🔊 TTS: Skipping duplicate announcement for ${obstacle.type} (${obstacle.id})`
        );
        return;
      }

      // 🔥 IMPROVED: Priority calculation with urgency factors
      const priority = this.calculateAnnouncementPriority(
        distance,
        obstacle.severity
      );

      // 🔥 IMPROVED: Check if already in queue to prevent queue duplicates
      const alreadyQueued = this.announcementQueue.some(
        (item) => item.obstacle.id === obstacle.id
      );

      if (alreadyQueued) {
        console.log(
          `🔊 TTS: Obstacle ${obstacle.type} already in queue, updating priority if needed`
        );
        this.updateQueuePriority(obstacle.id, priority, distance);
        return;
      }

      // Add to queue
      this.announcementQueue.push({
        obstacle,
        distance,
        userProfile,
        priority,
        queuedAt: Date.now(),
      });

      // 🔥 IMPROVED: Sort queue by priority AND distance
      this.announcementQueue.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.distance - b.distance; // Closer obstacles first within same priority
      });

      console.log(
        `🔊 TTS: Added ${obstacle.type} at ${distance}m to queue (priority ${priority})`
      );

      // Start processing queue if not already processing
      this.processAnnouncementQueue();
    } catch (error) {
      console.error("🔊 TTS: announceProximityAlert failed:", error);
    }
  }

  /**
   * 🔥 NEW: Improved duplicate detection with individual obstacle tracking
   */
  private isDuplicateAnnouncement(
    obstacle: AccessibilityObstacle,
    currentDistance: number
  ): boolean {
    const recentAnnouncement = this.recentlyAnnouncedObstacles.get(obstacle.id);

    if (!recentAnnouncement) {
      return false; // Not announced before
    }

    const now = Date.now();
    const timeSinceAnnouncement = now - recentAnnouncement.announcedAt;

    // Allow re-announcement if enough time has passed
    if (timeSinceAnnouncement > this.OBSTACLE_COOLDOWN_TIME) {
      return false;
    }

    // Allow re-announcement if user got significantly closer to the obstacle
    const distanceChange = Math.abs(
      currentDistance - recentAnnouncement.announcedDistance
    );
    if (distanceChange > 10) {
      // More than 10 meters change
      return false;
    }

    return true; // Is duplicate
  }

  /**
   * 🔥 NEW: Calculate announcement priority based on distance and severity
   */
  private calculateAnnouncementPriority(
    distance: number,
    severity: AccessibilityObstacle["severity"]
  ): number {
    let priority = 3; // Default priority

    // Distance-based priority (closer = higher priority = lower number)
    if (distance < 3) priority = 1; // Immediate danger
    else if (distance < 8) priority = 2; // High priority
    else if (distance < 20) priority = 3; // Medium priority
    else priority = 4; // Low priority

    // Severity adjustment
    if (severity === "blocking") priority = Math.max(1, priority - 1);
    else if (severity === "high") priority = Math.max(1, priority);
    else if (severity === "low") priority = Math.min(4, priority + 1);

    return priority;
  }

  /**
   * 🔥 NEW: Update existing queue item priority if needed
   */
  private updateQueuePriority(
    obstacleId: string,
    newPriority: number,
    newDistance: number
  ): void {
    const existingIndex = this.announcementQueue.findIndex(
      (item) => item.obstacle.id === obstacleId
    );

    if (existingIndex !== -1) {
      const existingItem = this.announcementQueue[existingIndex];

      // Update if new priority is higher (lower number) or distance is closer
      if (
        newPriority < existingItem.priority ||
        newDistance < existingItem.distance
      ) {
        existingItem.priority = newPriority;
        existingItem.distance = newDistance;

        // Re-sort queue
        this.announcementQueue.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.distance - b.distance;
        });

        console.log(
          `🔊 TTS: Updated queue priority for ${existingItem.obstacle.type} to ${newPriority}`
        );
      }
    }
  }

  /**
   * 🔥 ENHANCED: Process the announcement queue with better error handling
   */
  private async processAnnouncementQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(
      `🔊 TTS: Processing queue with ${this.announcementQueue.length} items`
    );

    while (this.announcementQueue.length > 0) {
      // 🔥 IMPROVED: Handle interruptions for urgent obstacles
      const nextItem = this.announcementQueue[0];

      // If currently speaking and next item is urgent, interrupt
      if (this.isSpeaking && nextItem.priority === 1) {
        console.log(
          `🚨 URGENT: Interrupting TTS for ${nextItem.obstacle.type} at ${nextItem.distance}m`
        );
        this.stopSpeaking();
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else if (this.isSpeaking) {
        // Wait for current speech to finish for non-urgent items
        await this.waitForSpeechToComplete();
      }

      // Get next item from queue
      const item = this.announcementQueue.shift();
      if (!item) break;

      try {
        // 🔥 IMPROVED: Check if item is still relevant (not too old)
        const itemAge = Date.now() - item.queuedAt;
        if (itemAge > 30000) {
          // 30 seconds old
          console.log(
            `🔊 TTS: Skipping stale queue item for ${item.obstacle.type} (${itemAge}ms old)`
          );
          continue;
        }

        // Generate and speak announcement
        const announcement = this.generateSimplifiedAnnouncement(
          item.obstacle,
          item.distance
        );

        console.log(`🔊 TTS: Generated announcement: "${announcement}"`);
        await this.speak(announcement);

        // 🔥 IMPROVED: Track announcement with location and distance
        this.trackAnnouncedObstacle(item.obstacle, item.distance);

        console.log(
          `🔊 TTS: Successfully announced ${item.obstacle.type} at ${item.distance}m`
        );

        // Small delay between announcements to prevent rushing
        if (this.announcementQueue.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error("🔊 TTS: Failed to announce queued obstacle:", error);
        // Continue with next item in queue
      }
    }

    this.isProcessingQueue = false;
    console.log("🔊 TTS: Queue processing completed");
  }

  /**
   * 🔥 NEW: Track announced obstacle with improved data structure
   */
  private trackAnnouncedObstacle(
    obstacle: AccessibilityObstacle,
    distance: number
  ): void {
    this.recentlyAnnouncedObstacles.set(obstacle.id, {
      obstacleId: obstacle.id,
      announcedAt: Date.now(),
      announcedDistance: distance,
      location: obstacle.location,
    });

    // Prevent memory leaks by limiting tracked obstacles
    if (this.recentlyAnnouncedObstacles.size > this.MAX_TRACKED_OBSTACLES) {
      this.cleanupOldestTrackedObstacles();
    }
  }

  /**
   * 🔥 NEW: Clean up obstacles that are too far from current user location
   */
  private cleanupDistantObstacles(userLocation: UserLocation): void {
    const distantObstacles: string[] = [];

    this.recentlyAnnouncedObstacles.forEach((announced, obstacleId) => {
      const obstacleDistance = this.calculateDistance(
        userLocation,
        announced.location
      );

      // Remove tracking for obstacles more than 100m away
      if (obstacleDistance > 100) {
        distantObstacles.push(obstacleId);
      }
    });

    distantObstacles.forEach((id) => {
      this.recentlyAnnouncedObstacles.delete(id);
    });

    if (distantObstacles.length > 0) {
      console.log(
        `🔊 TTS: Cleaned up ${distantObstacles.length} distant obstacle trackings`
      );
    }
  }

  /**
   * 🔥 NEW: Clean up expired obstacle announcements
   */
  private cleanupExpiredObstacles(): void {
    const now = Date.now();
    const expiredObstacles: string[] = [];

    this.recentlyAnnouncedObstacles.forEach((announced, obstacleId) => {
      const age = now - announced.announcedAt;

      // Remove tracking for obstacles announced more than 2 minutes ago
      if (age > 120000) {
        expiredObstacles.push(obstacleId);
      }
    });

    expiredObstacles.forEach((id) => {
      this.recentlyAnnouncedObstacles.delete(id);
    });

    if (expiredObstacles.length > 0) {
      console.log(
        `🔊 TTS: Cleaned up ${expiredObstacles.length} expired obstacle trackings`
      );
    }
  }

  /**
   * 🔥 NEW: Clean up oldest tracked obstacles to prevent memory leaks
   */
  private cleanupOldestTrackedObstacles(): void {
    const entries = Array.from(this.recentlyAnnouncedObstacles.entries());
    entries.sort((a, b) => a[1].announcedAt - b[1].announcedAt);

    // Remove oldest 10 entries
    const toRemove = entries.slice(0, 10);
    toRemove.forEach(([id]) => {
      this.recentlyAnnouncedObstacles.delete(id);
    });

    console.log(
      `🔊 TTS: Cleaned up ${toRemove.length} oldest obstacle trackings`
    );
  }

  /**
   * 🔥 NEW: Calculate distance between two geographical points
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * 🔥 NEW: Wait for current speech to complete
   */
  private async waitForSpeechToComplete(): Promise<void> {
    return new Promise<void>((resolve) => {
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

  /**
   * Simplified announcement generation
   */
  private generateSimplifiedAnnouncement(
    obstacle: AccessibilityObstacle,
    distance: number
  ): string {
    const distanceText = Math.round(distance);
    const obstacleType = this.getObstacleTypeInEnglish(obstacle.type);

    return `${obstacleType} in ${distanceText} meters ahead.`;
  }

  /**
   * Core speech function with enhanced error handling
   */
  private async speak(text: string): Promise<void> {
    try {
      console.log(`🔊 TTS: Speaking: "${text}"`);
      this.isSpeaking = true;

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
   * Check if obstacle is relevant for user's mobility type
   */
  private isObstacleRelevantForUser(
    obstacle: AccessibilityObstacle,
    userProfile: UserMobilityProfile
  ): boolean {
    // All obstacles are relevant to all users for safety
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

    return allObstacleTypes.includes(obstacle.type);
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
   * Clear the announcement queue and tracking
   */
  private clearQueue(): void {
    this.announcementQueue = [];
    this.isProcessingQueue = false;
    this.recentlyAnnouncedObstacles.clear();
    console.log("🔊 TTS: Queue and tracking cleared");
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
   * 🔥 NEW: Debug method to get current tracking state
   */
  getDebugInfo(): {
    queueLength: number;
    trackedObstacles: number;
    isProcessing: boolean;
    isSpeaking: boolean;
  } {
    return {
      queueLength: this.announcementQueue.length,
      trackedObstacles: this.recentlyAnnouncedObstacles.size,
      isProcessing: this.isProcessingQueue,
      isSpeaking: this.isSpeaking,
    };
  }

  /**
   * Test TTS functionality
   */
  async testTTS(): Promise<void> {
    await this.speak(
      "Text to speech is working correctly for WAISPATH navigation."
    );
  }

  /**
   * Test specific obstacle announcement
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
