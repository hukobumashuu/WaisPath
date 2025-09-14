// src/services/adminStatusChecker.ts
// NEW: Lightweight periodic status checker for mobile admin users
// Implements server-side enforcement without conflicting with existing auth system

import { Alert } from "react-native";

interface AdminStatusResponse {
  status:
    | "active"
    | "deactivated"
    | "suspended"
    | "not_admin"
    | "error"
    | "invalid";
  message: string;
  adminId?: string;
  role?: string;
  lastUpdated?: string;
}

class AdminStatusChecker {
  private checkInterval: NodeJS.Timeout | null = null;
  private isAdmin = false;
  private userEmail: string | null = null;
  private isChecking = false;
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MIN_CHECK_INTERVAL = 5000; // Minimum 5 seconds between checks

  /**
   * Start monitoring admin status for the current user
   */
  public startMonitoring(userEmail: string, isAdmin: boolean): void {
    if (!isAdmin) {
      console.log("👤 User is not admin, skipping status monitoring");
      return;
    }

    console.log(`🔍 Starting admin status monitoring for: ${userEmail}`);

    this.userEmail = userEmail;
    this.isAdmin = isAdmin;

    // Clear any existing interval
    this.stopMonitoring();

    // Perform initial check after 5 seconds (allow time for login to complete)
    setTimeout(() => {
      this.performStatusCheck();
    }, 5000);

    // Set up periodic checking
    this.checkInterval = setInterval(() => {
      this.performStatusCheck();
    }, this.CHECK_INTERVAL);

    console.log(
      `✅ Admin status monitoring started (${
        this.CHECK_INTERVAL / 1000
      }s interval)`
    );
  }

  /**
   * Perform a single status check
   */
  private async performStatusCheck(): Promise<void> {
    if (!this.userEmail || !this.isAdmin) {
      return;
    }

    // Prevent concurrent checks
    if (this.isChecking) {
      console.log("⏳ Status check already in progress, skipping");
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastCheckTime < this.MIN_CHECK_INTERVAL) {
      console.log("⏱️ Rate limiting status check");
      return;
    }

    this.isChecking = true;
    this.lastCheckTime = now;

    try {
      console.log(`🔍 Checking admin status for: ${this.userEmail}`);

      const response = await fetch("/api/admin/verify-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: this.userEmail }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: AdminStatusResponse = await response.json();

      console.log(`📊 Status check result:`, {
        email: this.userEmail,
        status: result.status,
        message: result.message,
      });

      // Handle status changes that require action
      if (result.status === "deactivated" || result.status === "suspended") {
        console.log(`🚨 Account ${result.status}, triggering signout`);
        this.handleAccountDeactivated(result.status, result.message);
      } else if (result.status === "not_admin") {
        console.log("🚨 User no longer admin, triggering signout");
        this.handleAccountDeactivated(
          "deactivated",
          "Admin privileges have been removed."
        );
      } else if (result.status === "active") {
        console.log("✅ Account status verified as active");
      }
    } catch (error) {
      console.warn("⚠️ Status check failed:", error);
      // Don't sign out on network errors - could be temporary
      // Log for debugging but continue operation
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Handle account deactivation/suspension
   */
  private handleAccountDeactivated(status: string, message: string): void {
    // Stop monitoring immediately
    this.stopMonitoring();

    // Show alert to user
    Alert.alert(
      "Account Status Changed",
      message,
      [
        {
          text: "OK",
          onPress: () => this.performSignout(),
          style: "default",
        },
      ],
      { cancelable: false }
    );
  }

  /**
   * Perform signout - integrates with existing auth system
   */
  private async performSignout(): Promise<void> {
    try {
      console.log("🔄 Performing admin signout due to status change");

      // Import signout function dynamically to avoid circular dependencies
      const { clearAuthState } = await import("./SimpleAuthPersistence");
      const { clearAuthCache } = await import("./enhancedFirebase");
      const { refreshAuthState } = await import("./AuthStateCoordinator");
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );

      // Clear auth state persistence
      await clearAuthState();

      // Clear cache
      clearAuthCache();

      // Sign out from Firebase
      const auth = await getUnifiedFirebaseAuth();
      const { signOut } = await import("firebase/auth");
      await signOut(auth);

      console.log("✅ Admin signout completed");

      // Refresh auth state to update UI
      await refreshAuthState();
    } catch (error) {
      console.error("❌ Signout failed:", error);
      // Even if signout fails, stop monitoring to prevent loops
    }
  }

  /**
   * Stop monitoring admin status
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isAdmin = false;
    this.userEmail = null;
    this.isChecking = false;

    console.log("🛑 Admin status monitoring stopped");
  }

  /**
   * Perform a manual status check (for testing or manual refresh)
   */
  public async manualCheck(): Promise<AdminStatusResponse | null> {
    if (!this.userEmail || !this.isAdmin) {
      console.warn("Cannot perform manual check: no admin user");
      return null;
    }

    try {
      const response = await fetch("/api/admin/verify-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: this.userEmail }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: AdminStatusResponse = await response.json();
      console.log("🔍 Manual status check result:", result);
      return result;
    } catch (error) {
      console.error("❌ Manual status check failed:", error);
      return null;
    }
  }

  /**
   * Get current monitoring status (for debugging)
   */
  public getMonitoringInfo() {
    return {
      isMonitoring: this.checkInterval !== null,
      userEmail: this.userEmail,
      isAdmin: this.isAdmin,
      checkInterval: this.CHECK_INTERVAL,
      isChecking: this.isChecking,
      lastCheckTime: new Date(this.lastCheckTime).toISOString(),
    };
  }
}

// Export singleton instance
export const adminStatusChecker = new AdminStatusChecker();
