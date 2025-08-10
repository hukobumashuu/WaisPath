// src/services/routeFeedbackService.ts
// Post-journey feedback system for continuous AHP improvement

import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseServices } from './firebase';
import { routeAnalysisService } from './routeAnalysisService';
import {
  RouteJourney,
  RouteFeedback,
  UserLocation,
  UserMobilityProfile,
  AccessibilityScore,
  EncounteredObstacle,
  DeviceSpecificFeedback,
  RouteConfidence,
} from '../types';

class RouteFeedbackService {
  private activeJourney: RouteJourney | null = null;
  private feedbackCallbacks: ((journey: RouteJourney) => void)[] = [];

  /**
   * Start tracking a new journey
   */
  async startJourney(
    userId: string,
    routeId: string,
    routeType: "fastest" | "accessible",
    startLocation: UserLocation,
    destinationLocation: UserLocation,
    estimatedDuration: number,
    accessibilityScore: AccessibilityScore
  ): Promise<string> {
    const journeyId = `journey_${Date.now()}_${userId}`;
    
    this.activeJourney = {
      id: journeyId,
      userId,
      startedAt: new Date(),
      status: "active",
      selectedRoute: {
        routeId,
        routeType,
        estimatedDuration,
        accessibilityScore,
      },
      startLocation,
      destinationLocation,
      distanceFromDestination: this.calculateDistance(startLocation, destinationLocation),
      completionTriggered: false,
      feedbackSubmitted: false,
    };

    // Save journey to local storage
    await this.saveJourneyToStorage(this.activeJourney);
    
    console.log(`🚀 Started journey tracking: ${journeyId}`);
    return journeyId;
  }

  /**
   * Update current location and check for completion
   */
  async updateLocation(currentLocation: UserLocation): Promise<boolean> {
    if (!this.activeJourney || this.activeJourney.status !== "active") {
      return false;
    }

    this.activeJourney.currentLocation = currentLocation;
    this.activeJourney.distanceFromDestination = this.calculateDistance(
      currentLocation, 
      this.activeJourney.destinationLocation
    );

    // Check for journey completion (within 50 meters of destination)
    const isCompleted = this.activeJourney.distanceFromDestination <= 50;
    
    if (isCompleted && !this.activeJourney.completionTriggered) {
      await this.triggerJourneyCompletion();
      return true;
    }

    // Update stored journey
    await this.saveJourneyToStorage(this.activeJourney);
    return false;
  }

  /**
   * Manually mark journey as completed
   */
  async completeJourney(): Promise<boolean> {
    if (!this.activeJourney || this.activeJourney.status !== "active") {
      return false;
    }

    await this.triggerJourneyCompletion();
    return true;
  }

  /**
   * Handle journey completion
   */
  private async triggerJourneyCompletion(): Promise<void> {
    if (!this.activeJourney) return;

    this.activeJourney.completedAt = new Date();
    this.activeJourney.status = "completed";
    this.activeJourney.completionTriggered = true;

    await this.saveJourneyToStorage(this.activeJourney);

    // Notify listeners (UI components) to show feedback modal
    this.feedbackCallbacks.forEach(callback => callback(this.activeJourney!));
    
    console.log(`✅ Journey completed: ${this.activeJourney.id}`);
  }

  /**
   * Submit feedback for completed journey
   */
  async submitFeedback(
    traversabilityRating: number,
    safetyRating: number,
    comfortRating: number,
    overallExperience: "excellent" | "good" | "acceptable" | "difficult" | "impossible",
    wouldRecommend: boolean,
    comments: string,
    userProfile: UserMobilityProfile,
    obstaclesEncountered: EncounteredObstacle[] = [],
    deviceSpecificFeedback?: DeviceSpecificFeedback
  ): Promise<void> {
    if (!this.activeJourney || this.activeJourney.status !== "completed") {
      throw new Error("No completed journey available for feedback");
    }

    const actualDuration = this.activeJourney.completedAt && this.activeJourney.startedAt
      ? Math.round((this.activeJourney.completedAt.getTime() - this.activeJourney.startedAt.getTime()) / (1000 * 60))
      : 0;

    const feedback: RouteFeedback = {
      id: `feedback_${Date.now()}_${this.activeJourney.userId}`,
      routeId: this.activeJourney.selectedRoute.routeId,
      userId: this.activeJourney.userId,
      userProfile,
      completedAt: this.activeJourney.completedAt!,
      
      // Ratings
      traversabilityRating,
      safetyRating,
      comfortRating,
      
      // Experience
      overallExperience,
      wouldRecommend,
      comments,
      
      // Route data
      routeStartLocation: this.activeJourney.startLocation,
      routeEndLocation: this.activeJourney.destinationLocation,
      actualDuration,
      estimatedDuration: this.activeJourney.selectedRoute.estimatedDuration,
      routeType: this.activeJourney.selectedRoute.routeType,
      
      // Obstacles
      obstaclesEncountered,
      newObstaclesReported: [], // Will be populated if user reports new obstacles
      
      // Confidence contribution
      confidenceContribution: this.calculateConfidenceContribution(
        traversabilityRating,
        safetyRating, 
        comfortRating,
        overallExperience
      ),
      
      deviceSpecificInsights: deviceSpecificFeedback || this.generateDeviceSpecificFeedback(
        userProfile.type,
        obstaclesEncountered
      ),
    };

    try {
      // Save to Firebase
      await this.saveFeedbackToFirebase(feedback);
      
      // Update journey status
      this.activeJourney.feedbackSubmitted = true;
      await this.saveJourneyToStorage(this.activeJourney);
      
      // Process feedback to improve future recommendations
      await this.processFeedbackForAHPImprovement(feedback);
      
      console.log(`📝 Feedback submitted: ${feedback.id}`);
      
      // Clear active journey
      this.activeJourney = null;
      
    } catch (error) {
      console.error("❌ Failed to submit feedback:", error);
      throw error;
    }
  }

  /**
   * Register callback for journey completion
   */
  onJourneyCompleted(callback: (journey: RouteJourney) => void): void {
    this.feedbackCallbacks.push(callback);
  }

  /**
   * Remove callback
   */
  removeJourneyCompletedCallback(callback: (journey: RouteJourney) => void): void {
    const index = this.feedbackCallbacks.indexOf(callback);
    if (index > -1) {
      this.feedbackCallbacks.splice(index, 1);
    }
  }

  /**
   * Get current active journey
   */
  getActiveJourney(): RouteJourney | null {
    return this.activeJourney;
  }

  /**
   * Calculate confidence contribution based on feedback quality
   */
  private calculateConfidenceContribution(
    traversabilityRating: number,
    safetyRating: number,
    comfortRating: number,
    overallExperience: string
  ): number {
    // Base contribution based on rating quality
    const avgRating = (traversabilityRating + safetyRating + comfortRating) / 3;
    let contribution = 10; // Base contribution

    // Bonus for detailed ratings
    if (avgRating >= 4) contribution += 5; // High satisfaction
    if (avgRating <= 2) contribution += 8; // Important negative feedback

    // Experience bonus
    const experienceBonus = {
      excellent: 8,
      good: 6,
      acceptable: 4,
      difficult: 7, // Valuable for identifying problems
      impossible: 10 // Critical feedback
    };
    
    contribution += experienceBonus[overallExperience as keyof typeof experienceBonus] || 0;

    return Math.min(contribution, 25); // Cap at 25 points
  }

  /**
   * Generate device-specific insights from obstacles encountered
   */
  private generateDeviceSpecificFeedback(
    deviceType: string,
    obstaclesEncountered: EncounteredObstacle[]
  ): DeviceSpecificFeedback {
    const deviceSpecificChallenges: Record<string, string[]> = {
      wheelchair: ["curb access", "narrow doorways", "steep inclines", "surface roughness"],
      walker: ["step navigation", "handrail availability", "rest areas", "uneven surfaces"],
      crutches: ["balance challenges", "arm fatigue", "slippery surfaces", "distance management"],
      cane: ["ground detection", "stability needs", "lighting conditions", "tactile guidance"],
      none: ["general mobility", "crowd navigation", "time constraints", "weather impact"]
    };

    return {
      deviceType: deviceType as any,
      specificChallenges: deviceSpecificChallenges[deviceType] || [],
      adaptationsUsed: [], // Would be populated from user input
      recommendedImprovements: [], // Would be populated from user input
    };
  }

  /**
   * Process feedback to improve AHP algorithm
   */
  private async processFeedbackForAHPImprovement(feedback: RouteFeedback): Promise<void> {
    try {
      console.log(`🔄 Processing feedback for AHP improvement:`, {
        routeType: feedback.routeType,
        deviceType: feedback.userProfile.type,
        traversability: feedback.traversabilityRating,
        safety: feedback.safetyRating,
        comfort: feedback.comfortRating,
        experience: feedback.overallExperience,
        confidenceBoost: feedback.confidenceContribution
      });
      
      // Integrate feedback into AHP algorithm
      await routeAnalysisService.integrateFeedbackIntoAHP(feedback);
      
      // Update route confidence scores based on real-world validation
      await this.updateRouteConfidenceFromFeedback(feedback);
      
      // Log learning progress
      console.log("📚 AHP Learning Update:", {
        feedbackId: feedback.id,
        contributionScore: feedback.confidenceContribution,
        deviceType: feedback.userProfile.type,
        experienceLevel: feedback.overallExperience,
        wouldRecommend: feedback.wouldRecommend
      });
      
    } catch (error) {
      console.error("⚠️ Error processing feedback for AHP improvement:", error);
    }
  }

  /**
   * Update route confidence based on user feedback
   */
  private async updateRouteConfidenceFromFeedback(feedback: RouteFeedback): Promise<void> {
    // This would query existing routes and update their confidence scores
    // based on the validated real-world feedback
    
    const confidenceUpdate = {
      routeId: feedback.routeId,
      feedbackId: feedback.id,
      deviceType: feedback.userProfile.type,
      validationBoost: feedback.confidenceContribution,
      lastValidated: feedback.completedAt,
      userExperience: feedback.overallExperience,
      accuracyRating: (feedback.traversabilityRating + feedback.safetyRating + feedback.comfortRating) / 3,
    };

    console.log("📈 Route confidence update:", confidenceUpdate);
    
    // In a real implementation, this would:
    // 1. Find routes that match this feedback
    // 2. Update their confidence scores
    // 3. Adjust AHP weights based on prediction accuracy
    // 4. Store validation data for future route calculations
  }

  /**
   * Calculate distance between two points (simplified)
   */
  private calculateDistance(point1: UserLocation, point2: UserLocation): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI/180;
    const φ2 = point2.latitude * Math.PI/180;
    const Δφ = (point2.latitude-point1.latitude) * Math.PI/180;
    const Δλ = (point2.longitude-point1.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Save journey to local storage
   */
  private async saveJourneyToStorage(journey: RouteJourney): Promise<void> {
    try {
      await AsyncStorage.setItem(`journey_${journey.id}`, JSON.stringify(journey));
    } catch (error) {
      console.error("Error saving journey to storage:", error);
    }
  }

  /**
   * Save feedback to Firebase
   */
  private async saveFeedbackToFirebase(feedback: RouteFeedback): Promise<void> {
    try {
      // Using Firebase services to save feedback
      // This would be implemented based on your Firebase setup
      console.log("💾 Saving feedback to Firebase:", feedback.id);
      
      // Example implementation:
      // await firebaseServices.feedback.addFeedback(feedback);
      
    } catch (error) {
      console.error("Error saving feedback to Firebase:", error);
      throw error;
    }
  }

  /**
   * Load journey from storage (for app restart scenarios)
   */
  async loadActiveJourney(userId: string): Promise<RouteJourney | null> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const journeyKeys = keys.filter(key => key.startsWith('journey_') && key.includes(userId));
      
      for (const key of journeyKeys) {
        const journeyData = await AsyncStorage.getItem(key);
        if (journeyData) {
          const journey: RouteJourney = JSON.parse(journeyData);
          if (journey.status === "active") {
            this.activeJourney = journey;
            return journey;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error loading active journey:", error);
      return null;
    }
  }
}

export const routeFeedbackService = new RouteFeedbackService();
export type { RouteFeedback, RouteJourney, EncounteredObstacle, DeviceSpecificFeedback };