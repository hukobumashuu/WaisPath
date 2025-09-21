// src/components/RouteInfoBottomSheet.tsx
// FIXED: Removed close button + Fixed map interaction blocking
// Users can drag up/down to expand/minimize, map clicks work properly

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccessibilityObstacle } from "../types";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const { height: screenHeight } = Dimensions.get("window");

const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  lightGray: "#F8FAFC",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  chipBg: "#EFF8FF",
};

// Constants for sheet positions
const EXPANDED_HEIGHT = screenHeight * 0.8;
const MINIMIZED_HEIGHT = 140;
const DRAG_THRESHOLD = 50;

interface SimpleRouteInfo {
  fastestRoute: {
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  clearestRoute: {
    duration: number; // seconds
    distance: number; // meters
    obstacleCount: number;
    obstacles: AccessibilityObstacle[];
  };
  summary: {
    recommendation: string;
    timeDifference: number; // seconds
    obstacleDifference: number;
    fastestIsAlsoClearest: boolean;
  };
}

interface RouteInfoBottomSheetProps {
  routeAnalysis: SimpleRouteInfo | null;
  isVisible: boolean;
  isCalculating?: boolean;
  isCalculatingObstacles?: boolean;
  onClose?: () => void; // Made optional since we removed close button
  onSelectRoute: (routeType: "fastest" | "clearest") => void;
}

type SheetState = "expanded" | "minimized";

export function RouteInfoBottomSheet({
  routeAnalysis,
  isVisible,
  isCalculating = false,
  isCalculatingObstacles = false,
  onSelectRoute,
}: RouteInfoBottomSheetProps) {
  // ALL HOOKS AT THE TOP
  const [sheetState, setSheetState] = useState<SheetState>("expanded");
  const translateY = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  // Memoized helper functions
  const formatDuration = useMemo(
    () =>
      (seconds: number): string => {
        const minutes = Math.round(seconds / 60);
        return `${minutes} min${minutes === 1 ? "" : "s"}`;
      },
    []
  );

  const formatDistance = useMemo(
    () =>
      (meters: number): string => {
        if (meters >= 1000) {
          return `${(meters / 1000).toFixed(1)} km`;
        }
        return `${Math.round(meters)} m`;
      },
    []
  );

  const getObstacleCountColor = useMemo(
    () =>
      (count: number): string => {
        if (count === 0) return COLORS.success;
        if (count <= 2) return COLORS.warning;
        return COLORS.error;
      },
    []
  );

  const getObstacleIcon = useMemo(
    () =>
      (count: number): keyof typeof Ionicons.glyphMap => {
        if (count === 0) return "checkmark-circle";
        if (count <= 2) return "alert-circle";
        return "warning";
      },
    []
  );

  // State management functions
  const expandSheet = useMemo(
    () => () => {
      setSheetState("expanded");
      translateY.value = withSpring(0, { damping: 20, stiffness: 100 }); // Slower, more natural
    },
    [translateY]
  );

  const minimizeSheet = useMemo(
    () => () => {
      setSheetState("minimized");
      translateY.value = withSpring(EXPANDED_HEIGHT - MINIMIZED_HEIGHT, {
        damping: 20,
        stiffness: 100, // Slower, more natural
      });
    },
    [translateY]
  );

  const toggleSheetState = useMemo(
    () => () => {
      if (sheetState === "expanded") {
        minimizeSheet();
      } else {
        expandSheet();
      }
    },
    [sheetState, expandSheet, minimizeSheet]
  );

  // Initialize position on visibility change
  useEffect(() => {
    if (isVisible) {
      if (sheetState === "expanded") {
        translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
      } else {
        translateY.value = withSpring(EXPANDED_HEIGHT - MINIMIZED_HEIGHT, {
          damping: 20,
          stiffness: 100,
        });
      }
    }
  }, [isVisible, sheetState, translateY]);

  // Gesture handler for dragging
  const gestureHandler =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: (_, context: any) => {
        isGestureActive.value = true;
        context.startY = translateY.value; // Remember starting position
      },
      onActive: (event, context: any) => {
        // Follow finger movement more closely
        const newTranslateY = context.startY + event.translationY;
        const minY = 0;
        const maxY = EXPANDED_HEIGHT - MINIMIZED_HEIGHT;

        // Allow slight overscroll for natural feel, then clamp
        if (newTranslateY < minY - 20) {
          translateY.value = minY - 20 + (newTranslateY - (minY - 20)) * 0.3;
        } else if (newTranslateY > maxY + 20) {
          translateY.value = maxY + 20 + (newTranslateY - (maxY + 20)) * 0.3;
        } else {
          translateY.value = newTranslateY;
        }
      },
      onEnd: (event) => {
        isGestureActive.value = false;
        const { velocityY, translationY } = event;

        // More responsive thresholds
        const shouldMinimize =
          translationY > DRAG_THRESHOLD ||
          (velocityY > 300 && translationY > 10); // Lower velocity threshold

        const shouldExpand =
          translationY < -DRAG_THRESHOLD ||
          (velocityY < -300 && translationY < -10); // Lower velocity threshold

        if (shouldMinimize) {
          translateY.value = withSpring(EXPANDED_HEIGHT - MINIMIZED_HEIGHT, {
            damping: 20,
            stiffness: 100,
          });
          runOnJS(setSheetState)("minimized");
        } else if (shouldExpand) {
          translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
          runOnJS(setSheetState)("expanded");
        } else {
          // Snap back to current state with natural spring
          if (sheetState === "expanded") {
            translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
          } else {
            translateY.value = withSpring(EXPANDED_HEIGHT - MINIMIZED_HEIGHT, {
              damping: 20,
              stiffness: 100,
            });
          }
        }
      },
    });

  // Animated style for the sheet
  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // EARLY RETURNS AFTER ALL HOOKS
  if (!isVisible) {
    return null;
  }

  // Loading state
  if (isCalculating && !routeAnalysis) {
    return (
      <View>
        <Animated.View style={[styles.panel, styles.loadingPanel]}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.softBlue} />
            <Text style={styles.loadingText}>Finding routes...</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  if (!routeAnalysis) {
    return null;
  }

  const { fastestRoute, clearestRoute, summary } = routeAnalysis;

  return (
    <>
      {/* Background overlay only visible when expanded for visual effect */}
      {sheetState === "expanded" && <View style={styles.backgroundOverlay} />}

      {/* Bottom sheet - positioned to not block map interaction */}
      <View style={styles.sheetContainer}>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.panel, animatedSheetStyle]}>
            {/* Drag Handle - Touch target for dragging */}
            <TouchableOpacity
              style={styles.dragHandleContainer}
              onPress={toggleSheetState}
              activeOpacity={0.7}
            >
              <View style={styles.dragHandle} />
            </TouchableOpacity>

            {/* Header - Simplified without close button */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={toggleSheetState}
                accessibilityLabel={
                  sheetState === "expanded" ? "Minimize panel" : "Expand panel"
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name={
                    sheetState === "expanded" ? "chevron-down" : "chevron-up"
                  }
                  size={24}
                  color={COLORS.muted}
                />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Route Options</Text>

              {/* Empty view for balance - no close button */}
              <View style={styles.headerSpacer} />
            </View>

            {/* Minimized Summary - Only visible when minimized */}
            {sheetState === "minimized" && (
              <TouchableOpacity
                style={styles.minimizedSummary}
                onPress={expandSheet}
                activeOpacity={0.7}
              >
                <View style={styles.routeSummaryRow}>
                  <View style={styles.routeSummaryItem}>
                    <Ionicons name="flash" size={16} color={COLORS.softBlue} />
                    <Text style={styles.summaryText}>
                      {formatDuration(fastestRoute.duration)}
                    </Text>
                    <Text style={styles.summaryObstacles}>
                      {fastestRoute.obstacleCount} obstacles
                    </Text>
                  </View>

                  <View style={styles.routeSummaryDivider} />

                  <View style={styles.routeSummaryItem}>
                    <Ionicons
                      name="shield-checkmark"
                      size={16}
                      color={COLORS.success}
                    />
                    <Text style={styles.summaryText}>
                      {formatDuration(clearestRoute.duration)}
                    </Text>
                    <Text style={styles.summaryObstacles}>
                      {clearestRoute.obstacleCount} obstacles
                    </Text>
                  </View>
                </View>
                <Text style={styles.tapToExpand}>Tap or drag to expand</Text>
              </TouchableOpacity>
            )}

            {/* Expanded Content - Only visible when expanded */}
            {sheetState === "expanded" && (
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isGestureActive.value}
              >
                {/* Loading overlay for obstacles */}
                {isCalculatingObstacles && (
                  <View style={styles.obstacleLoadingOverlay}>
                    <ActivityIndicator size="small" color={COLORS.softBlue} />
                    <Text style={styles.obstacleLoadingText}>
                      Counting obstacles along routes...
                    </Text>
                  </View>
                )}

                {/* Perfect Scenario */}
                {summary.fastestIsAlsoClearest && (
                  <View style={styles.perfectScenarioCard}>
                    <View style={styles.perfectIcon}>
                      <Ionicons name="star" size={24} color={COLORS.success} />
                    </View>
                    <Text style={styles.perfectTitle}>Perfect Route!</Text>
                    <Text style={styles.perfectSubtitle}>
                      The fastest route also has the fewest obstacles
                    </Text>

                    <View style={styles.routeStatsRow}>
                      <View style={styles.statItem}>
                        <Ionicons name="time" size={16} color={COLORS.muted} />
                        <Text style={styles.statText}>
                          {formatDuration(fastestRoute.duration)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="map" size={16} color={COLORS.muted} />
                        <Text style={styles.statText}>
                          {formatDistance(fastestRoute.distance)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons
                          name={getObstacleIcon(fastestRoute.obstacleCount)}
                          size={16}
                          color={getObstacleCountColor(
                            fastestRoute.obstacleCount
                          )}
                        />
                        <Text
                          style={[
                            styles.statText,
                            {
                              color: getObstacleCountColor(
                                fastestRoute.obstacleCount
                              ),
                            },
                          ]}
                        >
                          {fastestRoute.obstacleCount === 0
                            ? "No obstacles"
                            : `${fastestRoute.obstacleCount} obstacle${
                                fastestRoute.obstacleCount === 1 ? "" : "s"
                              }`}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.selectButton, styles.perfectButton]}
                      onPress={() => onSelectRoute("fastest")}
                      accessibilityLabel={`Select perfect route: ${formatDuration(
                        fastestRoute.duration
                      )} with ${fastestRoute.obstacleCount} obstacles`}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.selectButtonText,
                          styles.perfectButtonText,
                        ]}
                      >
                        Choose This Route
                      </Text>
                      <Ionicons name="star" size={16} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Two separate routes */}
                {!summary.fastestIsAlsoClearest && (
                  <>
                    {/* Fastest Route Card */}
                    <View style={styles.routeCard}>
                      <View style={styles.routeCardHeader}>
                        <View style={styles.routeTypeIcon}>
                          <Ionicons
                            name="flash"
                            size={20}
                            color={COLORS.softBlue}
                          />
                        </View>
                        <Text style={styles.routeCardTitle}>Fastest Route</Text>
                      </View>

                      <View style={styles.routeStatsRow}>
                        <View style={styles.statItem}>
                          <Ionicons
                            name="time"
                            size={16}
                            color={COLORS.muted}
                          />
                          <Text style={styles.statText}>
                            {formatDuration(fastestRoute.duration)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="map" size={16} color={COLORS.muted} />
                          <Text style={styles.statText}>
                            {formatDistance(fastestRoute.distance)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons
                            name={getObstacleIcon(fastestRoute.obstacleCount)}
                            size={16}
                            color={getObstacleCountColor(
                              fastestRoute.obstacleCount
                            )}
                          />
                          <Text
                            style={[
                              styles.statText,
                              {
                                color: getObstacleCountColor(
                                  fastestRoute.obstacleCount
                                ),
                              },
                            ]}
                          >
                            {fastestRoute.obstacleCount === 0
                              ? "No obstacles"
                              : `${fastestRoute.obstacleCount} obstacle${
                                  fastestRoute.obstacleCount === 1 ? "" : "s"
                                }`}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.selectButton}
                        onPress={() => onSelectRoute("fastest")}
                        accessibilityLabel={`Select fastest route: ${formatDuration(
                          fastestRoute.duration
                        )} with ${fastestRoute.obstacleCount} obstacles`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.selectButtonText}>
                          Choose Fast Route
                        </Text>
                        <Ionicons name="flash" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>

                    {/* Clearest Route Card */}
                    <View style={styles.routeCard}>
                      <View style={styles.routeCardHeader}>
                        <View style={styles.routeTypeIcon}>
                          <Ionicons
                            name="shield-checkmark"
                            size={20}
                            color={COLORS.success}
                          />
                        </View>
                        <Text style={styles.routeCardTitle}>
                          Clearest Route
                        </Text>
                      </View>

                      <View style={styles.routeStatsRow}>
                        <View style={styles.statItem}>
                          <Ionicons
                            name="time"
                            size={16}
                            color={COLORS.muted}
                          />
                          <Text style={styles.statText}>
                            {formatDuration(clearestRoute.duration)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="map" size={16} color={COLORS.muted} />
                          <Text style={styles.statText}>
                            {formatDistance(clearestRoute.distance)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons
                            name={getObstacleIcon(clearestRoute.obstacleCount)}
                            size={16}
                            color={getObstacleCountColor(
                              clearestRoute.obstacleCount
                            )}
                          />
                          <Text
                            style={[
                              styles.statText,
                              {
                                color: getObstacleCountColor(
                                  clearestRoute.obstacleCount
                                ),
                              },
                            ]}
                          >
                            {clearestRoute.obstacleCount === 0
                              ? "No obstacles"
                              : `${clearestRoute.obstacleCount} obstacle${
                                  clearestRoute.obstacleCount === 1 ? "" : "s"
                                }`}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.selectButton, styles.clearButton]}
                        onPress={() => onSelectRoute("clearest")}
                        accessibilityLabel={`Select clearest route: ${formatDuration(
                          clearestRoute.duration
                        )} with ${clearestRoute.obstacleCount} obstacles`}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.selectButtonText,
                            styles.clearButtonText,
                          ]}
                        >
                          Choose Clear Route
                        </Text>
                        <Ionicons
                          name="shield-checkmark"
                          size={16}
                          color={COLORS.white}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </PanGestureHandler>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Split overlay into two parts for better map interaction
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)", // Subtle background when expanded
    zIndex: 999,
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: EXPANDED_HEIGHT,
    justifyContent: "flex-end",
    zIndex: 1000,
    pointerEvents: "box-none", // Allow touches to pass through to map when not hitting sheet
  },

  // Panel
  panel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: EXPANDED_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    pointerEvents: "auto", // Sheet itself captures touches
  },
  loadingPanel: {
    height: 200,
  },

  // Drag handle
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.muted,
    borderRadius: 2,
  },

  // Header - Simplified without close button
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
  },
  expandButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerSpacer: {
    width: 40, // Same width as expandButton for balance
  },

  // Minimized summary
  minimizedSummary: {
    padding: 16,
    alignItems: "center",
  },
  routeSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  routeSummaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  routeSummaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 16,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.slate,
    marginLeft: 4,
    marginRight: 8,
  },
  summaryObstacles: {
    fontSize: 12,
    color: COLORS.muted,
  },
  tapToExpand: {
    fontSize: 12,
    color: COLORS.muted,
    fontStyle: "italic",
  },

  // Content (expanded state)
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 40,
  },

  // Loading states
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.slate,
    marginTop: 16,
    textAlign: "center",
  },
  obstacleLoadingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGray,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  obstacleLoadingText: {
    fontSize: 14,
    color: COLORS.muted,
    marginLeft: 8,
  },

  // Perfect scenario
  perfectScenarioCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.success,
    marginTop: 16,
    marginBottom: 8,
  },
  perfectIcon: {
    marginBottom: 8,
  },
  perfectTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.success,
    marginBottom: 4,
  },
  perfectSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 16,
  },

  // Route cards
  routeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  routeTypeIcon: {
    marginRight: 8,
  },
  routeCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.slate,
  },

  // Stats
  routeStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  statText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.slate,
    marginLeft: 4,
  },

  // Buttons
  selectButton: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  perfectButton: {
    backgroundColor: COLORS.success,
  },
  perfectButtonText: {
    color: COLORS.white,
  },
  clearButton: {
    backgroundColor: COLORS.success,
  },
  clearButtonText: {
    color: COLORS.white,
  },
});
