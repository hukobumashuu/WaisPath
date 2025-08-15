// src/screens/NavigationScreen.tsx
// UPDATED: Obstacle-First Design + Fixed Dual Routes Display! 🔥

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Vibration,
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

// 🔥 VALIDATION SYSTEM IMPORTS - Updated with new obstacle marker!
import { ValidationPrompt } from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";

// 🔥 IMPROVED THREE-TIER VALIDATION UI/UX MARKER COMPONENT
interface ObstacleMarkerProps {
  obstacle: AccessibilityObstacle;
  onPress: () => void;
}

function EnhancedObstacleMarker({ obstacle, onPress }: ObstacleMarkerProps) {
  // 🔥 USE EXISTING VALIDATION SERVICE (keep three-tier logic!)
  const validationStatus =
    obstacleValidationService.getValidationStatus(obstacle);

  // Get obstacle-specific icon and color
  const obstacleDisplay = getObstacleDisplay(obstacle.type, obstacle.severity);

  // 🎨 IMPROVED UI MAPPING for three-tier system
  const getValidationUI = (status: any) => {
    switch (status.tier) {
      case "admin_resolved":
        return {
          badgeColor: "#3B82F6", // Blue for official
          badgeIcon: "shield-checkmark",
          badgeText: "OFFICIAL",
          textColor: "#3B82F6",
        };

      case "community_verified":
        // 🔥 IMPROVED: Show dispute status clearly!
        if (status.conflictingReports && status.confidence === "low") {
          return {
            badgeColor: "#F59E0B", // Orange for disputed
            badgeIcon: "warning",
            badgeText: "DISPUTED",
            textColor: "#F59E0B",
          };
        } else {
          return {
            badgeColor: "#22C55E", // Green for verified
            badgeIcon: "checkmark",
            badgeText: "VERIFIED",
            textColor: "#22C55E",
          };
        }

      case "single_report":
      default:
        return {
          badgeColor: "#EF4444", // Red for unverified
          badgeIcon: "alert",
          badgeText: "UNVERIFIED",
          textColor: "#EF4444",
        };
    }
  };

  const uiConfig = getValidationUI(validationStatus);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        alignItems: "center",
        opacity: 1.0, // Always full opacity
        paddingTop: 8, // 🔥 FIX: Add padding to prevent badge clipping!
        paddingRight: 8, // 🔥 FIX: Add padding to prevent badge clipping!
        paddingLeft: 8, // 🔥 FIX: Symmetric padding for better touch area
      }}
      accessibilityLabel={`${obstacle.type} obstacle - ${validationStatus.displayLabel}`}
    >
      <View
        style={{
          position: "relative",
          // 🔥 FIX: Ensure container has enough space for badges
          minWidth: 60, // Wider than icon (44px) + badge overhang
          minHeight: 60, // Taller than icon (44px) + badge overhang
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {/* 🎯 MAIN OBSTACLE ICON - Always shows actual obstacle type */}
        <View
          style={{
            backgroundColor: obstacleDisplay.backgroundColor,
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            borderWidth: 2,
            borderColor: "white",
            // 🔥 FIX: Position icon to allow badge space
            marginTop: 4,
          }}
        >
          <Ionicons
            name={obstacleDisplay.icon as any}
            size={22}
            color="white"
          />
        </View>

        {/* 🎨 VALIDATION BADGE - Top-right corner with clear status */}
        <View
          style={{
            position: "absolute",
            top: 0, // 🔥 FIX: Changed from -4 to 0 (within bounds)
            right: 0, // 🔥 FIX: Changed from -4 to 0 (within bounds)
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: uiConfig.badgeColor,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: "white",
            elevation: 6, // 🔥 FIX: Higher elevation to appear above icon
            zIndex: 10, // 🔥 FIX: Ensure badge appears on top
          }}
        >
          <Ionicons name={uiConfig.badgeIcon as any} size={12} color="white" />
        </View>

        {/* 📝 CLEAR STATUS TEXT - Shows exactly what the status is */}
        <Text
          style={{
            fontSize: 8,
            color: uiConfig.textColor,
            fontWeight: "700",
            textAlign: "center",
            marginTop: 4,
            backgroundColor: "white",
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: uiConfig.badgeColor,
            overflow: "hidden",
            minWidth: 50,
          }}
        >
          {uiConfig.badgeText}
        </Text>

        {/* 🔥 ENHANCED: Validation count indicator for transparency */}
        <Text
          style={{
            fontSize: 6,
            color: "#6B7280",
            textAlign: "center",
            marginTop: 1,
            backgroundColor: "#F9FAFB",
            paddingHorizontal: 2,
            borderRadius: 3,
          }}
        >
          ↑{obstacle.upvotes || 0} ↓{obstacle.downvotes || 0}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// 🎨 Get obstacle-specific icon and colors
function getObstacleDisplay(type: ObstacleType, severity?: string) {
  const displays: Record<
    ObstacleType,
    {
      icon: string;
      backgroundColor: string;
    }
  > = {
    vendor_blocking: {
      icon: "storefront",
      backgroundColor: "#F97316", // Orange - vendors
    },
    parked_vehicles: {
      icon: "car",
      backgroundColor: "#EF4444", // Red - blocking vehicles
    },
    construction: {
      icon: "construct",
      backgroundColor: "#F59E0B", // Yellow/Amber - construction
    },
    electrical_post: {
      icon: "flash",
      backgroundColor: "#8B5CF6", // Purple - electrical
    },
    tree_roots: {
      icon: "leaf",
      backgroundColor: "#22C55E", // Green - nature
    },
    no_sidewalk: {
      icon: "ban",
      backgroundColor: "#DC2626", // Dark red - danger
    },
    flooding: {
      icon: "water",
      backgroundColor: "#3B82F6", // Blue - water
    },
    stairs_no_ramp: {
      icon: "arrow-up",
      backgroundColor: "#EC4899", // Pink - accessibility barrier
    },
    narrow_passage: {
      icon: "resize",
      backgroundColor: "#F59E0B", // Amber - width issue
    },
    broken_pavement: {
      icon: "warning",
      backgroundColor: "#EF4444", // Red - danger
    },
    steep_slope: {
      icon: "trending-up",
      backgroundColor: "#F97316", // Orange - difficulty
    },
    other: {
      icon: "help-circle",
      backgroundColor: "#6B7280", // Gray - unknown
    },
  };

  // Override color for blocking severity
  const display = displays[type] || displays.other;

  if (severity === "blocking") {
    return {
      ...display,
      backgroundColor: "#DC2626", // Dark red for blocking obstacles
    };
  }

  return display;
}

// 🔥 ENHANCED VALIDATION DISPLAY COMPONENT
function EnhancedValidationDisplay({
  obstacle,
}: {
  obstacle: AccessibilityObstacle;
}) {
  const validationStatus =
    obstacleValidationService.getValidationStatus(obstacle);
  const upvotes = obstacle.upvotes || 0;
  const downvotes = obstacle.downvotes || 0;

  const getStatusDisplay = () => {
    switch (validationStatus.tier) {
      case "admin_resolved":
        return {
          icon: "shield-checkmark",
          color: "#3B82F6",
          title: "Official Status",
          description: "Verified by government assessor or admin",
          bgColor: "#EFF6FF",
        };

      case "community_verified":
        if (
          validationStatus.conflictingReports &&
          validationStatus.confidence === "low"
        ) {
          return {
            icon: "warning",
            color: "#F59E0B",
            title: "Disputed Report",
            description: `Community has mixed opinions (${upvotes} confirm, ${downvotes} dispute)`,
            bgColor: "#FFFBEB",
          };
        } else {
          return {
            icon: "checkmark-circle",
            color: "#22C55E",
            title: "Community Verified",
            description: `Confirmed by ${upvotes} users, disputed by ${downvotes}`,
            bgColor: "#F0FDF4",
          };
        }

      case "single_report":
      default:
        return {
          icon: "alert-circle",
          color: "#EF4444",
          title: "Single Report",
          description: "Needs community validation - help verify this obstacle",
          bgColor: "#FEF2F2",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <View
      style={{
        backgroundColor: statusDisplay.bgColor,
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: statusDisplay.color + "40", // 25% opacity
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <Ionicons
          name={statusDisplay.icon as any}
          size={20}
          color={statusDisplay.color}
        />
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: statusDisplay.color,
            marginLeft: 8,
          }}
        >
          {statusDisplay.title}
        </Text>
      </View>

      <Text
        style={{
          fontSize: 14,
          color: "#374151",
          lineHeight: 20,
          marginBottom: 8,
        }}
      >
        {statusDisplay.description}
      </Text>

      {/* Validation breakdown */}
      {(upvotes > 0 || downvotes > 0) && (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="thumbs-up" size={16} color="#22C55E" />
            <Text
              style={{ marginLeft: 4, color: "#22C55E", fontWeight: "600" }}
            >
              {upvotes} confirmed
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="thumbs-down" size={16} color="#EF4444" />
            <Text
              style={{ marginLeft: 4, color: "#EF4444", fontWeight: "600" }}
            >
              {downvotes} disputed
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Unified route data structure
interface UnifiedRouteAnalysis {
  fastestRoute: {
    polyline: UserLocation[];
    duration: number;
    distance: number;
    grade: string;
    leftSidewalk: UserLocation[];
    rightSidewalk: UserLocation[];
  };
  accessibleRoute: {
    polyline: UserLocation[];
    duration: number;
    distance: number;
    grade: string;
    leftSidewalk: UserLocation[];
    rightSidewalk: UserLocation[];
  };
  comparison: {
    timeDifference: number;
    accessibilityImprovement: number;
    recommendation: string;
  };
}

// Polyline decoder
const decodePolyline = (encoded: string): UserLocation[] => {
  if (!encoded) return [];

  const points: UserLocation[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
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

  return points;
};

// Generate sidewalk offsets
const generateSidewalkPaths = (
  routePoints: UserLocation[],
  offsetDistance: number = 0.00008 // ~9 meters at equator
): { left: UserLocation[]; right: UserLocation[] } => {
  const leftSidewalk: UserLocation[] = [];
  const rightSidewalk: UserLocation[] = [];

  for (let i = 0; i < routePoints.length; i++) {
    const point = routePoints[i];

    if (i < routePoints.length - 1) {
      const nextPoint = routePoints[i + 1];

      const deltaLng = nextPoint.longitude - point.longitude;
      const deltaLat = nextPoint.latitude - point.latitude;
      const bearing = Math.atan2(deltaLng, deltaLat);

      const perpBearing = bearing + Math.PI / 2;
      const normalizedX = Math.sin(perpBearing);
      const normalizedY = Math.cos(perpBearing);

      leftSidewalk.push({
        latitude: point.latitude + normalizedY * offsetDistance,
        longitude: point.longitude + normalizedX * offsetDistance,
      });

      rightSidewalk.push({
        latitude: point.latitude - normalizedY * offsetDistance,
        longitude: point.longitude - normalizedX * offsetDistance,
      });
    } else {
      leftSidewalk.push(point);
      rightSidewalk.push(point);
    }
  }

  return { left: leftSidewalk, right: rightSidewalk };
};

export default function NavigationScreen() {
  const { location, loading, error, getCurrentLocation } = useLocation();
  const { profile } = useUserProfile();
  const [destination, setDestination] = useState<string>("");

  // Map and obstacle states
  const [nearbyObstacles, setNearbyObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [selectedObstacle, setSelectedObstacle] =
    useState<AccessibilityObstacle | null>(null);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  // 🔥 UNIFIED ROUTING STATES
  const [routeAnalysis, setRouteAnalysis] =
    useState<UnifiedRouteAnalysis | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedDestination, setSelectedDestination] =
    useState<UserLocation | null>(null);
  const [destinationName, setDestinationName] = useState<string>("");
  const [showSidewalks, setShowSidewalks] = useState(true);

  // Analysis loading states
  const [mapLoaded, setMapLoaded] = useState(false);

  // 🔥 VALIDATION SYSTEM STATE
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const insets = useSafeAreaInsets();

  // POI data
  const pasigPOIs = [
    {
      id: "1",
      name: "Pasig City Hall",
      lat: 14.5764,
      lng: 121.0851,
      type: "government",
    },
    { id: "2", name: "The Podium", lat: 14.5657, lng: 121.0644, type: "mall" },
    {
      id: "3",
      name: "Rizal Medical Center",
      lat: 14.5739,
      lng: 121.0892,
      type: "hospital",
    },
    {
      id: "4",
      name: "Pasig General Hospital",
      lat: 14.5858,
      lng: 121.0907,
      type: "hospital",
    },
    {
      id: "5",
      name: "Ortigas Center",
      lat: 14.5866,
      lng: 121.0564,
      type: "business",
    },
  ];

  // Load nearby obstacles
  const loadNearbyObstacles = async () => {
    if (!location) return;

    try {
      console.log("🗺️ Loading obstacles...");
      const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
        location.latitude,
        location.longitude,
        5
      );
      setNearbyObstacles(obstacles);
      console.log(`✅ Loaded ${obstacles.length} obstacles`);
    } catch (error) {
      console.error("❌ Error loading obstacles:", error);
    }
  };

  useEffect(() => {
    if (location) {
      loadNearbyObstacles();
    }
  }, [location]);

  // 🔥 VALIDATION SYSTEM MONITORING
  useEffect(() => {
    let validationInterval: number | null = null;

    if (location && (routeAnalysis || isNavigating)) {
      console.log("🔥 VALIDATION SYSTEM ACTIVATED!");

      // Reset session counters when navigation starts
      obstacleValidationService.resetSessionCounters();

      const performValidationCheck = async () => {
        try {
          // Guard against poor GPS accuracy
          if (!location.accuracy || location.accuracy > 30) {
            console.log(
              "🚫 Skipping validation - poor GPS accuracy:",
              location.accuracy
            );
            return;
          }

          // Prevent overlapping calls
          if (currentValidationPrompt) {
            return;
          }

          const prompts =
            await obstacleValidationService.checkForValidationPrompts(location);

          if (prompts.length > 0 && !currentValidationPrompt) {
            console.log(`🎯 VALIDATION PROMPT TRIGGERED!`);
            setCurrentValidationPrompt(prompts[0]);
            Vibration.vibrate(100);
          }
        } catch (error) {
          console.error("❌ Validation check error:", error);
        }
      };

      // Initial check
      performValidationCheck();

      // 10-second monitoring interval
      validationInterval = setInterval(
        performValidationCheck,
        10000
      ) as unknown as number;

      console.log("⏰ Validation monitoring active");
    }

    return () => {
      if (validationInterval !== null) {
        clearInterval(validationInterval);
      }
    };
  }, [location, routeAnalysis, isNavigating, currentValidationPrompt]);

  // 🔥 UNIFIED ROUTE CALCULATION
  const calculateUnifiedRoutes = async (poi: any) => {
    if (!location || !profile) {
      Alert.alert(
        "Requirements Missing",
        "Location and profile required for intelligent routing."
      );
      return;
    }

    setIsCalculating(true);
    setRouteAnalysis(null);

    try {
      console.log("🧠 Calculating unified intelligent routes...");

      const destLocation: UserLocation = {
        latitude: poi.lat,
        longitude: poi.lng,
      };

      setSelectedDestination(destLocation);
      setDestinationName(poi.name);

      // Get both multi-route analysis AND sidewalk analysis
      const [multiRouteResult, sidewalkResult] = await Promise.all([
        routeAnalysisService
          .analyzeRoutes(location, destLocation, profile)
          .catch(() => null),
        sidewalkRouteAnalysisService
          .analyzeSidewalkRoutes(location, destLocation, profile)
          .catch(() => null),
      ]);

      // Combine results into unified analysis
      let fastestRoute, accessibleRoute;

      if (multiRouteResult) {
        // Use multi-route analysis results
        const fastestPolyline = decodePolyline(
          multiRouteResult.fastestRoute.googleRoute?.polyline || ""
        );
        const accessiblePolyline = decodePolyline(
          multiRouteResult.accessibleRoute.googleRoute?.polyline || ""
        );

        // Generate sidewalk paths for both routes
        const fastestSidewalks = generateSidewalkPaths(fastestPolyline);
        const accessibleSidewalks = generateSidewalkPaths(accessiblePolyline);

        fastestRoute = {
          polyline: fastestPolyline,
          duration: multiRouteResult.fastestRoute.googleRoute?.duration || 0,
          distance: multiRouteResult.fastestRoute.googleRoute?.distance || 0,
          grade: multiRouteResult.fastestRoute.accessibilityScore?.grade || "C",
          leftSidewalk: fastestSidewalks.left,
          rightSidewalk: fastestSidewalks.right,
        };

        accessibleRoute = {
          polyline: accessiblePolyline,
          duration: multiRouteResult.accessibleRoute.googleRoute?.duration || 0,
          distance: multiRouteResult.accessibleRoute.googleRoute?.distance || 0,
          grade:
            multiRouteResult.accessibleRoute.accessibilityScore?.grade || "B",
          leftSidewalk: accessibleSidewalks.left,
          rightSidewalk: accessibleSidewalks.right,
        };
      } else if (sidewalkResult) {
        // Fallback to sidewalk analysis
        const standardPolyline = sidewalkResult.standardRoute?.segments?.[0]
          ? (sidewalkResult.standardRoute.segments[0] as any).polyline
            ? decodePolyline(
                (sidewalkResult.standardRoute.segments[0] as any).polyline
              )
            : []
          : [];
        const optimizedPolyline = sidewalkResult.optimizedRoute?.segments?.[0]
          ? (sidewalkResult.optimizedRoute.segments[0] as any).polyline
            ? decodePolyline(
                (sidewalkResult.optimizedRoute.segments[0] as any).polyline
              )
            : []
          : [];

        // Generate sidewalk paths for both routes
        const standardSidewalks = generateSidewalkPaths(standardPolyline);
        const optimizedSidewalks = generateSidewalkPaths(optimizedPolyline);

        fastestRoute = {
          polyline: standardPolyline,
          duration: sidewalkResult.standardRoute?.totalTime || 0,
          distance: sidewalkResult.standardRoute?.totalDistance || 0,
          grade: sidewalkResult.standardRoute?.overallScore?.grade || "C",
          leftSidewalk: standardSidewalks.left,
          rightSidewalk: standardSidewalks.right,
        };

        accessibleRoute = {
          polyline: optimizedPolyline,
          duration: sidewalkResult.optimizedRoute?.totalTime || 0,
          distance: sidewalkResult.optimizedRoute?.totalDistance || 0,
          grade: sidewalkResult.optimizedRoute?.overallScore?.grade || "B",
          leftSidewalk: optimizedSidewalks.left,
          rightSidewalk: optimizedSidewalks.right,
        };
      } else {
        throw new Error("Could not calculate any routes");
      }

      // Create unified analysis with FIXED interface mapping
      const unifiedAnalysis: UnifiedRouteAnalysis = {
        fastestRoute,
        accessibleRoute,
        comparison: {
          timeDifference:
            multiRouteResult?.routeComparison?.timeDifference ||
            accessibleRoute.duration - fastestRoute.duration,
          accessibilityImprovement:
            multiRouteResult?.routeComparison?.accessibilityImprovement ||
            (accessibleRoute.grade === "A"
              ? 90
              : accessibleRoute.grade === "B"
              ? 80
              : 70) -
              (fastestRoute.grade === "A"
                ? 90
                : fastestRoute.grade === "B"
                ? 80
                : 70),
          recommendation:
            multiRouteResult?.routeComparison?.recommendation ||
            `Accessible route is ${Math.round(
              (accessibleRoute.duration - fastestRoute.duration) / 60
            )} minutes longer but ${accessibleRoute.grade} grade vs ${
              fastestRoute.grade
            } grade`,
        },
      };

      setRouteAnalysis(unifiedAnalysis);

      // Auto-fit map to show both routes
      if (mapRef.current) {
        const allCoords = [
          location,
          destLocation,
          ...fastestRoute.polyline,
          ...accessibleRoute.polyline,
        ].filter((coord) => coord.latitude && coord.longitude);

        if (allCoords.length > 0) {
          mapRef.current.fitToCoordinates(allCoords, {
            edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        }
      }

      // Success feedback
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

  // Handle POI selection - ORIGINAL ONE-TAP FLOW PRESERVED!
  const handlePOIPress = (poi: any) => {
    console.log(`🏢 Selected POI: ${poi.name} - Auto-calculating routes...`);

    // Animate map to POI
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

    // AUTO-CALCULATE ROUTES (no modal, no extra clicks)
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
      }\n\nSidewalk guidance enabled.`,
      [{ text: "Let's Go!" }]
    );
  };

  // Clear routes
  const clearRoutes = () => {
    setRouteAnalysis(null);
    setSelectedDestination(null);
    setDestinationName("");
    setIsNavigating(false);
  };

  // Handle obstacle press
  const handleObstaclePress = (obstacle: AccessibilityObstacle) => {
    setSelectedObstacle(obstacle);
    setShowObstacleModal(true);
  };

  // 🔥 VALIDATION SYSTEM HANDLERS
  const handleValidationResponse = async (
    response: "still_there" | "cleared" | "skip"
  ) => {
    try {
      if (currentValidationPrompt) {
        console.log(`✅ User responded: ${response}`);

        await obstacleValidationService.processValidationResponse(
          currentValidationPrompt.obstacleId,
          response
        );

        let message = "";
        switch (response) {
          case "still_there":
            message =
              "Salamat! Na-confirm na ang obstacle.\n\n(Thanks! Obstacle confirmed.)";
            break;
          case "cleared":
            message =
              "Salamat! Na-mark na as cleared.\n\n(Thanks! Marked as cleared.)";
            break;
          case "skip":
            message = "OK, skip lang.\n\n(Skipped validation.)";
            break;
        }

        await loadNearbyObstacles();

        if (response !== "skip") {
          Alert.alert("Validation Recorded", message, [{ text: "OK" }]);
        }
      }
    } catch (error) {
      console.error("❌ Validation response error:", error);
      Alert.alert(
        "Validation Failed",
        "Hindi ma-record ang validation. Subukan ulit.\n\n(Could not record validation. Please try again.)",
        [{ text: "OK" }]
      );
    } finally {
      setCurrentValidationPrompt(null);
    }
  };

  const handleValidationDismiss = () => {
    setCurrentValidationPrompt(null);
  };

  // Utility functions
  const getPOIIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "government":
        return "business";
      case "mall":
        return "storefront";
      case "hospital":
        return "medical";
      case "business":
        return "briefcase";
      default:
        return "location";
    }
  };

  const getObstacleIcon = (
    type: ObstacleType
  ): keyof typeof Ionicons.glyphMap => {
    const icons: Record<ObstacleType, keyof typeof Ionicons.glyphMap> = {
      vendor_blocking: "storefront",
      parked_vehicles: "car",
      construction: "construct",
      electrical_post: "flash",
      tree_roots: "leaf",
      no_sidewalk: "warning",
      flooding: "water",
      stairs_no_ramp: "arrow-up",
      narrow_passage: "resize",
      broken_pavement: "warning",
      steep_slope: "trending-up",
      other: "help-circle",
    };
    return icons[type] || "help-circle";
  };

  const getObstacleColor = (severity: string) => {
    switch (severity) {
      case "blocking":
        return "#EF4444";
      case "high":
        return "#F97316";
      case "medium":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>
          Hinahanda ang mapa...\n(Loading map...)
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Location Error</Text>
        <Text style={styles.errorText}>
          Hindi makuha ang inyong location. Pakicheck ang location permissions.
          {"\n\n"}
          (Cannot get your location. Please check location permissions.)
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={getCurrentLocation}
        >
          <Text style={styles.retryButtonText}>Subukan Ulit (Try Again)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider="google"
        initialRegion={{
          latitude: location?.latitude || 14.5547,
          longitude: location?.longitude || 121.0244,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onMapReady={() => {
          setMapLoaded(true);
          console.log("✅ Map loaded successfully");
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="standard"
        maxZoomLevel={18}
        minZoomLevel={10}
      >
        {/* 🔥 NEW OBSTACLE-FIRST MARKERS */}
        {nearbyObstacles.map((obstacle) => (
          <Marker
            key={obstacle.id}
            coordinate={{
              latitude: obstacle.location.latitude,
              longitude: obstacle.location.longitude,
            }}
            onPress={() => handleObstaclePress(obstacle)}
          >
            <EnhancedObstacleMarker
              obstacle={obstacle}
              onPress={() => handleObstaclePress(obstacle)}
            />
          </Marker>
        ))}

        {/* POI MARKERS */}
        {pasigPOIs.map((poi) => (
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
            <Polyline
              coordinates={routeAnalysis.fastestRoute.polyline}
              strokeColor="#EF4444"
              strokeWidth={5}
              lineDashPattern={[0]}
              zIndex={1}
            />

            {/* ACCESSIBLE ROUTE - MAIN LINE */}
            <Polyline
              coordinates={routeAnalysis.accessibleRoute.polyline}
              strokeColor="#22C55E"
              strokeWidth={5}
              lineDashPattern={[0]}
              zIndex={2}
            />

            {/* LEFT SIDEWALK PATHS (DASHED) */}
            {showSidewalks && routeAnalysis?.fastestRoute.leftSidewalk && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.leftSidewalk}
                strokeColor="#EF4444"
                strokeWidth={2}
                lineDashPattern={[5, 5]}
                zIndex={3}
              />
            )}

            {showSidewalks && routeAnalysis?.accessibleRoute.leftSidewalk && (
              <Polyline
                coordinates={routeAnalysis.accessibleRoute.leftSidewalk}
                strokeColor="#22C55E"
                strokeWidth={2}
                lineDashPattern={[5, 5]}
                zIndex={4}
              />
            )}

            {/* RIGHT SIDEWALK PATHS (DOTTED) */}
            {showSidewalks && routeAnalysis?.fastestRoute.rightSidewalk && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.rightSidewalk}
                strokeColor="#EF4444"
                strokeWidth={2}
                lineDashPattern={[2, 8]}
                zIndex={5}
              />
            )}

            {showSidewalks && routeAnalysis?.accessibleRoute.rightSidewalk && (
              <Polyline
                coordinates={routeAnalysis.accessibleRoute.rightSidewalk}
                strokeColor="#22C55E"
                strokeWidth={2}
                lineDashPattern={[2, 8]}
                zIndex={6}
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

      {/* 🔥 FIXED DUAL ROUTE INFO PANEL! */}
      {routeAnalysis && (
        <View
          style={[styles.routeInfoContainer, { bottom: insets.bottom + 100 }]}
        >
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>
              🗺️ Routes to {destinationName}
            </Text>

            {/* 🔥 BOTH ROUTES DISPLAYED! */}
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
                  {Math.round(routeAnalysis.fastestRoute.duration / 60)}min •{" "}
                  {(routeAnalysis.fastestRoute.distance / 1000).toFixed(1)}km •
                  Grade {routeAnalysis.fastestRoute.grade}
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
                  {Math.round(routeAnalysis.accessibleRoute.duration / 60)}min •{" "}
                  {(routeAnalysis.accessibleRoute.distance / 1000).toFixed(1)}km
                  • Grade {routeAnalysis.accessibleRoute.grade}
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

            {/* 🔥 ROUTE COMPARISON STATS */}
            <View style={styles.comparisonStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Time Difference</Text>
                <Text style={styles.statValue}>
                  {Math.round(routeAnalysis.comparison.timeDifference / 60)} min
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Accessibility</Text>
                <Text style={styles.statValue}>
                  +
                  {Math.round(
                    routeAnalysis.comparison.accessibilityImprovement
                  )}{" "}
                  pts
                </Text>
              </View>
            </View>

            {/* Sidewalk toggle */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowSidewalks(!showSidewalks)}
              >
                <Ionicons
                  name={showSidewalks ? "eye" : "eye-off"}
                  size={16}
                  color="#3B82F6"
                />
                <Text style={styles.toggleText}>
                  {showSidewalks ? "Hide" : "Show"} Sidewalks
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearRoutes}
              >
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* CALCULATION LOADING OVERLAY */}
      {isCalculating && (
        <View style={styles.analysisOverlay}>
          <View style={styles.analysisCard}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.analysisText}>
              Calculating intelligent routes...
            </Text>
            <Text style={styles.analysisSubtext}>
              Analyzing accessibility • Generating sidewalk paths
            </Text>
          </View>
        </View>
      )}

      {/* OBSTACLE DETAIL MODAL */}
      <Modal visible={showObstacleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.obstacleModal}>
            {selectedObstacle && (
              <>
                <View style={styles.obstacleHeader}>
                  <View
                    style={[
                      styles.obstacleIconLarge,
                      {
                        backgroundColor: getObstacleColor(
                          selectedObstacle.severity
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name={getObstacleIcon(selectedObstacle.type)}
                      size={24}
                      color="white"
                    />
                  </View>
                  <View style={styles.obstacleInfo}>
                    <Text style={styles.obstacleTitle}>
                      {selectedObstacle.type.replace("_", " ").toUpperCase()}
                    </Text>
                    <Text style={styles.obstacleSeverity}>
                      Severity: {selectedObstacle.severity}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowObstacleModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.obstacleContent}>
                  <Text style={styles.obstacleDescription}>
                    {selectedObstacle.description}
                  </Text>

                  <View style={styles.obstacleDetails}>
                    <Text style={styles.detailLabel}>Reported:</Text>
                    <Text style={styles.detailValue}>
                      {selectedObstacle.reportedAt.toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.obstacleDetails}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={styles.detailValue}>
                      {selectedObstacle.verified ? "Verified" : "Unverified"}
                    </Text>
                  </View>

                  {/* 🔥 ENHANCED VALIDATION STATUS DISPLAY */}
                  <View style={styles.obstacleDetails}>
                    <Text style={styles.detailLabel}>Validation:</Text>
                    <Text style={styles.detailValue}>
                      ↑{selectedObstacle.upvotes || 0} ↓
                      {selectedObstacle.downvotes || 0}
                    </Text>
                  </View>

                  {/* 🔥 NEW: Enhanced validation breakdown */}
                  <EnhancedValidationDisplay obstacle={selectedObstacle} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 🔥 VALIDATION PROMPT OVERLAY */}
      {currentValidationPrompt && (
        <ValidationPrompt
          prompt={currentValidationPrompt}
          onResponse={handleValidationResponse}
          onDismiss={handleValidationDismiss}
        />
      )}

      {/* BOTTOM CONTROLS */}
      <View style={[styles.bottomControls, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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
  // 🔥 NEW COMPARISON STATS STYLES
  comparisonStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "bold",
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  toggleText: {
    fontSize: 12,
    color: "#3B82F6",
    marginLeft: 4,
    fontWeight: "600",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
  },
  clearText: {
    fontSize: 12,
    color: "#EF4444",
    marginLeft: 4,
    fontWeight: "600",
  },
  analysisOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  analysisCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    margin: 20,
  },
  analysisText: {
    marginTop: 16,
    fontSize: 16,
    color: "#1F2937",
    textAlign: "center",
  },
  analysisSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  poiMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  calloutContainer: {
    padding: 8,
    minWidth: 120,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  calloutType: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  calloutAction: {
    fontSize: 11,
    color: "#3B82F6",
    marginTop: 4,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  obstacleModal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  obstacleHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  obstacleIconLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  obstacleInfo: {
    flex: 1,
    marginLeft: 16,
  },
  obstacleTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  obstacleSeverity: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  obstacleContent: {
    padding: 20,
    maxHeight: 300,
  },
  obstacleDescription: {
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 24,
    marginBottom: 16,
  },
  obstacleDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
    flex: 1,
    textAlign: "right",
  },
  bottomControls: {
    position: "absolute",
    right: 16,
    flexDirection: "column",
    gap: 12,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
