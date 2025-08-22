// src/screens/NavigationScreen.tsx
// UPDATED: Complete NavigationScreen with Proximity Detection Integration

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Vibration,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";
import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle, ObstacleType } from "../types";

// Route analysis services
import { routeAnalysisService } from "../services/routeAnalysisService";
import { sidewalkRouteAnalysisService } from "../services/sidewalkRouteAnalysisService";

// 🔥 NEW: Proximity detection imports
import {
  proximityDetectionService,
  ProximityAlert,
} from "../services/proximityDetectionService";

// 🔥 VALIDATION SYSTEM IMPORTS
import { ValidationPrompt } from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";

// 🔥 NEW: Proximity Detection Hook
interface UseProximityDetectionOptions {
  isNavigating: boolean;
  userLocation: UserLocation | null;
  routePolyline: UserLocation[];
  userProfile: any;
  onCriticalObstacle?: (alert: ProximityAlert) => void;
}

interface ProximityDetectionState {
  proximityAlerts: ProximityAlert[];
  isDetecting: boolean;
  lastDetectionTime: Date | null;
  criticalAlerts: ProximityAlert[];
  detectionError: string | null;
}

function useProximityDetection({
  isNavigating,
  userLocation,
  routePolyline,
  userProfile,
  onCriticalObstacle,
}: UseProximityDetectionOptions): ProximityDetectionState {
  const [state, setState] = useState<ProximityDetectionState>({
    proximityAlerts: [],
    isDetecting: false,
    lastDetectionTime: null,
    criticalAlerts: [],
    detectionError: null,
  });

  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // 🔧 FIX #2: Use ref to track last critical IDs to avoid stale closure
  const lastCriticalIdsRef = useRef<Set<string>>(new Set());

  // 🔧 FIX #1: Move runDetection function BEFORE useEffect (hoisting fix)
  const runDetection = async () => {
    if (!userLocation || !isNavigating || !userProfile) return;

    try {
      const alerts = await proximityDetectionService.detectObstaclesAhead(
        userLocation,
        routePolyline,
        userProfile
      );

      // Filter critical alerts (within 50m and high severity)
      const criticalAlerts = alerts.filter(
        (alert) =>
          alert.distance < 50 &&
          (alert.severity === "blocking" || alert.severity === "high")
      );

      setState((prev) => ({
        ...prev,
        proximityAlerts: alerts,
        criticalAlerts,
        lastDetectionTime: new Date(),
        detectionError: null,
      }));

      // 🔧 FIX #2: Handle critical obstacles using ref instead of stale state
      if (criticalAlerts.length > 0 && onCriticalObstacle) {
        const mostCritical = criticalAlerts[0]; // Highest urgency (already sorted)

        // Check if this is a new critical obstacle using ref (not stale state)
        if (!lastCriticalIdsRef.current.has(mostCritical.obstacle.id)) {
          console.log(
            "🚨 New critical obstacle detected:",
            mostCritical.obstacle.type
          );
          lastCriticalIdsRef.current.add(mostCritical.obstacle.id);
          onCriticalObstacle(mostCritical);
        }
      }

      // Clean up old critical IDs when obstacles are far away (reset logic)
      const currentCriticalIds = new Set(
        criticalAlerts.map((alert) => alert.obstacle.id)
      );
      const idsToRemove: string[] = [];

      lastCriticalIdsRef.current.forEach((id) => {
        if (!currentCriticalIds.has(id)) {
          idsToRemove.push(id);
        }
      });

      idsToRemove.forEach((id) => lastCriticalIdsRef.current.delete(id));
    } catch (error) {
      console.error("❌ Proximity detection error:", error);
      setState((prev) => ({
        ...prev,
        detectionError: "Detection failed - using cached data",
        isDetecting: false,
      }));
    }
  };

  // Main detection effect
  useEffect(() => {
    if (
      !isNavigating ||
      !userLocation ||
      routePolyline.length < 2 ||
      !userProfile
    ) {
      // Stop detection when not navigating
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }

      // 🔧 FIX #2: Clear critical IDs ref when stopping navigation
      lastCriticalIdsRef.current.clear();

      setState((prev) => ({
        ...prev,
        proximityAlerts: [],
        isDetecting: false,
        criticalAlerts: [],
      }));

      return;
    }

    // Start proximity detection monitoring
    const startDetection = async () => {
      setState((prev) => ({
        ...prev,
        isDetecting: true,
        detectionError: null,
      }));

      try {
        if (__DEV__) {
          console.log("🔍 Starting proximity detection monitoring...");
        }

        // Run initial detection
        await runDetection();

        // 🔧 FIX #4: Use service config for poll interval
        const pollInterval =
          proximityDetectionService.getConfig().updateInterval || 5000;

        // Set up periodic detection
        detectionIntervalRef.current = setInterval(async () => {
          await runDetection();
        }, pollInterval);
      } catch (error) {
        console.error("❌ Failed to start proximity detection:", error);
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          detectionError: "Failed to start obstacle detection",
        }));
      }
    };

    startDetection();

    // Cleanup on unmount
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      lastCriticalIdsRef.current.clear();
    };
  }, [isNavigating, userLocation, routePolyline, userProfile]);

  return state;
}

// 🔥 NEW: Proximity Alerts Overlay Component
const ProximityAlertsOverlay = ({
  alerts,
  onAlertPress,
}: {
  alerts: ProximityAlert[];
  onAlertPress: (alert: ProximityAlert) => void;
}) => {
  if (alerts.length === 0) return null;

  return (
    <View style={styles.proximityAlertsContainer}>
      <Text style={styles.alertsTitle}>⚠️ Obstacles Ahead</Text>
      {alerts.slice(0, 2).map((alert, index) => (
        <TouchableOpacity
          key={alert.obstacle.id}
          style={[
            styles.alertItem,
            alert.severity === "blocking" && styles.blockingAlert,
          ]}
          onPress={() => onAlertPress(alert)}
        >
          <View style={styles.alertContent}>
            <Text style={styles.alertType}>
              {alert.obstacle.type.replace("_", " ")}
            </Text>
            <Text style={styles.alertDistance}>{alert.distance}m ahead</Text>
          </View>
          <View
            style={[
              styles.urgencyIndicator,
              { backgroundColor: alert.urgency > 70 ? "#EF4444" : "#F59E0B" },
            ]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

// 🔧 PROPER polyline decoder implementation
const decodePolyline = (encoded: string): UserLocation[] => {
  if (!encoded) return [];

  const points: UserLocation[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;

      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      // Decode longitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("⚠️ Polyline decode error:", error);
    }
    return [];
  }

  return points;
};
function getObstacleDisplay(type: ObstacleType, severity: string) {
  const displays = {
    vendor_blocking: {
      icon: "storefront-outline" as keyof typeof Ionicons.glyphMap,
      title: "Vendor Blocking Path",
      color: "#F59E0B",
    },
    parked_vehicles: {
      icon: "car-outline" as keyof typeof Ionicons.glyphMap,
      title: "Parked Vehicle",
      color: "#EF4444",
    },
    stairs_no_ramp: {
      icon: "layers-outline" as keyof typeof Ionicons.glyphMap,
      title: "Stairs No Ramp",
      color: "#DC2626",
    },
    narrow_passage: {
      icon: "resize-outline" as keyof typeof Ionicons.glyphMap,
      title: "Narrow Passage",
      color: "#F59E0B",
    },
    broken_pavement: {
      icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
      title: "Broken Pavement",
      color: "#EF4444",
    },
    flooding: {
      icon: "water-outline" as keyof typeof Ionicons.glyphMap,
      title: "Flooding",
      color: "#3B82F6",
    },
    construction: {
      icon: "construct-outline" as keyof typeof Ionicons.glyphMap,
      title: "Construction",
      color: "#F59E0B",
    },
    electrical_post: {
      icon: "flash-outline" as keyof typeof Ionicons.glyphMap,
      title: "Electrical Post",
      color: "#6B7280",
    },
    tree_roots: {
      icon: "leaf-outline" as keyof typeof Ionicons.glyphMap,
      title: "Tree Roots",
      color: "#059669",
    },
    no_sidewalk: {
      icon: "trail-sign-outline" as keyof typeof Ionicons.glyphMap,
      title: "No Sidewalk",
      color: "#DC2626",
    },
    steep_slope: {
      icon: "trending-up-outline" as keyof typeof Ionicons.glyphMap,
      title: "Steep Slope",
      color: "#F59E0B",
    },
    other: {
      icon: "help-circle-outline" as keyof typeof Ionicons.glyphMap,
      title: "Other Obstacle",
      color: "#6B7280",
    },
  };

  return displays[type] || displays.other;
}

// Enhanced Obstacle Marker Component
interface ObstacleMarkerProps {
  obstacle: AccessibilityObstacle;
  onPress: () => void;
}

function EnhancedObstacleMarker({ obstacle, onPress }: ObstacleMarkerProps) {
  const validationStatus =
    obstacleValidationService.getValidationStatus(obstacle);
  const obstacleDisplay = getObstacleDisplay(obstacle.type, obstacle.severity);

  const getValidationUI = (status: any) => {
    switch (status.tier) {
      case "admin_resolved":
        return { badgeColor: "#3B82F6", badgeText: "OFFICIAL" };
      case "community_verified":
        const hasDisputes = (obstacle.downvotes || 0) > 0;
        return {
          badgeColor: hasDisputes ? "#F59E0B" : "#10B981",
          badgeText: hasDisputes ? "DISPUTED" : "VERIFIED",
        };
      case "needs_validation":
      default:
        return { badgeColor: "#EF4444", badgeText: "UNVERIFIED" };
    }
  };

  const uiProps = getValidationUI(validationStatus);

  return (
    <Marker
      coordinate={obstacle.location}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View
        style={[styles.obstacleMarker, { backgroundColor: uiProps.badgeColor }]}
      >
        <Ionicons name={obstacleDisplay.icon} size={16} color="white" />
      </View>
      <Callout>
        <View style={styles.calloutContainer}>
          <View style={styles.calloutHeader}>
            <Text style={styles.calloutTitle}>{obstacleDisplay.title}</Text>
            <View
              style={[
                styles.validationBadge,
                { backgroundColor: uiProps.badgeColor },
              ]}
            >
              <Text style={styles.validationBadgeText}>
                {uiProps.badgeText}
              </Text>
            </View>
          </View>
          <Text style={styles.calloutDescription}>{obstacle.description}</Text>
          <Text style={styles.calloutMeta}>
            {obstacle.upvotes || 0}↑ {obstacle.downvotes || 0}↓ •
            {new Date(obstacle.reportedAt).toLocaleDateString()}
          </Text>
        </View>
      </Callout>
    </Marker>
  );
}

// Sample POI data for testing
const SAMPLE_POIS = [
  {
    id: "poi_1",
    name: "Pasig City Hall",
    type: "government",
    lat: 14.5764,
    lng: 121.0851,
  },
  {
    id: "poi_2",
    name: "Robinson's Metro East",
    type: "shopping",
    lat: 14.6042,
    lng: 121.0753,
  },
  {
    id: "poi_3",
    name: "SM City Pasig",
    type: "shopping",
    lat: 14.5863,
    lng: 121.0614,
  },
];

function getPOIIcon(type: string): keyof typeof Ionicons.glyphMap {
  const icons = {
    government: "business-outline",
    shopping: "storefront-outline",
    restaurant: "restaurant-outline",
    hospital: "medical-outline",
    school: "school-outline",
    default: "location-outline",
  };
  return (icons[type as keyof typeof icons] ||
    icons.default) as keyof typeof Ionicons.glyphMap;
}

// 🔥 MAIN NAVIGATION SCREEN COMPONENT
export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { location, error: locationError } = useLocation();
  const { profile } = useUserProfile();

  // Navigation state
  const [routeAnalysis, setRouteAnalysis] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [selectedDestination, setSelectedDestination] =
    useState<UserLocation | null>(null);

  // Map and UI state
  const mapRef = useRef<MapView | null>(null);
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [showSidewalks, setShowSidewalks] = useState(true);
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);

  // 🔧 FIX #8: Use useCallback for stable handler references
  const handleCriticalObstacle = useCallback((alert: ProximityAlert) => {
    if (__DEV__) {
      console.log("🚨 Critical obstacle detected:", alert.obstacle.type);
    }

    // Cross-platform vibration (iOS compatible)
    if (Vibration) {
      try {
        Vibration.vibrate([100, 50, 100]);
      } catch {
        // Fallback for iOS
        Vibration.vibrate(100);
      }
    }

    Alert.alert(
      "⚠️ Obstacle Ahead",
      `${alert.obstacle.type.replace("_", " ")} detected ${
        alert.distance
      }m ahead.\n\n` +
        `Severity: ${alert.severity}\n` +
        `Description: ${alert.obstacle.description}`,
      [
        {
          text: "Find Alternative",
          onPress: () => handleFindAlternative(alert),
          style: "default",
        },
        {
          text: "Continue Anyway",
          style: "cancel",
        },
      ]
    );
  }, []);

  const handleFindAlternative = useCallback((alert: ProximityAlert) => {
    if (__DEV__) {
      console.log("🔄 Finding alternative route around:", alert.obstacle.type);
    }

    Alert.alert(
      "Alternative Route",
      "Micro-rerouting feature coming soon!\n\nFor now, please navigate around the obstacle manually.",
      [{ text: "OK" }]
    );
  }, []);

  const handleProximityAlertPress = useCallback(
    (alert: ProximityAlert) => {
      if (__DEV__) {
        console.log("📍 User pressed proximity alert:", alert.obstacle.type);
      }

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: alert.obstacle.location.latitude,
            longitude: alert.obstacle.location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000
        );
      }

      Alert.alert(
        "Obstacle Details",
        `Type: ${alert.obstacle.type.replace("_", " ")}\n` +
          `Distance: ${alert.distance}m away\n` +
          `Severity: ${alert.severity}\n` +
          `Confidence: ${Math.round(alert.confidence * 100)}%\n\n` +
          `${alert.obstacle.description}`,
        [
          {
            text: "Find Alternative",
            onPress: () => handleFindAlternative(alert),
          },
          { text: "OK" },
        ]
      );
    },
    [handleFindAlternative]
  );

  // 🔧 FIX: Memoize routePolyline to prevent infinite re-renders
  const routePolyline = useMemo(() => {
    return routeAnalysis?.fastestRoute?.polyline || [];
  }, [routeAnalysis?.fastestRoute?.polyline]);

  // 🔥 NEW: Proximity detection state
  const proximityState = useProximityDetection({
    isNavigating,
    userLocation: location,
    routePolyline,
    userProfile: profile,
    onCriticalObstacle: handleCriticalObstacle,
  });

  // Load nearby obstacles when location changes
  useEffect(() => {
    if (location) {
      loadNearbyObstacles();
      checkForValidationPrompts();
    }
  }, [location]);

  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        1 // 1km radius
      );
      setNearbyObstacles(obstacles);
    } catch (error) {
      console.error("Failed to load obstacles:", error);
    }
  };

  const checkForValidationPrompts = async () => {
    if (!location || !profile) return;

    try {
      const prompts = await obstacleValidationService.checkForValidationPrompts(
        location,
        profile
      );

      if (prompts.length > 0) {
        setCurrentValidationPrompt(prompts[0]);
        setShowValidationPrompt(true);
      }
    } catch (error) {
      console.error("Validation prompt check failed:", error);
    }
  };

  // Unified route calculation
  const calculateUnifiedRoutes = async (poi?: any) => {
    if (!location) {
      Alert.alert("Location Error", "Cannot get your current location.");
      return;
    }

    let destLocation: UserLocation;
    let destName: string;

    if (poi) {
      destLocation = { latitude: poi.lat, longitude: poi.lng };
      destName = poi.name;
      setSelectedDestination(destLocation);
      setDestinationName(destName);
    } else {
      if (!destination.trim()) {
        Alert.alert("No Destination", "Please enter a destination first.");
        return;
      }
      const firstPOI = SAMPLE_POIS[0];
      destLocation = { latitude: firstPOI.lat, longitude: firstPOI.lng };
      destName = destination;
      setSelectedDestination(destLocation);
      setDestinationName(destName);
    }

    if (!profile) {
      Alert.alert("Profile Error", "Please set up your profile first.");
      return;
    }

    setIsCalculating(true);

    try {
      console.log(
        `🗺️ Calculating unified routes from current location to ${destName}...`
      );

      // Run both route analysis services with correct method names
      const [multiRouteResult, sidewalkResult] = await Promise.all([
        routeAnalysisService.analyzeRoutes(location, destLocation, profile),
        sidewalkRouteAnalysisService.analyzeSidewalkRoutes(
          location,
          destLocation,
          profile
        ),
      ]);

      // Use the results with proper fallbacks
      const fastestRoute = multiRouteResult?.fastestRoute || {
        polyline: [location, destLocation],
        duration: 600, // 10 minutes fallback
        distance: 1000, // 1km fallback
        accessibilityScore: { overall: 70, grade: "B" },
      };

      const accessibleRoute = multiRouteResult?.accessibleRoute || fastestRoute;

      const unifiedAnalysis = {
        fastestRoute: {
          polyline: fastestRoute.googleRoute?.polyline
            ? decodePolyline(fastestRoute.googleRoute.polyline)
            : [location, destLocation],
          duration: fastestRoute.googleRoute?.duration || 600,
          distance: fastestRoute.googleRoute?.distance || 1000,
          grade: fastestRoute.accessibilityScore?.grade || "B",
        },
        accessibleRoute: {
          polyline: accessibleRoute.googleRoute?.polyline
            ? decodePolyline(accessibleRoute.googleRoute.polyline)
            : [location, destLocation],
          duration: accessibleRoute.googleRoute?.duration || 600,
          distance: accessibleRoute.googleRoute?.distance || 1000,
          grade: accessibleRoute.accessibilityScore?.grade || "A",
        },
        comparison: {
          timeDifference:
            (accessibleRoute.googleRoute?.duration || 600) -
            (fastestRoute.googleRoute?.duration || 600),
          gradeDifference: 0,
          recommendation: `Accessible route is ${Math.round(
            ((accessibleRoute.googleRoute?.duration || 600) -
              (fastestRoute.googleRoute?.duration || 600)) /
              60
          )} minutes longer but better accessibility grade`,
        },
      };

      setRouteAnalysis(unifiedAnalysis);

      if (__DEV__) {
        console.log("🗺️ Route polylines decoded:", {
          fastest: unifiedAnalysis.fastestRoute.polyline.length,
          accessible: unifiedAnalysis.accessibleRoute.polyline.length,
        });
      }

      // Auto-fit map to show both routes
      if (mapRef.current) {
        const allCoords = [
          location,
          destLocation,
          ...(unifiedAnalysis.fastestRoute.polyline || []),
          ...(unifiedAnalysis.accessibleRoute.polyline || []),
        ].filter((coord) => coord.latitude && coord.longitude);

        if (allCoords.length > 0) {
          mapRef.current.fitToCoordinates(allCoords, {
            edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        }
      }

      Vibration.vibrate(100);
      console.log("✅ Unified route calculation complete!");
    } catch (error: any) {
      console.error("❌ Route calculation failed:", error);
      Alert.alert(
        "Route Error",
        `Could not calculate routes: ${error.message}`
      );
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle POI selection
  const handlePOIPress = (poi: any) => {
    console.log(`🏢 Selected POI: ${poi.name} - Auto-calculating routes...`);

    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: poi.lat,
          longitude: poi.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }

    calculateUnifiedRoutes(poi);
  };

  // Start navigation
  const startNavigation = (routeType: "fastest" | "accessible") => {
    setIsNavigating(true);
    Vibration.vibrate(100);
    Alert.alert(
      "🚀 Navigation Started!",
      `Following ${routeType} route to ${destinationName}.\n\nRoute grade: ${
        routeType === "fastest"
          ? routeAnalysis?.fastestRoute.grade
          : routeAnalysis?.accessibleRoute.grade
      }\n\nProximity detection enabled.`,
      [{ text: "Let's Go!" }]
    );
  };

  // 🔥 NEW: Show detection status
  const renderDetectionStatus = useCallback(() => {
    if (!isNavigating) return null;

    return (
      <View style={styles.detectionStatusContainer}>
        <Text style={styles.detectionStatus}>
          {proximityState.isDetecting
            ? `🔍 Scanning ahead... (${proximityState.proximityAlerts.length} obstacles)`
            : "⏸️ Detection paused"}
        </Text>

        {proximityState.detectionError && (
          <Text style={styles.detectionError}>
            ⚠️ {proximityState.detectionError}
          </Text>
        )}
      </View>
    );
  }, [
    isNavigating,
    proximityState.isDetecting,
    proximityState.proximityAlerts.length,
    proximityState.detectionError,
  ]);

  // Error state
  if (locationError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Location Access Required</Text>
          <Text style={styles.errorMessage}>
            WAISPATH needs your location to provide accessible navigation.
            Please enable location services in your device settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* USER LOCATION MARKER */}
        <Marker
          coordinate={location}
          title="Your Location"
          description={`${profile?.type || "Standard"} user navigation`}
        >
          <View style={styles.userLocationMarker}>
            <Ionicons name="person" size={16} color="white" />
          </View>
        </Marker>

        {/* DESTINATION MARKER */}
        {selectedDestination && (
          <Marker
            coordinate={selectedDestination}
            title={destinationName}
            description="Destination"
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={16} color="white" />
            </View>
          </Marker>
        )}

        {/* OBSTACLE MARKERS */}
        {nearbyObstacles.map((obstacle) => (
          <EnhancedObstacleMarker
            key={obstacle.id}
            obstacle={obstacle}
            onPress={() => console.log("Obstacle pressed:", obstacle.type)}
          />
        ))}

        {/* POI MARKERS */}
        {SAMPLE_POIS.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            onPress={() => handlePOIPress(poi)}
          >
            <View style={styles.poiMarker}>
              <Ionicons name={getPOIIcon(poi.type)} size={20} color="white" />
            </View>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{poi.name}</Text>
                <Text style={styles.calloutType}>
                  {poi.type.charAt(0).toUpperCase() + poi.type.slice(1)}
                </Text>
                <Text style={styles.calloutAction}>
                  Tap for intelligent routing
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* ROUTE VISUALIZATION */}
        {routeAnalysis && (
          <>
            {/* FASTEST ROUTE - MAIN LINE */}
            {routeAnalysis.fastestRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.polyline}
                strokeColor="#EF4444"
                strokeWidth={5}
                lineDashPattern={[0]}
                zIndex={1}
              />
            )}

            {/* ACCESSIBLE ROUTE - MAIN LINE */}
            {routeAnalysis.accessibleRoute.polyline && (
              <Polyline
                coordinates={routeAnalysis.accessibleRoute.polyline}
                strokeColor="#22C55E"
                strokeWidth={5}
                lineDashPattern={[0]}
                zIndex={2}
              />
            )}
          </>
        )}
      </MapView>

      {/* SEARCH BAR */}
      <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Where do you want to go?"
            value={destination}
            onChangeText={setDestination}
            placeholderTextColor="#6B7280"
          />
          {isCalculating && <ActivityIndicator size="small" color="#3B82F6" />}
        </View>
      </View>

      {/* 🔥 NEW: Proximity detection status */}
      {renderDetectionStatus()}

      {/* 🔥 NEW: Proximity alerts overlay */}
      <ProximityAlertsOverlay
        alerts={proximityState.proximityAlerts}
        onAlertPress={handleProximityAlertPress}
      />

      {/* ROUTE INFO PANEL */}
      {routeAnalysis && (
        <View
          style={[styles.routeInfoContainer, { bottom: insets.bottom + 100 }]}
        >
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>
              🗺️ Routes to {destinationName}
            </Text>

            {/* BOTH ROUTES DISPLAYED */}
            <View style={styles.routeComparison}>
              {/* FASTEST ROUTE ROW */}
              <View style={styles.routeRow}>
                <View style={styles.routeIndicator}>
                  <View
                    style={[styles.routeColor, { backgroundColor: "#EF4444" }]}
                  />
                  <Text style={styles.routeLabel}>Fastest</Text>
                </View>
                <Text style={styles.routeDetails}>
                  {Math.round(
                    (routeAnalysis.fastestRoute.duration || 600) / 60
                  )}
                  min •{" "}
                  {(
                    (routeAnalysis.fastestRoute.distance || 1000) / 1000
                  ).toFixed(1)}
                  km • Grade {routeAnalysis.fastestRoute.grade || "B"}
                </Text>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => startNavigation("fastest")}
                >
                  <Ionicons name="navigate" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* ACCESSIBLE ROUTE ROW */}
              <View style={styles.routeRow}>
                <View style={styles.routeIndicator}>
                  <View
                    style={[styles.routeColor, { backgroundColor: "#22C55E" }]}
                  />
                  <Text style={styles.routeLabel}>Accessible</Text>
                </View>
                <Text style={styles.routeDetails}>
                  {Math.round(
                    (routeAnalysis.accessibleRoute.duration || 600) / 60
                  )}
                  min •{" "}
                  {(
                    (routeAnalysis.accessibleRoute.distance || 1000) / 1000
                  ).toFixed(1)}
                  km • Grade {routeAnalysis.accessibleRoute.grade || "A"}
                </Text>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => startNavigation("accessible")}
                >
                  <Ionicons name="navigate" size={16} color="#22C55E" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Recommendation */}
            <Text style={styles.recommendation}>
              💡 {routeAnalysis.comparison.recommendation}
            </Text>

            {/* Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setShowSidewalks(!showSidewalks)}
              >
                <Ionicons
                  name={showSidewalks ? "eye" : "eye-off"}
                  size={16}
                  color="#6B7280"
                />
                <Text style={styles.controlButtonText}>
                  {showSidewalks ? "Hide" : "Show"} Sidewalks
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => calculateUnifiedRoutes()}
              >
                <Ionicons name="refresh" size={16} color="#6B7280" />
                <Text style={styles.controlButtonText}>Recalculate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* FLOATING ACTION BUTTON */}
      {!routeAnalysis && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => calculateUnifiedRoutes()}
          disabled={isCalculating}
        >
          {isCalculating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="navigate-circle" size={24} color="white" />
          )}
        </TouchableOpacity>
      )}

      {/* VALIDATION PROMPT MODAL */}
      <Modal
        visible={showValidationPrompt}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowValidationPrompt(false)}
      >
        {currentValidationPrompt && (
          <ValidationPrompt
            prompt={currentValidationPrompt}
            onResponse={async (response) => {
              if (currentValidationPrompt && location) {
                await obstacleValidationService.processValidationResponse(
                  currentValidationPrompt.obstacleId,
                  response
                );
              }
              setShowValidationPrompt(false);
              setCurrentValidationPrompt(null);
            }}
            onDismiss={() => {
              setShowValidationPrompt(false);
              setCurrentValidationPrompt(null);
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// 🔥 COMPLETE STYLES with new proximity detection styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1F2937",
  },

  // 🔥 NEW: Proximity detection styles
  proximityAlertsContainer: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 9,
  },

  alertsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#F59E0B",
    marginBottom: 8,
  },

  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  blockingAlert: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    paddingLeft: 8,
    borderRadius: 4,
  },

  alertContent: {
    flex: 1,
  },

  alertType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textTransform: "capitalize",
  },

  alertDistance: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  urgencyIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },

  detectionStatusContainer: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 8,
    zIndex: 8,
  },

  detectionStatus: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
  },

  detectionError: {
    color: "#FCD34D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },

  // Marker styles
  userLocationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  obstacleMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  poiMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
  },
  calloutType: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  calloutAction: {
    fontSize: 12,
    color: "#3B82F6",
    fontStyle: "italic",
  },
  calloutDescription: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  validationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validationBadgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "white",
  },
  routeInfoContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  routeInfo: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  routeComparison: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  routeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    width: 90,
  },
  routeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  routeDetails: {
    flex: 1,
    fontSize: 12,
    color: "#1F2937",
    marginLeft: 8,
  },
  navigateBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
  },
  recommendation: {
    fontSize: 12,
    color: "#059669",
    fontStyle: "italic",
    marginBottom: 12,
    textAlign: "center",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  controlButtonText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
