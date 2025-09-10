// src/components/UniversalLoginForm.tsx
// 🔐 FIXED LOGIN FORM - Properly handles existing accounts during upgrade
// KEY FIX: Handle auth/email-already-in-use by switching to existing account

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
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

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
        console.log("🧹 Auth cache cleared after successful login");

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
          console.log("🔄 User context refreshed after login");
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

  // 🔥 FIXED: Smart authentication logic that handles existing accounts
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
        // 🔥 KEY FIX: Handle upgrade mode properly
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          console.log(
            "🔄 Attempting to upgrade anonymous user to registered account"
          );

          try {
            // Try to link anonymous account to email/password
            const credential = EmailAuthProvider.credential(email, password);
            userCredential = await linkWithCredential(
              auth.currentUser,
              credential
            );
            console.log(
              "✅ Anonymous account successfully linked to email/password"
            );
          } catch (linkError: any) {
            if (linkError.code === "auth/email-already-in-use") {
              // 🔥 FIX: Email already exists - sign out anonymous and sign in to existing account
              console.log(
                "⚠️ Email already in use - switching to existing account"
              );

              // Sign out the anonymous user
              await signOut(auth);
              console.log("🔄 Anonymous user signed out");

              // Sign in to the existing account
              userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
              );
              console.log("✅ Signed in to existing account");

              // Show user-friendly message
              Alert.alert(
                "Account Found",
                "We found your existing account and signed you in. Your anonymous data will be preserved in your profile."
              );
            } else if (linkError.code === "auth/wrong-password") {
              throw new Error("Incorrect password for this email address");
            } else if (linkError.code === "auth/invalid-credential") {
              throw new Error("Invalid email or password");
            } else {
              throw linkError;
            }
          }
        } else {
          // No anonymous user, just do regular login
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
        // Standard login mode
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
                  { text: "Cancel", onPress: () => resolve(false) },
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
              console.log("✅ New user account created via login attempt");
            } else {
              throw loginError;
            }
          } else {
            throw loginError;
          }
        }
      }

      const user = userCredential.user;

      // Check admin status via custom claims
      const tokenResult = await user.getIdTokenResult();
      const claims = tokenResult.claims;

      if (claims.admin === true) {
        const adminRole = claims.role as string;
        console.log(`🏛️ Admin detected: ${adminRole}`);

        // Update rate limiting for admin
        await enhancedFirebaseService.upgradeUserToAdmin(user.uid, adminRole);

        return {
          success: true,
          userType: "admin",
          user,
          adminRole,
          message: `✅ Admin login successful: ${adminRole}`,
        };
      } else {
        // Regular user
        console.log("👤 Regular user authenticated");

        // Update rate limiting for registered user
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
      const { getUnifiedFirebaseAuth } = await import(
        "../config/firebaseConfig"
      );
      const auth = await getUnifiedFirebaseAuth();

      console.log("🔐 Unified Firebase Auth obtained");
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
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />
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
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.slate,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  form: {
    flex: 1,
    padding: 24,
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
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: COLORS.white,
    color: COLORS.slate,
  },
  submitButton: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.muted,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
