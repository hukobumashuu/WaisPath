// src/screens/ReportScreen.tsx
// FIXED: Proper responsive layout with correct tab positioning and scrollable content

import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

// Enhanced Firebase service
import { enhancedFirebaseService } from "../services/enhancedFirebase";

// Import the ACTUAL components we created
import { SubmitReportTab } from "../components/SubmitReportTab";
import { MyReportsTab } from "../components/MyReportsTab";
import { AuthUpgradePrompt } from "../components/AuthUpgradePrompt";

// Import separated styles
import {
  reportScreenStyles as styles,
  COLORS,
} from "../styles/reportScreenStyles";

type TabType = "submit" | "reports";

const ReportScreen = ({ navigation }: { navigation: any }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("submit");
  const [userCapabilities, setUserCapabilities] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // FIXED: Refresh capabilities when screen comes into focus (fixes logout bug)
  const loadUserCapabilities = useCallback(async () => {
    try {
      // Force refresh context to get latest auth state
      const context = await enhancedFirebaseService.refreshUserContext();
      setUserCapabilities(context.capabilities);
      console.log("User capabilities loaded:", context.authType);
    } catch (error) {
      console.error("Failed to load user capabilities:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load capabilities on mount
  useEffect(() => {
    loadUserCapabilities();
  }, [loadUserCapabilities]);

  // FIXED: Refresh capabilities when screen comes into focus (fixes logout caching bug)
  useFocusEffect(
    useCallback(() => {
      console.log("Report screen focused - refreshing capabilities");
      loadUserCapabilities();
    }, [loadUserCapabilities])
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // FIXED: Custom tab header with proper spacing
  const renderTabHeader = () => (
    <View style={[styles.customTabHeader, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === "submit" && styles.tabButtonActive,
        ]}
        onPress={() => setActiveTab("submit")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabButtonText,
            activeTab === "submit" && styles.tabButtonTextActive,
          ]}
        >
          I-report
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === "reports" && styles.tabButtonActive,
        ]}
        onPress={() => {
          if (!userCapabilities?.canTrackReports) {
            // Show upgrade prompt for anonymous users
            Alert.alert(
              "Register Required",
              "Register to track your reports and see their progress!",
              [
                { text: "Maybe Later", style: "cancel" },
                {
                  text: "Register Now",
                  onPress: () => navigation.navigate("Profile"),
                },
              ]
            );
            return;
          }
          setActiveTab("reports");
        }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabButtonText,
            activeTab === "reports" && styles.tabButtonTextActive,
            !userCapabilities?.canTrackReports && styles.tabButtonTextDisabled,
          ]}
        >
          Mga Na-report
        </Text>
        {!userCapabilities?.canTrackReports && (
          <Ionicons
            name="lock-closed"
            size={14}
            color={COLORS.muted}
            style={{ marginLeft: 4 }}
          />
        )}
      </TouchableOpacity>
    </View>
  );

  // FIXED: Use actual components with proper container
  const renderTabContent = () => {
    if (activeTab === "submit") {
      return (
        <View style={styles.tabContentContainer}>
          <SubmitReportTab navigation={navigation} />
        </View>
      );
    } else if (activeTab === "reports") {
      if (!userCapabilities?.canTrackReports) {
        return (
          <View style={styles.tabContentContainer}>
            <AuthUpgradePrompt />
          </View>
        );
      }
      return (
        <View style={styles.tabContentContainer}>
          <MyReportsTab />
        </View>
      );
    }
  };

  return (
    <View style={[styles.reportScreenContainer, { paddingTop: 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      {renderTabHeader()}
      {renderTabContent()}
    </View>
  );
};

export default ReportScreen;
