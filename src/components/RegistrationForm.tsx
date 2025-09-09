// src/components/RegistrationForm.tsx
// User Registration Component - Clean signup flow for WAISPATH
// UPDATED: Added onSwitchToLogin prop for modal switching

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
  onSwitchToLogin?: () => void; // NEW: Optional prop for switching to login modal
  mode?: "standalone" | "upgrade"; // upgrade = anonymous user upgrading
}

export default function RegistrationForm({
  onRegistrationSuccess,
  onCancel,
  onSwitchToLogin, // NEW: Added prop
  mode = "standalone",
}: RegistrationFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form validation
  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!email.trim()) {
      return { isValid: false, error: "Email address is required" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: "Please enter a valid email address" };
    }

    if (!password) {
      return { isValid: false, error: "Password is required" };
    }

    if (password.length < 6) {
      return {
        isValid: false,
        error: "Password must be at least 6 characters",
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

      // Handle specific Firebase errors
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
        // FIXED: Don't show Alert here - let parent handle success message
        // Just call the success callback directly
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

  // NEW: Handle switching to login modal
  const handleSwitchToLogin = () => {
    if (onSwitchToLogin) {
      onSwitchToLogin();
    } else {
      // Fallback if no onSwitchToLogin provided
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
            <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
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
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
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
                  placeholder="Enter a secure password"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.passwordHint}>Minimum 6 characters</Text>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
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
                  placeholder="Confirm your password"
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
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
            </View>

            {/* Terms Acceptance */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptTerms(!acceptTerms)}
                disabled={isLoading}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptTerms && styles.checkboxChecked,
                  ]}
                >
                  {acceptTerms && (
                    <Ionicons name="checkmark" size={16} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to WAISPATH's{" "}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* Benefits Section for Upgrade Mode */}
            {mode === "upgrade" && (
              <View style={styles.benefitsContainer}>
                <Text style={styles.benefitsTitle}>Unlock These Features:</Text>
                <View style={styles.benefitsList}>
                  {[
                    {
                      icon: "infinite-outline",
                      text: "Unlimited obstacle reporting",
                    },
                    {
                      icon: "camera-outline",
                      text: "Photo uploads with reports",
                    },
                    { icon: "list-outline", text: "Track your report history" },
                    {
                      icon: "people-outline",
                      text: "Join community validation",
                    },
                    {
                      icon: "cloud-upload-outline",
                      text: "Cloud sync across devices",
                    },
                  ].map((benefit, index) => (
                    <View key={index} style={styles.benefit}>
                      <Ionicons
                        name={benefit.icon as any}
                        size={18}
                        color={COLORS.success}
                      />
                      <Text style={styles.benefitText}>{benefit.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                isLoading && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.submitButtonText}>
                    {mode === "upgrade"
                      ? "Upgrading Account..."
                      : "Creating Account..."}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons
                    name="person-add-outline"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.submitButtonText}>
                    {mode === "upgrade" ? "Upgrade Account" : "Create Account"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Footer - UPDATED: Added onPress handler for "Sign in instead" */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{" "}
                <Text style={styles.footerLink} onPress={handleSwitchToLogin}>
                  Sign in instead
                </Text>
              </Text>
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
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 8,
    textAlign: "center",
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
    borderWidth: 1.5,
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
  passwordHint: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
    marginLeft: 4,
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
    alignItems: "center",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  footerLink: {
    color: COLORS.softBlue,
    fontWeight: "500",
  },
});
