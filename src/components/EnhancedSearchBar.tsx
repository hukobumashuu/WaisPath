// src/components/EnhancedSearchBar.tsx
// UPDATED: Added "Choose on Map" option for Option A implementation

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
  onChooseOnMap?: () => void; // ✅ NEW: Callback for "Choose on Map" option
  userLocation?: UserLocation;
  style?: any;
  placeholder?: string;
  initialQuery?: string;
}

export const EnhancedSearchBar: React.FC<EnhancedSearchBarProps> = ({
  onDestinationSelect,
  onChooseOnMap, // ✅ NEW
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

  const [inputLayout, setInputLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardVisibleRef = useRef(false);

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
        setTimeout(measureInput, 80);
      } catch (error) {
        console.error("Autocomplete error:", error);
        if (keyboardVisibleRef.current) {
          setShowPopularDestinations(true);
        } else {
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

  const handlePopularDestinationPress = async (item: {
    name: string;
    category: string;
    query: string;
  }) => {
    try {
      setIsLoadingResults(true);
      setShowPopularDestinations(false);
      setQuery(item.query);

      const searchResults = await googlePlacesService.searchPlaces(
        item.query,
        userLocation
      );

      if (searchResults && searchResults.length > 0) {
        onDestinationSelect(searchResults[0]);
        Keyboard.dismiss();
      } else {
        Alert.alert(
          "Location Error",
          `Unable to find ${item.name}. Please try searching manually.`
        );
      }
    } catch (error) {
      console.error("Popular destination error:", error);
      Alert.alert(
        "Search Error",
        "Unable to load this destination. Please try searching manually."
      );
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setIsLoadingResults(true);
      const results = await googlePlacesService.searchPlaces(
        query,
        userLocation
      );

      if (results && results.length > 0) {
        setSearchResults(results);
        setSuggestions(
          results.map((result) => ({
            placeId: result.placeId,
            description: `${result.name}, ${result.address}`, // ✅ ADDED: Required field
            mainText: result.name,
            secondaryText: result.address,
            types: result.types || [],
            structured: {
              mainText: result.name,
              secondaryText: result.address,
            },
          }))
        );
        setTimeout(measureInput, 80);
      } else {
        Alert.alert(
          "No Results",
          `No places found for "${query}" in Pasig area. Try a different search term or browse popular destinations.`,
          [
            { text: "Try Again" },
            {
              text: "Browse Popular",
              onPress: () => {
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

  const handleClearAndShowPopular = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);

    inputRef.current?.focus();

    setTimeout(() => {
      if (keyboardVisibleRef.current) {
        setShowPopularDestinations(true);
        setTimeout(measureInput, 80);
      } else {
        setTimeout(() => {
          measureInput();
          setShowPopularDestinations(true);
        }, 120);
      }
    }, 260);
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      if (keyboardVisibleRef.current) {
        setShowPopularDestinations(true);
        setTimeout(measureInput, 80);
      }
    }, 260);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      setShowPopularDestinations(false);
    }, 160);
  };

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

  // ✅ NEW: Dropdown content with "Choose on Map" option at the top
  const DropdownContent = (
    <>
      {/* ✅ NEW: "Choose on Map" option - ALWAYS FIRST when dropdown is open */}
      {(showSuggestions || showPopularDestinations) && onChooseOnMap && (
        <TouchableOpacity
          style={styles.chooseOnMapOption}
          onPress={() => {
            // Close dropdown and keyboard
            setShowSuggestions(false);
            setShowPopularDestinations(false);
            Keyboard.dismiss();

            // Trigger map selection mode
            onChooseOnMap();
          }}
          accessibilityLabel="Choose location on map"
          accessibilityHint="Tap to select a custom location by tapping anywhere on the map"
        >
          <View style={styles.chooseOnMapContent}>
            <View style={styles.chooseOnMapIcon}>
              <Ionicons name="location-sharp" size={24} color="#3B82F6" />
            </View>
            <View style={styles.chooseOnMapText}>
              <Text style={styles.chooseOnMapTitle}>Choose on map</Text>
              <Text style={styles.chooseOnMapSubtitle}>
                Tap anywhere to select location
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Existing suggestions list */}
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

      {/* Existing popular destinations list */}
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

  // ✅ NEW: "Choose on Map" option styles
  chooseOnMapOption: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#F0F9FF",
  },
  chooseOnMapContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  chooseOnMapIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  chooseOnMapText: {
    flex: 1,
  },
  chooseOnMapTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E40AF",
  },
  chooseOnMapSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

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
