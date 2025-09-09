// src/components/AuthenticationSection.tsx
// AUTHENTICATION SECTION - FIXED: Proper signOut method and removed adminRole error
// Uses correct Firebase signOut and existing UserCapabilities interface

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
import RegistrationForm from "./RegistrationForm"; // Import existing RegistrationForm
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

  // Get profile store methods
  const { setProfile, reloadProfileAfterLogin } = useUserProfile();

  useEffect(() => {
    // Set up auth state listener
    const handleAuthStateChange = async (authState: AuthState) => {
      console.log(`AuthSection received auth change: ${authState.authType}`);

      try {
        setIsLoading(true);

        // Get capabilities based on auth state
        const status = await enhancedFirebaseService.getUserReportingStatus();
        setUserCapabilities(status.capabilities);

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
  }, []);

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
    userType: "admin" | "registered",
    userInfo: any
  ) => {
    console.log(`Authentication successful in section: ${userType}`);

    setShowLoginModal(false);

    // Clear cache and refresh auth state through coordinator
    clearAuthCache();
    await refreshAuthState();

    // Reload profile after login
    await reloadProfileAfterLogin();

    // Save auth state for next session
    await saveAuthState(
      userType,
      userInfo?.email,
      userType === "admin" ? userInfo?.customClaims?.role : undefined
    );

    console.log("Auth cache cleared, state refreshed, and persistence updated");

    const message =
      userType === "admin"
        ? "Admin access enabled! You now have unlimited reporting and validation powers."
        : "Welcome back! You now have unlimited reporting and can track your reports.";

    Alert.alert("Welcome!", message);
  };

  const handleRegistrationSuccess = async (user: any) => {
    console.log(`Registration successful in section for user:`, user?.email);

    // FIXED: Close modal first, then handle the rest
    setShowRegistrationModal(false);

    try {
      // Clear cache and refresh auth state
      clearAuthCache();
      await refreshAuthState();

      // Create a default profile for the new user if they don't have one
      try {
        // Check if user already has a profile from the registration process
        await reloadProfileAfterLogin();

        // If no profile exists after reload, create a default one
        const currentProfile = useUserProfile.getState().profile;
        if (!currentProfile) {
          console.log("🔄 Creating default profile for new user");
          const defaultProfile = createProfileWithDefaults("none", {
            // Basic accessibility-friendly defaults
            preferShade: true,
            maxWalkingDistance: 1000, // 1km default
            avoidCrowds: true,
            // Let user customize later in profile screen
          });
          setProfile(defaultProfile);
        }
      } catch (error) {
        console.error("Failed to create default profile:", error);
        // Continue anyway - user can create profile later
      }

      // Save auth state for next session
      await saveAuthState("registered", user?.email);

      console.log("Registration complete: auth cache cleared, state refreshed");

      // FIXED: Show success alert after everything is done
      Alert.alert(
        "Welcome to WAISPATH!",
        "Your account has been created successfully. You now have unlimited reporting and can help make Pasig City more accessible!",
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

  // FIXED: Use the same signOut method as the current AuthenticationSection
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
              // Clear auth state persistence
              await clearAuthState();

              // Clear cache
              clearAuthCache();

              // Sign out from Firebase (using the same method as current code)
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

  // FIXED: Use the same getUserBadgeInfo pattern as existing code
  const getBadgeInfo = () => {
    switch (userCapabilities.authType) {
      case "admin":
        return {
          text: "OFFICIAL (LGU ADMIN)", // Use generic admin text since we don't have specific role
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

  // Define account features based on auth type
  const features = [
    {
      icon: "infinite" as keyof typeof Ionicons.glyphMap,
      text:
        userCapabilities.authType === "admin"
          ? "Unlimited official reporting"
          : userCapabilities.authType === "registered"
          ? `${userCapabilities.dailyReportLimit} reports per day`
          : "1 report per day",
      available: userCapabilities.canReport,
    },
    {
      icon: "camera" as keyof typeof Ionicons.glyphMap,
      text: "Photo uploads",
      available: userCapabilities.canUploadPhotos,
    },
    {
      icon: "analytics" as keyof typeof Ionicons.glyphMap,
      text: "Report tracking",
      available: userCapabilities.canTrackReports,
    },
    {
      icon: "people" as keyof typeof Ionicons.glyphMap,
      text: "Community validation",
      available: userCapabilities.canValidateReports,
    },
    {
      icon: "shield-checkmark" as keyof typeof Ionicons.glyphMap,
      text: "Admin verification",
      available: userCapabilities.canAccessAdminFeatures,
    },
  ];

  const badgeInfo = getBadgeInfo();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        {/* User Status Badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: badgeInfo.color }]}>
            <Ionicons
              name={badgeInfo.icon}
              size={14}
              color={COLORS.white}
              style={styles.badgeIcon}
            />
            <Text style={styles.badgeText}>{badgeInfo.text}</Text>
          </View>
        </View>

        {/* Authentication Actions */}
        <View style={styles.actionContainer}>
          {userCapabilities.authType === "anonymous" ? (
            <View style={styles.authButtonsContainer}>
              {/* Sign In Button */}
              <TouchableOpacity
                style={styles.signInButton}
                onPress={handleOpenLogin}
              >
                <Ionicons name="log-in" size={18} color={COLORS.softBlue} />
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>

              {/* Register Button */}
              <TouchableOpacity
                style={styles.registerButton}
                onPress={handleOpenRegistration}
              >
                <Ionicons name="person-add" size={18} color={COLORS.white} />
                <Text style={styles.registerButtonText}>Register</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out" size={18} color={COLORS.muted} />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Account Features</Text>
        {features.map((feature, index) => (
          <View key={index} style={styles.feature}>
            <Ionicons
              name={feature.icon}
              size={18}
              color={feature.available ? COLORS.success : COLORS.muted}
            />
            <Text
              style={[
                styles.featureText,
                !feature.available && styles.featureTextDisabled,
              ]}
            >
              {feature.text}
            </Text>
            {!feature.available && (
              <Ionicons name="lock-closed" size={14} color={COLORS.muted} />
            )}
          </View>
        ))}

        {userCapabilities?.authType === "anonymous" && (
          <TouchableOpacity
            style={styles.upgradePrompt}
            onPress={handleOpenRegistration}
          >
            <Text style={styles.upgradePromptText}>
              Create account for unlimited access →
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Login Modal */}
      <Modal
        visible={showLoginModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <UniversalLoginForm
          mode={
            userCapabilities?.authType === "anonymous" ? "upgrade" : "login"
          }
          onLoginSuccess={handleLoginSuccess}
          onCancel={() => setShowLoginModal(false)}
        />
      </Modal>

      {/* Registration Modal */}
      <Modal
        visible={showRegistrationModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <RegistrationForm
          onRegistrationSuccess={handleRegistrationSuccess}
          onCancel={() => setShowRegistrationModal(false)}
          onSwitchToLogin={handleSwitchToLogin}
          mode={
            userCapabilities?.authType === "anonymous"
              ? "upgrade"
              : "standalone"
          }
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.muted,
  },
  header: {
    marginBottom: 20,
  },
  badgeContainer: {
    marginBottom: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeIcon: {
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.white,
    textTransform: "uppercase",
  },
  actionContainer: {
    alignItems: "flex-start",
  },
  authButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signInButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.softBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signInButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.softBlue,
    marginLeft: 6,
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 6,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonText: {
    fontSize: 14,
    color: COLORS.muted,
    marginLeft: 6,
  },
  featuresContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 12,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.slate,
    marginLeft: 10,
    flex: 1,
  },
  featureTextDisabled: {
    color: COLORS.muted,
  },
  upgradePrompt: {
    marginTop: 8,
    paddingVertical: 8,
  },
  upgradePromptText: {
    fontSize: 14,
    color: COLORS.softBlue,
    fontWeight: "500",
  },
});
