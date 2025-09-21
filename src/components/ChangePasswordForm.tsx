// src/components/ChangePasswordForm.tsx
// WAISPATH Change Password Component - In-app password management for PWDs
// INTEGRATES: With existing Firebase auth and WAISPATH design system

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
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

interface ChangePasswordFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

interface PasswordStrength {
  isValid: boolean;
  strength: "weak" | "medium" | "strong";
  feedback: string[];
  score: number; // 0-100
}

export default function ChangePasswordForm({
  onCancel,
  onSuccess,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength calculation
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score += 25;
    } else {
      feedback.push("Use at least 8 characters");
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 20;
    } else {
      feedback.push("Add an uppercase letter");
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 20;
    } else {
      feedback.push("Add a lowercase letter");
    }

    // Number check
    if (/\d/.test(password)) {
      score += 15;
    } else {
      feedback.push("Add a number");
    }

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 20;
    } else {
      feedback.push("Add a special character (!@#$%^&*)");
    }

    // Determine strength
    let strength: "weak" | "medium" | "strong";
    if (score >= 80) strength = "strong";
    else if (score >= 60) strength = "medium";
    else strength = "weak";

    return {
      isValid: score >= 60 && password.length >= 8,
      strength,
      feedback,
      score,
    };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!currentPassword.trim()) {
      return { isValid: false, error: "Current password is required" };
    }

    if (!newPassword.trim()) {
      return { isValid: false, error: "New password is required" };
    }

    if (!passwordStrength.isValid) {
      return {
        isValid: false,
        error: "Password is too weak. Please follow the requirements below.",
      };
    }

    if (newPassword !== confirmPassword) {
      return { isValid: false, error: "New passwords do not match" };
    }

    if (currentPassword === newPassword) {
      return {
        isValid: false,
        error: "New password must be different from current password",
      };
    }

    return { isValid: true };
  };

  const handleChangePassword = async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      Alert.alert("Invalid Input", validation.error);
      return;
    }

    try {
      setIsLoading(true);
      const auth = await getUnifiedFirebaseAuth();
      const user = auth.currentUser;

      if (!user || !user.email) {
        Alert.alert("Error", "No user logged in");
        return;
      }

      // Re-authenticate user first for security
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      Alert.alert(
        "Password Updated",
        "Your password has been successfully changed. You will remain logged in.",
        [{ text: "OK", onPress: onSuccess }]
      );
    } catch (error: any) {
      console.error("Change password failed:", error);

      let errorMessage = "Failed to change password";

      switch (error.code) {
        case "auth/wrong-password":
          errorMessage = "Current password is incorrect";
          break;
        case "auth/weak-password":
          errorMessage = "New password is too weak";
          break;
        case "auth/requires-recent-login":
          errorMessage =
            "For security reasons, please log out and log back in before changing your password";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your connection and try again";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Please try again later";
          break;
        default:
          errorMessage =
            error.message || "Failed to change password. Please try again";
      }

      Alert.alert("Change Password Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength.strength) {
      case "strong":
        return COLORS.success;
      case "medium":
        return COLORS.warning;
      case "weak":
        return COLORS.error;
      default:
        return COLORS.muted;
    }
  };

  const getStrengthText = () => {
    switch (passwordStrength.strength) {
      case "strong":
        return "Strong password";
      case "medium":
        return "Medium strength";
      case "weak":
        return "Weak password";
      default:
        return "";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              accessibilityLabel="Close change password form"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={COLORS.muted} />
            </TouchableOpacity>

            <Text style={styles.title}>Change Password</Text>
            <Text style={styles.subtitle}>
              Update your password to keep your WAISPATH account secure
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Current Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter your current password"
                  secureTextEntry={!showCurrentPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  editable={!isLoading}
                  accessibilityLabel="Current password"
                  accessibilityHint="Enter your existing password for verification"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showCurrentPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={
                      showCurrentPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter a new secure password"
                  secureTextEntry={!showNewPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                  accessibilityLabel="New password"
                  accessibilityHint="Enter your new password"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showNewPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${passwordStrength.score}%`,
                          backgroundColor: getStrengthColor(),
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.strengthText, { color: getStrengthColor() }]}
                  >
                    {getStrengthText()}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your new password"
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                  accessibilityLabel="Confirm new password"
                  accessibilityHint="Re-enter your new password to confirm"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchContainer}>
                  <Ionicons
                    name={
                      newPassword === confirmPassword
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      newPassword === confirmPassword
                        ? COLORS.success
                        : COLORS.error
                    }
                  />
                  <Text
                    style={[
                      styles.matchText,
                      {
                        color:
                          newPassword === confirmPassword
                            ? COLORS.success
                            : COLORS.error,
                      },
                    ]}
                  >
                    {newPassword === confirmPassword
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </Text>
                </View>
              )}
            </View>

            {/* Password Requirements */}
            {newPassword.length > 0 && passwordStrength.feedback.length > 0 && (
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>
                  Password Requirements:
                </Text>
                {passwordStrength.feedback.map((requirement, index) => (
                  <View key={index} style={styles.requirementItem}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={COLORS.error}
                    />
                    <Text style={styles.requirementText}>{requirement}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Change Password Button */}
            <TouchableOpacity
              style={[
                styles.changeButton,
                (!validateForm().isValid || isLoading) &&
                  styles.changeButtonDisabled,
              ]}
              onPress={handleChangePassword}
              disabled={!validateForm().isValid || isLoading}
              accessibilityLabel="Change password"
              accessibilityRole="button"
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.changeButtonText}>Updating...</Text>
                </View>
              ) : (
                <>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.changeButtonText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={COLORS.softBlue}
              />
              <View style={styles.securityContent}>
                <Text style={styles.securityTitle}>Security Notice</Text>
                <Text style={styles.securityText}>
                  Changing your password will not log you out of other devices.
                  For maximum security, consider logging out of all devices
                  after changing your password.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    paddingBottom: 32,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.slate,
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  form: {
    padding: 24,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.slate,
    paddingVertical: 16,
    paddingRight: 16,
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 4,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: "500",
  },
  matchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  matchText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  requirementsContainer: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 14,
    color: COLORS.error,
    marginLeft: 8,
  },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  changeButtonDisabled: {
    backgroundColor: COLORS.muted,
    shadowOpacity: 0,
    elevation: 0,
  },
  changeButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  securityNotice: {
    flexDirection: "row",
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  securityContent: {
    flex: 1,
    marginLeft: 12,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },
  securityText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
});
