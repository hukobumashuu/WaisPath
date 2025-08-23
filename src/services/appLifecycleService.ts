// src/services/appLifecycleService.ts
// CRITICAL: App lifecycle handler to ensure quota persistence
// Integrates with GoogleMapsService to flush quota on background/exit

import { AppState, AppStateStatus } from "react-native";
import { googleMapsService } from "./googleMapsService";

class AppLifecycleService {
  private isInitialized = false;
  private currentAppState: AppStateStatus = AppState.currentState;
  private subscription?: { remove: () => void } | null = null;

  /**
   * Initialize app state monitoring
   * Call this once in your App.tsx or main component
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn("⚠️ AppLifecycleService already initialized");
      return;
    }

    console.log("🔄 Initializing app lifecycle monitoring...");

    // CRITICAL FIX: Use modern AppState subscription API
    this.subscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );
    this.isInitialized = true;

    console.log("✅ App lifecycle monitoring active");
  }

  /**
   * Cleanup - call this if you need to remove listeners
   */
  cleanup(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = undefined;
    }
    this.isInitialized = false;
    console.log("🗑️ App lifecycle monitoring stopped");
  }

  /**
   * Handle app state transitions
   */
  private handleAppStateChange = async (
    nextAppState: AppStateStatus
  ): Promise<void> => {
    console.log(`📱 App state: ${this.currentAppState} → ${nextAppState}`);

    // When app goes to background or becomes inactive, flush quota immediately
    if (
      this.currentAppState === "active" &&
      (nextAppState === "background" || nextAppState === "inactive")
    ) {
      console.log("💾 App backgrounding - flushing quota state...");

      try {
        await googleMapsService.flushQuota();
        console.log("✅ Quota state flushed successfully before background");
      } catch (error) {
        console.error("❌ Failed to flush quota state:", error);
      }
    }

    // When app becomes active, ensure GoogleMaps service is ready
    if (nextAppState === "active" && this.currentAppState !== "active") {
      console.log("🚀 App foregrounding - ensuring GoogleMaps ready...");

      try {
        await googleMapsService.ensureReady();
        const stats = googleMapsService.getQuotaStats();
        console.log("📊 GoogleMaps ready. Quota:", stats);
      } catch (error) {
        console.error(
          "❌ Failed to initialize GoogleMaps on foreground:",
          error
        );
      }
    }

    this.currentAppState = nextAppState;
  };

  /**
   * Force immediate quota flush (for manual testing/emergency)
   */
  async forceFlushQuota(): Promise<void> {
    console.log("🔄 Manually flushing quota state...");
    try {
      await googleMapsService.flushQuota();
      console.log("✅ Manual quota flush completed");
    } catch (error) {
      console.error("❌ Manual quota flush failed:", error);
      throw error;
    }
  }

  /**
   * Get current app state (useful for debugging)
   */
  getCurrentState(): AppStateStatus {
    return this.currentAppState;
  }

  /**
   * Check if lifecycle monitoring is active
   */
  isActive(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const appLifecycleService = new AppLifecycleService();

// Export for use in App.tsx
export default appLifecycleService;
