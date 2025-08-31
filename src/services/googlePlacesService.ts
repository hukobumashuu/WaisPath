// src/services/googlePlacesService.ts
// FIXED: React Native compatible Google Places API integration
// Removed invalid timeout property and added proper AbortController usage

import { UserLocation } from "../types";

interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  location: UserLocation;
  types: string[];
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  rating: number;
  userRatingsTotal: number;
  accessibilityFeatures?: {
    wheelchairAccessible?: boolean;
    hasParking?: boolean;
    hasRamp?: boolean;
    hasElevator?: boolean;
  };
  openingHours?: {
    openNow: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
}

interface AutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
  structured: {
    mainText: string;
    secondaryText: string;
  };
}

class GooglePlacesService {
  private apiKey: string;
  private readonly REQUEST_TIMEOUT = 10000;

  // Cache for recent searches
  private searchCache = new Map<
    string,
    { data: PlaceSearchResult[]; timestamp: number }
  >();
  private autocompleteCache = new Map<
    string,
    { data: AutocompleteResult[]; timestamp: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    if (!this.apiKey) {
      console.warn("⚠️ Google Places API requires the same API key as Maps");
    }
  }

  /**
   * FIXED: Utility function for fetch with timeout using AbortController
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw error;
    }
  }

  /**
   * Search for places using Google Places Text Search
   * Optimized for accessibility-relevant results in Pasig City
   */
  async searchPlaces(
    query: string,
    userLocation?: UserLocation,
    radius: number = 5000 // 5km default radius
  ): Promise<PlaceSearchResult[]> {
    if (!query.trim()) return [];

    const cacheKey = `search:${query}:${userLocation?.latitude}:${userLocation?.longitude}:${radius}`;
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log("🔍 Using cached search results");
      return cached.data;
    }

    try {
      console.log(`🔍 Searching for: "${query}" in Pasig area`);

      const baseUrl =
        "https://maps.googleapis.com/maps/api/place/textsearch/json";
      const params = new URLSearchParams({
        query: `${query} Pasig City Philippines`,
        key: this.apiKey,
        region: "PH",
        language: "en",
      });

      // Add location bias if user location available
      if (userLocation) {
        params.append(
          "location",
          `${userLocation.latitude},${userLocation.longitude}`
        );
        params.append("radius", radius.toString());
      }

      const response = await this.fetchWithTimeout(
        `${baseUrl}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "OK") {
        if (data.status === "ZERO_RESULTS") {
          console.log("📍 No places found for query:", query);
          return [];
        }
        throw new Error(`Places API status: ${data.status}`);
      }

      const results = data.results.map(this.convertGooglePlaceToSearchResult);

      // Cache results
      this.searchCache.set(cacheKey, { data: results, timestamp: Date.now() });

      console.log(`✅ Found ${results.length} places for "${query}"`);
      return results;
    } catch (error) {
      console.error("❌ Places search error:", error);
      throw new Error(
        `Search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get autocomplete suggestions for search input
   * Prioritizes accessible locations and common PWD destinations
   */
  async getAutocompleteSuggestions(
    input: string,
    userLocation?: UserLocation
  ): Promise<AutocompleteResult[]> {
    if (!input.trim() || input.length < 2) return [];

    const cacheKey = `autocomplete:${input}:${userLocation?.latitude}:${userLocation?.longitude}`;
    const cached = this.autocompleteCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const baseUrl =
        "https://maps.googleapis.com/maps/api/place/autocomplete/json";
      const params = new URLSearchParams({
        input: input,
        key: this.apiKey,
        components: "country:ph", // Philippines only
        language: "en",
        types: "establishment", // Focus on businesses/establishments
      });

      // Bias results toward Pasig City
      if (userLocation) {
        params.append(
          "location",
          `${userLocation.latitude},${userLocation.longitude}`
        );
        params.append("radius", "10000"); // 10km radius
      } else {
        // Default to Pasig City center
        params.append("location", "14.5764,121.0851");
        params.append("radius", "15000");
      }

      const response = await this.fetchWithTimeout(
        `${baseUrl}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Autocomplete API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        throw new Error(`Autocomplete API status: ${data.status}`);
      }

      const results = (data.predictions || []).map(
        this.convertGooglePredictionToAutocomplete
      );

      // Prioritize accessibility-relevant places
      const prioritized = this.prioritizeAccessibilityRelevantResults(results);

      this.autocompleteCache.set(cacheKey, {
        data: prioritized,
        timestamp: Date.now(),
      });

      return prioritized;
    } catch (error) {
      console.error("❌ Autocomplete error:", error);
      return []; // Return empty array instead of throwing for autocomplete
    }
  }

  /**
   * Get detailed information about a specific place
   * Includes accessibility-relevant details when available
   */
  async getPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
    try {
      console.log(`🔍 Getting details for place: ${placeId}`);

      const baseUrl = "https://maps.googleapis.com/maps/api/place/details/json";
      const params = new URLSearchParams({
        place_id: placeId,
        key: this.apiKey,
        fields: [
          "place_id",
          "name",
          "formatted_address",
          "geometry",
          "types",
          "business_status",
          "rating",
          "user_ratings_total",
          "opening_hours",
          "wheelchair_accessible_entrance", // Accessibility field
        ].join(","),
        language: "en",
      });

      const response = await this.fetchWithTimeout(
        `${baseUrl}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Place Details API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "OK") {
        console.warn(`Place Details API status: ${data.status}`);
        return null;
      }

      return this.convertGooglePlaceToSearchResult(data.result);
    } catch (error) {
      console.error("❌ Place details error:", error);
      return null;
    }
  }

  /**
   * Convert Google Place API result to our format
   */
  private convertGooglePlaceToSearchResult = (
    place: any
  ): PlaceSearchResult => {
    const location: UserLocation = {
      latitude: place.geometry?.location?.lat || 0,
      longitude: place.geometry?.location?.lng || 0,
    };

    // Extract accessibility features from Google data
    const accessibilityFeatures = {
      wheelchairAccessible: place.wheelchair_accessible_entrance === true,
      hasParking: place.types?.includes("parking") || false,
      // These would be enhanced with more detailed accessibility data
      hasRamp: undefined, // Not available in basic Google Places
      hasElevator: undefined,
    };

    return {
      placeId: place.place_id,
      name: place.name || "Unknown Place",
      address: place.formatted_address || place.vicinity || "",
      location,
      types: place.types || [],
      businessStatus: place.business_status || "OPERATIONAL",
      rating: place.rating || 0,
      userRatingsTotal: place.user_ratings_total || 0,
      accessibilityFeatures,
      openingHours: place.opening_hours
        ? {
            openNow: place.opening_hours.open_now || false,
            periods: place.opening_hours.periods || [],
          }
        : undefined,
    };
  };

  /**
   * Convert Google Autocomplete prediction to our format
   */
  private convertGooglePredictionToAutocomplete = (
    prediction: any
  ): AutocompleteResult => {
    return {
      placeId: prediction.place_id,
      description: prediction.description,
      mainText:
        prediction.structured_formatting?.main_text || prediction.description,
      secondaryText: prediction.structured_formatting?.secondary_text || "",
      types: prediction.types || [],
      structured: {
        mainText:
          prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || "",
      },
    };
  };

  /**
   * Prioritize places that are typically important for PWD users
   */
  private prioritizeAccessibilityRelevantResults(
    results: AutocompleteResult[]
  ): AutocompleteResult[] {
    const priorityTypes = [
      "hospital",
      "doctor",
      "pharmacy",
      "government_office",
      "city_hall",
      "shopping_mall",
      "bank",
      "atm",
      "grocery_or_supermarket",
      "public_transport",
    ];

    return results.sort((a, b) => {
      const aPriority = a.types.some((type) => priorityTypes.includes(type));
      const bPriority = b.types.some((type) => priorityTypes.includes(type));

      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return 0;
    });
  }

  /**
   * Clear caches to free memory
   */
  clearCache(): void {
    this.searchCache.clear();
    this.autocompleteCache.clear();
    console.log("🗑️ Places search cache cleared");
  }

  /**
   * Get popular PWD-relevant destinations in Pasig
   * Fallback for when search fails or for quick access
   */
  getPopularDestinations(): Array<{
    name: string;
    category: string;
    query: string;
  }> {
    return [
      // Government & Services
      {
        name: "Pasig City Hall",
        category: "Government",
        query: "Pasig City Hall",
      },
      {
        name: "DILG Pasig",
        category: "Government",
        query: "DILG Office Pasig",
      },
      {
        name: "BIR District Office",
        category: "Government",
        query: "BIR Pasig",
      },
      {
        name: "PhilHealth Pasig",
        category: "Healthcare",
        query: "PhilHealth Pasig",
      },

      // Healthcare
      {
        name: "Pasig City General Hospital",
        category: "Healthcare",
        query: "Pasig General Hospital",
      },
      {
        name: "The Medical City",
        category: "Healthcare",
        query: "Medical City Pasig",
      },
      {
        name: "Rizal Medical Center",
        category: "Healthcare",
        query: "Rizal Medical Center",
      },

      // Shopping & Essentials
      { name: "SM City Pasig", category: "Shopping", query: "SM City Pasig" },
      {
        name: "Robinson's Metro East",
        category: "Shopping",
        query: "Robinsons Metro East",
      },
      { name: "Tiendesitas", category: "Shopping", query: "Tiendesitas Pasig" },

      // Transportation
      {
        name: "Pasig Bus Terminal",
        category: "Transport",
        query: "Pasig Bus Terminal",
      },
      {
        name: "Shaw Boulevard MRT",
        category: "Transport",
        query: "Shaw Boulevard MRT Station",
      },
      {
        name: "Ortigas MRT Station",
        category: "Transport",
        query: "Ortigas MRT Station",
      },

      // Banking & Finance
      { name: "BDO Ortigas", category: "Banking", query: "BDO Bank Ortigas" },
      {
        name: "BPI Capitol Commons",
        category: "Banking",
        query: "BPI Capitol Commons",
      },
    ];
  }
}

export const googlePlacesService = new GooglePlacesService();
export type { PlaceSearchResult, AutocompleteResult };
