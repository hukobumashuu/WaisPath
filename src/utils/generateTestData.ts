// src/utils/generateTestData.ts
// Test Data Generator for WAISPATH - Creates realistic obstacles around Pasig

import { firebaseServices } from "../services/firebase";
import { UserLocation, ObstacleType, AccessibilityObstacle } from "../types";

// Pasig City coordinates and landmarks
const PASIG_LANDMARKS = [
  { name: "Pasig City Hall", lat: 14.5764, lng: 121.0851 },
  { name: "The Podium", lat: 14.5657, lng: 121.0644 },
  { name: "Rizal Medical Center", lat: 14.5739, lng: 121.0892 },
  { name: "Pasig General Hospital", lat: 14.5858, lng: 121.0907 },
  { name: "SM Megamall", lat: 14.5856, lng: 121.0567 },
  { name: "Kapitolyo", lat: 14.5679, lng: 121.0644 },
  { name: "Marikina Bridge", lat: 14.5847, lng: 121.0947 },
  { name: "Pasig River", lat: 14.5741, lng: 121.0794 },
  { name: "Ortigas Center", lat: 14.5839, lng: 121.0583 },
  { name: "Shaw Boulevard", lat: 14.5781, lng: 121.0639 },
];

// Filipino obstacle descriptions with different validation states
const OBSTACLE_TEMPLATES = [
  {
    type: "vendor_blocking" as ObstacleType,
    descriptions: [
      "May nagtitindang pagkain sa bangketa",
      "Sari-sari store nakaharang sa daan",
      "Vendor cart na nakahirang sa wheelchair path",
      "Nagtitindang gulay sa sidewalk",
    ],
    severities: ["medium", "high"] as const,
  },
  {
    type: "parked_vehicles" as ObstacleType,
    descriptions: [
      "Motor nakaharang sa sidewalk",
      "Kotse nakapark sa wheelchair ramp",
      "Jeep nakatigil sa bangketa",
      "Tricycle na nakahirang sa daan",
    ],
    severities: ["high", "blocking"] as const,
  },
  {
    type: "broken_pavement" as ObstacleType,
    descriptions: [
      "Malaking butas sa bangketa",
      "Sirang semento sa daan",
      "Uneven na sahig, delikado sa wheelchair",
      "Loose tiles sa sidewalk",
    ],
    severities: ["medium", "high", "blocking"] as const,
  },
  {
    type: "flooding" as ObstacleType,
    descriptions: [
      "Baha sa daan tuwing umuulan",
      "Standing water sa sidewalk",
      "Tubig hindi tumutulo sa drainage",
      "Madulas na daan dahil sa baha",
    ],
    severities: ["medium", "high"] as const,
  },
  {
    type: "stairs_no_ramp" as ObstacleType,
    descriptions: [
      "Walang ramp sa entrance ng building",
      "Stairs lang, walang alternative access",
      "Mataas na steps, hindi accessible",
      "Kailangan ng ramp para sa wheelchair",
    ],
    severities: ["blocking"] as const,
  },
  {
    type: "construction" as ObstacleType,
    descriptions: [
      "May construction na nakaharang",
      "Road works, walang alternative path",
      "Gumawa ng daan, temporary barrier",
      "Construction materials sa sidewalk",
    ],
    severities: ["high", "blocking"] as const,
  },
  {
    type: "narrow_passage" as ObstacleType,
    descriptions: [
      "Masyadong makitid para sa wheelchair",
      "Narrow path between posts",
      "Hindi kasyang wheelchair sa gitna",
      "Makitid na daanan dahil sa mga poste",
    ],
    severities: ["medium", "high"] as const,
  },
];

// FIXED: Use correct type values that match the interface
const generateValidationState = () => {
  const scenarios = [
    // Single report - unverified
    { upvotes: 0, downvotes: 0, reportsCount: 1, status: "pending" },
    // Community verified - confirmed
    { upvotes: 3, downvotes: 0, reportsCount: 4, status: "verified" },
    { upvotes: 2, downvotes: 1, reportsCount: 4, status: "verified" },
    // Disputed obstacles
    { upvotes: 1, downvotes: 2, reportsCount: 4, status: "pending" },
    { upvotes: 0, downvotes: 3, reportsCount: 4, status: "false_report" },
    // Admin resolved
    {
      upvotes: 0,
      downvotes: 0,
      reportsCount: 1,
      status: "resolved",
      verified: true,
    },
  ];

  return scenarios[Math.floor(Math.random() * scenarios.length)];
};

// Generate obstacles around a landmark with realistic distances
const generateObstaclesNearLandmark = (
  landmark: { name: string; lat: number; lng: number },
  count: number = 2
) => {
  const obstacles = [];

  for (let i = 0; i < count; i++) {
    // Generate coordinates within 200m of landmark
    const offsetLat = (Math.random() - 0.5) * 0.003; // ~150m
    const offsetLng = (Math.random() - 0.5) * 0.003;

    const template =
      OBSTACLE_TEMPLATES[Math.floor(Math.random() * OBSTACLE_TEMPLATES.length)];
    const description =
      template.descriptions[
        Math.floor(Math.random() * template.descriptions.length)
      ];
    const severity =
      template.severities[
        Math.floor(Math.random() * template.severities.length)
      ];
    const validationState = generateValidationState();

    // Generate realistic timestamps (last 30 days)
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const reportedAt = new Date();
    reportedAt.setDate(reportedAt.getDate() - daysAgo);
    reportedAt.setHours(reportedAt.getHours() - hoursAgo);

    // FIXED: Use valid timePattern values
    const timePatterns = [
      "permanent",
      "morning",
      "afternoon",
      "evening",
      "weekend",
    ] as const;
    const randomTimePattern =
      timePatterns[Math.floor(Math.random() * timePatterns.length)];

    obstacles.push({
      location: {
        latitude: landmark.lat + offsetLat,
        longitude: landmark.lng + offsetLng,
        accuracy: Math.floor(Math.random() * 20) + 5, // 5-25m accuracy
      },
      type: template.type,
      severity,
      description: `${description} (malapit sa ${landmark.name})`,
      timePattern: randomTimePattern, // FIXED: Valid time pattern
      reportedAt,
      ...validationState,
    });
  }

  return obstacles;
};

export async function generateTestData(): Promise<{
  success: boolean;
  message: string;
  obstaclesCreated: number;
}> {
  try {
    console.log("🚀 Starting test data generation...");

    const allObstacles = [];

    // Generate 2-3 obstacles near each landmark
    for (const landmark of PASIG_LANDMARKS) {
      const obstacleCount = Math.floor(Math.random() * 2) + 2; // 2-3 obstacles
      const landmarkObstacles = generateObstaclesNearLandmark(
        landmark,
        obstacleCount
      );
      allObstacles.push(...landmarkObstacles);
    }

    console.log(`📝 Generated ${allObstacles.length} test obstacles`);

    // Report obstacles to Firebase (or mock service)
    let successCount = 0;
    let failCount = 0;

    for (const obstacle of allObstacles) {
      try {
        await firebaseServices.obstacle.reportObstacle(obstacle);
        successCount++;

        // Add small delay to prevent overwhelming the service
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("❌ Failed to create obstacle:", error);
        failCount++;
      }
    }

    const message =
      `✅ Test data generation complete!\n\n` +
      `• ${successCount} obstacles created successfully\n` +
      `• ${failCount} obstacles failed to create\n` +
      `• Obstacles distributed around ${PASIG_LANDMARKS.length} Pasig landmarks\n` +
      `• Mix of validation states for testing\n\n` +
      `You can now test the validation system!`;

    console.log(message);

    return {
      success: true,
      message,
      obstaclesCreated: successCount,
    };
  } catch (error: any) {
    console.error("❌ Test data generation failed:", error);

    return {
      success: false,
      message: `Test data generation failed: ${error.message}`,
      obstaclesCreated: 0,
    };
  }
}

// Generate obstacles with specific validation states for testing
export async function generateValidationTestScenarios(): Promise<void> {
  console.log("🧪 Creating validation test scenarios...");

  const testScenarios = [
    {
      name: "Single Report - Needs Validation",
      location: { latitude: 14.5764, longitude: 121.0851, accuracy: 10 },
      type: "vendor_blocking" as ObstacleType,
      description:
        "TEST: Single report - nagtitindang pagkain (needs validation)",
      timePattern: "morning" as const, // FIXED: Valid time pattern
    },
    {
      name: "Community Verified - Confirmed",
      location: { latitude: 14.5667, longitude: 121.0654, accuracy: 8 },
      type: "parked_vehicles" as ObstacleType,
      description: "TEST: Community verified - motor nakaharang (3 confirms)",
      timePattern: "permanent" as const, // FIXED: Valid time pattern
    },
    {
      name: "Disputed Obstacle",
      location: { latitude: 14.5749, longitude: 121.0902, accuracy: 15 },
      type: "broken_pavement" as ObstacleType,
      description: "TEST: Disputed - butas sa bangketa (conflicting reports)",
      timePattern: "permanent" as const, // FIXED: Valid time pattern
    },
    {
      name: "Recently Cleared",
      location: { latitude: 14.5868, longitude: 121.0917, accuracy: 12 },
      type: "flooding" as ObstacleType,
      description: "TEST: Recently cleared - baha (0 confirms, 2 clears)",
      timePattern: "afternoon" as const, // FIXED: Valid time pattern
    },
  ];

  for (const scenario of testScenarios) {
    try {
      await firebaseServices.obstacle.reportObstacle({
        location: scenario.location,
        type: scenario.type,
        severity: "medium",
        description: scenario.description,
        timePattern: scenario.timePattern, // FIXED: Use valid time pattern
      });

      console.log(`✅ Created test scenario: ${scenario.name}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(
        `❌ Failed to create test scenario: ${scenario.name}`,
        error
      );
    }
  }
}

// Quick function to clear all test data (for development)
export async function clearTestData(): Promise<void> {
  console.log(
    "🧹 Note: This function would clear test data in a real Firebase setup"
  );
  console.log(
    "For now, manually delete collections in Firebase Console if needed"
  );
}

// Export helper for easy import in screens
export const testDataUtils = {
  generateTestData,
  generateValidationTestScenarios,
  clearTestData,
};
