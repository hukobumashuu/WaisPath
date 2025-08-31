// src/components/EnhancedSearchBar.tsx
// Enhanced search component with Google Places integration
// Designed specifically for PWD users with accessibility prioritization

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  googlePlacesService,
  PlaceSearchResult,
  AutocompleteResult,
} from "../services/googlePlacesService";
import { UserLocation } from "../types";

interface EnhancedSearchBarProps {
  onDestinationSelect: (destination: PlaceSearchResult) => void;
  userLocation?: UserLocation;
  style?: any;
  placeholder?: string;
  initialQuery?: string;
}

export const EnhancedSearchBar: React.FC<EnhancedSearchBarProps> = ({
  onDestinationSelect,
  userLocation,
  style,
  placeholder = "Where do you want to go?",
  initialQuery = "",
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPopularDestinations, setShowPopularDestinations] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const suggestionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Popular destinations for quick access
  const popularDestinations = googlePlacesService.getPopularDestinations();

  /**
   * Debounced autocomplete suggestions
   */
  const getSuggestions = useCallback(
    async (searchText: string) => {
      if (searchText.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);

      try {
        const results = await googlePlacesService.getAutocompleteSuggestions(
          searchText,
          userLocation
        );
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Autocomplete error:", error);
        // Show popular destinations as fallback
        setShowPopularDestinations(true);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [userLocation]
  );

  /**
   * Handle text input changes with debouncing
   */
  const handleTextChange = (text: string) => {
    setQuery(text);

    // Clear existing timeout
    if (suggestionTimeout.current) {
      clearTimeout(suggestionTimeout.current);
    }

    // Debounce suggestions request
    suggestionTimeout.current = setTimeout(() => {
      getSuggestions(text);
    }, 300);
  };

  /**
   * Handle suggestion selection
   */
  const handleSuggestionPress = async (suggestion: AutocompleteResult) => {
    try {
      setIsLoadingResults(true);
      setShowSuggestions(false);
      setQuery(suggestion.mainText);

      // Get detailed place information
      const placeDetails = await googlePlacesService.getPlaceDetails(
        suggestion.placeId
      );

      if (placeDetails) {
        console.log(`✅ Selected: ${placeDetails.name}`);
        onDestinationSelect(placeDetails);
        Keyboard.dismiss();
      } else {
        Alert.alert(
          "Location Error",
          "Unable to get details for this location. Please try another search."
        );
      }
    } catch (error) {
      console.error("Place details error:", error);
      Alert.alert(
        "Search Error",
        "Unable to load location details. Please check your connection."
      );
    } finally {
      setIsLoadingResults(false);
    }
  };

  /**
   * Handle popular destination selection
   */
  const handlePopularDestinationPress = async (destination: {
    name: string;
    query: string;
  }) => {
    try {
      setIsLoadingResults(true);
      setShowPopularDestinations(false);
      setQuery(destination.name);

      const results = await googlePlacesService.searchPlaces(
        destination.query,
        userLocation,
        5000
      );

      if (results.length > 0) {
        onDestinationSelect(results[0]);
        console.log(`✅ Selected popular destination: ${destination.name}`);
        Keyboard.dismiss();
      } else {
        Alert.alert(
          "Location Not Found",
          `Unable to find ${destination.name}. Please try a manual search.`
        );
      }
    } catch (error) {
      console.error("Popular destination error:", error);
      Alert.alert(
        "Search Error",
        "Unable to load this destination. Please try manual search."
      );
    } finally {
      setIsLoadingResults(false);
    }
  };

  /**
   * Perform text search when user presses search
   */
  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setIsLoadingResults(true);
      setShowSuggestions(false);
      setShowPopularDestinations(false);

      const results = await googlePlacesService.searchPlaces(
        query,
        userLocation,
        10000 // 10km radius for text search
      );

      if (results.length > 0) {
        setSearchResults(results);
        // Auto-select first result if there's a clear match
        if (
          results.length === 1 ||
          query.toLowerCase().includes(results[0].name.toLowerCase())
        ) {
          onDestinationSelect(results[0]);
          console.log(`✅ Auto-selected: ${results[0].name}`);
          Keyboard.dismiss();
        } else {
          // Show multiple results for user selection
          setShowSuggestions(true);
          setSuggestions(
            results.map((result) => ({
              placeId: result.placeId,
              description: `${result.name} - ${result.address}`,
              mainText: result.name,
              secondaryText: result.address,
              types: result.types,
              structured: {
                mainText: result.name,
                secondaryText: result.address,
              },
            }))
          );
        }
      } else {
        Alert.alert(
          "No Results",
          `No places found for "${query}" in Pasig area. Try a different search term or browse popular destinations.`,
          [
            { text: "Try Again" },
            {
              text: "Browse Popular",
              onPress: () => setShowPopularDestinations(true),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert(
        "Search Error",
        "Unable to search for locations. Please check your connection."
      );
    } finally {
      setIsLoadingResults(false);
    }
  };

  /**
   * Clear search and show popular destinations
   */
  const handleClearAndShowPopular = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setShowPopularDestinations(true);
    inputRef.current?.focus();
  };

  /**
   * Hide suggestions when input loses focus
   */
  const handleInputBlur = () => {
    // Delay hiding to allow suggestion tap
    setTimeout(() => {
      setShowSuggestions(false);
      setShowPopularDestinations(false);
    }, 200);
  };

  /**
   * Show popular destinations when input gains focus and is empty
   */
  const handleInputFocus = () => {
    if (!query.trim()) {
      setShowPopularDestinations(true);
    }
  };

  /**
   * Render suggestion item with accessibility info
   */
  const renderSuggestionItem = ({ item }: { item: AutocompleteResult }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
      accessibilityLabel={`Navigate to ${item.mainText}, ${item.secondaryText}`}
      accessibilityHint="Tap to select this destination and calculate accessible routes"
    >
      <View style={styles.suggestionContent}>
        <Ionicons
          name="location-outline"
          size={20}
          color="#6B7280"
          style={styles.suggestionIcon}
        />
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionMainText}>{item.mainText}</Text>
          <Text style={styles.suggestionSecondaryText}>
            {item.secondaryText}
          </Text>
          {item.types.some((type) =>
            ["hospital", "pharmacy", "government_office"].includes(type)
          ) && (
            <View style={styles.accessibilityBadge}>
              <Ionicons
                name="accessibility-outline"
                size={14}
                color="#059669"
              />
              <Text style={styles.accessibilityBadgeText}>PWD Priority</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  /**
   * Render popular destination item
   */
  const renderPopularDestinationItem = ({
    item,
  }: {
    item: { name: string; category: string; query: string };
  }) => (
    <TouchableOpacity
      style={styles.popularDestinationItem}
      onPress={() => handlePopularDestinationPress(item)}
      accessibilityLabel={`Quick access to ${item.name} in ${item.category} category`}
      accessibilityHint="Tap for quick navigation to this popular PWD destination"
    >
      <View style={styles.popularDestinationContent}>
        <View style={styles.popularDestinationIconContainer}>
          <Ionicons
            name={getIconForCategory(item.category)}
            size={24}
            color="#3B82F6"
          />
        </View>
        <View style={styles.popularDestinationText}>
          <Text style={styles.popularDestinationName}>{item.name}</Text>
          <Text style={styles.popularDestinationCategory}>{item.category}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      {/* Search Input */}
      <View style={styles.searchInputContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#6B7280"
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={placeholder}
          value={query}
          onChangeText={handleTextChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onSubmitEditing={handleSearch}
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          accessibilityLabel="Destination search input"
          accessibilityHint="Enter where you want to navigate to for accessible routes"
        />

        {/* Clear/Popular button */}
        {query ? (
          <TouchableOpacity
            onPress={() => setQuery("")}
            style={styles.actionButton}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleClearAndShowPopular}
            style={styles.actionButton}
            accessibilityLabel="Show popular destinations"
          >
            <Ionicons name="star-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* Loading indicator */}
        {(isLoadingSuggestions || isLoadingResults) && (
          <ActivityIndicator
            size="small"
            color="#3B82F6"
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {/* Suggestions List */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            renderItem={renderSuggestionItem}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {/* Popular Destinations */}
      {showPopularDestinations && (
        <View style={styles.popularDestinationsContainer}>
          <Text style={styles.popularDestinationsTitle}>
            Popular PWD Destinations
          </Text>
          <FlatList
            data={popularDestinations}
            keyExtractor={(item) => item.name}
            renderItem={renderPopularDestinationItem}
            style={styles.popularDestinationsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
};

/**
 * Get appropriate icon for destination category
 */
const getIconForCategory = (
  category: string
): keyof typeof Ionicons.glyphMap => {
  const icons = {
    Government: "business-outline",
    Healthcare: "medical-outline",
    Shopping: "storefront-outline",
    Transport: "train-outline",
    Banking: "card-outline",
  };
  return (icons[category as keyof typeof icons] ||
    "location-outline") as keyof typeof Ionicons.glyphMap;
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1000,
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
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
  },
  actionButton: {
    marginLeft: 8,
    padding: 4,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 12,
    marginTop: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    maxHeight: 300,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  suggestionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  suggestionSecondaryText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  accessibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  accessibilityBadgeText: {
    fontSize: 12,
    color: "#059669",
    marginLeft: 4,
  },
  popularDestinationsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 12,
    marginTop: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    maxHeight: 400,
  },
  popularDestinationsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  popularDestinationsList: {
    maxHeight: 350,
  },
  popularDestinationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  popularDestinationContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  popularDestinationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  popularDestinationText: {
    flex: 1,
  },
  popularDestinationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  popularDestinationCategory: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
});

export default EnhancedSearchBar;
