// App.tsx - Updated with ReportScreen
import "./global.css";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";

// WAISPATH Screens
import HomeScreen from "./src/screens/HomeScreen";
import NavigationScreen from "./src/screens/NavigationScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import ReportScreen from "./src/screens/ReportScreen"; // NEW: Import ReportScreen

// Store
import { useUserProfile } from "./src/stores/userProfileStore";

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
const MainTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap;

        // Icons for PWD navigation context
        if (route.name === "Home") {
          iconName = focused ? "home" : "home-outline";
        } else if (route.name === "Navigate") {
          iconName = focused ? "navigate-circle" : "navigate-circle-outline";
        } else if (route.name === "Report") {
          iconName = focused ? "alert-circle" : "alert-circle-outline";
        } else {
          iconName = focused ? "person" : "person-outline";
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: "#3B82F6",
      tabBarInactiveTintColor: "#6B7280",
      tabBarStyle: {
        backgroundColor: "white",
        borderTopColor: "#E5E7EB",
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: "600",
      },
      headerShown: false,
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Navigate" component={NavigationScreen} />
    <Tab.Screen name="Report" component={ReportScreen} />
    <Tab.Screen name="Profile" component={UserProfileScreen} />
  </Tab.Navigator>
);

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
      } catch (error) {
        console.warn("⚠️ Profile loading failed:", error);
      } finally {
        setAppReady(true);
      }
    };

    initializeApp();
  }, [loadProfile]);

  // Show loading screen while initializing
  if (!appReady || isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-accessible-blue">
        <Ionicons name="navigate-circle" size={80} color="white" />
        <Text className="text-2xl font-bold text-white mt-4">WAISPATH</Text>
        <Text className="text-base text-blue-100 mt-2">
          Intelligent Accessibility Navigation
        </Text>
        <Text className="text-sm text-blue-200 mt-8">Loading...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {isFirstTime ? (
        // First-time users see onboarding
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={UserProfileScreen} />
        </Stack.Navigator>
      ) : (
        // Existing users go directly to main app
        <MainTabNavigator />
      )}
    </NavigationContainer>
  );
}
