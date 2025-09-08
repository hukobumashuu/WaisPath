// src/services/SimpleAuthPersistence.ts
// SIMPLIFIED Auth State Management - Works without AsyncStorage
// Addresses immediate auth conflicts while accepting session-only persistence

import AsyncStorage from "@react-native-async-storage/async-storage";

interface SimpleAuthState {
  lastKnownAuthType: "anonymous" | "registered" | "admin";
  lastKnownUserEmail: string | null;
  lastKnownAdminRole: string | null;
  timestamp: number;
}

class SimpleAuthPersistence {
  private readonly STORAGE_KEY = "@waispath:simple_auth_state";
  private memoryState: SimpleAuthState | null = null;

  /**
   * Save basic auth info to AsyncStorage for next session
   * This helps with the "logged out after restart" issue
   */
  async saveAuthState(
    authType: "anonymous" | "registered" | "admin",
    userEmail?: string,
    adminRole?: string
  ): Promise<void> {
    try {
      const state: SimpleAuthState = {
        lastKnownAuthType: authType,
        lastKnownUserEmail: userEmail || null,
        lastKnownAdminRole: adminRole || null,
        timestamp: Date.now(),
      };

      // Save to both memory and storage
      this.memoryState = state;
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));

      console.log(`💾 Auth state saved: ${authType} user`);
    } catch (error) {
      console.error("Failed to save auth state:", error);
      // Non-blocking - app continues to work
    }
  }

  /**
   * Load last known auth state
   * Helps determine if user was previously logged in
   */
  async loadAuthState(): Promise<SimpleAuthState | null> {
    try {
      // Return memory state if available
      if (this.memoryState) {
        return this.memoryState;
      }

      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const state = JSON.parse(stored) as SimpleAuthState;

      // Check if state is less than 7 days old
      const daysSinceLastAuth =
        (Date.now() - state.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceLastAuth > 7) {
        console.log("📅 Auth state expired, clearing");
        await this.clearAuthState();
        return null;
      }

      this.memoryState = state;
      console.log(`📱 Loaded auth state: ${state.lastKnownAuthType} user`);
      return state;
    } catch (error) {
      console.error("Failed to load auth state:", error);
      return null;
    }
  }

  /**
   * Clear auth state (when user logs out)
   */
  async clearAuthState(): Promise<void> {
    try {
      this.memoryState = null;
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log("🧹 Auth state cleared");
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    }
  }

  /**
   * Get current memory state without storage access
   */
  getMemoryState(): SimpleAuthState | null {
    return this.memoryState;
  }

  /**
   * Check if user was previously an admin
   * Useful for showing "Sign back in as admin" prompts
   */
  wasLastUserAdmin(): boolean {
    return this.memoryState?.lastKnownAuthType === "admin" || false;
  }

  /**
   * Get last known user email for convenience
   */
  getLastKnownEmail(): string | null {
    return this.memoryState?.lastKnownUserEmail || null;
  }
}

// Export singleton instance
export const simpleAuthPersistence = new SimpleAuthPersistence();

// Convenience functions
export const saveAuthState = (
  authType: "anonymous" | "registered" | "admin",
  userEmail?: string,
  adminRole?: string
) => simpleAuthPersistence.saveAuthState(authType, userEmail, adminRole);

export const loadAuthState = () => simpleAuthPersistence.loadAuthState();

export const clearAuthState = () => simpleAuthPersistence.clearAuthState();

export const wasLastUserAdmin = () => simpleAuthPersistence.wasLastUserAdmin();

export const getLastKnownEmail = () =>
  simpleAuthPersistence.getLastKnownEmail();
