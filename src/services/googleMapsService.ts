// src/services/googleMapsService.ts
// React Native compatible Google Maps Directions API integration

import { UserLocation } from "../types";

interface GoogleRoute {
  id: string;
  polyline: string;
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

class GoogleMapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "⚠️ Google Maps API key not found. Please add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env"
      );
    }
  }

  /**
   * Get multiple route alternatives between two points using fetch (React Native compatible)
   */
  async getRoutes(
    start: UserLocation,
    end: UserLocation,
    alternatives: boolean = true
  ): Promise<GoogleRoute[]> {
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

      // Use fetch instead of axios (React Native compatible)
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

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

      // Provide helpful error messages
      if (error.message.includes("API key")) {
        throw new Error(
          "Google Maps API key issue. Check your .env file and ensure the API key has Directions API enabled."
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error. Check your internet connection.");
      } else if (error.message.includes("REQUEST_DENIED")) {
        throw new Error(
          "API key invalid or Directions API not enabled for this key."
        );
      } else if (error.message.includes("OVER_QUERY_LIMIT")) {
        throw new Error("Google Maps API quota exceeded. Try again later.");
      } else if (error.message.includes("ZERO_RESULTS")) {
        throw new Error(
          "No routes found between these locations. Try different destinations."
        );
      }

      throw new Error(`Failed to get routes: ${error.message}`);
    }
  }

  /**
   * Convert Google Maps route format to our internal format
   */
  private convertGoogleRouteToWaispathRoute(
    googleRoute: any,
    index: number
  ): GoogleRoute {
    const leg = googleRoute.legs[0]; // For single-leg journeys

    const steps: RouteStep[] = leg.steps.map((step: any) => ({
      startLocation: {
        latitude: step.start_location.lat,
        longitude: step.start_location.lng,
      },
      endLocation: {
        latitude: step.end_location.lat,
        longitude: step.end_location.lng,
      },
      distance: step.distance.value,
      duration: step.duration.value,
      instructions: step.html_instructions.replace(/<[^>]*>/g, ""), // Strip HTML
      polyline: step.polyline.points,
    }));

    return {
      id: `route_${index}`,
      polyline: googleRoute.overview_polyline.points,
      distance: leg.distance.value,
      duration: leg.duration.value,
      steps,
      bounds: {
        northeast: {
          latitude: googleRoute.bounds.northeast.lat,
          longitude: googleRoute.bounds.northeast.lng,
        },
        southwest: {
          latitude: googleRoute.bounds.southwest.lat,
          longitude: googleRoute.bounds.southwest.lng,
        },
      },
      warnings: googleRoute.warnings || [],
      summary: googleRoute.summary || "Route via local roads",
    };
  }

  /**
   * Simple test method to verify API connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      // Test with a simple route in Pasig
      const start = { latitude: 14.5764, longitude: 121.0851 }; // Pasig City Hall
      const end = { latitude: 14.5657, longitude: 121.0644 }; // The Podium

      const routes = await this.getRoutes(start, end, false);
      return routes.length > 0;
    } catch (error) {
      console.error("Connectivity test failed:", error);
      return false;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(point1: UserLocation, point2: UserLocation): number {
    const R = 6371e3; // Earth's radius in meters
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

  /**
   * Get detailed directions for a specific route
   */
  async getDetailedDirections(route: GoogleRoute): Promise<string[]> {
    return route.steps.map(
      (step, index) =>
        `${index + 1}. ${step.instructions} (${step.distance}m, ${Math.round(
          step.duration / 60
        )}min)`
    );
  }
}

// Export singleton instance
export const googleMapsService = new GoogleMapsService();

// Export types for use in other files
export type { GoogleRoute, RouteStep };
