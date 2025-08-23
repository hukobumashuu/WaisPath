// src/services/microReroutingService.ts
// FIXED: Critical bug fixes applied from CG's analysis

import {
  UserLocation,
  AccessibilityObstacle,
  UserMobilityProfile,
} from "../types";
import { googleMapsService } from "./googleMapsService"; // 🔧 FIX #1: Corrected import path
// 🔧 REMOVED: Firebase import since we're not using analytics yet

// ================================================
// TYPES AND INTERFACES
// ================================================

// 🔧 FIX: Proper typing for profile keys to avoid runtime undefined
type ProfileKey = "wheelchair" | "walker" | "crutches" | "cane" | "none";

export interface MicroDetour {
  route: {
    polyline: UserLocation[];
    duration: number; // seconds
    distance: number; // meters
  };
  extraTime: number; // seconds
  extraDistance: number; // meters
  safetyRating: "high" | "medium" | "low";
  confidence: number; // 0-1
  reason: string;
  routeSimilarity: number; // 0-1, how similar to original route
}

interface DetourCandidate {
  waypoints: UserLocation[];
  estimatedExtraTime: number; // seconds
  estimatedExtraDistance: number; // meters
  reason: string;
  safetyRating: "high" | "medium" | "low";
}

interface WaypointRouteResult {
  route: {
    polyline: UserLocation[];
    duration: number;
    distance: number;
    raw?: any; // 🔧 FIX #3: Add raw Google response for safety checks
  };
  extraTime?: number; // Make optional since it might come from routeResult
  extraDistance?: number; // Make optional since it might come from routeResult
  isValid: boolean;
}

interface MicroDetourThresholds {
  maxExtraTimeSec: number;
  maxExtraDistanceM: number;
  maxRouteDeviationPercent: number;
}

interface CachedEvaluation {
  result: WaypointRouteResult;
  ts: number; // timestamp
}

// ================================================
// MICRO REROUTING SERVICE CLASS
// ================================================

class MicroReroutingService {
  // 🔧 FIX #1: Add coordinate precision constant to match googleMapsService
  private readonly COORD_PRECISION = 4;
  private readonly EVAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CONCURRENT_EVALUATIONS = 3;
  private readonly MAX_EVAL_CACHE_ENTRIES = 500; // 🔧 FIX #2: Prevent unbounded cache growth

  // Caches
  private evaluatedCache = new Map<string, CachedEvaluation>();
  private inflightEvaluations = new Map<
    string,
    Promise<WaypointRouteResult | null>
  >();

  // Configuration
  private readonly DEFAULT_THRESHOLDS: Record<
    ProfileKey,
    MicroDetourThresholds
  > = {
    wheelchair: {
      maxExtraTimeSec: 180, // 3 minutes
      maxExtraDistanceM: 300, // 300 meters
      maxRouteDeviationPercent: 25,
    },
    walker: {
      maxExtraTimeSec: 240, // 4 minutes
      maxExtraDistanceM: 400,
      maxRouteDeviationPercent: 30,
    },
    crutches: {
      maxExtraTimeSec: 180, // 3 minutes
      maxExtraDistanceM: 300,
      maxRouteDeviationPercent: 25,
    },
    cane: {
      maxExtraTimeSec: 300, // 5 minutes
      maxExtraDistanceM: 500,
      maxRouteDeviationPercent: 35,
    },
    none: {
      maxExtraTimeSec: 600, // 10 minutes
      maxExtraDistanceM: 800,
      maxRouteDeviationPercent: 40,
    },
  };

  // 🔧 FIX #5: Add concurrency control
  private semaphoreCount = 0;

  // 📊 Cache metrics for observability
  private evalCacheHits = 0;
  private evalCacheMisses = 0;

  // ================================================
  // PUBLIC API
  // ================================================

  /**
   * Create a micro-detour around an obstacle
   * Returns null if no suitable detour found
   */
  async createMicroDetour(
    currentLocation: UserLocation,
    obstacle: AccessibilityObstacle,
    destination: UserLocation,
    userProfile: UserMobilityProfile
  ): Promise<MicroDetour | null> {
    console.log(`🔄 Creating micro-detour around ${obstacle.type}...`);

    const maxSearchRadius = this.getMaxSearchRadius(userProfile);
    const activeThresholds = this.getThresholds(userProfile);

    try {
      // 🔧 FIX #1: Pass userProfile to findStreetDetourOptions
      const candidates = await this.findStreetDetourOptions(
        currentLocation,
        obstacle.location,
        maxSearchRadius,
        userProfile
      );

      if (candidates.length === 0) {
        const msg = this.getFallbackMessage(obstacle.type);
        console.log(`📍 ${msg}`);
        return null;
      }

      console.log(`🎯 Found ${candidates.length} detour candidates`);

      // 🔧 FIX #6: Prefilter candidates using both time and distance
      const viableCandidates = candidates.filter(
        (candidate) =>
          candidate.estimatedExtraTime <= activeThresholds.maxExtraTimeSec &&
          candidate.estimatedExtraDistance <= activeThresholds.maxExtraDistanceM
      );

      if (viableCandidates.length === 0) {
        console.log(
          `⏰ No candidates meet thresholds (max: ${activeThresholds.maxExtraTimeSec}s, ${activeThresholds.maxExtraDistanceM}m)`
        );
        return null;
      }

      console.log(
        `✅ ${viableCandidates.length} candidates pass pre-filtering`
      );

      // Evaluate candidates with Google Maps API
      for (const candidate of viableCandidates) {
        try {
          // 🔧 FIX #5: Use concurrency control
          const evaluation = await this.withSemaphore(() =>
            this.evaluateCandidate(
              currentLocation,
              destination,
              candidate,
              activeThresholds
            )
          );

          if (
            evaluation &&
            this.shouldShowDetour(evaluation, candidate, activeThresholds)
          ) {
            console.log(`✅ Found suitable detour: ${candidate.reason}`);
            return this.makeMicroDetourFromEval(evaluation, candidate);
          }
        } catch (error) {
          console.error(
            `❌ Failed to evaluate candidate: ${candidate.reason}`,
            error
          );

          // 🔧 FIX #8: Handle quota errors gracefully
          if (
            error instanceof Error &&
            error.message.toLowerCase().includes("quota")
          ) {
            console.log(
              "🚫 Google Maps quota exhausted - stopping candidate evaluation"
            );
            break;
          }
          continue;
        }
      }

      console.log("📍 No suitable detour found after evaluation");
      return null;
    } catch (error) {
      console.error("❌ Micro-detour creation failed:", error);
      return null;
    }
  }

  /**
   * Log detour usage for analytics (simplified)
   */
  async logDetourUsage(
    detour: MicroDetour,
    obstacleType: string,
    userAccepted: boolean,
    userProfile: UserMobilityProfile
  ): Promise<void> {
    try {
      const usageLog = {
        timestamp: new Date().toISOString(),
        obstacleType,
        detourReason: detour.reason,
        extraTime: detour.extraTime,
        extraDistance: detour.extraDistance,
        safetyRating: detour.safetyRating,
        userAccepted,
        userProfile: userProfile.type,
        confidence: detour.confidence,
      };

      console.log("📊 Detour usage logged:", usageLog);
      // TODO: Integrate proper analytics backend when available
    } catch (error) {
      console.error("❌ Failed to log detour usage:", error);
    }
  }

  /**
   * Get fallback message when no detour available
   */
  getFallbackMessage(obstacleType: string): string {
    const messages: Record<string, string> = {
      vendor_blocking: "Vendor blocking path - please navigate around manually",
      parked_vehicles:
        "Vehicle blocking sidewalk - use alternate route or roadside",
      stairs_no_ramp:
        "Steps without ramp access - find alternate entrance or route",
      narrow_passage: "Passage too narrow - find wider alternate path",
      construction: "Construction zone - follow posted detour signs",
      flooding: "Flooding detected - avoid area and use alternate route",
      broken_pavement:
        "Damaged pavement - proceed carefully or find alternate path",
      electrical_post: "Utility pole blocking path - navigate around carefully",
      tree_roots: "Uneven surface from tree roots - navigate carefully",
      no_sidewalk: "No sidewalk available - use alternate route",
      steep_slope: "Steep incline ahead - consider alternate route",
      other: "Obstacle detected - navigate around carefully",
    };

    return messages[obstacleType] || messages.other;
  }

  // ================================================
  // PRIVATE HELPER METHODS
  // ================================================

  /**
   * 🔧 FIX #5: Concurrency control using simple semaphore with timeout
   */
  private async withSemaphore<T>(
    fn: () => Promise<T>,
    maxWaitMs = 5000
  ): Promise<T> {
    const start = Date.now();
    while (this.semaphoreCount >= this.MAX_CONCURRENT_EVALUATIONS) {
      if (Date.now() - start > maxWaitMs) {
        throw new Error(
          "Semaphore wait timeout - too many concurrent evaluations"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.semaphoreCount++;
    try {
      return await fn();
    } finally {
      this.semaphoreCount--;
    }
  }

  /**
   * 🔧 FIX #2: Cache management with size limit to prevent unbounded growth
   */
  private setEvalCacheEntry(key: string, value: CachedEvaluation): void {
    // Evict oldest entries if at capacity
    while (this.evaluatedCache.size >= this.MAX_EVAL_CACHE_ENTRIES) {
      const firstKey = this.evaluatedCache.keys().next().value;
      if (!firstKey) break;
      this.evaluatedCache.delete(firstKey);
    }
    this.evaluatedCache.set(key, value);
  }

  /**
   * 🔧 FIX #1: Generate street-only detour waypoints around obstacle
   * Fixed to accept userProfile parameter for accurate walking speed calculation
   */
  private async findStreetDetourOptions(
    currentLocation: UserLocation,
    obstacleLocation: UserLocation,
    radiusMeters: number,
    userProfile?: UserMobilityProfile // 🔧 FIX #1: Add userProfile param
  ): Promise<DetourCandidate[]> {
    const candidates: DetourCandidate[] = [];

    // 🔧 FIX #2: Filter distances by radiusMeters
    const baseDistances = [100, 70, 50];
    const distances = baseDistances.filter((d) => d <= radiusMeters);

    if (distances.length === 0) {
      console.log(`⚠️ No valid distances within radius ${radiusMeters}m`);
      return [];
    }

    // Generate candidate waypoints at different distances
    for (const distance of distances) {
      // Four cardinal directions around obstacle
      const offsets = [
        { lat: distance / 111000, lng: 0, reason: `${distance}m north detour` },
        {
          lat: -distance / 111000,
          lng: 0,
          reason: `${distance}m south detour`,
        },
        {
          lat: 0,
          lng:
            distance /
            (111000 * Math.cos((obstacleLocation.latitude * Math.PI) / 180)),
          reason: `${distance}m east detour`,
        },
        {
          lat: 0,
          lng:
            -distance /
            (111000 * Math.cos((obstacleLocation.latitude * Math.PI) / 180)),
          reason: `${distance}m west detour`,
        },
      ];

      for (const offset of offsets) {
        const waypoint: UserLocation = {
          latitude: obstacleLocation.latitude + offset.lat,
          longitude: obstacleLocation.longitude + offset.lng,
        };

        // 🔧 FIX #1: Use userProfile for accurate walking speed calculation
        const walkingSpeedMps = this.getWalkingSpeed(userProfile);
        const estimatedExtraTime = Math.round(distance / walkingSpeedMps); // seconds

        candidates.push({
          waypoints: [waypoint],
          estimatedExtraTime,
          estimatedExtraDistance: distance,
          reason: offset.reason,
          safetyRating:
            distance >= 70 ? "high" : distance >= 50 ? "medium" : "low",
        });
      }
    }

    console.log(`🎯 Generated ${candidates.length} detour candidates`);
    return candidates;
  }

  /**
   * 🔧 FIX #1: Get profile-dependent walking speed with type safety
   */
  private getWalkingSpeed(userProfile?: UserMobilityProfile): number {
    // Profile-specific walking speeds (m/s) with proper typing
    const walkingSpeeds: Record<ProfileKey, number> = {
      wheelchair: 1.2, // Slightly slower for wheelchair users
      walker: 1.0, // Slower for walker users
      crutches: 1.1, // Moderately slower for crutches
      cane: 1.3, // Slightly slower than normal
      none: 1.4, // Average walking speed
    };

    const key = (userProfile?.type as ProfileKey) || "none";
    return walkingSpeeds[key];
  }

  /**
   * Evaluate a candidate using Google Maps API with caching
   */
  private async evaluateCandidate(
    currentLocation: UserLocation,
    destination: UserLocation,
    candidate: DetourCandidate,
    activeThresholds: MicroDetourThresholds
  ): Promise<WaypointRouteResult | null> {
    const evalKey = this.makeEvalKey(currentLocation, destination, candidate);

    // 🔧 FIX #4: Atomic cache read and validation with metrics
    const cachedEntry = this.evaluatedCache.get(evalKey);
    if (cachedEntry && Date.now() - cachedEntry.ts < this.EVAL_CACHE_TTL) {
      const cached = cachedEntry.result;
      if (this.shouldShowDetour(cached, candidate, activeThresholds)) {
        console.log("🔄 Using cached detour evaluation");
        this.evalCacheHits++; // Track cache hit
        return cached;
      }
    }

    // Track cache miss
    this.evalCacheMisses++;

    // Check for inflight evaluation to avoid duplicate API calls
    if (this.inflightEvaluations.has(evalKey)) {
      console.log("⏳ Waiting for inflight evaluation...");
      return await this.inflightEvaluations.get(evalKey)!;
    }

    // Start new evaluation
    const evaluationPromise = this.performEvaluation(
      currentLocation,
      destination,
      candidate
    );

    this.inflightEvaluations.set(evalKey, evaluationPromise);

    try {
      const result = await evaluationPromise;

      if (result) {
        // Cache the result with size management
        this.setEvalCacheEntry(evalKey, {
          result,
          ts: Date.now(),
        });

        // 🔧 FIX #4: Prune cache after adding entries
        this.pruneEvalCache();
      }

      return result;
    } finally {
      this.inflightEvaluations.delete(evalKey);
    }
  }

  /**
   * 🔧 FIX #2: Perform actual route evaluation using Google Maps
   * Fixed to prefer routeResult.extraTime/extraDistance when available
   */
  private async performEvaluation(
    currentLocation: UserLocation,
    destination: UserLocation,
    candidate: DetourCandidate
  ): Promise<WaypointRouteResult | null> {
    try {
      // 🔧 FIX #3: Ensure Google Maps service is ready
      await googleMapsService.ensureReady();

      // Get route with waypoints
      const routeResult = await googleMapsService.getRouteWithWaypoints(
        currentLocation,
        destination,
        candidate.waypoints
      );

      if (!routeResult?.route) {
        return null;
      }

      // 🔧 FIX #2: Prefer routeResult.extraTime/extraDistance if provided
      let extraTime = (routeResult as any).extraTime;
      let extraDistance = (routeResult as any).extraDistance;

      if (typeof extraTime !== "number" || typeof extraDistance !== "number") {
        // Fallback: get direct route for comparison
        console.log(
          "🔄 Computing extra time/distance using direct route fallback"
        );
        const directRoute = await googleMapsService.getRoutes(
          currentLocation,
          destination
        );

        if (!directRoute || directRoute.length === 0) {
          return null;
        }

        const directDuration = directRoute[0].duration;
        const directDistance = directRoute[0].distance;

        extraTime = routeResult.route.duration - directDuration;
        extraDistance = routeResult.route.distance - directDistance;
      } else {
        console.log("✅ Using extraTime/extraDistance from routeResult");
      }

      // 🔧 FIX #3: Check for private building/off-road routing with safe raw access
      const isUnsafe = this.isRouteUnsafe(
        routeResult.route.raw ?? (routeResult as any).raw ?? {}
      );

      if (isUnsafe) {
        console.log(
          "🚫 Rejected detour: route goes through private access/building"
        );
        return null;
      }

      return {
        route: {
          polyline: routeResult.route.polyline,
          duration: routeResult.route.duration,
          distance: routeResult.route.distance,
          raw: routeResult.route.raw ?? (routeResult as any).raw, // 🔧 FIX #3: Include raw
        },
        extraTime,
        extraDistance,
        isValid: true,
      };
    } catch (error) {
      console.error("❌ Route evaluation failed:", error);
      return null;
    }
  }

  /**
   * 🔧 FIX #3 & #7: Check if route goes through private buildings or unsafe areas
   * Enhanced with travel_mode and maneuver checks
   */
  private isRouteUnsafe(routeRaw: any): boolean {
    try {
      const stepsText =
        routeRaw?.legs?.flatMap((leg: any) =>
          leg.steps?.map((s: any) => s.html_instructions || "")
        ) || [];

      const blackListPhrases = [
        "enter the",
        "shopping mall",
        "private property",
        "through the building",
        "inside the",
        "pedestrian overpass",
        "underground passage",
      ];

      // Check instruction text
      const hasUnsafeText = stepsText.some((instr: string) =>
        blackListPhrases.some((phrase) => instr.toLowerCase().includes(phrase))
      );

      if (hasUnsafeText) return true;

      // 🔧 FIX #7: Enhanced check using travel_mode and maneuver
      const steps =
        routeRaw?.legs?.flatMap((leg: any) => leg.steps || []) || [];

      for (const step of steps) {
        // Check for non-walking travel modes
        if (step.travel_mode && step.travel_mode !== "WALKING") {
          console.log(`🚫 Unsafe travel mode detected: ${step.travel_mode}`);
          return true;
        }

        // Check for problematic maneuvers
        const unsafeManeuvers = ["ferry", "ramp-left", "ramp-right"];
        if (step.maneuver && unsafeManeuvers.includes(step.maneuver)) {
          console.log(`🚫 Unsafe maneuver detected: ${step.maneuver}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn("Failed to analyze route safety:", error);
      return false; // Don't reject on analysis failure
    }
  }

  /**
   * Check if detour meets acceptance criteria
   * Enhanced with safer validation
   */
  private shouldShowDetour(
    evaluation: WaypointRouteResult,
    candidate: DetourCandidate,
    thresholds: MicroDetourThresholds
  ): boolean {
    if (!evaluation.isValid) return false;

    // Use fallback values if extraTime/extraDistance are undefined
    const extraTime = evaluation.extraTime ?? candidate.estimatedExtraTime;
    const extraDistance =
      evaluation.extraDistance ?? candidate.estimatedExtraDistance;

    // Check time threshold
    if (extraTime > thresholds.maxExtraTimeSec) {
      return false;
    }

    // Check distance threshold
    if (extraDistance > thresholds.maxExtraDistanceM) {
      return false;
    }

    // Additional safety checks
    if (candidate.safetyRating === "low" && extraTime > 120) {
      return false; // Don't show risky detours for long extra times
    }

    return true;
  }

  /**
   * Create MicroDetour object from evaluation
   * Fixed route similarity calculation with proper clamping
   */
  private makeMicroDetourFromEval(
    evaluation: WaypointRouteResult,
    candidate: DetourCandidate
  ): MicroDetour {
    // Use evaluation values with fallbacks
    const extraTime = evaluation.extraTime ?? candidate.estimatedExtraTime;
    const extraDistance =
      evaluation.extraDistance ?? candidate.estimatedExtraDistance;

    // 🔧 POLISH: Clamp route similarity to [0,1] range
    const routeSimilarity = Math.max(0, Math.min(1, 1 - extraDistance / 1000));

    // Calculate confidence based on safety rating and extra time
    let confidence = 0.8; // Base confidence

    if (candidate.safetyRating === "high") confidence += 0.1;
    if (candidate.safetyRating === "low") confidence -= 0.2;

    if (extraTime <= 60) confidence += 0.1; // Bonus for quick detours
    if (extraTime > 180) confidence -= 0.1; // Penalty for long detours

    // 🔧 FIX #4: Ensure confidence is properly clamped
    confidence = Math.max(0.0, Math.min(1.0, confidence));

    return {
      route: evaluation.route,
      extraTime,
      extraDistance,
      safetyRating: candidate.safetyRating,
      confidence,
      reason: candidate.reason,
      routeSimilarity,
    };
  }

  /**
   * 🔧 FIX #6: Use coordinate precision constant consistently
   * Generate cache key for evaluation
   */
  private makeEvalKey(
    currentLocation: UserLocation,
    destination: UserLocation,
    candidate: DetourCandidate
  ): string {
    const current = `${currentLocation.latitude.toFixed(
      this.COORD_PRECISION
    )},${currentLocation.longitude.toFixed(this.COORD_PRECISION)}`;
    const dest = `${destination.latitude.toFixed(
      this.COORD_PRECISION
    )},${destination.longitude.toFixed(this.COORD_PRECISION)}`;
    const waypoints = candidate.waypoints
      .map(
        (w) =>
          `${w.latitude.toFixed(this.COORD_PRECISION)},${w.longitude.toFixed(
            this.COORD_PRECISION
          )}`
      )
      .join("|");

    return `${current}->${dest}[${waypoints}]`;
  }

  /**
   * 🔧 FIX #4: Prune expired cache entries
   */
  private pruneEvalCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.evaluatedCache.entries()) {
      if (now - entry.ts > this.EVAL_CACHE_TTL) {
        this.evaluatedCache.delete(key);
      }
    }
  }

  /**
   * Get max search radius based on user profile
   */
  private getMaxSearchRadius(userProfile: UserMobilityProfile): number {
    const radiusMap = {
      wheelchair: 80, // Smaller radius for wheelchair users
      walker: 100,
      crutches: 90,
      cane: 120,
      none: 150,
    };

    return radiusMap[userProfile.type] || 100;
  }

  /**
   * Get thresholds for user profile with safe type checking
   */
  private getThresholds(
    userProfile: UserMobilityProfile
  ): MicroDetourThresholds {
    const key = (userProfile?.type as ProfileKey) || "none";
    return this.DEFAULT_THRESHOLDS[key];
  }

  /**
   * Get detour service statistics for monitoring
   */
  getDetourStats() {
    return {
      cacheSize: this.evaluatedCache.size,
      hits: this.evalCacheHits,
      misses: this.evalCacheMisses,
      inflight: this.inflightEvaluations.size,
      hitRate:
        this.evalCacheHits + this.evalCacheMisses > 0
          ? (
              (this.evalCacheHits /
                (this.evalCacheHits + this.evalCacheMisses)) *
              100
            ).toFixed(1) + "%"
          : "0%",
    };
  }
}

// Export singleton instance
export const microReroutingService = new MicroReroutingService();
