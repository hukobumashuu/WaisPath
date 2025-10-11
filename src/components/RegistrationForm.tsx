// src/components/RegistrationForm.tsx
// SIMPLE & RELIABLE: Format validation + Firebase duplicate handling
// No complex real-time availability checking

import React, { useState, useEffect } from "react";
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
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import PolicyModal from "./PolicyModal";

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
  orange: "#F97316",
};

interface RegistrationResult {
  success: boolean;
  user?: any;
  message: string;
}

interface RegistrationFormProps {
  onRegistrationSuccess: (user: any) => void;
  onCancel: () => void;
  onSwitchToLogin?: () => void;
  mode?: "standalone" | "upgrade";
}

interface PasswordStrength {
  isValid: boolean;
  strength: "weak" | "medium" | "strong";
  feedback: string[];
  score: number;
  requirements: PasswordRequirement[];
}

interface PasswordRequirement {
  label: string;
  met: boolean;
  icon: string;
}

export default function RegistrationForm({
  onRegistrationSuccess,
  onCancel,
  onSwitchToLogin,
  mode = "standalone",
}: RegistrationFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation states
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Policy modal states
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyInitialTab, setPolicyInitialTab] = useState<"terms" | "privacy">(
    "terms"
  );

  // Simple email validation
  const validateEmailFormat = (email: string): boolean => {
    if (!email.trim()) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isEmailValid = validateEmailFormat(email);

  // Password strength calculation
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    const requirements: PasswordRequirement[] = [
      {
        label: "At least 8 characters",
        met: password.length >= 8,
        icon: password.length >= 8 ? "checkmark-circle" : "close-circle",
      },
      {
        label: "One uppercase letter",
        met: /[A-Z]/.test(password),
        icon: /[A-Z]/.test(password) ? "checkmark-circle" : "close-circle",
      },
      {
        label: "One lowercase letter",
        met: /[a-z]/.test(password),
        icon: /[a-z]/.test(password) ? "checkmark-circle" : "close-circle",
      },
      {
        label: "One number",
        met: /\d/.test(password),
        icon: /\d/.test(password) ? "checkmark-circle" : "close-circle",
      },
      {
        label: "One special character (!@#$%^&*)",
        met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        icon: /[!@#$%^&*(),.?":{}|<>]/.test(password)
          ? "checkmark-circle"
          : "close-circle",
      },
    ];

    const metRequirements = requirements.filter((req) => req.met).length;
    let score = (metRequirements / requirements.length) * 100;

    let strength: "weak" | "medium" | "strong";
    if (score >= 80) strength = "strong";
    else if (score >= 60) strength = "medium";
    else strength = "weak";

    const feedback = requirements
      .filter((req) => !req.met)
      .map((req) => req.label);

    return {
      isValid: metRequirements >= 4 && password.length >= 8,
      strength,
      feedback,
      score,
      requirements,
    };
  };

  const passwordStrength = calculatePasswordStrength(password);

  // Confirm password validation
  const isConfirmPasswordValid = () => {
    return confirmPassword.length > 0 && password === confirmPassword;
  };

  // Simple form validation
  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!isEmailValid) {
      return {
        isValid: false,
        error: "Please enter a valid email address",
      };
    }

    if (!passwordStrength.isValid) {
      return {
        isValid: false,
        error: "Please meet all password requirements.",
      };
    }

    if (!isConfirmPasswordValid()) {
      return { isValid: false, error: "Passwords do not match" };
    }

    if (!acceptTerms) {
      return { isValid: false, error: "Please accept the Terms of Service" };
    }

    return { isValid: true };
  };

  const getFirebaseAuth = async () => {
    try {
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );
      return await getUnifiedFirebaseAuth();
    } catch (error) {
      console.error("Failed to get Firebase Auth:", error);
      throw new Error("Authentication service unavailable");
    }
  };

  const performRegistration = async (): Promise<RegistrationResult> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const auth = await getFirebaseAuth();
      let userCredential;

      if (mode === "upgrade" && auth.currentUser?.isAnonymous) {
        console.log("🔄 Upgrading anonymous user to registered account");
        const credential = EmailAuthProvider.credential(
          normalizedEmail,
          password
        );
        userCredential = await linkWithCredential(auth.currentUser, credential);
        console.log(
          "✅ Anonymous account successfully linked to email/password"
        );
      } else {
        console.log("🔄 Creating new user account");
        userCredential = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );
        console.log("✅ New user account created successfully");
      }

      const user = userCredential.user;
      const tokenResult = await user.getIdTokenResult();
      const isAdmin = tokenResult.claims.admin === true;

      return {
        success: true,
        user: {
          ...user,
          isAdmin,
          customClaims: tokenResult.claims,
        },
        message:
          mode === "upgrade"
            ? "Account upgraded successfully! You now have unlimited access."
            : "Welcome to WAISPATH! Your account has been created successfully.",
      };
    } catch (error: any) {
      console.error("Registration failed:", error);

      let errorMessage = "Registration failed";
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage =
            "This email is already registered. Please sign in instead or use a different email address.";
          break;
        case "auth/weak-password":
          errorMessage =
            "Password is too weak. Please choose a stronger password.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address format.";
          break;
        case "auth/operation-not-allowed":
          errorMessage =
            "Email registration is not enabled. Please contact support.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your connection and try again.";
          break;
        case "auth/too-many-requests":
          errorMessage =
            "Too many registration attempts. Please wait before trying again.";
          break;
        default:
          errorMessage = error.message || "An unexpected error occurred.";
      }

      return { success: false, message: errorMessage };
    }
  };

  const handleSubmit = async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      Alert.alert("Registration Error", validation.error);
      return;
    }

    setIsLoading(true);

    try {
      const result = await performRegistration();

      if (result.success) {
        onRegistrationSuccess(result.user);
      } else {
        Alert.alert("Registration Failed", result.message);
      }
    } catch (error: any) {
      console.error("Registration submission failed:", error);
      Alert.alert(
        "Registration Error",
        "An unexpected error occurred. Please try again."
      );
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
        "Please close this form and use the Sign In button instead."
      );
    }
  };

  const getTitle = () => {
    return mode === "upgrade"
      ? "Upgrade Your Account"
      : "Create Your WAISPATH Account";
  };

  const getSubtitle = () => {
    return mode === "upgrade"
      ? "Get unlimited access and track your accessibility reports"
      : "Join the community making cities more accessible";
  };

  // Password strength indicator color
  const getPasswordStrengthColor = () => {
    switch (passwordStrength.strength) {
      case "strong":
        return COLORS.success;
      case "medium":
        return COLORS.orange;
      default:
        return COLORS.error;
    }
  };

  // Policy modal helpers
  const openPolicyModal = (tab: "terms" | "privacy") => {
    setPolicyInitialTab(tab);
    setShowPolicyModal(true);
  };

  const closePolicyModal = () => {
    setShowPolicyModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close registration form"
            >
              <Ionicons name="close" size={24} color={COLORS.slate} />
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={styles.title}>{getTitle()}</Text>
              <Text style={styles.subtitle}>{getSubtitle()}</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input with Format Validation */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  email.length > 0 && isEmailValid && styles.inputSuccess,
                  email.length > 0 && !isEmailValid && styles.inputError,
                ]}
              >
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
                  accessibilityLabel="Email address"
                  accessibilityHint="Enter your email address for your WAISPATH account"
                />
                {email.length > 0 && (
                  <Ionicons
                    name={isEmailValid ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={isEmailValid ? COLORS.success : COLORS.error}
                  />
                )}
              </View>
              {email.length > 0 && !isEmailValid && (
                <Text style={styles.errorText}>
                  Please enter a valid email address
                </Text>
              )}
            </View>

            {/* Password Input with Progress Bar */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  passwordTouched &&
                    !passwordStrength.isValid &&
                    styles.inputError,
                  passwordTouched &&
                    passwordStrength.isValid &&
                    styles.inputSuccess,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => setPasswordTouched(true)}
                  onFocus={() => setPasswordTouched(true)}
                  placeholder="Enter a secure password"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                  accessibilityLabel="Password"
                  accessibilityHint="Enter a secure password for your account"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {(passwordTouched || password.length > 0) && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.strengthHeader}>
                    <Text style={styles.strengthLabel}>Password Strength</Text>
                    {password.length > 0 && (
                      <Text
                        style={[
                          styles.strengthText,
                          { color: getPasswordStrengthColor() },
                        ]}
                      >
                        {passwordStrength.strength.toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${passwordStrength.score}%`,
                          backgroundColor: getPasswordStrengthColor(),
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.requirementsList}>
                    {passwordStrength.requirements.map((req, index) => (
                      <View key={index} style={styles.requirementItem}>
                        <Ionicons
                          name={req.icon as any}
                          size={14}
                          color={req.met ? COLORS.success : COLORS.muted}
                        />
                        <Text
                          style={[
                            styles.requirementText,
                            { color: req.met ? COLORS.success : COLORS.muted },
                          ]}
                        >
                          {req.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  confirmPasswordTouched &&
                    !isConfirmPasswordValid() &&
                    styles.inputError,
                  confirmPasswordTouched &&
                    isConfirmPasswordValid() &&
                    styles.inputSuccess,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (text.length > 0) {
                      setConfirmPasswordTouched(true);
                    }
                  }}
                  onBlur={() => setConfirmPasswordTouched(true)}
                  placeholder="Confirm your password"
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                  accessibilityLabel="Confirm password"
                  accessibilityHint="Re-enter your password to confirm"
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
              {confirmPasswordTouched &&
                !isConfirmPasswordValid() &&
                confirmPassword.length > 0 && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
            </View>

            {/* Terms and Conditions Checkbox + Links */}
            <View style={styles.termsContainer}>
              {/* Checkbox only toggles acceptance */}
              <TouchableOpacity
                onPress={() => setAcceptTerms(!acceptTerms)}
                style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptTerms }}
                accessibilityLabel="Accept Terms of Service and Privacy Policy"
              >
                {acceptTerms && (
                  <Ionicons name="checkmark" size={14} color={COLORS.white} />
                )}
              </TouchableOpacity>

              {/* Text with tappable links that open the policy modal (uses Text.onPress for perfect inline alignment) */}
              <View style={{ flex: 1 }}>
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text
                    style={styles.termsLink}
                    onPress={() => openPolicyModal("terms")}
                    accessibilityRole="link"
                    accessibilityLabel="Open Terms of Service"
                  >
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={styles.termsLink}
                    onPress={() => openPolicyModal("privacy")}
                    accessibilityRole="link"
                    accessibilityLabel="Open Privacy Policy"
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!validateForm().isValid || isLoading) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!validateForm().isValid || isLoading}
              accessibilityRole="button"
              accessibilityLabel={
                mode === "upgrade" ? "Upgrade account" : "Create account"
              }
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === "upgrade"
                    ? "Get Unlimited Access"
                    : "Create Account"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch to Login */}
            {onSwitchToLogin && (
              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={handleSwitchToLogin}
                  accessibilityRole="button"
                  accessibilityLabel="Switch to sign in"
                >
                  <Text style={styles.switchLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Policy Modal */}
      <PolicyModal
        visible={showPolicyModal}
        initialTab={policyInitialTab}
        onClose={closePolicyModal}
        termsLastUpdated="October 11, 2025"
        privacyLastUpdated="October 11, 2025"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  titleContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.navy,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
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
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputSuccess: {
    borderColor: COLORS.success,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.slate,
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 8,
    fontWeight: "500",
  },
  passwordStrengthContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "700",
  },
  strengthBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  requirementsList: {
    gap: 6,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  requirementText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: "500",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.muted,
    marginRight: 12,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  checkboxChecked: {
    backgroundColor: COLORS.softBlue,
    borderColor: COLORS.softBlue,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  termsLink: {
    color: COLORS.softBlue,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.muted,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  switchLink: {
    fontSize: 14,
    color: COLORS.softBlue,
    fontWeight: "600",
  },
});
