// src/components/AuthenticationSection.tsx
// ENHANCED: Added admin status monitoring integration
// Automatically starts/stops monitoring based on admin login/logout

import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    // Set up auth state listener
    const handleAuthStateChange = async (authState: AuthState) => {
      console.log(`AuthSection received auth change: ${authState.authType}`);

      try {
        setIsLoading(true);

        // Get capabilities based on auth state
        const status = await enhancedFirebaseService.getUserReportingStatus();
        setUserCapabilities(status.capabilities);

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
          setIsCurrentUserAdmin(false);
          setAdminRole(null);
          setAdminEmail(null);

          // FIXED: Single stop call only when needed
          if (isCurrentUserAdmin) {
            console.log(
              "Stopping admin status monitoring (user changed to non-admin)"
            );
            adminStatusChecker.stopMonitoring();
          }
        }

        if (onAuthStateChange) {
          onAuthStateChange(status.capabilities.authType);
        }
      } catch (error) {
        console.error("Failed to update user status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Add listener with unique ID
    addAuthListener("auth-section", handleAuthStateChange);

    // Initial load
    loadUserStatus();

    return () => {
      removeAuthListener("auth-section");
      // Clean up monitoring on component unmount
      adminStatusChecker.stopMonitoring();
    };
  }, [onAuthStateChange]);

  const loadUserStatus = async () => {
    try {
      setIsLoading(true);
      const status = await enhancedFirebaseService.getUserReportingStatus();
      setUserCapabilities(status.capabilities);

      console.log(`Auth section loaded: ${status.capabilities.authType} user`);

      if (onAuthStateChange) {
        onAuthStateChange(status.capabilities.authType);
      }
    } catch (error) {
      console.error("Failed to load user status:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
        "Your account was created but there was an issue with setup. Please restart the app if needed."
      );
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? You'll return to guest mode with limited features.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              // ENHANCED: Stop admin status monitoring before signout
              console.log("🛑 Stopping admin status monitoring before signout");
              adminStatusChecker.stopMonitoring();

              // Log admin sign-out BEFORE signing out
              if (isCurrentUserAdmin) {
                await logAdminSignOut();
                setIsCurrentUserAdmin(false);
                setAdminRole(null);
                setAdminEmail(null);
              }

              // Clear auth state persistence
              await clearAuthState();

              // Clear cache
              clearAuthCache();

              // Sign out from Firebase
              const { getUnifiedFirebaseAuth } = await import(
                "../config/firebaseConfig"
              );
              const auth = await getUnifiedFirebaseAuth();

              const { signOut } = await import("firebase/auth");
              await signOut(auth);

              console.log("User signed out successfully");

              // Refresh auth state
              await refreshAuthState();
            } catch (error) {
              console.error("Sign out failed:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Handle switching between login and registration modals
  const handleSwitchToLogin = () => {
    setShowRegistrationModal(false);
    setShowLoginModal(true);
  };

  const handleOpenLogin = () => {
    setShowLoginModal(true);
  };

  const handleOpenRegistration = () => {
    setShowRegistrationModal(true);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading account status...</Text>
        </View>
      </View>
    );
  }

  if (!userCapabilities) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Unable to load account status</Text>
        </View>
      </View>
    );
  }

  // Get badge info with admin role details
  const getBadgeInfo = () => {
    switch (userCapabilities.authType) {
      case "admin":
        const roleText = adminRole
          ? adminRole === "lgu_admin"
            ? "LGU Admin"
            : "Field Admin"
          : "Admin";
        return {
          text: roleText,
          bgColor: COLORS.success,
          textColor: COLORS.white,
          icon: "shield-checkmark",
        };
      case "registered":
        return {
          text: "Registered User",
          bgColor: COLORS.softBlue,
          textColor: COLORS.white,
          icon: "person",
        };
      case "anonymous":
      default:
        return {
          text: "Guest User",
          bgColor: COLORS.chipBg,
          textColor: COLORS.navy,
          icon: "person-outline",
        };
    }
  };

  const badgeInfo = getBadgeInfo();
  const isLoggedIn = userCapabilities.authType !== "anonymous";

  return (
    <View style={[styles.container, style]}>
      {/* User Status Badge */}
      <View style={[styles.badge, { backgroundColor: badgeInfo.bgColor }]}>
        <Ionicons
          name={badgeInfo.icon as any}
          size={16}
          color={badgeInfo.textColor}
        />
        <Text style={[styles.badgeText, { color: badgeInfo.textColor }]}>
          {badgeInfo.text}
        </Text>
        {/* ENHANCED: Add monitoring indicator for admins */}
        {isCurrentUserAdmin && (
          <View style={styles.monitoringIndicator}>
            <View style={styles.monitoringDot} />
          </View>
        )}
      </View>

      {/* Account Info */}
      <View style={styles.accountInfo}>
        <Text style={styles.accountTitle}>
          {isLoggedIn ? "Account Active" : "Limited Access"}
        </Text>
        <Text style={styles.accountDescription}>
          {userCapabilities.authType === "admin"
            ? `${adminRole
                ?.replace("_", " ")
                .toUpperCase()} with full system access`
            : userCapabilities.authType === "registered"
            ? "Unlimited reporting and tracking"
            : `${
                userCapabilities.dailyReportLimit === 1
                  ? "1"
                  : userCapabilities.dailyReportLimit
              } reports remaining today`}
        </Text>
        {/* ENHANCED: Show admin email for clarity */}
        {isCurrentUserAdmin && adminEmail && (
          <Text style={styles.adminEmail}>Signed in as: {adminEmail}</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {!isLoggedIn ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleOpenRegistration}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleOpenLogin}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Login Modal */}
      <Modal
        visible={showLoginModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <UniversalLoginForm
            mode="login"
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => setShowLoginModal(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Registration Modal */}
      <Modal
        visible={showRegistrationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRegistrationModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <RegistrationForm
            onRegistrationSuccess={handleRegistrationSuccess}
            onCancel={() => setShowRegistrationModal(false)}
            onSwitchToLogin={handleSwitchToLogin}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    position: "relative",
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  // ENHANCED: Monitoring indicator styles
  monitoringIndicator: {
    position: "absolute",
    right: 8,
    top: 6,
  },
  monitoringDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
    opacity: 0.8,
  },
  accountInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  accountTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.slate,
    marginBottom: 4,
  },
  accountDescription: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  // ENHANCED: Admin email display
  adminEmail: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
    fontStyle: "italic",
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: COLORS.softBlue,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 2,
    borderColor: COLORS.softBlue,
  },
  secondaryButtonText: {
    color: COLORS.softBlue,
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
  signOutButtonText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
