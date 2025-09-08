// App.tsx - Updated with auth coordinator initialization
import "./global.css";
import React, { useEffect, useState } from "react";
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
// Store
import { useUserProfile } from "./src/stores/userProfileStore";
// NEW: Auth coordinator
import { initializeAuthCoordinator } from "./src/services/AuthStateCoordinator";

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

// Main tab navigator for authenticated users - CLEANED UP FOR PRODUCTION
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

// App entry point with profile-aware navigation
export default function App() {
  const { profile, isFirstTime, isLoading, loadProfile } = useUserProfile();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load user profile on app start
        await loadProfile();
        console.log("📱 App initialized with profile system");

        // NEW: Initialize auth coordinator for unified auth state
        await initializeAuthCoordinator();
        console.log("🔄 Auth coordinator initialized");
      } catch (error) {
        console.warn("⚠️ App initialization failed:", error);
      } finally {
        setAppReady(true);
      }
    };

    initializeApp();
  }, [loadProfile]);

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
          <Text className="text-sm text-blue-200 mt-8">Loading...</Text>
          <StatusBar style="light" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {isFirstTime ? (
          // First-time users see onboarding
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={UserProfileScreen} />
          </Stack.Navigator>
        ) : (
          // Existing users go directly to main app with clean navigation
          <MainTabNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
