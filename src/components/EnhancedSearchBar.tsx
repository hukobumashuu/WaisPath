// src/components/EnhancedSearchBar.tsx
// Enhanced search component with Google Places integration
// Fixed: prevents keyboard flashing by deferring modal/popular open until keyboard state is settled.

import React, { useState, useRef, useCallback, useEffect } from "react";
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
  TouchableWithoutFeedback,
  Modal,
  Platform,
  findNodeHandle,
  UIManager,
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

  const inputRef = useRef<TextInput | null>(null);
  const inputWrapperRef = useRef<View | null>(null);
  const suggestionTimeout = useRef<NodeJS.Timeout | null>(null);

  // layout for anchoring dropdown
  const [inputLayout, setInputLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // track keyboard visibility to decide modal vs inline
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardVisibleRef = useRef(false); // immediate-ref to avoid stale closures

  // Popular destinations for quick access
  const popularDestinations = googlePlacesService.getPopularDestinations();

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisibleRef.current = true;
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisibleRef.current = false;
      setIsKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /**
   * Measure input position in window coordinates so we can anchor the modal dropdown
   */
  const measureInput = useCallback(() => {
    const node = findNodeHandle(inputWrapperRef.current as any);
    if (!node) {
      setInputLayout(null);
      return;
    }
    UIManager.measureInWindow(
      node,
      (x: number, y: number, width: number, height: number) => {
        setInputLayout({ x, y, width, height });
      }
    );
  }, []);

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
        setShowPopularDestinations(false);
        // measure when opening so modal anchor is correct
        setTimeout(measureInput, 80);
      } catch (error) {
        console.error("Autocomplete error:", error);
        // Show popular destinations as fallback (but only inline if keyboard visible)
        if (keyboardVisibleRef.current) {
          setShowPopularDestinations(true);
        } else {
          // if keyboard not visible, don't immediately open modal — measure & set after a short delay
          setTimeout(() => {
            measureInput();
            setShowPopularDestinations(true);
          }, 180);
        }
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [userLocation, measureInput]
  );

  const handleTextChange = (text: string) => {
    setQuery(text);

    if (suggestionTimeout.current) {
      clearTimeout(suggestionTimeout.current);
    }

    suggestionTimeout.current = setTimeout(() => {
      getSuggestions(text);
    }, 300);
  };

  const handleSuggestionPress = async (suggestion: AutocompleteResult) => {
    try {
      setIsLoadingResults(true);
      setShowSuggestions(false);
      setQuery(suggestion.mainText);

      const placeDetails = await googlePlacesService.getPlaceDetails(
        suggestion.placeId
      );

      if (placeDetails) {
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

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setIsLoadingResults(true);
      setShowSuggestions(false);
      setShowPopularDestinations(false);

      const results = await googlePlacesService.searchPlaces(
        query,
        userLocation,
        10000
      );

      if (results.length > 0) {
        setSearchResults(results);
        if (
          results.length === 1 ||
          query.toLowerCase().includes(results[0].name.toLowerCase())
        ) {
          onDestinationSelect(results[0]);
          Keyboard.dismiss();
        } else {
          setShowSuggestions(true);
          setSuggestions(
            results.map((result) => ({
              placeId: result.placeId,
              description: `${result.name} - ${result.address}`,
              mainText: result.name,
              secondaryText: result.address,
              types: result.types ?? [],
              structured: {
                mainText: result.name,
                secondaryText: result.address,
              },
            }))
          );
          setTimeout(measureInput, 80);
        }
      } else {
        Alert.alert(
          "No Results",
          `No places found for "${query}" in Pasig area. Try a different search term or browse popular destinations.`,
          [
            { text: "Try Again" },
            {
              text: "Browse Popular",
              onPress: () => {
                // prefer inline if typing
                if (keyboardVisibleRef.current) {
                  setShowPopularDestinations(true);
                } else {
                  setTimeout(() => {
                    measureInput();
                    setShowPopularDestinations(true);
                  }, 180);
                }
              },
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
   * Clear search and show popular destinations:
   * - focus input
   * - wait shortly to let keyboard show, then open inline popular
   * - if keyboard won't show, open modal after measure
   */
  const handleClearAndShowPopular = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);

    // focus the input — keyboard should come up
    inputRef.current?.focus();

    // small delay so keyboardDidShow can fire and update keyboardVisibleRef
    setTimeout(() => {
      if (keyboardVisibleRef.current) {
        setShowPopularDestinations(true);
        setTimeout(measureInput, 80);
      } else {
        // keyboard didn't appear — show modal dropdown anchored
        setTimeout(() => {
          measureInput();
          setShowPopularDestinations(true);
        }, 120);
      }
    }, 260);
  };

  /**
   * onFocus: don't immediately open modal/popular (avoids modal stealing focus).
   * Wait briefly and open inline popular only if keyboard actually visible.
   */
  const handleInputFocus = () => {
    // let the keyboard event arrive; after small delay, open popular inline if keyboard is visible
    setTimeout(() => {
      if (keyboardVisibleRef.current) {
        setShowPopularDestinations(true);
        setTimeout(measureInput, 80);
      }
    }, 260);
  };

  const handleInputBlur = () => {
    // Delay hiding to allow suggestion tap
    setTimeout(() => {
      setShowSuggestions(false);
      setShowPopularDestinations(false);
    }, 160);
  };

  // keep measurement updated while visible (small interval)
  useEffect(() => {
    let tid: number | undefined;
    if (showSuggestions || showPopularDestinations) {
      tid = setInterval(() => {
        measureInput();
      }, 700) as unknown as number;
    }
    return () => {
      if (tid) clearInterval(tid);
    };
  }, [showSuggestions, showPopularDestinations, measureInput]);

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
          {item.types?.some((type) =>
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

  // Dropdown content wrapper (shared for modal & inline)
  const DropdownContent = (
    <>
      {showSuggestions && suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.placeId}
          renderItem={renderSuggestionItem}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={styles.suggestionsList}
        />
      )}

      {showPopularDestinations && popularDestinations.length > 0 && (
        <>
          <Text style={styles.popularDestinationsTitle}>
            Popular PWD Destinations
          </Text>
          <FlatList
            data={popularDestinations}
            keyExtractor={(item) => item.name}
            renderItem={renderPopularDestinationItem}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.popularDestinationsList}
          />
        </>
      )}
    </>
  );

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        setShowSuggestions(false);
        setShowPopularDestinations(false);
        Keyboard.dismiss();
      }}
    >
      <View style={[styles.container, style]}>
        {/* Input wrapper for measurement */}
        <View ref={inputWrapperRef} style={styles.inputWrapper}>
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

            {query ? (
              <TouchableOpacity
                onPress={() => {
                  setQuery("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                  // focus and then allow keyboardDidShow handler to decide showing popular
                  inputRef.current?.focus();
                  setTimeout(() => {
                    if (keyboardVisibleRef.current) {
                      setShowPopularDestinations(true);
                      setTimeout(measureInput, 80);
                    }
                  }, 260);
                }}
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

            {(isLoadingSuggestions || isLoadingResults) && (
              <ActivityIndicator
                size="small"
                color="#3B82F6"
                style={styles.loadingIndicator}
              />
            )}
          </View>

          {/* Inline dropdown: render when keyboard visible so typing & keyboard remain functional */}
          {isKeyboardVisible &&
            (showSuggestions || showPopularDestinations) && (
              <View
                style={[styles.dropdownInner, { marginTop: 8 }]}
                pointerEvents="box-none"
              >
                {DropdownContent}
              </View>
            )}
        </View>

        {/* Modal-backed dropdown: only when keyboard is NOT visible (prevents touch-through to map) */}
        {!isKeyboardVisible && (showSuggestions || showPopularDestinations) && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowSuggestions(false);
              setShowPopularDestinations(false);
            }}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                setShowSuggestions(false);
                setShowPopularDestinations(false);
                Keyboard.dismiss();
              }}
            >
              <View style={styles.modalOverlay}>
                <View
                  style={[
                    styles.modalDropdownContainer,
                    inputLayout
                      ? {
                          left: Math.max(8, inputLayout.x - 8),
                          top: Math.max(
                            Platform.OS === "android" ? 20 : 44,
                            inputLayout.y + inputLayout.height + 8
                          ),
                          width: Math.max(280, inputLayout.width + 16),
                        }
                      : { marginTop: 80, marginHorizontal: 16 },
                  ]}
                >
                  <View style={styles.dropdownInner}>{DropdownContent}</View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}

        {/* Compact searchResults (if you still want to show under input without modal) */}
        {searchResults.length > 0 &&
          !showSuggestions &&
          !showPopularDestinations && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.placeId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => onDestinationSelect(item)}
                  >
                    <View style={styles.suggestionContent}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#6B7280"
                        style={styles.suggestionIcon}
                      />
                      <View style={styles.suggestionText}>
                        <Text style={styles.suggestionMainText}>
                          {item.name}
                        </Text>
                        <Text style={styles.suggestionSecondaryText}>
                          {item.address}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              />
            </View>
          )}
      </View>
    </TouchableWithoutFeedback>
  );
};

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
    zIndex: Platform.OS === "android" ? 9999 : 1000,
  },
  inputWrapper: {
    position: "relative",
    zIndex: Platform.OS === "android" ? 9999 : 1000,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
    paddingVertical: 0,
  },
  actionButton: {
    marginLeft: 8,
    padding: 6,
  },
  loadingIndicator: {
    marginLeft: 8,
  },

  // Inline & modal dropdown inner (shared style)
  dropdownInner: {
    backgroundColor: "white",
    borderRadius: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    maxHeight: 420,
    overflow: "hidden",
  },

  // Inline suggestions list styling
  suggestionsList: {
    maxHeight: 380,
  },

  suggestionItem: {
    padding: 14,
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
    marginTop: 4,
  },
  accessibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  accessibilityBadgeText: {
    fontSize: 12,
    color: "#059669",
    marginLeft: 6,
  },

  // Modal overlay (fills screen and prevents touch-through)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  // anchored dropdown container inside modal
  modalDropdownContainer: {
    position: "absolute",
    maxHeight: "70%",
    zIndex: Platform.OS === "android" ? 99999 : 10001,
  },

  popularDestinationsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  popularDestinationsList: {
    maxHeight: 340,
  },
  popularDestinationItem: {
    padding: 12,
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

  resultsContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
});

export default EnhancedSearchBar;
