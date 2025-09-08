// src/components/AuthenticationSection.tsx
// AUTHENTICATION SECTION - Complete Remake with Proper Imports

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
import { useUserProfile } from "../stores/userProfileStore";

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

    // FIXED: Trigger profile reload using the hook
    const { reloadProfileAfterLogin } = useUserProfile.getState();
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
        : "Account linked successfully! You now have unlimited reporting and can track your reports.";

    Alert.alert("Welcome!", message);
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

  const getUserBadgeInfo = () => {
    if (!userCapabilities) return { text: "LOADING", color: COLORS.muted };

    switch (userCapabilities.authType) {
      case "admin":
        return {
          text: "OFFICIAL (LGU ADMIN)",
          color: COLORS.success,
          icon: "shield-checkmark" as const,
        };
      case "registered":
        return {
          text: "REGISTERED USER",
          color: COLORS.softBlue,
          icon: "person-circle" as const,
        };
      case "anonymous":
      default:
        return {
          text: "GUEST",
          color: COLORS.warning,
          icon: "person" as const,
        };
    }
  };

  const getFeaturesList = () => {
    if (!userCapabilities) return [];

    const features = [];

    if (userCapabilities.canReport) {
      const reportText =
        userCapabilities.authType === "admin"
          ? "Unlimited official reporting"
          : userCapabilities.authType === "registered"
          ? `${userCapabilities.dailyReportLimit} reports per day`
          : "1 report per day";

      features.push({
        icon: "alert-circle" as const,
        text: reportText,
        available: true,
      });
    }

    if (userCapabilities.canUploadPhotos) {
      features.push({
        icon: "camera" as const,
        text: "Photo uploads",
        available: true,
      });
    } else {
      features.push({
        icon: "camera" as const,
        text: "Photo uploads",
        available: false,
      });
    }

    if (userCapabilities.canTrackReports) {
      features.push({
        icon: "list" as const,
        text: "Report tracking",
        available: true,
      });
    } else {
      features.push({
        icon: "list" as const,
        text: "Report tracking",
        available: false,
      });
    }

    if (userCapabilities.canValidateReports) {
      features.push({
        icon: "people" as const,
        text: "Community validation",
        available: true,
      });
    } else {
      features.push({
        icon: "people" as const,
        text: "Community validation",
        available: false,
      });
    }

    return features;
  };

  const badgeInfo = getUserBadgeInfo();
  const features = getFeaturesList();

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            Loading authentication status...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: badgeInfo.color }]}>
            <Ionicons
              name={badgeInfo.icon}
              size={16}
              color={COLORS.white}
              style={styles.badgeIcon}
            />
            <Text style={styles.badgeText}>{badgeInfo.text}</Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          {userCapabilities?.authType === "anonymous" ? (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => setShowLoginModal(true)}
            >
              <Ionicons name="log-in" size={20} color={COLORS.white} />
              <Text style={styles.loginButtonText}>Sign In / Register</Text>
            </TouchableOpacity>
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
            onPress={() => setShowLoginModal(true)}
          >
            <Text style={styles.upgradePromptText}>
              Register for unlimited access →
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
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
