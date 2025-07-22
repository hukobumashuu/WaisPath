// App.tsx - Updated with User Profile Flow
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

// Store
import { useUserProfile } from "./src/stores/userProfileStore";

// Temporary placeholder for Report screen
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
      // Accessibility-focused tab bar
      tabBarActiveTintColor: "#3B82F6", // accessible-blue
      tabBarInactiveTintColor: "#6B7280", // accessible-gray
      tabBarLabelStyle: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 4,
      },
      tabBarStyle: {
        height: 68, // Large touch area for PWD users
        paddingBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
      },
      headerStyle: {
        backgroundColor: "#3B82F6",
      },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: {
        fontSize: 20,
        fontWeight: "bold",
      },
    })}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: "WAISPATH" }}
    />
    <Tab.Screen
      name="Navigate"
      component={NavigationScreen}
      options={{ title: "Find Route" }}
    />
    <Tab.Screen
      name="Report"
      children={() => <PlaceholderScreen title="Report Feature" />}
      options={{ title: "Report Issue" }}
    />
    <Tab.Screen
      name="Profile"
      component={UserProfileScreen}
      options={{ title: "My Profile" }}
    />
  </Tab.Navigator>
);

// Loading screen component
const LoadingScreen = () => (
  <View className="flex-1 justify-center items-center bg-accessible-blue">
    <Ionicons name="accessibility" size={64} color="white" />
    <Text className="text-2xl font-bold text-white mt-4">WAISPATH</Text>
    <Text className="text-base text-blue-200 mt-2">
      Loading your accessibility profile...
    </Text>
  </View>
);

export default function App() {
  const { profile, isFirstTime } = useUserProfile();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate app initialization
  useEffect(() => {
    const initializeApp = async () => {
      // Simulate loading time for splash screen
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsLoading(false);
    };

    initializeApp();
  }, []);

  // Show loading screen during initialization
  if (isLoading) {
    return (
      <NavigationContainer>
        <StatusBar style="light" />
        <LoadingScreen />
      </NavigationContainer>
    );
  }

  // Show onboarding if first time user or no profile
  if (isFirstTime || !profile) {
    return (
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ title: "Setup Your Profile" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Show main app with tabs
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <MainTabNavigator />
    </NavigationContainer>
  );
}
