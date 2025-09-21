// src/components/RegistrationForm.tsx
// ENHANCED: User Registration Component with password strength validation
// INTEGRATES: Real-time validation, duplicate email handling, accessibility features

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
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  signInWithEmailAndPassword,
} from "firebase/auth";

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
  score: number; // 0-100
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
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Email validation
  const validateEmail = (
    email: string
  ): { isValid: boolean; feedback: string } => {
    if (!email.trim()) {
      return { isValid: false, feedback: "Email address is required" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, feedback: "Please enter a valid email address" };
    }

    return { isValid: true, feedback: "Valid email address" };
  };

  // Password strength calculation (same as change password form)
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

  const emailValidation = validateEmail(email);
  const passwordStrength = calculatePasswordStrength(password);

  // Form validation
  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!emailValidation.isValid) {
      return { isValid: false, error: emailValidation.feedback };
    }

    if (!passwordStrength.isValid) {
      return {
        isValid: false,
        error: "Password is too weak. Please follow the requirements below.",
      };
    }

    if (password !== confirmPassword) {
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
      const auth = await getFirebaseAuth();
      let userCredential;

      if (mode === "upgrade" && auth.currentUser?.isAnonymous) {
        // Upgrade anonymous user to registered account
        console.log("🔄 Upgrading anonymous user to registered account");
        const credential = EmailAuthProvider.credential(email, password);
        userCredential = await linkWithCredential(auth.currentUser, credential);
        console.log(
          "✅ Anonymous account successfully linked to email/password"
        );
      } else {
        // Create new account
        console.log("🔄 Creating new user account");
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        console.log("✅ New user account created successfully");
      }

      const user = userCredential.user;

      // Check if this becomes an admin (unlikely but possible)
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

      // Handle specific Firebase errors with user-friendly messages
      let errorMessage = "Registration failed";

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage =
            "An account with this email already exists. Try signing in instead.";
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
          errorMessage =
            error.message ||
            "An unexpected error occurred during registration.";
      }

      return {
        success: false,
        message: errorMessage,
      };
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
      ? "Link your anonymous account to get unlimited access and report tracking"
      : "Join the community and help make Pasig more accessible for everyone";
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
              accessibilityLabel="Close registration form"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={COLORS.muted} />
            </TouchableOpacity>
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>

          {/* Registration Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  emailTouched && !emailValidation.isValid && styles.inputError,
                  emailTouched &&
                    emailValidation.isValid &&
                    styles.inputSuccess,
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
                  onBlur={() => setEmailTouched(true)}
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
                {emailTouched && emailValidation.isValid && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={COLORS.success}
                  />
                )}
              </View>
              {emailTouched && !emailValidation.isValid && (
                <Text style={styles.errorText}>{emailValidation.feedback}</Text>
              )}
            </View>

            {/* Password Input */}
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
              {password.length > 0 && (
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

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  confirmPasswordTouched &&
                    password !== confirmPassword &&
                    styles.inputError,
                  confirmPasswordTouched &&
                    password === confirmPassword &&
                    confirmPassword.length > 0 &&
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
                  onChangeText={setConfirmPassword}
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

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchContainer}>
                  <Ionicons
                    name={
                      password === confirmPassword
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      password === confirmPassword
                        ? COLORS.success
                        : COLORS.error
                    }
                  />
                  <Text
                    style={[
                      styles.matchText,
                      {
                        color:
                          password === confirmPassword
                            ? COLORS.success
                            : COLORS.error,
                      },
                    ]}
                  >
                    {password === confirmPassword
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </Text>
                </View>
              )}
            </View>

            {/* Password Requirements */}
            {password.length > 0 && passwordStrength.feedback.length > 0 && (
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

            {/* Terms and Conditions */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptTerms(!acceptTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptTerms }}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptTerms && styles.checkboxChecked,
                  ]}
                >
                  {acceptTerms && (
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* Benefits Section */}
            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Account Benefits:</Text>
              <View style={styles.benefitsList}>
                <View style={styles.benefit}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={styles.benefitText}>
                    Unlimited accessibility reporting
                  </Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={styles.benefitText}>
                    Save and sync your routes
                  </Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={styles.benefitText}>
                    Track your community contributions
                  </Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={styles.benefitText}>
                    Personalized accessibility preferences
                  </Text>
                </View>
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
              accessibilityLabel="Create account"
              accessibilityRole="button"
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.submitButtonText}>
                    Creating Account...
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color={COLORS.white} />
                  <Text style={styles.submitButtonText}>
                    {mode === "upgrade" ? "Upgrade Account" : "Create Account"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={handleSwitchToLogin}
                accessibilityLabel="Switch to sign in"
                accessibilityRole="button"
              >
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
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
    marginBottom: 20,
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
  inputError: {
    borderColor: COLORS.error,
  },
  inputSuccess: {
    borderColor: COLORS.success,
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
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 6,
    marginLeft: 4,
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
    marginBottom: 20,
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
  termsContainer: {
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  termsLink: {
    color: COLORS.softBlue,
    fontWeight: "500",
  },
  benefitsContainer: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.navy,
    marginBottom: 12,
  },
  benefitsList: {
    gap: 10,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitText: {
    fontSize: 14,
    color: COLORS.slate,
    marginLeft: 10,
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.muted,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  footerLink: {
    fontSize: 14,
    color: COLORS.softBlue,
    fontWeight: "500",
  },
});
