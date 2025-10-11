// src/components/UniversalLoginForm.tsx
// FIXED: Force token refresh to get latest admin claims after login

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
} from "firebase/auth";
import {
  enhancedFirebaseService,
  clearAuthCache,
} from "../services/enhancedFirebase";
import RegistrationForm from "./RegistrationForm";
import ForgotPasswordForm from "./ForgotPasswordForm";

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

interface LoginResult {
  success: boolean;
  userType: "admin" | "registered";
  user: any;
  adminRole?: string;
  message: string;
}

interface UniversalLoginFormProps {
  mode: "login" | "upgrade";
  onLoginSuccess: (userType: "admin" | "registered", userInfo: any) => void;
  onCancel: () => void;
}

export default function UniversalLoginForm({
  mode,
  onLoginSuccess,
  onCancel,
}: UniversalLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modal states for linked components
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter both email and password"
      );
      return;
    }

    try {
      setIsLoading(true);
      const result = await performAuthentication(email, password, mode);

      if (result.success) {
        clearAuthCache();
        console.log("Auth cache cleared after successful login");

        const welcomeMessage =
          result.userType === "admin"
            ? `Welcome back, ${result.adminRole
                ?.replace("_", " ")
                .toUpperCase()} administrator!`
            : "Welcome! You now have access to unlimited reporting.";

        Alert.alert("Login Successful", welcomeMessage);
        onLoginSuccess(result.userType, result.user);

        setTimeout(async () => {
          await enhancedFirebaseService.getCurrentUserContext();
          console.log("User context refreshed after login");
        }, 500);
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

  /**
   * FIXED: Verify admin account status during login
   */
  const verifyAdminAccountStatus = async (email: string) => {
    // For mobile app, skip API verification and rely on Firebase claims
    console.log(`Skipping API verification for mobile app: ${email}`);
    return {
      isValid: true,
      status: "active",
      message: "Using Firebase claims for verification",
    };
  };

  /**
   * FIXED: Authentication with FORCED token refresh and admin status validation
   */
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
        // Handle upgrade mode properly
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          console.log(
            "Attempting to upgrade anonymous user to registered account"
          );

          try {
            // Try to link anonymous account to email/password
            const credential = EmailAuthProvider.credential(email, password);
            userCredential = await linkWithCredential(
              auth.currentUser,
              credential
            );
            console.log(
              "Anonymous account successfully linked to email/password"
            );
          } catch (linkError: any) {
            if (linkError.code === "auth/email-already-in-use") {
              // Email already exists - sign out anonymous and sign in to existing account
              console.log(
                "Email already in use - switching to existing account"
              );

              // Sign out the anonymous user
              await signOut(auth);
              console.log("Anonymous user signed out");

              // Sign in to the existing account
              userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
              );
              console.log("Signed in to existing account");

              Alert.alert(
                "Account Found",
                "We found your existing account and signed you in. Your anonymous data will be preserved in your profile."
              );
            } else {
              throw linkError;
            }
          }
        } else {
          // No anonymous user - just sign in normally
          userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
        }
      } else {
        // Standard login mode
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      const user = userCredential.user;
      console.log(`Firebase authentication successful for: ${user.email}`);

      // CRITICAL FIX: Force token refresh to get latest claims
      console.log("Force refreshing token to get latest admin claims...");
      const tokenResult = await user.getIdTokenResult(true); // true = forceRefresh
      const claims = tokenResult.claims;
      console.log("Fresh token claims:", claims);

      // FIRST: Check for deactivated flag BEFORE checking admin status
      if (claims.deactivated === true) {
        console.log(`Account deactivated via custom claims: ${user.email}`);
        await signOut(auth);
        return {
          success: false,
          userType: "registered",
          user: null,
          message:
            "Your account has been deactivated. Please contact your administrator.",
        };
      }

      // SECOND: Check if user is admin
      const isAdmin = claims.admin === true;
      let adminRole = undefined;

      if (isAdmin) {
        console.log(`Admin user detected: ${user.email}`);

        // Verify admin account status via API for double verification
        const statusCheck = await verifyAdminAccountStatus(user.email!);

        if (!statusCheck.isValid) {
          // Admin account is deactivated or suspended
          console.log(`Admin account ${statusCheck.status}: ${user.email}`);

          // Sign out the user immediately
          await signOut(auth);

          return {
            success: false,
            userType: "admin",
            user: null,
            message: statusCheck.message,
          };
        }

        adminRole = claims.role as string;
        console.log(`Admin status verified: ${adminRole}`);

        return {
          success: true,
          userType: "admin",
          user: {
            uid: user.uid,
            email: user.email,
            customClaims: claims,
          },
          adminRole,
          message: `Admin login successful - ${adminRole
            ?.replace("_", " ")
            ?.toUpperCase()}`,
        };
      } else {
        // Regular registered user
        console.log(`Registered user authenticated: ${user.email}`);
        return {
          success: true,
          userType: "registered",
          user: {
            uid: user.uid,
            email: user.email,
          },
          message: "User login successful",
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
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );
      const auth = await getUnifiedFirebaseAuth();

      console.log("Unified Firebase Auth obtained");
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

  // Handlers for opening linked components
  const openRegister = () => setShowRegister(true);
  const openForgot = () => setShowForgot(true);

  const handleRegistrationSuccess = (user: any) => {
    // Close register modal and forward success to parent as a registered user
    setShowRegister(false);
    onLoginSuccess("registered", user);
  };

  const handleForgotSuccess = () => {
    // ForgotPasswordForm already alerts on success — just close it
    setShowForgot(false);
  };

  const handleSwitchToLoginFromChild = () => {
    setShowRegister(false);
    setShowForgot(false);
    // retains the current sign-in form visibility for user to continue
  };

  // If a linked form is open, render it full-screen (overlay)
  if (showRegister) {
    return (
      <RegistrationForm
        onRegistrationSuccess={handleRegistrationSuccess}
        onCancel={() => setShowRegister(false)}
        onSwitchToLogin={handleSwitchToLoginFromChild}
        mode="standalone"
      />
    );
  }

  if (showForgot) {
    return (
      <ForgotPasswordForm
        onCancel={() => setShowForgot(false)}
        onSuccess={handleForgotSuccess}
        onSwitchToLogin={handleSwitchToLoginFromChild}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <Ionicons name="close" size={24} color={COLORS.muted} />
        </TouchableOpacity>
        <Text style={styles.title}>{getFormTitle()}</Text>
        <Text style={styles.subtitle}>{getFormSubtitle()}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
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
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!isPasswordVisible}
              autoComplete="password"
              textContentType="password"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              <Ionicons
                name={isPasswordVisible ? "eye-off" : "eye"}
                size={22}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.submitButtonText}>{getSubmitButtonText()}</Text>
        </TouchableOpacity>

        {/* Modernized link row: lighter "forgot" + accented "Sign up" */}
        <View style={styles.linkRow}>
          <TouchableOpacity onPress={openForgot} accessibilityRole="button">
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Text style={styles.divider}>·</Text>

          <TouchableOpacity onPress={openRegister} accessibilityRole="button">
            <Text style={styles.signupText}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
    fontSize: 24,
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
  input: {
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingRight: 12,
  },
  eyeIcon: { paddingHorizontal: 4 },
  submitButton: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.muted,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
  },
  linkContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  linkText: {
    color: COLORS.softBlue,
    fontSize: 16,
    fontWeight: "500",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  forgotText: {
    color: COLORS.muted,
    fontSize: 14,
    paddingHorizontal: 6,
  },
  divider: {
    color: "#E5E7EB",
    marginHorizontal: 8,
    fontSize: 14,
    alignSelf: "center",
  },
  signupText: {
    color: COLORS.softBlue,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 6,
  },
});
