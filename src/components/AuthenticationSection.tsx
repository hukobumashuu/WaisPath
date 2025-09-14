// src/components/AuthenticationSection.tsx
// CRITICAL FIX: Sign out bug resolved + All TypeScript errors fixed

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  enhancedFirebaseService,
  clearAuthCache,
} from "../services/enhancedFirebase";
import { UserCapabilities } from "../services/UserCapabilitiesService";
import UniversalLoginForm from "./UniversalLoginForm";
import RegistrationForm from "./RegistrationForm";
import {
  addAuthListener,
  removeAuthListener,
  refreshAuthState,
  type AuthState,
} from "../services/AuthStateCoordinator";
import {
  saveAuthState,
  loadAuthState,
  clearAuthState,
} from "../services/SimpleAuthPersistence";
import {
  useUserProfile,
  createProfileWithDefaults,
} from "../stores/userProfileStore";

// ENHANCED: Import admin status monitoring
import { adminStatusChecker } from "../services/adminStatusChecker";

// Import existing logging (keep existing functionality)
import { logAdminSignIn, logAdminSignOut } from "../services/mobileAdminLogger";

// 🔥 NEW: Import Firebase signOut to fix the bug
import { getUnifiedFirebaseAuth } from "../config/firebaseConfig";

const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  lightGray: "#F8FAFC",
  success: "#10B981",
  warning: "#F59E0B",
  chipBg: "#EFF8FF",
};

interface AuthenticationSectionProps {
  onAuthStateChange?: (authType: "anonymous" | "registered" | "admin") => void;
  style?: any;
}

export default function AuthenticationSection({
  onAuthStateChange,
  style,
}: AuthenticationSectionProps) {
  const [userCapabilities, setUserCapabilities] =
    useState<UserCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Track admin status for logging and monitoring
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<
    "lgu_admin" | "field_admin" | null
  >(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Use correct property names from userProfileStore
  const { profile, setProfile, reloadProfileAfterLogin } = useUserProfile();

  // NEW: Ref to prevent duplicate processing
  const lastAuthStateRef = useRef<string>("");
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    // Set up auth state listener
    const handleAuthStateChange = async (authState: AuthState) => {
      const authKey = `${authState.authType}-${authState.user?.uid || "none"}`;

      // NEW: Skip duplicate processing
      if (lastAuthStateRef.current === authKey && hasInitializedRef.current) {
        return;
      }

      lastAuthStateRef.current = authKey;
      console.log(`AuthSection received auth change: ${authState.authType}`);

      try {
        setIsLoading(true);

        // Get capabilities based on auth state
        const status = await enhancedFirebaseService.getUserReportingStatus();

        // FIXED: Override capabilities for anonymous users to show correct photo upload capability
        let capabilities = status.capabilities;
        if (authState.authType === "anonymous") {
          capabilities = {
            ...capabilities,
            canUploadPhotos: true, // FIXED: Anonymous users CAN upload photos now
            dailyReportLimit: status.context.rateLimitInfo?.remaining || 0, // FIXED: Use device-based count
          };
        }

        setUserCapabilities(capabilities);

        // ENHANCED: Handle admin status monitoring
        if (authState.authType === "admin") {
          const email = authState.user?.email;
          const role = authState.adminRole as "lgu_admin" | "field_admin";

          setIsCurrentUserAdmin(true);
          setAdminRole(role);
          setAdminEmail(email);

          // Start admin status monitoring
          if (email) {
            console.log(`🔍 Starting admin status monitoring for: ${email}`);
            adminStatusChecker.startMonitoring(email, true);
          }
        } else {
          // Non-admin user or signed out
          const wasAdmin = isCurrentUserAdmin;
          setIsCurrentUserAdmin(false);
          setAdminRole(null);
          setAdminEmail(null);

          // FIXED: Single stop call only when needed
          if (wasAdmin) {
            console.log(
              "Stopping admin status monitoring (user changed to non-admin)"
            );
            adminStatusChecker.stopMonitoring();
          }
        }

        console.log(`Auth section loaded: ${capabilities.authType} user`);

        if (onAuthStateChange) {
          onAuthStateChange(capabilities.authType);
        }

        hasInitializedRef.current = true;
      } catch (error) {
        console.error("Failed to update user status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Add listener with unique ID
    addAuthListener("auth-section", handleAuthStateChange);

    // REMOVED: No initial loadUserStatus() call - this was causing duplicates!
    // Let the auth listener handle everything

    return () => {
      removeAuthListener("auth-section");
      // Clean up monitoring on component unmount
      adminStatusChecker.stopMonitoring();
      // Reset refs
      hasInitializedRef.current = false;
      lastAuthStateRef.current = "";
    };
  }, [onAuthStateChange, isCurrentUserAdmin]);

  const handleLoginSuccess = async (
    userType: "registered" | "admin",
    user: any
  ) => {
    console.log(`Authentication successful in section: ${userType}`);

    setShowLoginModal(false);

    try {
      // ENHANCED: Handle admin login with status monitoring
      if (userType === "admin") {
        const email = user?.email;
        const role = user?.customClaims?.role as "lgu_admin" | "field_admin";

        setIsCurrentUserAdmin(true);
        setAdminRole(role);
        setAdminEmail(email);

        // Log the sign-in (existing functionality)
        await logAdminSignIn();

        // ENHANCED: Start status monitoring immediately
        if (email) {
          console.log(
            `🔍 Starting admin status monitoring after login: ${email}`
          );
          adminStatusChecker.startMonitoring(email, true);
        }
      }

      // Clear cache and refresh auth state through coordinator
      clearAuthCache();
      await refreshAuthState();

      // Reload profile after login
      await reloadProfileAfterLogin();

      // Save auth state for persistence
      await saveAuthState(
        userType,
        user?.email,
        userType === "admin" ? user?.customClaims?.role : undefined
      );

      console.log(
        "Auth cache cleared, state refreshed, and persistence updated"
      );

      const message =
        userType === "admin"
          ? "Admin access enabled! You now have unlimited reporting and validation powers."
          : "Welcome back! You now have unlimited reporting and can track your reports.";

      Alert.alert("Welcome!", message, [
        { text: "Get Started", style: "default" },
      ]);
    } catch (error) {
      console.error("Login post-processing failed:", error);
      Alert.alert(
        "Login Complete",
        "You're signed in but there was an issue with setup. Please restart the app if needed."
      );
    }
  };

  const handleRegistrationSuccess = async (user: any) => {
    console.log("Registration successful in section");
    setShowRegistrationModal(false);

    try {
      // Clear cache and refresh state
      clearAuthCache();
      await refreshAuthState();

      // Save user profile after registration
      if (user && user.email) {
        const defaultProfile = createProfileWithDefaults("none");
        setProfile(defaultProfile);
      }

      await reloadProfileAfterLogin();

      // Save auth state
      await saveAuthState("registered", user?.email);

      Alert.alert(
        "Welcome to WAISPATH!",
        "Your account has been created successfully. You now have unlimited reporting access.",
        [{ text: "Get Started", style: "default" }]
      );
    } catch (error) {
      console.error("Registration post-processing failed:", error);
      Alert.alert(
        "Registration Complete",
        "Account created but there was an issue with setup. Please restart if needed."
      );
    }
  };

  // 🔥 CRITICAL FIX: Fixed sign out logic to prevent auto-restore bug
  const handleSignOut = async () => {
    try {
      console.log("Starting signout process");

      // ENHANCED: Handle admin signout logging
      if (isCurrentUserAdmin && adminEmail) {
        await logAdminSignOut();
        console.log("Admin signout logged");
      }

      // Stop admin monitoring first
      if (isCurrentUserAdmin) {
        adminStatusChecker.stopMonitoring();
        console.log("Admin status monitoring stopped");
      }

      // Clear local component state
      setIsCurrentUserAdmin(false);
      setAdminRole(null);
      setAdminEmail(null);

      // 🔥 CRITICAL FIX: Clear persistence FIRST, then Firebase auth
      console.log("🧹 Clearing auth state persistence...");
      await clearAuthState(); // Clear our stored auth state

      console.log("🧹 Clearing Firebase cache...");
      clearAuthCache(); // Clear service cache

      // 🔥 NEW: Sign out from Firebase AFTER clearing persistence
      console.log("🔥 Signing out from Firebase...");
      try {
        const auth = await getUnifiedFirebaseAuth();
        if (auth && auth.currentUser) {
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
          console.log("✅ Firebase signOut completed");
        }
      } catch (firebaseError) {
        console.error("Firebase signOut failed:", firebaseError);
        // Continue anyway - local state is cleared
      }

      // 🔥 FIXED: Refresh auth state AFTER Firebase signout
      console.log("🔄 Refreshing auth state...");
      await refreshAuthState();

      console.log("✅ Signout completed successfully");

      Alert.alert("Signed Out", "You have been signed out successfully.", [
        { text: "OK", style: "default" },
      ]);
    } catch (error) {
      console.error("❌ Signout failed:", error);

      // Even if signout fails, try to clear local state
      try {
        await clearAuthState();
        clearAuthCache();
        await refreshAuthState();
        console.log("⚠️ Local signout completed despite errors");

        Alert.alert(
          "Signed Out",
          "You have been signed out (some cleanup operations failed).",
          [{ text: "OK", style: "default" }]
        );
      } catch (fallbackError) {
        console.error("❌ Fallback signout also failed:", fallbackError);
        Alert.alert(
          "Signout Error",
          "There was an issue signing out. Please restart the app.",
          [{ text: "OK", style: "default" }]
        );
      }
    }
  };

  const handleOpenLogin = () => setShowLoginModal(true);
  const handleOpenRegistration = () => setShowRegistrationModal(true);

  // Determine if user is logged in
  const isLoggedIn =
    userCapabilities && userCapabilities.authType !== "anonymous";

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.card}>
          <View style={styles.loadingContainer}>
            <Ionicons name="hourglass" size={24} color={COLORS.softBlue} />
            <Text style={styles.loadingText}>Loading user status...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!userCapabilities) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.card}>
          <Text style={styles.errorText}>Failed to load user information</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.card}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <Ionicons
            name={
              userCapabilities.authType === "admin"
                ? "shield-checkmark"
                : userCapabilities.authType === "registered"
                ? "person-circle"
                : "person"
            }
            size={28}
            color={
              userCapabilities.authType === "admin"
                ? COLORS.success
                : userCapabilities.authType === "registered"
                ? COLORS.softBlue
                : COLORS.muted
            }
          />
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              {userCapabilities.authType === "admin"
                ? "Admin Access"
                : userCapabilities.authType === "registered"
                ? "Registered User"
                : "Anonymous User"}
            </Text>
            <Text style={styles.statusSubtitle}>
              {userCapabilities.authType === "admin"
                ? `${adminRole?.replace("_", " ")} • Unlimited reports`
                : userCapabilities.authType === "registered"
                ? `${userCapabilities.dailyReportLimit} reports remaining today`
                : `${userCapabilities.dailyReportLimit} report remaining today on this device`}
            </Text>
          </View>
        </View>

        {/* Features List */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons
              name={
                userCapabilities.canUploadPhotos ? "camera" : "camera-outline"
              }
              size={16}
              color={
                userCapabilities.canUploadPhotos ? COLORS.success : COLORS.muted
              }
            />
            <Text
              style={[
                styles.featureText,
                {
                  color: userCapabilities.canUploadPhotos
                    ? COLORS.success
                    : COLORS.muted,
                },
              ]}
            >
              Photo Upload:{" "}
              {userCapabilities.canUploadPhotos ? "Enabled" : "Disabled"}
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name={
                userCapabilities.canValidateReports
                  ? "checkmark-circle"
                  : "close-circle"
              }
              size={16}
              color={
                userCapabilities.canValidateReports
                  ? COLORS.success
                  : COLORS.muted
              }
            />
            <Text
              style={[
                styles.featureText,
                {
                  color: userCapabilities.canValidateReports
                    ? COLORS.success
                    : COLORS.muted,
                },
              ]}
            >
              Report Validation:{" "}
              {userCapabilities.canValidateReports ? "Enabled" : "Disabled"}
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name={
                userCapabilities.canAccessReportHistory
                  ? "document-text"
                  : "document-text-outline"
              }
              size={16}
              color={
                userCapabilities.canAccessReportHistory
                  ? COLORS.success
                  : COLORS.muted
              }
            />
            <Text
              style={[
                styles.featureText,
                {
                  color: userCapabilities.canAccessReportHistory
                    ? COLORS.success
                    : COLORS.muted,
                },
              ]}
            >
              Report History:{" "}
              {userCapabilities.canAccessReportHistory
                ? "Available"
                : "Limited"}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!isLoggedIn ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleOpenLogin}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="log-in-outline"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleOpenRegistration}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="person-add-outline"
                  size={20}
                  color={COLORS.softBlue}
                />
                <Text style={styles.secondaryButtonText}>Register</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.signOutButton]}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upgrade Prompt for Anonymous Users */}
        {userCapabilities.authType === "anonymous" && (
          <View style={styles.upgradePrompt}>
            <Text style={styles.upgradeTitle}>Want More Features?</Text>
            <Text style={styles.upgradeText}>
              Register for unlimited reporting, photo upload, and report
              tracking!
            </Text>
          </View>
        )}
      </View>

      {/* Login Modal - FIXED: Using correct prop names */}
      <Modal visible={showLoginModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <UniversalLoginForm
            mode="login"
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => setShowLoginModal(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Registration Modal - FIXED: Using correct prop names */}
      <Modal visible={showRegistrationModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <RegistrationForm
            onRegistrationSuccess={handleRegistrationSuccess}
            onCancel={() => setShowRegistrationModal(false)}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Original styles preserved
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.muted,
  },
  errorText: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 16,
    paddingVertical: 20,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusContent: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.navy,
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 2,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.softBlue,
  },
  primaryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.softBlue,
  },
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.softBlue,
  },
  signOutButton: {
    backgroundColor: COLORS.muted,
  },
  signOutButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  upgradePrompt: {
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.navy,
    marginBottom: 4,
  },
  upgradeText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
