// src/components/ForgotPasswordForm.tsx
// WAISPATH Password Reset Component - Accessible password recovery for PWDs
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
import { sendPasswordResetEmail } from "firebase/auth";
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

interface ForgotPasswordFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  onSwitchToLogin?: () => void;
}

export default function ForgotPasswordForm({
  onCancel,
  onSuccess,
  onSwitchToLogin,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (
    email: string
  ): { isValid: boolean; error?: string } => {
    if (!email.trim()) {
      return { isValid: false, error: "Email address is required" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: "Please enter a valid email address" };
    }

    return { isValid: true };
  };

  const handlePasswordReset = async () => {
    const validation = validateEmail(email);
    if (!validation.isValid) {
      Alert.alert("Invalid Email", validation.error);
      return;
    }

    try {
      setIsLoading(true);
      const auth = await getUnifiedFirebaseAuth();

      await sendPasswordResetEmail(auth, email);

      setEmailSent(true);
      Alert.alert(
        "Reset Email Sent",
        `We've sent password reset instructions to ${email}.\n\nPlease check your email and follow the link to reset your password. The link will expire in 1 hour.`,
        [
          {
            text: "OK",
            onPress: () => {
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Password reset failed:", error);

      let errorMessage = "Failed to send reset email";

      switch (error.code) {
        case "auth/user-not-found":
          errorMessage =
            "No account found with this email address. Please check your email or create a new account.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address format";
          break;
        case "auth/too-many-requests":
          errorMessage =
            "Too many reset requests. Please wait a few minutes before trying again.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection and try again.";
          break;
        default:
          errorMessage =
            error.message || "Failed to send reset email. Please try again.";
      }

      Alert.alert("Reset Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToLogin = () => {
    if (onSwitchToLogin) {
      onSwitchToLogin();
    } else {
      Alert.alert(
        "Sign In",
        "Please close this form and use the Sign In option in Settings."
      );
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
              accessibilityLabel="Close password reset form"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={COLORS.muted} />
            </TouchableOpacity>

            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a secure link to reset
              your password
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Success State */}
            {emailSent && (
              <View style={styles.successCard}>
                <View style={styles.successIconContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color={COLORS.success}
                  />
                </View>
                <Text style={styles.successTitle}>Check Your Email</Text>
                <Text style={styles.successText}>
                  We've sent password reset instructions to{" "}
                  <Text style={styles.emailText}>{email}</Text>
                </Text>
                <Text style={styles.instructionText}>
                  • Check your inbox and spam folder{"\n"}• Click the reset link
                  in the email{"\n"}• Create a new password{"\n"}• The link
                  expires in 1 hour
                </Text>
              </View>
            )}

            {/* Email Input */}
            {!emailSent && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={COLORS.muted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="your-email@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      editable={!isLoading}
                      accessibilityLabel="Email address for password reset"
                      accessibilityHint="Enter the email address associated with your WAISPATH account"
                    />
                  </View>
                  <Text style={styles.inputHint}>
                    Enter the email address you used to create your WAISPATH
                    account
                  </Text>
                </View>

                {/* Reset Button */}
                <TouchableOpacity
                  style={[
                    styles.resetButton,
                    isLoading && styles.resetButtonDisabled,
                  ]}
                  onPress={handlePasswordReset}
                  disabled={isLoading}
                  accessibilityLabel="Send password reset email"
                  accessibilityRole="button"
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={COLORS.white} />
                      <Text style={styles.resetButtonText}>Sending...</Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="mail" size={20} color={COLORS.white} />
                      <Text style={styles.resetButtonText}>
                        Send Reset Email
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Help Section */}
                <View style={styles.helpSection}>
                  <View style={styles.helpCard}>
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={COLORS.softBlue}
                    />
                    <View style={styles.helpContent}>
                      <Text style={styles.helpTitle}>Need Help?</Text>
                      <Text style={styles.helpText}>
                        • Make sure you entered the correct email{"\n"}• Check
                        your spam/junk folder{"\n"}• Contact support if you
                        don't receive the email
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Footer Actions */}
            <View style={styles.footer}>
              {emailSent ? (
                <TouchableOpacity
                  style={styles.footerButton}
                  onPress={onCancel}
                  accessibilityLabel="Close password reset form"
                  accessibilityRole="button"
                >
                  <Text style={styles.footerButtonText}>Done</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.footerText}>
                    Remember your password?{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={handleSwitchToLogin}
                    accessibilityLabel="Switch to sign in form"
                    accessibilityRole="button"
                  >
                    <Text style={styles.footerLink}>Sign In</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Contact Support */}
            {emailSent && (
              <View style={styles.supportSection}>
                <Text style={styles.supportText}>
                  Still having trouble? Contact WAISPATH support for assistance.
                </Text>
                <TouchableOpacity
                  style={styles.supportButton}
                  onPress={() =>
                    Alert.alert(
                      "Contact Support",
                      "Email: support@waispath.ph\nPhone: +63 2 8XXX-XXXX\n\nWe typically respond within 24 hours."
                    )
                  }
                  accessibilityLabel="Contact support"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={COLORS.softBlue}
                  />
                  <Text style={styles.supportButtonText}>Contact Support</Text>
                </TouchableOpacity>
              </View>
            )}
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
  successCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 8,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    color: COLORS.slate,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  emailText: {
    fontWeight: "600",
    color: COLORS.softBlue,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    textAlign: "left",
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
  inputHint: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
    marginLeft: 4,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.softBlue,
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resetButtonDisabled: {
    backgroundColor: COLORS.muted,
    shadowOpacity: 0,
    elevation: 0,
  },
  resetButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  helpSection: {
    marginBottom: 24,
  },
  helpCard: {
    flexDirection: "row",
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.softBlue,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  footerText: {
    fontSize: 16,
    color: COLORS.muted,
  },
  footerLink: {
    fontSize: 16,
    color: COLORS.softBlue,
    fontWeight: "600",
  },
  footerButton: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  supportSection: {
    alignItems: "center",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  supportText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.softBlue,
  },
  supportButtonText: {
    fontSize: 14,
    color: COLORS.softBlue,
    fontWeight: "500",
    marginLeft: 6,
  },
});
