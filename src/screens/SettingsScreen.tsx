// src/screens/SettingsScreen.tsx
// SIMPLIFIED: Account-focused Settings Screen for WAISPATH
// FUNCTIONAL: Fixed auth state handling and logout functionality

import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import existing auth components
import UniversalLoginForm from "../components/UniversalLoginForm";
import RegistrationForm from "../components/RegistrationForm";
import ForgotPasswordForm from "../components/ForgotPasswordForm";
import ChangePasswordForm from "../components/ChangePasswordForm"; // NEW: Import change password component
import InfoModal from "../components/InfoModal";

// Import auth state management
import {
  getCurrentAuthState,
  addAuthListener,
  removeAuthListener,
  AuthState,
} from "../services/AuthStateCoordinator";
import { signOut } from "firebase/auth";
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
  error: "#EF4444",
  chipBg: "#EFF8FF",
};

interface SettingsScreenProps {
  navigation: any;
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  titleStyle?: any;
  disabled?: boolean;
}

// Settings Row Component
function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  titleStyle,
  disabled = false,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.settingsRow, disabled && styles.settingsRowDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View style={styles.settingsRowLeft}>
        <View style={styles.settingsIconContainer}>
          <Ionicons
            name={icon}
            size={20}
            color={disabled ? COLORS.muted : COLORS.softBlue}
          />
        </View>
        <View style={styles.settingsTextContainer}>
          <Text
            style={[
              styles.settingsTitle,
              titleStyle,
              disabled && styles.disabledText,
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.settingsSubtitle, disabled && styles.disabledText]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingsRowRight}>
        {rightElement ||
          (onPress && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={disabled ? COLORS.muted : COLORS.muted}
            />
          ))}
      </View>
    </TouchableOpacity>
  );
}

// Main Settings Screen Component
export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isSmallScreen = dims.width < 380;

  // Auth state
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derived auth info
  const isAuthenticated =
    authState?.isAuthenticated && authState?.authType !== "anonymous";
  const isAdmin = authState?.isAdmin;
  const userEmail = authState?.user?.email;
  const adminRole = authState?.adminRole;

  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false); // NEW: Change password modal
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalType, setInfoModalType] = useState<"about" | "team">("about");

  // Listen to auth state changes
  useEffect(() => {
    console.log("SettingsScreen: Setting up auth listener");

    // Get current state immediately
    const currentState = getCurrentAuthState();
    console.log("SettingsScreen: Current auth state:", currentState);

    if (currentState) {
      setAuthState(currentState);
    }
    setIsLoading(false);

    // Add listener for auth state changes
    const listenerId = "settings-screen";
    addAuthListener(listenerId, (newState: AuthState) => {
      console.log("SettingsScreen: Auth state changed:", newState);
      setAuthState(newState);
    });

    // Cleanup listener on unmount
    return () => {
      console.log("SettingsScreen: Cleaning up auth listener");
      removeAuthListener(listenerId);
    };
  }, []);

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("SettingsScreen: Starting logout process");
              setIsLoading(true);

              const auth = await getUnifiedFirebaseAuth();
              await signOut(auth);

              console.log("SettingsScreen: Logout successful");

              Alert.alert(
                "Signed Out",
                "You have been successfully signed out",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Navigate back to home after successful logout
                      navigation.navigate("Home");
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error("SettingsScreen: Sign out error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle login success
  const handleLoginSuccess = (userType: "registered" | "admin", user: any) => {
    console.log("SettingsScreen: Login successful:", userType, user?.email);
    setShowLoginModal(false);

    const message =
      userType === "admin"
        ? "Admin access enabled! You now have unlimited reporting and validation powers."
        : "Welcome back! You now have unlimited reporting and can track your reports.";

    Alert.alert("Welcome!", message);
  };

  // Handle registration success
  const handleRegistrationSuccess = (user: any) => {
    console.log("SettingsScreen: Registration successful:", user?.email);
    setShowRegistrationModal(false);

    Alert.alert(
      "Welcome to WAISPATH!",
      "Your account has been created successfully. You now have unlimited reporting access."
    );
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true);
  };

  // Handle change password
  const handleChangePassword = () => {
    if (!isAuthenticated) {
      Alert.alert("Sign In Required", "Please sign in to change your password");
      return;
    }

    setShowChangePasswordModal(true); // Open the change password modal
  };

  // Handle account deletion
  const handleAccountDeletion = () => {
    if (!isAuthenticated) {
      Alert.alert("Sign In Required", "Please sign in to delete your account");
      return;
    }

    Alert.alert(
      "Delete Account",
      "This will permanently delete your WAISPATH account and all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Feature Coming Soon",
              "Account deletion will be available in the next update."
            );
          },
        },
      ]
    );
  };

  const getUserDisplayName = () => {
    if (isAdmin && adminRole) {
      return `${adminRole.replace("_", " ").toUpperCase()} Admin`;
    }
    return isAuthenticated ? "Registered User" : "Anonymous User";
  };

  const getUserSubtitle = () => {
    if (isAuthenticated && userEmail) {
      return userEmail;
    }
    if (isAuthenticated) {
      return "Signed in user";
    }
    return "Sign in to access all features";
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="settings" size={48} color={COLORS.softBlue} />
          <Text style={styles.loadingText}>Loading Settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: isSmallScreen ? 28 : 32 }]}>
            Account Settings
          </Text>
          <Text
            style={[styles.subtitle, { fontSize: isSmallScreen ? 14 : 16 }]}
          >
            Manage your WAISPATH account and authentication
          </Text>
        </View>

        {/* Account Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardContent}>
            <View style={styles.statusIcon}>
              <Ionicons
                name={
                  isAuthenticated ? "person-circle" : "person-circle-outline"
                }
                size={32}
                color={isAuthenticated ? COLORS.success : COLORS.muted}
              />
            </View>
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>{getUserDisplayName()}</Text>
              <Text style={styles.statusSubtitle}>{getUserSubtitle()}</Text>
            </View>
            {isAuthenticated && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isAdmin ? COLORS.warning : COLORS.success,
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {isAdmin ? "ADMIN" : "USER"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            {!isAuthenticated ? (
              <>
                <SettingsRow
                  icon="log-in-outline"
                  title="Sign In"
                  subtitle="Access your saved routes and preferences"
                  onPress={() => setShowLoginModal(true)}
                />
                <SettingsRow
                  icon="person-add-outline"
                  title="Create Account"
                  subtitle="Join the WAISPATH community"
                  onPress={() => setShowRegistrationModal(true)}
                />
                <SettingsRow
                  icon="help-circle-outline"
                  title="Forgot Password?"
                  subtitle="Reset your password"
                  onPress={handleForgotPassword}
                />
              </>
            ) : (
              <>
                <SettingsRow
                  icon="key-outline"
                  title="Change Password"
                  subtitle="Update your account password"
                  onPress={handleChangePassword}
                />
                <SettingsRow
                  icon="mail-outline"
                  title="Email Settings"
                  subtitle="Manage email verification and notifications"
                  onPress={() =>
                    Alert.alert(
                      "Coming Soon",
                      "Email settings will be available in the next update"
                    )
                  }
                />
                <SettingsRow
                  icon="trash-outline"
                  title="Delete Account"
                  subtitle="Permanently delete your account and data"
                  titleStyle={{ color: COLORS.error }}
                  onPress={handleAccountDeletion}
                />
                <SettingsRow
                  icon="log-out-outline"
                  title="Sign Out"
                  subtitle="Sign out of your account"
                  titleStyle={{ color: COLORS.error }}
                  onPress={handleLogout}
                />
              </>
            )}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="information-circle-outline"
              title="App Version"
              subtitle="1.0.0 (Build 1)"
            />
            <SettingsRow
              icon="help-circle-outline"
              title="The Team"
              subtitle="Get to know the capstone duo"
              onPress={() => {
                setInfoModalType("team"); // we are using 'team' type for credits/help
                setShowInfoModal(true);
              }}
            />
            <SettingsRow
              icon="heart-outline"
              title="About WAISPATH"
              subtitle="Making Pasig City accessible for everyone"
              onPress={() => {
                setInfoModalType("about");
                setShowInfoModal(true);
              }}
            />
          </View>
        </View>

        {/* Bottom padding for better scrolling */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Authentication Modals */}
      <Modal
        visible={showLoginModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <UniversalLoginForm
          mode="login"
          onLoginSuccess={handleLoginSuccess}
          onCancel={() => setShowLoginModal(false)}
        />
      </Modal>

      <Modal
        visible={showRegistrationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRegistrationModal(false)}
      >
        <RegistrationForm
          onRegistrationSuccess={handleRegistrationSuccess}
          onCancel={() => setShowRegistrationModal(false)}
          onSwitchToLogin={() => {
            setShowRegistrationModal(false);
            setShowLoginModal(true);
          }}
        />
      </Modal>

      <Modal
        visible={showForgotPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForgotPasswordModal(false)}
      >
        <ForgotPasswordForm
          onCancel={() => setShowForgotPasswordModal(false)}
          onSuccess={() => setShowForgotPasswordModal(false)}
          onSwitchToLogin={() => {
            setShowForgotPasswordModal(false);
            setShowLoginModal(true);
          }}
        />
      </Modal>
      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <ChangePasswordForm
          onCancel={() => setShowChangePasswordModal(false)}
          onSuccess={() => {
            setShowChangePasswordModal(false);
            // Optionally show success message here
          }}
        />
      </Modal>

      {/* Info Modal (About / Team) */}
      <InfoModal
        visible={showInfoModal}
        type={infoModalType}
        onClose={() => setShowInfoModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.slate,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    lineHeight: 22,
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: COLORS.chipBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  statusCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    marginRight: 16,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.white,
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 12,
    marginHorizontal: 24,
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    minHeight: 60,
  },
  settingsRowDisabled: {
    opacity: 0.5,
  },
  settingsRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  settingsRowRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.chipBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingsTextContainer: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.slate,
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 18,
  },
  disabledText: {
    color: COLORS.muted,
  },
});
