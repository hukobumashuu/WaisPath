// src/components/RouteFeedbackModal.tsx
// Post-journey feedback modal for route accessibility evaluation

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteJourney, UserMobilityProfile, EncounteredObstacle } from '../types';
import { routeFeedbackService } from '../services/routeFeedbackService';

interface RouteFeedbackModalProps {
  visible: boolean;
  journey: RouteJourney | null;
  userProfile: UserMobilityProfile | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const RouteFeedbackModal: React.FC<RouteFeedbackModalProps> = ({
  visible,
  journey,
  userProfile,
  onClose,
  onSubmitted,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  // Rating states (1-5 scale)
  const [traversabilityRating, setTraversabilityRating] = useState(3);
  const [safetyRating, setSafetyRating] = useState(3);
  const [comfortRating, setComfortRating] = useState(3);

  // Overall experience
  const [overallExperience, setOverallExperience] = useState<
    "excellent" | "good" | "acceptable" | "difficult" | "impossible"
  >("good");
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [comments, setComments] = useState("");

  // Device-specific feedback
  const [specificChallenges, setSpecificChallenges] = useState<string[]>([]);
  const [adaptationsUsed, setAdaptationsUsed] = useState("");
  const [improvements, setImprovements] = useState("");

  if (!visible || !journey || !userProfile) {
    return null;
  }

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const deviceSpecificFeedback = {
        deviceType: userProfile.type,
        specificChallenges,
        adaptationsUsed: adaptationsUsed ? [adaptationsUsed] : [],
        recommendedImprovements: improvements ? [improvements] : [],
      };

      await routeFeedbackService.submitFeedback(
        traversabilityRating,
        safetyRating,
        comfortRating,
        overallExperience,
        wouldRecommend,
        comments,
        userProfile,
        [], // obstaclesEncountered - would be populated in full implementation
        deviceSpecificFeedback
      );

      Alert.alert(
        "Thank you!",
        "Your feedback helps improve route recommendations for the PWD community.",
        [{ text: "OK", onPress: onSubmitted }]
      );

    } catch (error) {
      console.error("Failed to submit feedback:", error);
      Alert.alert(
        "Submission Error", 
        "Failed to save feedback. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = (
    currentRating: number,
    onRatingChange: (rating: number) => void,
    label: string,
    description: string
  ) => (
    <View className="mb-6">
      <Text className="text-lg font-semibold text-gray-900 mb-1">{label}</Text>
      <Text className="text-sm text-gray-600 mb-3">{description}</Text>
      <View className="flex-row justify-between">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onRatingChange(star)}
            className="flex-1 items-center py-2"
          >
            <Ionicons
              name={star <= currentRating ? "star" : "star-outline"}
              size={32}
              color={star <= currentRating ? "#F59E0B" : "#D1D5DB"}
            />
            <Text className={`text-xs mt-1 ${
              star <= currentRating ? "text-yellow-600" : "text-gray-400"
            }`}>
              {star}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const deviceChallenges = {
    wheelchair: ["Curb accessibility", "Surface roughness", "Narrow passages", "Steep slopes"],
    walker: ["Step navigation", "Handrail availability", "Rest areas needed", "Surface stability"],
    crutches: ["Balance challenges", "Arm fatigue", "Slippery surfaces", "Distance too long"],
    cane: ["Ground detection", "Stability issues", "Poor lighting", "Tactile guidance needed"],
    none: ["Crowd density", "Walking pace", "Weather conditions", "Distance comfort"]
  };

  const currentChallenges = deviceChallenges[userProfile.type] || [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View 
          className="flex-row items-center justify-between p-4 border-b border-gray-200"
          style={{ paddingTop: insets.top + 16 }}
        >
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Route Feedback</Text>
            <Text className="text-sm text-gray-600">
              Help improve accessibility for {userProfile.type} users
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {/* Journey Summary */}
          <View className="bg-blue-50 rounded-xl p-4 mb-6">
            <Text className="text-lg font-semibold text-blue-900 mb-2">
              Journey Completed!
            </Text>
            <Text className="text-sm text-blue-700">
              Route: {journey.selectedRoute.routeType === "fastest" ? "Fastest" : "Most Accessible"}
            </Text>
            <Text className="text-sm text-blue-700">
              Duration: {journey.completedAt && journey.startedAt 
                ? Math.round((journey.completedAt.getTime() - journey.startedAt.getTime()) / (1000 * 60))
                : '?'} minutes
            </Text>
          </View>

          {/* Accessibility Ratings */}
          <Text className="text-xl font-bold text-gray-900 mb-4">Rate Your Experience</Text>

          {renderStarRating(
            traversabilityRating,
            setTraversabilityRating,
            "Traversability",
            "How easily could you navigate this route with your " + userProfile.type + "?"
          )}

          {renderStarRating(
            safetyRating,
            setSafetyRating,
            "Safety", 
            "How safe did you feel from traffic, hazards, and other dangers?"
          )}

          {renderStarRating(
            comfortRating,
            setComfortRating,
            "Comfort",
            "How comfortable was the route (surface quality, shade, rest areas)?"
          )}

          {/* Overall Experience */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Overall Experience</Text>
            <View className="space-y-2">
              {[
                { value: "excellent", label: "Excellent", color: "green" },
                { value: "good", label: "Good", color: "blue" },
                { value: "acceptable", label: "Acceptable", color: "yellow" },
                { value: "difficult", label: "Difficult", color: "orange" },
                { value: "impossible", label: "Impossible", color: "red" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setOverallExperience(option.value as any)}
                  className={`flex-row items-center p-3 rounded-lg border-2 ${
                    overallExperience === option.value
                      ? `border-${option.color}-500 bg-${option.color}-50`
                      : "border-gray-200"
                  }`}
                >
                  <View className={`w-4 h-4 rounded-full mr-3 ${
                    overallExperience === option.value 
                      ? `bg-${option.color}-500` 
                      : "bg-gray-300"
                  }`} />
                  <Text className={`font-medium ${
                    overallExperience === option.value 
                      ? `text-${option.color}-900` 
                      : "text-gray-700"
                  }`}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Would Recommend */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Would you recommend this route to other {userProfile.type} users?
            </Text>
            <View className="flex-row space-x-4">
              <TouchableOpacity
                onPress={() => setWouldRecommend(true)}
                className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border-2 ${
                  wouldRecommend ? "border-green-500 bg-green-50" : "border-gray-200"
                }`}
              >
                <Ionicons 
                  name="thumbs-up" 
                  size={20} 
                  color={wouldRecommend ? "#10B981" : "#6B7280"} 
                />
                <Text className={`ml-2 font-medium ${
                  wouldRecommend ? "text-green-900" : "text-gray-700"
                }`}>
                  Yes
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setWouldRecommend(false)}
                className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border-2 ${
                  !wouldRecommend ? "border-red-500 bg-red-50" : "border-gray-200"
                }`}
              >
                <Ionicons 
                  name="thumbs-down" 
                  size={20} 
                  color={!wouldRecommend ? "#EF4444" : "#6B7280"} 
                />
                <Text className={`ml-2 font-medium ${
                  !wouldRecommend ? "text-red-900" : "text-gray-700"
                }`}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Device-Specific Challenges */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              {userProfile.type.charAt(0).toUpperCase() + userProfile.type.slice(1)}-Specific Challenges
            </Text>
            <Text className="text-sm text-gray-600 mb-3">
              Select any challenges you encountered:
            </Text>
            <View className="flex-row flex-wrap">
              {currentChallenges.map((challenge) => (
                <TouchableOpacity
                  key={challenge}
                  onPress={() => {
                    if (specificChallenges.includes(challenge)) {
                      setSpecificChallenges(prev => prev.filter(c => c !== challenge));
                    } else {
                      setSpecificChallenges(prev => [...prev, challenge]);
                    }
                  }}
                  className={`mr-2 mb-2 px-3 py-2 rounded-full border ${
                    specificChallenges.includes(challenge)
                      ? "border-blue-500 bg-blue-100"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text className={`text-sm ${
                    specificChallenges.includes(challenge)
                      ? "text-blue-900"
                      : "text-gray-700"
                  }`}>
                    {challenge}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Additional Comments */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Additional Comments (Optional)
            </Text>
            <TextInput
              value={comments}
              onChangeText={setComments}
              placeholder="Share any additional insights about this route..."
              multiline
              numberOfLines={4}
              className="border border-gray-300 rounded-lg p-3 text-base"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* Improvements Suggestions */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Suggested Improvements
            </Text>
            <TextInput
              value={improvements}
              onChangeText={setImprovements}
              placeholder={`What would make this route better for ${userProfile.type} users?`}
              multiline
              numberOfLines={3}
              className="border border-gray-300 rounded-lg p-3 text-base"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View 
          className="p-4 border-t border-gray-200"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`py-4 rounded-xl flex-row items-center justify-center ${
              loading ? "bg-gray-400" : "bg-blue-500"
            }`}
          >
            {loading && <ActivityIndicator size="small" color="white" className="mr-2" />}
            <Text className="text-white font-semibold text-lg">
              {loading ? "Submitting..." : "Submit Feedback"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={onClose}
            className="py-3 mt-2"
          >
            <Text className="text-center text-gray-600">Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default RouteFeedbackModal;