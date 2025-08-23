// src/services/googleMapsService.ts
// PRODUCTION-READY: Google Maps service with ALL critical fixes applied
// Addresses: async init, race conditions, persistence, cooldowns, waypoint quality

import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserLocation } from "../types";

interface GoogleRoute {
  id: string;
  polylineEncoded: string;
  polyline: UserLocation[];
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
  bounds: {
    northeast: UserLocation;
    southwest: UserLocation;
  };
  warnings: string[];
  summary: string;
}

interface RouteStep {
  startLocation: UserLocation;
  endLocation: UserLocation;
  distance: number; // meters
  duration: number; // seconds
  instructions: string;
  polyline: string;
}

interface WaypointRouteResult {
  route: {
    polyline: UserLocation[];
    polylineEncoded: string;
    duration: number; // seconds
    distance: number; // meters
    raw?: any;
  };
  extraTime: number; // seconds vs direct route
  extraDistance: number; // meters vs direct route
  routeSimilarity: number; // 0-1 (1 = identical)
}

interface QuotaState {
  dailyRequestCount: number;
  lastRequestDate: string;
  cooldownUntil?: number; // timestamp
  quotaLimit: number;
}

// CRITICAL FIX #1: Async mutex for race condition prevention
class AsyncMutex {
  private _locked = false;
  private _queue: (() => void)[] = [];

  async lock(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve(() => this.unlock());
      } else {
        this._queue.push(() => {
          this._locked = true;
          resolve(() => this.unlock());
        });
      }
    });
  }

  private unlock(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      setImmediate(next); // Prevent blocking
    } else {
      this._locked = false;
    }
  }
}

class GoogleMapsService {
  private apiKey: string;

  // CRITICAL FIX #1: Remove async calls from constructor
  private _ready: Promise<void>;
  private _initialized = false;

  // Cache with size limits and eviction
  private routeCache: Map<string, { ts: number; value: WaypointRouteResult }> =
    new Map();
  private readonly ROUTE_CACHE_TTL = 1000 * 60 * 10; // 10 minutes
  private readonly MAX_CACHE_ENTRIES = 200;

  // Request timeout
  private readonly REQUEST_TIMEOUT = 15000; // 15 seconds

  // CRITICAL FIX #2: Quota management with persistence and cooldowns
  private quotaState: QuotaState = {
    dailyRequestCount: 0,
    lastRequestDate: new Date().toDateString(),
    quotaLimit: 150,
  };

  // CRITICAL FIX #2: Mutex for atomic quota operations
  private quotaMutex = new AsyncMutex();

  // CRITICAL FIX #3: Debounced persistence with proper RN typing
  private quotaPersistTimer?: ReturnType<typeof setTimeout>;
  private pendingQuotaSave = false;

  // Inflight request deduplication
  private inflightRequests = new Map<string, Promise<WaypointRouteResult>>();
  private inflightRoutes = new Map<string, Promise<GoogleRoute[]>>();

  // Storage keys (readonly to prevent mutation)
  private readonly STORAGE_KEYS = {
    QUOTA_STATE: "waispath_quota_state",
  } as const;

  // CRITICAL: Coordinate precision constant for consistency
  private readonly COORDINATE_PRECISION = 4;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "⚠️ Google Maps API key not found. Please add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env"
      );
      console.warn(
        "🔒 SECURITY: For production, consider proxying requests through your server to protect API key"
      );
    }

    // CRITICAL FIX #1: Initialize asynchronously, don't block constructor
    this._ready = this.initialize();
  }

  // CRITICAL FIX #1: Explicit async initialization
  private async initialize(): Promise<void> {
    try {
      await this.loadQuotaFromStorage();
      this._initialized = true;
      console.log("✅ GoogleMapsService initialized", this.getQuotaStats());
    } catch (error) {
      console.error("❌ GoogleMapsService initialization failed:", error);
      // Continue with defaults
      this._initialized = true;
    }
  }

  // CRITICAL FIX #1: Ensure service is ready before use
  async ensureReady(): Promise<void> {
    if (!this._initialized) {
      await this._ready;
    }
  }

  // CRITICAL FIX #2: Persistent quota state management
  private async loadQuotaFromStorage(): Promise<void> {
    try {
      const storedQuota = await AsyncStorage.getItem(
        this.STORAGE_KEYS.QUOTA_STATE
      );
      if (storedQuota) {
        const parsed: QuotaState = JSON.parse(storedQuota);

        // Check if we need to reset for new day
        const today = new Date().toDateString();
        if (parsed.lastRequestDate !== today) {
          this.quotaState = {
            ...parsed,
            dailyRequestCount: 0,
            lastRequestDate: today,
            cooldownUntil: undefined, // Reset cooldown on new day
          };
        } else {
          this.quotaState = parsed;
        }

        console.log("📊 Loaded quota state from storage:", this.quotaState);
      }
    } catch (error) {
      console.warn("⚠️ Failed to load quota from storage:", error);
      // Continue with defaults
    }
  }

  // CRITICAL FIX #5: Immediate quota flush for app lifecycle
  private async flushQuotaImmediately(): Promise<void> {
    if (this.pendingQuotaSave) {
      try {
        await AsyncStorage.setItem(
          this.STORAGE_KEYS.QUOTA_STATE,
          JSON.stringify(this.quotaState)
        );
        this.pendingQuotaSave = false;
        if (this.quotaPersistTimer) {
          clearTimeout(this.quotaPersistTimer);
          this.quotaPersistTimer = undefined;
        }
        console.log("💾 Quota state flushed immediately");
      } catch (error) {
        console.warn("⚠️ Failed to flush quota immediately:", error);
      }
    }
  }
  // CRITICAL FIX #3: Debounced quota persistence to reduce AsyncStorage writes
  private saveQuotaToStorage(): void {
    this.pendingQuotaSave = true;

    if (this.quotaPersistTimer) {
      clearTimeout(this.quotaPersistTimer);
    }

    this.quotaPersistTimer = setTimeout(async () => {
      if (this.pendingQuotaSave) {
        try {
          await AsyncStorage.setItem(
            this.STORAGE_KEYS.QUOTA_STATE,
            JSON.stringify(this.quotaState)
          );
          this.pendingQuotaSave = false;
          console.log("💾 Quota state persisted to storage");
        } catch (error) {
          console.warn("⚠️ Failed to save quota to storage:", error);
        }
      }
    }, 5000); // Debounce 5 seconds
  }

  // CRITICAL FIX #2: Atomic quota check and increment with cooldown support
  private async incrementQuotaAndCheck(): Promise<void> {
    const unlock = await this.quotaMutex.lock();

    try {
      const now = Date.now();

      // Check cooldown first
      if (
        this.quotaState.cooldownUntil &&
        now < this.quotaState.cooldownUntil
      ) {
        const remainingMs = this.quotaState.cooldownUntil - now;
        const remainingMin = Math.ceil(remainingMs / 60000);
        throw new Error(
          `API quota in cooldown. Please wait ${remainingMin} minutes before trying again.`
        );
      }

      // Reset cooldown if expired
      if (
        this.quotaState.cooldownUntil &&
        now >= this.quotaState.cooldownUntil
      ) {
        this.quotaState.cooldownUntil = undefined;
      }

      // Check and reset for new day
      const today = new Date().toDateString();
      if (this.quotaState.lastRequestDate !== today) {
        this.quotaState.dailyRequestCount = 0;
        this.quotaState.lastRequestDate = today;
        this.quotaState.cooldownUntil = undefined;
      }

      // Check quota limit
      if (this.quotaState.dailyRequestCount >= this.quotaState.quotaLimit) {
        // Set 1-hour cooldown when daily limit reached
        this.quotaState.cooldownUntil = now + 60 * 60 * 1000;
        this.saveQuotaToStorage();
        // CRITICAL FIX: Immediate cooldown persistence
        this.flushQuotaImmediately().catch(() => {});

        throw new Error(
          `Daily API quota reached (${this.quotaState.quotaLimit} requests). ` +
            `Cooldown activated for 1 hour to conserve your Google Maps credits.`
        );
      }

      // Increment quota
      this.quotaState.dailyRequestCount++;
      this.saveQuotaToStorage();

      console.log(
        `📊 API Usage: ${this.quotaState.dailyRequestCount}/${this.quotaState.quotaLimit} today`
      );
    } finally {
      unlock();
    }
  }

  // CRITICAL FIX #2: Enhanced error handling for API errors
  private handleApiError(error: any): never {
    // Handle different error types
    const message = error?.message || String(error);

    if (message.includes("API key")) {
      throw new Error(
        "Google Maps API key issue. Check your .env file and ensure the API key has Directions API enabled."
      );
    } else if (message.includes("timeout")) {
      throw new Error(
        "Network timeout. Please check your internet connection and try again."
      );
    } else if (message.includes("network") || message.includes("fetch")) {
      throw new Error("Network error. Check your internet connection.");
    } else if (message.includes("REQUEST_DENIED")) {
      throw new Error(
        "API key invalid or Directions API not enabled for this key."
      );
    } else if (message.includes("OVER_QUERY_LIMIT")) {
      // Set 30-minute cooldown for API rate limit
      const now = Date.now();
      this.quotaState.cooldownUntil = now + 30 * 60 * 1000;
      this.saveQuotaToStorage();
      // CRITICAL FIX: Immediate cooldown persistence
      this.flushQuotaImmediately().catch(() => {});

      throw new Error(
        "Google Maps API rate limit exceeded. Cooldown activated for 30 minutes."
      );
    } else if (message.includes("ZERO_RESULTS")) {
      throw new Error(
        "No routes found between these locations. Try different destinations."
      );
    }

    throw new Error(`Failed to get routes: ${message}`);
  }

  /**
   * CRITICAL FIX #1: Get routes with inflight deduplication BEFORE quota check
   * This prevents wasted quota when multiple callers request the same route
   */
  async getRoutes(
    start: UserLocation,
    end: UserLocation,
    alternatives: boolean = true
  ): Promise<GoogleRoute[]> {
    await this.ensureReady();

    // CRITICAL FIX #1: Inflight deduplication BEFORE quota check
    const routeKey = `${start.latitude.toFixed(
      this.COORDINATE_PRECISION
    )},${start.longitude.toFixed(
      this.COORDINATE_PRECISION
    )}_${end.latitude.toFixed(
      this.COORDINATE_PRECISION
    )},${end.longitude.toFixed(this.COORDINATE_PRECISION)}_${alternatives}`;

    if (this.inflightRoutes.has(routeKey)) {
      console.log("🔄 Using inflight route request (no quota used)");
      return await this.inflightRoutes.get(routeKey)!;
    }

    // Start request that will call incrementQuotaAndCheck internally
    const requestPromise = this._fetchRoutes(start, end, alternatives);
    this.inflightRoutes.set(routeKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.inflightRoutes.delete(routeKey);
    }
  }

  /**
   * Enhanced waypoint routing with production-ready error handling
   */
  async getRouteWithWaypoints(
    start: UserLocation,
    end: UserLocation,
    waypoints: UserLocation[]
  ): Promise<WaypointRouteResult> {
    await this.ensureReady();

    // Check cache first
    const cacheKey = this.makeRouteCacheKey(start, end, waypoints);
    const cached = this.routeCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.ROUTE_CACHE_TTL) {
      console.log("🔄 Using cached waypoint route");
      return cached.value;
    }

    // Inflight deduplication
    if (this.inflightRequests.has(cacheKey)) {
      console.log("🔄 Using inflight waypoint request");
      return await this.inflightRequests.get(cacheKey)!;
    }

    await this.incrementQuotaAndCheck();

    const requestPromise = this._fetchWaypointRoute(start, end, waypoints);
    this.inflightRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  // CRITICAL FIX #5: Improved waypoint generation with route snapping
  private improveWaypoints(
    waypoints: UserLocation[],
    directRoute?: GoogleRoute
  ): UserLocation[] {
    if (
      !directRoute ||
      !directRoute.polyline ||
      directRoute.polyline.length === 0
    ) {
      // Fallback to simple midpoint nudging
      return waypoints.map((wp) => {
        const offset = 0.001; // Smaller offset for better road snapping
        return {
          latitude: wp.latitude + (Math.random() - 0.5) * offset,
          longitude: wp.longitude + (Math.random() - 0.5) * offset,
        };
      });
    }

    // Better approach: snap waypoints to direct route polyline points
    const routePoints = directRoute.polyline;
    const improvedWaypoints: UserLocation[] = [];

    for (const waypoint of waypoints) {
      // Find the closest point on the direct route
      let minDistance = Infinity;
      let closestPoint = waypoint;

      for (const point of routePoints) {
        const distance = this.calculateDistance(waypoint, point);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      }

      // Use the closest route point as the improved waypoint
      improvedWaypoints.push(closestPoint);
    }

    console.log(
      `🎯 Improved ${waypoints.length} waypoints using route snapping`
    );
    return improvedWaypoints;
  }

  /**
   * Force alternative routes using improved strategic waypoints
   */
  private async forceAlternativeRoutes(
    start: UserLocation,
    end: UserLocation
  ): Promise<any[]> {
    const alternativeRoutes: any[] = [];

    try {
      // Get direct route first for waypoint improvement
      const directRoutes = await this.getRoutes(start, end, false);
      const directRoute = directRoutes.length > 0 ? directRoutes[0] : undefined;

      const waypoints = this.calculateStrategicWaypoints(start, end);
      const improvedWaypoints = this.improveWaypoints(waypoints, directRoute);

      // Limit waypoint attempts to prevent quota exhaustion
      const maxAttempts = Math.min(improvedWaypoints.length, 3);

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const waypoint = improvedWaypoints[i];
          await this.incrementQuotaAndCheck(); // Each waypoint uses quota

          const waypointUrl = this.buildWaypointUrl(start, end, waypoint);
          const waypointData = await this.fetchDirectionsWithTimeout(
            waypointUrl
          );

          if (
            waypointData.status === "OK" &&
            waypointData.routes &&
            waypointData.routes.length > 0
          ) {
            const route = waypointData.routes[0];
            route.summary = route.summary + " (Alternative Path)";
            route.via_waypoint = true;

            alternativeRoutes.push(route);
            console.log(
              `✅ Created alternative route via waypoint: ${route.summary}`
            );
          }
        } catch (error) {
          console.log(`⚠️ Waypoint route ${i} failed, continuing...`);
          continue;
        }
      }
    } catch (error) {
      console.log("⚠️ Could not create alternative routes:", error);
    }

    return alternativeRoutes;
  }

  // Rest of the implementation methods (fetchDirectionsWithTimeout, etc.)
  private async fetchDirectionsWithTimeout(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(
          `Request timeout after ${this.REQUEST_TIMEOUT / 1000} seconds`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Cache management with periodic cleanup
  private setCacheEntry(key: string, value: WaypointRouteResult): void {
    this.ensureCacheLimit();
    this.routeCache.set(key, { ts: Date.now(), value });
  }

  private ensureCacheLimit(): void {
    // Remove expired entries first
    const now = Date.now();
    for (const [key, entry] of this.routeCache.entries()) {
      if (now - entry.ts > this.ROUTE_CACHE_TTL) {
        this.routeCache.delete(key);
      }
    }

    // Then enforce size limit
    while (this.routeCache.size >= this.MAX_CACHE_ENTRIES) {
      const firstKey = this.routeCache.keys().next().value;
      if (firstKey) {
        this.routeCache.delete(firstKey);
      } else {
        break;
      }
    }
  }

  // Utility methods...
  private makeRouteCacheKey(
    start: UserLocation,
    end: UserLocation,
    waypoints?: UserLocation[]
  ) {
    const precision = (n: number) => n.toFixed(this.COORDINATE_PRECISION);
    const s = `${precision(start.latitude)},${precision(start.longitude)}`;
    const e = `${precision(end.latitude)},${precision(end.longitude)}`;
    const w =
      waypoints && waypoints.length > 0
        ? waypoints
            .map((p) => `${precision(p.latitude)},${precision(p.longitude)}`)
            .join("|")
        : "none";
    return `route_${s}_${e}_${w}`;
  }

  private calculateStrategicWaypoints(start: UserLocation, end: UserLocation) {
    const midLat = (start.latitude + end.latitude) / 2;
    const midLng = (start.longitude + end.longitude) / 2;
    const offsetDistance = 0.002; // Reduced for better road snapping

    return [
      {
        latitude: midLat + offsetDistance,
        longitude: midLng,
        description: "Northern Route",
      },
      {
        latitude: midLat - offsetDistance,
        longitude: midLng,
        description: "Southern Route",
      },
      {
        latitude: midLat,
        longitude: midLng + offsetDistance,
        description: "Eastern Route",
      },
    ];
  }

  private buildWaypointUrl(
    start: UserLocation,
    end: UserLocation,
    waypoint: UserLocation
  ): string {
    const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const params = new URLSearchParams({
      origin: `${start.latitude},${start.longitude}`,
      destination: `${end.latitude},${end.longitude}`,
      waypoints: `${waypoint.latitude},${waypoint.longitude}`,
      mode: "walking",
      key: this.apiKey,
      region: "PH",
    });
    return `${baseUrl}?${params.toString()}`;
  }

  calculateDistance(point1: UserLocation, point2: UserLocation): number {
    const R = 6371e3;
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // CRITICAL: Quota management and app lifecycle methods
  getQuotaStats(): {
    used: number;
    limit: number;
    remaining: number;
    date: string;
    cooldownUntil?: number;
    cooldownRemainingMs?: number;
  } {
    const now = Date.now();
    const cooldownRemainingMs =
      this.quotaState.cooldownUntil && this.quotaState.cooldownUntil > now
        ? this.quotaState.cooldownUntil - now
        : undefined;

    return {
      used: this.quotaState.dailyRequestCount,
      limit: this.quotaState.quotaLimit,
      remaining: this.quotaState.quotaLimit - this.quotaState.dailyRequestCount,
      date: this.quotaState.lastRequestDate,
      cooldownUntil: this.quotaState.cooldownUntil,
      cooldownRemainingMs,
    };
  }

  updateQuotaLimit(newLimit: number): void {
    if (newLimit > 0 && newLimit <= 1000) {
      this.quotaState.quotaLimit = newLimit;
      this.saveQuotaToStorage();
      console.log(`📊 Updated daily API quota limit to ${newLimit}`);
    } else {
      console.warn(
        `⚠️ Invalid quota limit: ${newLimit}. Must be between 1-1000`
      );
    }
  }

  // CRITICAL FIX #5: Expose flush method for app lifecycle
  async flushQuota(): Promise<void> {
    await this.flushQuotaImmediately();
  }

  // Cleanup methods
  clearCache(): void {
    this.routeCache.clear();
    this.inflightRequests.clear();
    this.inflightRoutes.clear();
    console.log("🗑️ All caches cleared");
  }

  async resetQuota(): Promise<void> {
    const unlock = await this.quotaMutex.lock();
    try {
      this.quotaState = {
        dailyRequestCount: 0,
        lastRequestDate: new Date().toDateString(),
        quotaLimit: this.quotaState.quotaLimit,
        cooldownUntil: undefined,
      };
      await AsyncStorage.removeItem(this.STORAGE_KEYS.QUOTA_STATE);
      console.log("🔄 Quota reset successfully");
    } finally {
      unlock();
    }
  }

  // COMPLETE IMPLEMENTATION: _fetchRoutes and _fetchWaypointRoute
  private async _fetchRoutes(
    start: UserLocation,
    end: UserLocation,
    alternatives: boolean
  ): Promise<GoogleRoute[]> {
    // CRITICAL: Increment quota ONLY when actually making network call
    await this.incrementQuotaAndCheck();

    try {
      console.log(
        `🗺️ Fetching routes from ${start.latitude},${start.longitude} to ${end.latitude},${end.longitude}`
      );

      if (!this.apiKey) {
        throw new Error("Google Maps API key not configured");
      }

      // Build the Google Directions API URL
      const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
      const params = new URLSearchParams({
        origin: `${start.latitude},${start.longitude}`,
        destination: `${end.latitude},${end.longitude}`,
        mode: "walking",
        alternatives: alternatives.toString(),
        key: this.apiKey,
        region: "PH", // Philippines
      });

      const url = `${baseUrl}?${params.toString()}`;
      console.log("🌐 Making request to Google Directions API...");

      let data = await this.fetchDirectionsWithTimeout(url);

      // If Google only returns one route, force different routes using waypoints
      if (alternatives && data.routes && data.routes.length === 1) {
        console.log(
          "📍 Google returned only 1 route, forcing alternatives with waypoints..."
        );

        const additionalRoutes = await this.forceAlternativeRoutes(start, end);
        const uniqueAdditionalRoutes = this.deduplicateGoogleRoutes(
          additionalRoutes,
          data.routes
        );
        data.routes = [...data.routes, ...uniqueAdditionalRoutes];
        console.log(`🔀 Enhanced to ${data.routes.length} total routes`);
      }

      if (data.status !== "OK") {
        let errorMessage = `Google Directions API error: ${data.status}`;
        if (data.error_message) {
          errorMessage += ` - ${data.error_message}`;
        }
        throw new Error(errorMessage);
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No routes found between these locations");
      }

      // Convert Google response to our format
      const routes = data.routes.map((route: any, index: number) =>
        this.convertGoogleRouteToWaispathRoute(route, index)
      );

      console.log(`✅ Retrieved ${routes.length} route alternatives`);
      return routes;
    } catch (error: any) {
      console.error("❌ Google Maps routing error:", error);
      throw this.handleApiError(error);
    }
  }

  private async _fetchWaypointRoute(
    start: UserLocation,
    end: UserLocation,
    waypoints: UserLocation[]
  ): Promise<WaypointRouteResult> {
    const cacheKey = this.makeRouteCacheKey(start, end, waypoints);

    // Get direct route for comparison (uses inflight deduplication from getRoutes)
    const directRoutes = await this.getRoutes(start, end, false);
    if (!directRoutes || directRoutes.length === 0) {
      throw new Error("Direct route not available for comparison");
    }
    const direct = directRoutes[0];

    // CRITICAL: Increment quota ONLY when making actual waypoint network call
    await this.incrementQuotaAndCheck();

    // Build Google Directions URL with waypoints
    const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const origin = `${start.latitude},${start.longitude}`;
    const destination = `${end.latitude},${end.longitude}`;

    const waypointsParam =
      waypoints && waypoints.length > 0
        ? `&waypoints=optimize:false|${waypoints
            .map((w) => `${w.latitude},${w.longitude}`)
            .join("|")}`
        : "";

    const url = `${baseUrl}?origin=${origin}&destination=${destination}${waypointsParam}&mode=walking&key=${this.apiKey}&region=PH`;

    console.log(
      `🗺️ Requesting waypoint route with ${waypoints.length} waypoints`
    );

    const json = await this.fetchDirectionsWithTimeout(url);

    if (json.status !== "OK") {
      throw new Error(
        `Google API error: ${json.status} - ${
          json.error_message || "Unknown error"
        }`
      );
    }

    if (!json.routes || json.routes.length === 0) {
      throw new Error("No waypoint routes returned from Google Directions");
    }

    const gRoute = json.routes[0];

    if (!gRoute.legs || !Array.isArray(gRoute.legs)) {
      throw new Error("Invalid route data: missing legs");
    }

    // Calculate total duration and distance from all legs
    const duration = gRoute.legs.reduce(
      (sum: number, leg: any) => sum + (leg?.duration?.value || 0),
      0
    );
    const distance = gRoute.legs.reduce(
      (sum: number, leg: any) => sum + (leg?.distance?.value || 0),
      0
    );

    // Get encoded polyline and decode it
    const encodedPolyline = gRoute.overview_polyline?.points || "";
    const decodedPolyline = this.decodePolyline(encodedPolyline);

    const directDuration = direct?.duration || 0;
    const directDistance = direct?.distance || 0;

    const extraTime = Math.max(0, duration - directDuration);
    const extraDistance = Math.max(0, distance - directDistance);

    const routeSimilarity =
      directDistance > 0 ? Math.max(0, 1 - extraDistance / directDistance) : 0;

    const result: WaypointRouteResult = {
      route: {
        polyline: decodedPolyline,
        polylineEncoded: encodedPolyline,
        duration,
        distance,
        raw: gRoute,
      },
      extraTime,
      extraDistance,
      routeSimilarity,
    };

    this.setCacheEntry(cacheKey, result);

    console.log(
      `✅ Waypoint route cached: +${Math.round(extraTime)}s, ${Math.round(
        routeSimilarity * 100
      )}% similar`
    );

    return result;
  }

  // Helper methods for route processing
  private deduplicateGoogleRoutes(
    newRoutes: any[],
    existingRoutes: any[]
  ): any[] {
    const existingSummaries = new Set(
      existingRoutes.map((r) => r.summary || "")
    );
    const existingPolylines = new Set(
      existingRoutes.map((r) => r.overview_polyline?.points || "")
    );

    return newRoutes.filter((route) => {
      const summary = route.summary || "";
      const polyline = route.overview_polyline?.points || "";
      return (
        !existingSummaries.has(summary) && !existingPolylines.has(polyline)
      );
    });
  }

  private convertGoogleRouteToWaispathRoute(
    googleRoute: any,
    index: number
  ): GoogleRoute {
    const leg = googleRoute.legs?.[0];

    if (!leg) {
      throw new Error(`Invalid route data: missing leg at index ${index}`);
    }

    const steps: RouteStep[] = (leg.steps || []).map((step: any) => ({
      startLocation: {
        latitude: step.start_location?.lat || 0,
        longitude: step.start_location?.lng || 0,
      },
      endLocation: {
        latitude: step.end_location?.lat || 0,
        longitude: step.end_location?.lng || 0,
      },
      distance: step.distance?.value || 0,
      duration: step.duration?.value || 0,
      instructions: (step.html_instructions || "").replace(/<[^>]*>/g, ""),
      polyline: step.polyline?.points || "",
    }));

    const encodedPolyline = googleRoute.overview_polyline?.points || "";
    const decodedPolyline = this.decodePolyline(encodedPolyline);

    return {
      id: `route_${index}`,
      polylineEncoded: encodedPolyline,
      polyline: decodedPolyline,
      distance: leg.distance?.value || 0,
      duration: leg.duration?.value || 0,
      steps,
      bounds: {
        northeast: {
          latitude: googleRoute.bounds?.northeast?.lat || 0,
          longitude: googleRoute.bounds?.northeast?.lng || 0,
        },
        southwest: {
          latitude: googleRoute.bounds?.southwest?.lat || 0,
          longitude: googleRoute.bounds?.southwest?.lng || 0,
        },
      },
      warnings: googleRoute.warnings || [],
      summary: googleRoute.summary || "Route via local roads",
    };
  }

  private decodePolyline(encoded: string): UserLocation[] {
    if (!encoded) return [];

    const points: UserLocation[] = [];
    let index = 0,
      lat = 0,
      lng = 0;

    try {
      while (index < encoded.length) {
        let b,
          shift = 0,
          result = 0;

        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        points.push({
          latitude: lat / 1e5,
          longitude: lng / 1e5,
        });
      }
      return points;
    } catch (error) {
      console.warn("Polyline decode error:", error);
      return [];
    }
  }
}

export const googleMapsService = new GoogleMapsService();
export type { GoogleRoute, RouteStep, WaypointRouteResult };
