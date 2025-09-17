// App.tsx - FIXED: App launch logging added to main initialization
import "./global.css";
import React, { useEffect, useState, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// WAISPATH Core Screens
import HomeScreen from "./src/screens/HomeScreen";
import NavigationScreen from "./src/screens/NavigationScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import ReportScreen from "./src/screens/ReportScreen";
import { ReportDetailsScreen } from "./src/components/ReportDetailsScreen";

// Store
import { useUserProfile } from "./src/stores/userProfileStore";
// Auth coordinator
import { initializeAuthCoordinator } from "./src/services/AuthStateCoordinator";
// Mobile admin logger
import { logAdminAppLaunch } from "./src/services/mobileAdminLogger";

// Temporary placeholder for future screens
const PlaceholderScreen = ({ title }: { title: string }) => (
  <View className="flex-1 justify-center items-center bg-white">
    <Ionicons name="construct" size={48} color="#3B82F6" />
    <Text className="text-2xl font-bold mt-4">{title}</Text>
    <Text className="text-base mt-2 text-accessible-gray">
      Coming in Month 2...
    </Text>
  </View>
);

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Main tab navigator for authenticated users
const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          // Core navigation icons for PWD users
          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Navigate") {
            iconName = focused ? "navigate-circle" : "navigate-circle-outline";
          } else if (route.name === "Report") {
            iconName = focused ? "alert-circle" : "alert-circle-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = focused ? "home" : "home-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: "#E5E7EB",
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        headerShown: false,
      })}
    >
      {/* Core User Experience - Clean, focused navigation for PWDs */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarAccessibilityLabel: "Home screen",
        }}
      />
      <Tab.Screen
        name="Navigate"
        component={NavigationScreen}
        options={{
          tabBarAccessibilityLabel: "Navigation and route planning",
        }}
      />
      <Tab.Screen
        name="Report"
        component={ReportScreen}
        options={{
          tabBarAccessibilityLabel: "Report accessibility issues",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={UserProfileScreen}
        options={{
          tabBarAccessibilityLabel: "User profile and accessibility settings",
        }}
      />
    </Tab.Navigator>
  );
};

// App entry point with FIXED auth-first initialization + reactive navigation
export default function App() {
  const { profile, isFirstTime, isLoading, loadProfile } = useUserProfile();
  const [appReady, setAppReady] = useState(false);
  // Track if we've logged app launch to prevent duplicates
  const appLaunchLoggedRef = useRef(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize auth coordinator FIRST to restore auth state
        console.log("🔐 Initializing auth coordinator first...");
        await initializeAuthCoordinator();
        console.log("🔄 Auth coordinator initialized - auth state ready");

        // Load profile AFTER auth is ready (so it can detect authenticated users)
        console.log("📱 Loading profile with auth context...");
        await loadProfile();
        console.log("📱 App initialized with profile system");

        // Log admin app launch after auth is ready
        if (!appLaunchLoggedRef.current) {
          // Add a small delay to ensure auth state is fully settled
          setTimeout(async () => {
            try {
              await logAdminAppLaunch();
              appLaunchLoggedRef.current = true;
              console.log("🚀 App launch logging attempted");
            } catch (error) {
              console.warn("⚠️ Failed to log app launch:", error);
            }
          }, 1000); // 1 second delay to ensure auth is fully ready
        }
      } catch (error) {
        console.warn("⚠️ App initialization failed:", error);
      } finally {
        setAppReady(true);
      }
    };

    initializeApp();
  }, [loadProfile]);

  // Add effect to react to isFirstTime changes during login
  useEffect(() => {
    if (appReady && !isLoading) {
      console.log(
        `🔄 Navigation decision: isFirstTime=${isFirstTime} ${
          isFirstTime ? "(showing onboarding)" : "(showing main app)"
        }`
      );
    }
  }, [isFirstTime, appReady, isLoading]);

  // Show loading screen while initializing
  if (!appReady || isLoading) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 justify-center items-center bg-accessible-blue">
          <Ionicons name="navigate-circle" size={80} color="white" />
          <Text className="text-2xl font-bold text-white mt-4">WAISPATH</Text>
          <Text className="text-base text-blue-100 mt-2">
            Intelligent Accessibility Navigation
          </Text>
          <Text className="text-sm text-blue-200 mt-8">
            {!appReady ? "Starting up..." : "Loading profile..."}
          </Text>
          <StatusBar style="light" />
        </View>
      </SafeAreaProvider>
    );
  }

  // This now reacts to isFirstTime changes in real-time
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {isFirstTime ? (
          // First-time users or users without cloud profiles see onboarding
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={UserProfileScreen} />
            <Stack.Screen
              name="ReportDetails"
              component={ReportDetailsScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        ) : (
          // Existing users with cloud profiles OR users who just logged in go to main app
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="ReportDetails"
              component={ReportDetailsScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
