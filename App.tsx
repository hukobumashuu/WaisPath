import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

// WAISPATH Screens
import HomeScreen from "./src/screens/HomeScreen";
import NavigationScreen from "./src/screens/NavigationScreen";

// Temporary placeholder for Report screen
import { View, Text } from "react-native";

const PlaceholderScreen = ({ title }: { title: string }) => (
  <View
    style={{
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "white",
    }}
  >
    <Ionicons name="construct" size={48} color="#3B82F6" />
    <Text style={{ fontSize: 24, fontWeight: "bold", marginTop: 16 }}>
      {title}
    </Text>
    <Text style={{ fontSize: 16, marginTop: 8, color: "#6B7280" }}>
      Coming in Month 2...
    </Text>
  </View>
);

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            // Icons for PWD navigation context
            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Navigate") {
              iconName = focused
                ? "navigate-circle"
                : "navigate-circle-outline";
            } else {
              iconName = focused ? "alert-circle" : "alert-circle-outline";
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}
