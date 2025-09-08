// src/services/AuthStateCoordinator.ts
// AUTH STATE COORDINATOR - Unified Auth Management (Complete Remake)

import { getUnifiedFirebaseAuth } from "../config/firebaseConfig";

interface AuthStateListener {
  id: string;
  callback: (authState: AuthState) => void;
}

interface AuthState {
  user: any;
  isAuthenticated: boolean;
  isAdmin: boolean;
  authType: "anonymous" | "registered" | "admin";
  adminRole?: string;
  timestamp: number;
}

class AuthStateCoordinator {
  private listeners: Set<AuthStateListener> = new Set();
  private currentState: AuthState | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log("Initializing Auth State Coordinator");

      // Use unified auth (prevents conflicts)
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );
      const auth = await getUnifiedFirebaseAuth();

      // Set up auth state listener
      this.authUnsubscribe = auth.onAuthStateChanged(async (user: any) => {
        console.log(`Auth state changed: ${user?.email || "anonymous"}`);

        const newState = await this.buildAuthState(user);
        this.currentState = newState;

        // Notify all listeners
        this.notifyListeners(newState);
      });

      this.isInitialized = true;
      console.log("Auth State Coordinator initialized");
    } catch (error) {
      console.error("Failed to initialize Auth State Coordinator:", error);
    }
  }

  private async buildAuthState(user: any): Promise<AuthState> {
    if (!user) {
      return {
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        authType: "anonymous",
        timestamp: Date.now(),
      };
    }

    let authType: "anonymous" | "registered" | "admin" = "anonymous";
    let isAdmin = false;
    let adminRole: string | undefined;

    try {
      // Check if user has admin claims
      const tokenResult = await user.getIdTokenResult();
      const claims = tokenResult.claims;

      if (claims.admin === true) {
        authType = "admin";
        isAdmin = true;
        adminRole = claims.role as string;
      } else if (!user.isAnonymous && user.email) {
        authType = "registered";
      }
    } catch (error) {
      console.warn("Failed to get user claims:", error);
      // Fallback to basic auth type detection
      if (!user.isAnonymous && user.email) {
        authType = "registered";
      }
    }

    return {
      user,
      isAuthenticated: true,
      isAdmin,
      authType,
      adminRole,
      timestamp: Date.now(),
    };
  }

  addListener(id: string, callback: (authState: AuthState) => void): void {
    this.listeners.add({ id, callback });

    // If we already have state, call the listener immediately
    if (this.currentState) {
      callback(this.currentState);
    }
  }

  removeListener(id: string): void {
    for (const listener of this.listeners) {
      if (listener.id === id) {
        this.listeners.delete(listener);
        break;
      }
    }
  }

  private notifyListeners(state: AuthState): void {
    this.listeners.forEach((listener) => {
      try {
        listener.callback(state);
      } catch (error) {
        console.error(`Error in auth listener ${listener.id}:`, error);
      }
    });
  }

  getCurrentState(): AuthState | null {
    return this.currentState;
  }

  async forceRefresh(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
      return;
    }

    try {
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );
      const auth = await getUnifiedFirebaseAuth();
      const currentUser = auth.currentUser;

      if (currentUser) {
        // Force token refresh
        await currentUser.getIdToken(true);
      }

      const newState = await this.buildAuthState(currentUser);
      this.currentState = newState;
      this.notifyListeners(newState);

      console.log("Auth state refreshed");
    } catch (error) {
      console.error("Failed to refresh auth state:", error);
    }
  }

  destroy(): void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }

    this.listeners.clear();
    this.currentState = null;
    this.isInitialized = false;

    console.log("Auth State Coordinator destroyed");
  }
}

// Export singleton instance
export const authStateCoordinator = new AuthStateCoordinator();

// Convenience functions
export const initializeAuthCoordinator = () =>
  authStateCoordinator.initialize();
export const getCurrentAuthState = () => authStateCoordinator.getCurrentState();
export const refreshAuthState = () => authStateCoordinator.forceRefresh();
export const addAuthListener = (
  id: string,
  callback: (state: AuthState) => void
) => authStateCoordinator.addListener(id, callback);
export const removeAuthListener = (id: string) =>
  authStateCoordinator.removeListener(id);

export type { AuthState };
