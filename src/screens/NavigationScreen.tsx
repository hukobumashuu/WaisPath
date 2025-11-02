// src/screens/NavigationScreen.tsx
// ✅ FINAL FIX: Touch-and-hold location check + Stop navigation clears panel

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Vibration,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useLocation } from "../hooks/useLocation";
import { useUserProfile } from "../stores/userProfileStore";
import { firebaseServices } from "../services/firebase";
import { UserLocation, AccessibilityObstacle } from "../types";
import { calculateUserBearingFromRoute } from "../utils/navigationUtils";
import { useMapInteraction } from "../hooks/useMapInteraction";
import { navigationStyles as styles } from "../styles/navigationStyles";
import { useProximityDetection } from "../hooks/useProximityDetection";
import { useRouteCalculation } from "../hooks/useRouteCalculation";
import { ProximityAlertsOverlay } from "../components/ProximityAlertsOverlay";
import { EnhancedObstacleMarker } from "../components/EnhancedObstacleMarker";
import { RouteInfoBottomSheet } from "../components/RouteInfoPanel";
import { NavigationControls } from "../components/NavigationControls";
import EnhancedSearchBar from "../components/EnhancedSearchBar";
import { PlaceSearchResult } from "../services/googlePlacesService";
import { getPOIIcon } from "../utils/mapUtils";
import { SAMPLE_POIS } from "../constants/navigationConstants";
import {
  ProximityAlert,
  proximityDetectionService,
} from "../services/proximityDetectionService";
import { ValidationPrompt } from "../components/ValidationPrompt";
import {
  obstacleValidationService,
  type ValidationPrompt as ValidationPromptType,
} from "../services/obstacleValidationService";
import { textToSpeechService } from "../services/textToSpeechService";

export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { location, error: locationError } = useLocation();
  const { profile } = useUserProfile();

  const mapRef = useRef<MapView | null>(null);
  const lastValidationCheckRef = useRef<number>(0);

  const [destination, setDestination] = useState("");
  const [remainingPolyline, setRemainingPolyline] = useState<UserLocation[]>(
    []
  );
  const [selectedRouteType, setSelectedRouteType] = useState<
    "fastest" | "clearest" | null
  >(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [userBearing, setUserBearing] = useState<number | null>(null);
  const [navigationPausedByBlur, setNavigationPausedByBlur] = useState(false);

  const [showAllObstacles, setShowAllObstacles] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(true);
  const [validationRadiusObstacles, setValidationRadiusObstacles] = useState<
    AccessibilityObstacle[]
  >([]);
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [currentValidationPrompt, setCurrentValidationPrompt] =
    useState<ValidationPromptType | null>(null);
  const [showSidewalks, setShowSidewalks] = useState(true);

  const [isMapSelectionMode, setIsMapSelectionMode] = useState(false);
  const [selectedMapLocation, setSelectedMapLocation] =
    useState<UserLocation | null>(null);

  const VALIDATION_CHECK_INTERVAL = 30000;

  const {
    routeAnalysis,
    isCalculating,
    selectedDestination,
    destinationName,
    routeObstacles,
    nearbyObstacles,
    calculateUnifiedRoutes,
    handlePOIPress,
    updateRouteAnalysis,
    clearRoutes,
  } = useRouteCalculation({
    location,
    profile,
    mapRef,
    destination,
  });

  const proximityState = useProximityDetection({
    isNavigating,
    userLocation: location,
    routePolyline: remainingPolyline,
    userProfile: profile,
  });

  // ✅ FIX: Pass currentLocation to hook
  const mapInteraction = useMapInteraction({
    isNavigating: isNavigating || isMapSelectionMode,
    nearbyPOIs: SAMPLE_POIS,
    currentLocation: location, // ✅ NEW: Pass location for checking
    onLocationSelected: (coordinate, nearestInfo) => {
      // Location already checked in hook, just proceed
      const customPOI = {
        id: `custom_${Date.now()}`,
        name: "Custom Destination",
        type: "custom" as const,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
      };

      handlePOIPress(customPOI);
      setShowRoutePanel(true);
    },
    onReportAtLocation: (coordinate) => {
      Alert.alert(
        "Report Feature",
        "This will navigate to Report screen with location pre-filled.",
        [{ text: "OK" }]
      );
    },
  });

  function getObstacleRouteType(
    obstacle: AccessibilityObstacle,
    routeAnalysis: any
  ): "fastest" | "clearest" | "both" | undefined {
    if (!routeAnalysis) return undefined;

    const onFastest = routeAnalysis.fastestRoute?.obstacles?.some(
      (obs: any) => obs.id === obstacle.id
    );
    const onClearest = routeAnalysis.clearestRoute?.obstacles?.some(
      (obs: any) => obs.id === obstacle.id
    );

    if (onFastest && onClearest) return "both";
    if (onFastest) return "fastest";
    if (onClearest) return "clearest";
    return undefined;
  }

  const dedupeById = (arr: AccessibilityObstacle[] = []) => {
    const map = new Map<string, AccessibilityObstacle>();
    arr.forEach((o) => map.set(String(o.id), o));
    return Array.from(map.values());
  };

  const calculateRemainingRoute = useCallback(
    (userLocation: UserLocation, fullRoute: UserLocation[]): UserLocation[] => {
      if (!fullRoute || fullRoute.length === 0 || !userLocation) return [];

      const norm = (p: any) => ({
        latitude: p.latitude ?? p.lat,
        longitude: p.longitude ?? p.lng,
      });

      const user = norm(userLocation);
      const route = fullRoute.map(norm);

      let bestIndex = 0;
      let bestDist = Infinity;

      for (let i = 0; i < route.length; i++) {
        const rPt = route[i];
        const dLat = user.latitude - rPt.latitude;
        const dLng = user.longitude - rPt.longitude;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      const out: UserLocation[] = [];
      const lastPt = out[out.length - 1];

      if (
        !lastPt ||
        lastPt.latitude !== user.latitude ||
        lastPt.longitude !== user.longitude
      ) {
        out.push(user);
      }

      if (
        lastPt &&
        lastPt.latitude === route[bestIndex].latitude &&
        lastPt.longitude === route[bestIndex].longitude
      ) {
        return out;
      }

      const start = bestIndex + 1;
      for (let k = start; k < route.length; k++) {
        const pt = route[k];
        const prev = out[out.length - 1];
        if (
          !prev ||
          prev.latitude !== pt.latitude ||
          prev.longitude !== pt.longitude
        ) {
          out.push(pt);
        }
      }

      return out;
    },
    []
  );

  const handleChooseOnMap = useCallback(() => {
    console.log("📍 Map selection mode activated");
    setIsMapSelectionMode(true);
    setShowRoutePanel(false);
    setSelectedMapLocation(null);

    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [location]);

  const cancelMapSelection = useCallback(() => {
    console.log("❌ Map selection mode cancelled");
    setIsMapSelectionMode(false);
    setSelectedMapLocation(null);
  }, []);

  const handleMapSingleTap = useCallback(
    (coordinate: UserLocation) => {
      if (!isMapSelectionMode) return;

      console.log("📍 Custom location selected:", coordinate);
      setSelectedMapLocation(coordinate);

      // ✅ Check location for tap-to-select too
      if (!location) {
        Alert.alert(
          "Location Error",
          "Cannot get your current location. Please ensure GPS is enabled and app has location permission."
        );
        return;
      }

      Alert.alert(
        "Set Custom Destination?",
        `Coordinates: ${coordinate.latitude.toFixed(
          5
        )}, ${coordinate.longitude.toFixed(5)}`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setSelectedMapLocation(null),
          },
          {
            text: "Calculate Route",
            onPress: () => {
              const customPOI = {
                id: `custom_${Date.now()}`,
                name: "Custom Destination",
                type: "custom" as const,
                lat: coordinate.latitude,
                lng: coordinate.longitude,
              };

              handlePOIPress(customPOI);
              setShowRoutePanel(true);
              setIsMapSelectionMode(false);
              setSelectedMapLocation(null);
            },
          },
        ]
      );
    },
    [isMapSelectionMode, handlePOIPress, location]
  );

  const handleDestinationSelect = async (destination: PlaceSearchResult) => {
    try {
      setDestination(destination.name);

      const poiObject = {
        id: `search_${destination.placeId}`,
        name: destination.name,
        type: getDestinationTypeFromGoogleTypes(destination.types),
        lat: destination.location.latitude,
        lng: destination.location.longitude,
      };

      await calculateUnifiedRoutes(poiObject);
      setShowRoutePanel(true);

      if (destination.accessibilityFeatures?.wheelchairAccessible) {
        Alert.alert(
          "Accessibility Info",
          `${destination.name} is marked as wheelchair accessible.`,
          [{ text: "Great!" }]
        );
      }
    } catch (error) {
      console.error("Error selecting destination:", error);
      Alert.alert("Error", "Unable to calculate route to this destination.");
    }
  };

  const getDestinationTypeFromGoogleTypes = (types: string[]) => {
    if (types.includes("government")) return "government";
    if (types.includes("hospital")) return "hospital";
    if (types.includes("school")) return "school";
    if (types.includes("shopping_mall")) return "mall";
    if (types.includes("store")) return "shopping";
    return "business";
  };

  const handleStartNavigation = useCallback(
    (routeType: "fastest" | "clearest") => {
      if (!location) {
        Alert.alert(
          "Location Error",
          "Cannot get your current location. Please ensure GPS is enabled and app has location permission."
        );
        return;
      }

      if (!routeAnalysis) {
        Alert.alert("Error", "No route available. Please try again.");
        return;
      }

      console.log(`🚀 Starting navigation with ${routeType} route`);
      setSelectedRouteType(routeType);
      setIsNavigating(true);

      Vibration.vibrate(50);
      textToSpeechService.testTTS();
    },
    [location, routeAnalysis]
  );

  // ✅ FIX: Clear routes AND hide panel
  const handleStopNavigation = useCallback(() => {
    Alert.alert(
      "Stop Navigation?",
      "Are you sure you want to stop navigation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () => {
            console.log("🛑 Navigation stopped by user");
            setIsNavigating(false);
            setSelectedRouteType(null);
            setRemainingPolyline([]);
            proximityDetectionService.resetDetectionState();
            Vibration.vibrate(100);

            // ✅ FIX: Clear routes and hide panel
            clearRoutes();
            setShowRoutePanel(false);
            setDestination("");
          },
        },
      ]
    );
  }, [clearRoutes]);

  const handleToggleObstacles = useCallback(() => {
    setShowAllObstacles((prev) => !prev);
  }, []);

  const handleProximityAlertPress = useCallback((alert: ProximityAlert) => {
    console.log("🔔 Proximity alert pressed:", alert.obstacle.type);
  }, []);

  const checkArrival = useCallback(() => {
    if (!location || !selectedDestination || hasArrived) return;

    const distance =
      Math.sqrt(
        Math.pow(location.latitude - selectedDestination.latitude, 2) +
          Math.pow(location.longitude - selectedDestination.longitude, 2)
      ) * 111320;

    if (distance < 20) {
      setHasArrived(true);
      setIsNavigating(false);
      Vibration.vibrate([0, 100, 50, 100]);
      textToSpeechService.testTTS();

      Alert.alert(
        "Destination Reached! 🎉",
        `You've arrived at ${destinationName}`,
        [
          {
            text: "End Navigation",
            onPress: () => {
              clearRoutes();
              setSelectedRouteType(null);
              setDestination("");
              setShowRoutePanel(false);
            },
          },
        ]
      );
    }
  }, [
    location,
    selectedDestination,
    isNavigating,
    destinationName,
    hasArrived,
    clearRoutes,
  ]);

  const handleValidationResponse = useCallback(
    async (response: "still_there" | "cleared" | "skip") => {
      if (!currentValidationPrompt) return;

      try {
        await obstacleValidationService.processValidationResponse(
          currentValidationPrompt.obstacleId,
          response
        );

        Alert.alert(
          "Thank You!",
          "Your feedback helps improve route accuracy for everyone."
        );
      } catch (error) {
        console.error("Validation submission failed:", error);
      } finally {
        setShowValidationPrompt(false);
        setCurrentValidationPrompt(null);
      }
    },
    [currentValidationPrompt]
  );

  useEffect(() => {
    const initServices = async () => {
      const ttsReady = await textToSpeechService.initialize();
      if (!ttsReady) {
        console.warn("⚠️ TTS initialization failed");
      }
    };
    initServices();
  }, []);

  useEffect(() => {
    if (!isNavigating || !location || !selectedRouteType || !routeAnalysis) {
      return;
    }

    const selectedRoute =
      selectedRouteType === "fastest"
        ? routeAnalysis.fastestRoute
        : routeAnalysis.clearestRoute;

    if (!selectedRoute || !selectedRoute.polyline) return;

    const updatedPolyline = calculateRemainingRoute(
      location,
      selectedRoute.polyline
    );

    if (updatedPolyline.length > 0) {
      setRemainingPolyline(updatedPolyline);
    }
  }, [
    location,
    isNavigating,
    selectedRouteType,
    routeAnalysis,
    calculateRemainingRoute,
  ]);

  useEffect(() => {
    if (!isNavigating || !location || !selectedRouteType || !routeAnalysis) {
      setUserBearing(null);
      return;
    }

    const selectedRoute =
      selectedRouteType === "fastest"
        ? routeAnalysis.fastestRoute
        : routeAnalysis.clearestRoute;

    if (!selectedRoute || !selectedRoute.polyline) return;

    const bearing = calculateUserBearingFromRoute(
      location,
      selectedRoute.polyline
    );

    if (bearing !== null) {
      setUserBearing(bearing);
    }
  }, [location, isNavigating, selectedRouteType, routeAnalysis]);

  useEffect(() => {
    if (isNavigating && location && selectedDestination) {
      checkArrival();
    }
  }, [location, isNavigating, selectedDestination, checkArrival]);

  useFocusEffect(
    useCallback(() => {
      if (
        navigationPausedByBlur &&
        selectedDestination &&
        isNavigating === false
      ) {
        setIsNavigating(true);
        setNavigationPausedByBlur(false);
      }

      return () => {
        if (isNavigating) {
          setIsNavigating(false);
          setNavigationPausedByBlur(true);
        }
      };
    }, [isNavigating, selectedDestination, navigationPausedByBlur])
  );

  const renderObstacles = () => {
    const allObstacleIds = new Set<string>();
    const renderedObstacles: JSX.Element[] = [];

    const addObstacleIfUnique = (
      obstacle: AccessibilityObstacle,
      keyPrefix: string,
      isOnRoute: boolean,
      routeType?: "fastest" | "clearest" | "both" | undefined,
      opacity: number = 1.0
    ) => {
      const obstacleId = String(obstacle.id);
      if (!allObstacleIds.has(obstacleId)) {
        allObstacleIds.add(obstacleId);
        renderedObstacles.push(
          <EnhancedObstacleMarker
            key={`${keyPrefix}-${obstacleId}`}
            obstacle={obstacle}
            isOnRoute={isOnRoute}
            routeType={routeType}
            opacity={opacity}
            onPress={() => {}}
          />
        );
      }
    };

    if (routeObstacles && routeObstacles.length > 0) {
      dedupeById(routeObstacles).forEach((obstacle) => {
        const routeType = getObstacleRouteType(obstacle, routeAnalysis);
        addObstacleIfUnique(obstacle, "route", true, routeType, 1.0);
      });
    }

    validationRadiusObstacles.forEach((obstacle) => {
      addObstacleIfUnique(obstacle, "validation", false, undefined, 0.8);
    });

    if (showAllObstacles && nearbyObstacles && nearbyObstacles.length > 0) {
      const extendedOpacity = isNavigating ? 0.5 : 0.7;
      dedupeById(nearbyObstacles).forEach((obstacle) => {
        addObstacleIfUnique(
          obstacle,
          "extended",
          false,
          undefined,
          extendedOpacity
        );
      });
    }

    return renderedObstacles;
  };

  if (!location && !locationError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </SafeAreaView>
    );
  }

  if (locationError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="location-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Location Required</Text>
        <Text style={styles.errorMessage}>
          WAISPATH needs your location to provide accessible navigation.
        </Text>
        <Text style={styles.errorMessage}>{locationError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || 14.5764,
          longitude: location?.longitude || 121.0851,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        followsUserLocation={isNavigating}
        loadingEnabled={true}
        onMapReady={() => console.log("Map ready")}
        onPress={(event) => {
          if (isMapSelectionMode) {
            handleMapSingleTap(event.nativeEvent.coordinate);
          }
        }}
        onLongPress={(event) => {
          if (!isMapSelectionMode) {
            mapInteraction.handleMapLongPress(event.nativeEvent.coordinate);
          }
        }}
      >
        {location && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={userBearing || 0}
            flat={true}
          >
            <View style={styles.userLocationMarker}>
              <Ionicons name="navigate" size={20} color="white" />
            </View>
          </Marker>
        )}

        {selectedDestination && (
          <Marker coordinate={selectedDestination} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={24} color="white" />
            </View>
          </Marker>
        )}

        {renderObstacles()}

        {SAMPLE_POIS.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={poi.location}
            onPress={() => {
              if (!isMapSelectionMode) {
                handlePOIPress(poi);
                setShowRoutePanel(true);
              }
            }}
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

        {mapInteraction.isHoldingMap && mapInteraction.holdLocation && (
          <Marker
            coordinate={mapInteraction.holdLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 80,
                height: 80,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 4,
                  borderColor: "#3B82F6",
                  opacity: mapInteraction.holdProgress / 100,
                }}
              />
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#3B82F6",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "white", fontSize: 10, fontWeight: "bold" }}
                >
                  {Math.round(mapInteraction.holdProgress)}
                </Text>
              </View>
            </View>
          </Marker>
        )}

        {isMapSelectionMode && selectedMapLocation && (
          <Marker coordinate={selectedMapLocation}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#3B82F6",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 3,
                borderColor: "white",
              }}
            >
              <Ionicons name="location-sharp" size={24} color="white" />
            </View>
          </Marker>
        )}

        {routeAnalysis && !isNavigating && (
          <>
            {routeAnalysis.fastestRoute?.polyline?.length > 0 && (
              <Polyline
                coordinates={routeAnalysis.fastestRoute.polyline}
                strokeColor="#EF4444"
                strokeWidth={6}
                zIndex={9}
              />
            )}

            {routeAnalysis.clearestRoute?.polyline?.length > 0 && (
              <Polyline
                coordinates={routeAnalysis.clearestRoute.polyline}
                strokeColor="#22C55E"
                strokeWidth={6}
                zIndex={8}
              />
            )}
          </>
        )}

        {isNavigating && selectedRouteType && remainingPolyline.length > 0 && (
          <Polyline
            coordinates={remainingPolyline}
            strokeColor={
              selectedRouteType === "fastest" ? "#EF4444" : "#22C55E"
            }
            strokeWidth={6}
            zIndex={10}
          />
        )}
      </MapView>

      <EnhancedSearchBar
        onDestinationSelect={handleDestinationSelect}
        onChooseOnMap={handleChooseOnMap}
        userLocation={location || undefined}
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: 16,
          right: 16,
          zIndex: 1000,
        }}
        placeholder="Search for accessible destinations..."
      />

      {isMapSelectionMode && (
        <View style={[styles.mapSelectionBanner, { top: insets.top + 70 }]}>
          <View style={styles.mapSelectionBannerContent}>
            <Ionicons name="hand-left-outline" size={20} color="#3B82F6" />
            <Text style={styles.mapSelectionBannerText}>
              Tap anywhere on map to select location
            </Text>
          </View>
          <TouchableOpacity
            style={styles.mapSelectionCancelButton}
            onPress={cancelMapSelection}
          >
            <Text style={styles.mapSelectionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <NavigationControls
        showFAB={false}
        onFABPress={() => calculateUnifiedRoutes()}
        fabStyle={{ bottom: insets.bottom + 20 }}
        isCalculating={isCalculating}
        isNavigating={isNavigating}
        isDetecting={proximityState.isDetecting}
        proximityAlertsCount={proximityState.proximityAlerts.length}
        showAllObstacles={showAllObstacles}
        onToggleObstacles={handleToggleObstacles}
        validationObstacleCount={validationRadiusObstacles.length}
      />

      <ProximityAlertsOverlay
        alerts={proximityState.proximityAlerts}
        onAlertPress={handleProximityAlertPress}
      />

      {/* ✅ FIX: Show panel based on showRoutePanel state */}
      <RouteInfoBottomSheet
        routeAnalysis={routeAnalysis}
        isVisible={
          !isMapSelectionMode && showRoutePanel && routeAnalysis !== null
        }
        isCalculating={isCalculating}
        onSelectRoute={handleStartNavigation}
        onStopNavigation={handleStopNavigation}
        isNavigating={isNavigating}
      />

      {showValidationPrompt && currentValidationPrompt && (
        <Modal
          visible={showValidationPrompt}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowValidationPrompt(false)}
        >
          <ValidationPrompt
            prompt={currentValidationPrompt}
            onResponse={handleValidationResponse}
            onDismiss={() => setShowValidationPrompt(false)}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}
