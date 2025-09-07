// src/components/UniversalLoginForm.tsx
// 🔐 COMPATIBLE VERSION: Works with your Firebase version

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { enhancedFirebaseService } from "../services/enhancedFirebase";

const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  lightGray: "#F8FAFC",
  success: "#10B981",
  error: "#EF4444",
};

interface UniversalLoginFormProps {
  onLoginSuccess: (userType: "admin" | "registered", userInfo: any) => void;
  onSwitchToRegister?: () => void;
  onCancel?: () => void;
  mode?: "login" | "upgrade";
}

interface LoginResult {
  success: boolean;
  userType: "admin" | "registered";
  user: any;
  adminRole?: string;
  message?: string;
}

export default function UniversalLoginForm({
  onLoginSuccess,
  onSwitchToRegister,
  onCancel,
  mode = "login",
}: UniversalLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter both email and password"
      );
      return;
    }

    setIsLoading(true);

    try {
      console.log(`🔐 Attempting ${mode} for:`, email);

      const result = await performAuthentication(
        email.trim(),
        password.trim(),
        mode
      );

      if (result.success) {
        console.log(
          `✅ ${mode} successful:`,
          result.userType,
          result.adminRole || "regular user"
        );

        const welcomeMessage =
          result.userType === "admin"
            ? `Welcome back, ${result.adminRole
                ?.replace("_", " ")
                .toUpperCase()} administrator!`
            : "Welcome! You now have access to unlimited reporting.";

        Alert.alert("Login Successful", welcomeMessage);
        onLoginSuccess(result.userType, result.user);

        // Refresh user status
        await enhancedFirebaseService.getCurrentUserContext();
      } else {
        Alert.alert(
          "Login Failed",
          result.message || "Invalid email or password"
        );
      }
    } catch (error: any) {
      console.error(`${mode} failed:`, error);
      Alert.alert("Login Error", `Failed to sign in: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const performAuthentication = async (
    email: string,
    password: string,
    authMode: "login" | "upgrade"
  ): Promise<LoginResult> => {
    try {
      const auth = await getExistingFirebaseAuth();

      if (!auth) {
        throw new Error("Firebase Auth not available");
      }

      let userCredential;

      if (authMode === "upgrade") {
        // Check if there's actually an anonymous user to upgrade
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          // Link anonymous account to email/password
          const credential = EmailAuthProvider.credential(email, password);
          userCredential = await linkWithCredential(
            auth.currentUser,
            credential
          );
          console.log("✅ Anonymous account linked to email/password");
        } else {
          // No anonymous user, just do regular login/registration
          console.log("⚠️ No anonymous user found, attempting regular login");
          try {
            userCredential = await signInWithEmailAndPassword(
              auth,
              email,
              password
            );
          } catch (loginError: any) {
            if (loginError.code === "auth/user-not-found") {
              // User doesn't exist, create new account
              userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
              );
              setIsNewUser(true);
              console.log("✅ New user account created");
            } else {
              throw loginError;
            }
          }
        }
      } else {
        // Standard login
        try {
          userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
        } catch (loginError: any) {
          if (loginError.code === "auth/user-not-found") {
            // Offer to create account
            const createAccount = await new Promise<boolean>((resolve) => {
              Alert.alert(
                "Account Not Found",
                "No account exists with this email. Would you like to create a new account?",
                [
                  {
                    text: "Cancel",
                    onPress: () => resolve(false),
                    style: "cancel",
                  },
                  { text: "Create Account", onPress: () => resolve(true) },
                ]
              );
            });

            if (createAccount) {
              userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
              );
              setIsNewUser(true);
              console.log("✅ New user account created");
            } else {
              throw loginError;
            }
          } else {
            throw loginError;
          }
        }
      }

      const user = userCredential.user;

      // Get custom claims to check user type
      const tokenResult = await user.getIdTokenResult();
      const claims = tokenResult.claims;

      if (claims.admin === true) {
        // Admin user detected
        const adminRole = claims.role || "admin";

        // Update our rate limiting system
        await enhancedFirebaseService.upgradeUserToAdmin(user.uid, adminRole);

        return {
          success: true,
          userType: "admin",
          user,
          adminRole: String(adminRole),
          message: `Admin login successful: ${adminRole}`,
        };
      } else {
        // Regular registered user
        await enhancedFirebaseService.upgradeUserToRegistered(user.uid);

        return {
          success: true,
          userType: "registered",
          user,
          adminRole: undefined,
          message: isNewUser
            ? "Account created successfully"
            : "User login successful",
        };
      }
    } catch (error: any) {
      console.error("Authentication failed:", error);

      // Handle specific Firebase errors
      let errorMessage = "Authentication failed";

      if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters";
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        userType: "registered",
        user: null,
        adminRole: undefined,
        message: errorMessage,
      };
    }
  };

  const getExistingFirebaseAuth = async () => {
    try {
      // Use the simple approach that works with your Firebase version
      const { getAuth } = await import("firebase/auth");
      const { initializeApp, getApps } = await import("firebase/app");
      const { getFirebaseConfig } = await import("../config/firebaseConfig");

      // Check if Firebase is already initialized
      const existingApps = getApps();
      let app;

      if (existingApps.length > 0) {
        // Use existing app
        app = existingApps[0];
        console.log("🔥 Using existing Firebase app");
      } else {
        // Initialize Firebase with your config
        const config = getFirebaseConfig();
        app = initializeApp(config);
        console.log("🔥 Firebase app initialized");
      }

      // Get Auth instance (will show the AsyncStorage warning but still work)
      const auth = getAuth(app);
      console.log("🔐 Firebase Auth instance obtained");

      return auth;
    } catch (error) {
      console.error("Failed to get Firebase Auth instance:", error);
      throw new Error("Firebase Auth not available");
    }
  };

  const getFormTitle = () => {
    if (mode === "upgrade") {
      return "Get Unlimited Access";
    }
    return "Sign In to WAISPATH";
  };

  const getFormSubtitle = () => {
    if (mode === "upgrade") {
      return "Sign in or create an account for unlimited reporting and report tracking";
    }
    return "Access your account and track your accessibility reports";
  };

  const getSubmitButtonText = () => {
    if (isLoading) {
      return mode === "upgrade" ? "Getting Access..." : "Signing In...";
    }
    return mode === "upgrade" ? "Get Access" : "Sign In";
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.formContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="log-in" size={32} color={COLORS.softBlue} />
          </View>
          <Text style={styles.title}>{getFormTitle()}</Text>
          <Text style={styles.subtitle}>{getFormSubtitle()}</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formFields}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail"
                size={20}
                color={COLORS.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="your-email@example.com"
                placeholderTextColor={COLORS.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed"
                size={20}
                color={COLORS.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={COLORS.muted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.submitButtonText}>
                {getSubmitButtonText()}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>{getSubmitButtonText()}</Text>
          )}
        </TouchableOpacity>

        {/* Action Links */}
        <View style={styles.actionLinks}>
          {mode === "login" && onSwitchToRegister && (
            <TouchableOpacity onPress={onSwitchToRegister} disabled={isLoading}>
              <Text style={styles.linkText}>
                Don't have an account?{" "}
                <Text style={styles.linkTextBold}>Register</Text>
              </Text>
            </TouchableOpacity>
          )}

          {onCancel && (
            <TouchableOpacity
              onPress={onCancel}
              style={styles.cancelButton}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Notice */}
        <View style={styles.adminNotice}>
          <Ionicons
            name="information-circle"
            size={16}
            color={COLORS.softBlue}
          />
          <Text style={styles.adminNoticeText}>
            {mode === "upgrade"
              ? "Will automatically detect admin accounts and create new accounts if needed."
              : "Admin accounts are automatically detected. Regular users get unlimited reporting."}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: COLORS.lightGray,
  },

  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.lightGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
  },

  formFields: {
    marginBottom: 24,
  },

  inputContainer: {
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 8,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  inputIcon: {
    marginRight: 12,
  },

  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.slate,
  },

  passwordToggle: {
    padding: 4,
  },

  submitButton: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  actionLinks: {
    alignItems: "center",
    marginBottom: 16,
  },

  linkText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 12,
  },

  linkTextBold: {
    color: COLORS.softBlue,
    fontWeight: "600",
  },

  cancelButton: {
    paddingVertical: 8,
  },

  cancelButtonText: {
    color: COLORS.muted,
    fontSize: 14,
  },

  adminNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.lightGray,
    padding: 12,
    borderRadius: 8,
  },

  adminNoticeText: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});
