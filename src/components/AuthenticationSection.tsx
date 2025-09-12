// src/components/AuthenticationSection.tsx
// CLEANED: Removed app launch logging to prevent duplicates

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

// 🔥 UPDATED: Only import sign-in and sign-out logging (app launch moved to App.tsx)
import {
  logAdminSignIn,
  logAdminSignOut,
  // logAdminAppLaunch - REMOVED to prevent duplicates
} from "../services/mobileAdminLogger";

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

  // Track admin status for logging (sign-in/sign-out only)
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<
    "lgu_admin" | "field_admin" | null
  >(null);

  // Use correct property names from your userProfileStore
  const { profile, setProfile, reloadProfileAfterLogin } = useUserProfile();

  useEffect(() => {
    // 🔥 REMOVED: logAdminAppLaunch() - now handled in App.tsx

    // Set up auth state listener
    const handleAuthStateChange = async (authState: AuthState) => {
      console.log(`AuthSection received auth change: ${authState.authType}`);

      try {
        setIsLoading(true);

        // Get capabilities based on auth state
        const status = await enhancedFirebaseService.getUserReportingStatus();
        setUserCapabilities(status.capabilities);

        // Track admin status from auth state (for sign-in/sign-out logging only)
        if (authState.authType === "admin") {
          setIsCurrentUserAdmin(true);
          setAdminRole(
            (authState.adminRole as "lgu_admin" | "field_admin") || null
          );
        } else {
          setIsCurrentUserAdmin(false);
          setAdminRole(null);
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
      // 🔥 UPDATED: Log admin sign-in (but not app launch)
      if (userType === "admin") {
        setIsCurrentUserAdmin(true);

        // Extract admin role if available from user object
        const role = user?.customClaims?.role as "lgu_admin" | "field_admin";
        setAdminRole(role);

        // Log the sign-in (app launch is handled separately in App.tsx)
        await logAdminSignIn();
      }

      // Clear cache and refresh auth state through coordinator
      clearAuthCache();
      await refreshAuthState();

      // Reload profile after login
      await reloadProfileAfterLogin();

      // FIXED: Use correct saveAuthState signature (without callback)
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

      Alert.alert("Welcome!", message);
    } catch (error) {
      console.error("Login post-processing failed:", error);
      Alert.alert(
        "Login Successful",
        "You're now signed in, but there was an issue with profile setup."
      );
    }
  };

  const handleRegistrationSuccess = async () => {
    try {
      setShowRegistrationModal(false);

      // Clear cache and refresh auth state
      clearAuthCache();
      await refreshAuthState();

      // Create a default profile for the new user if they don't have one
      try {
        await reloadProfileAfterLogin();

        // If no profile exists after reload, create a default one
        if (!profile) {
          console.log("🔄 Creating default profile for new user");
          const defaultProfile = createProfileWithDefaults("none");
          setProfile(defaultProfile);
        }
      } catch (error) {
        console.error("Failed to create default profile:", error);
      }

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
              // 🔥 KEPT: Log admin sign-out BEFORE signing out
              if (isCurrentUserAdmin) {
                await logAdminSignOut();
                setIsCurrentUserAdmin(false);
                setAdminRole(null);
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
          ? `OFFICIAL (${adminRole.replace("_", " ").toUpperCase()})`
          : "OFFICIAL (LGU ADMIN)";
        return {
          text: roleText,
          color: COLORS.success,
          icon: "shield-checkmark" as const,
        };
      case "registered":
        return {
          text: "REGISTERED USER",
          color: COLORS.softBlue,
          icon: "person" as const,
        };
      case "anonymous":
      default:
        return {
          text: "GUEST USER",
          color: COLORS.warning,
          icon: "person-outline" as const,
        };
    }
  };

  const features = [
    {
      icon: "infinite" as keyof typeof Ionicons.glyphMap,
      text:
        userCapabilities.authType === "admin"
          ? "Unlimited official reporting"
          : userCapabilities.authType === "registered"
          ? "Unlimited community reporting"
          : "Limited daily reporting",
    },
    {
      icon: "camera" as keyof typeof Ionicons.glyphMap,
      text:
        userCapabilities.authType !== "anonymous"
          ? "Photo attachments enabled"
          : "No photo attachments",
    },
    {
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
      text:
        userCapabilities.authType === "admin"
          ? "Auto-verified reports"
          : userCapabilities.authType === "registered"
          ? "Community validation"
          : "Anonymous validation",
    },
    {
      icon: "analytics" as keyof typeof Ionicons.glyphMap,
      text:
        userCapabilities.authType !== "anonymous"
          ? "Report tracking & history"
          : "No report tracking",
    },
  ];

  const badge = getBadgeInfo();

  return (
    <View style={[styles.container, style]}>
      {/* Account Status Badge */}
      <View style={[styles.badge, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon} size={16} color={COLORS.white} />
        <Text style={styles.badgeText}>{badge.text}</Text>
      </View>

      {/* Features List */}
      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name={feature.icon}
              size={20}
              color={COLORS.softBlue}
              style={styles.featureIcon}
            />
            <Text style={styles.featureText}>{feature.text}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {userCapabilities.authType === "anonymous" ? (
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
    alignSelf: "center",
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureIcon: {
    marginRight: 12,
    width: 20,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.slate,
    flex: 1,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
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
    borderWidth: 1,
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
    borderColor: COLORS.warning,
  },
  signOutButtonText: {
    color: COLORS.warning,
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
