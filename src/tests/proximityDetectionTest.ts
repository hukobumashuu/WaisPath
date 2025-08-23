// src/tests/proximityDetectionTest.ts
// Quick test file to validate proximity detection service

import { proximityDetectionService } from "../services/proximityDetectionService";
import { UserLocation, UserMobilityProfile } from "../types";

// Test data for Pasig City
const testUserLocation: UserLocation = {
  latitude: 14.5764, // Near Pasig City Hall
  longitude: 121.0851,
  accuracy: 10,
};

const testUserProfile: UserMobilityProfile = {
  id: "test_user",
  type: "wheelchair",
  maxRampSlope: 5,
  minPathWidth: 90,
  avoidStairs: true,
  avoidCrowds: true,
  preferShade: true,
  maxWalkingDistance: 500,
};

// Simple test route (straight line from City Hall to nearby area)
const testRoute: UserLocation[] = [
  { latitude: 14.5764, longitude: 121.0851 }, // Start: City Hall
  { latitude: 14.577, longitude: 121.086 }, // Middle point
  { latitude: 14.578, longitude: 121.087 }, // End point
];

/**
 * Test proximity detection with sample data
 */
export async function testProximityDetection(): Promise<void> {
  console.log("🧪 Starting Proximity Detection Test...");
  console.log("📍 Test Location:", testUserLocation);
  console.log("👤 User Profile:", testUserProfile.type);
  console.log("🛣️ Route points:", testRoute.length);

  try {
    // Test the proximity detection service
    const proximityAlerts =
      await proximityDetectionService.detectObstaclesAhead(
        testUserLocation,
        testRoute,
        testUserProfile
      );

    console.log("\n✅ Proximity Detection Results:");
    console.log(`🚨 Found ${proximityAlerts.length} proximity alerts`);

    if (proximityAlerts.length > 0) {
      proximityAlerts.forEach((alert, index) => {
        console.log(`\n🚨 Alert ${index + 1}:`);
        console.log(`   Type: ${alert.obstacle.type}`);
        console.log(`   Severity: ${alert.severity}`);
        console.log(`   Distance: ${alert.distance}m`);
        console.log(`   Time to encounter: ${alert.timeToEncounter}s`);
        console.log(`   Urgency: ${alert.urgency}/100`);
        console.log(`   Confidence: ${alert.confidence}`);
        console.log(`   Description: ${alert.obstacle.description}`);
      });
    } else {
      console.log("✅ No obstacles detected on route - clear path!");
    }

    // Test configuration updates
    console.log("\n🔧 Testing configuration updates...");
    const originalConfig = proximityDetectionService.getConfig();
    console.log("📊 Original config:", originalConfig);

    // Update detection radius
    proximityDetectionService.updateConfig({
      detectionRadius: 150,
      maxAlerts: 5,
    });

    const updatedConfig = proximityDetectionService.getConfig();
    console.log("📊 Updated config:", updatedConfig);

    console.log("\n🎉 Proximity Detection Test Completed Successfully!");
  } catch (error) {
    console.error("❌ Proximity Detection Test Failed:", error);
    throw error;
  }
}

/**
 * Test Firebase connection specifically
 */
export async function testFirebaseConnection(): Promise<void> {
  console.log("🔥 Testing Firebase Connection...");

  try {
    // Import firebase service directly
    const { firebaseServices } = await import("../services/firebase");

    // Test obstacle query
    const obstacles = await firebaseServices.obstacle.getObstaclesInArea(
      testUserLocation.latitude,
      testUserLocation.longitude,
      0.5 // 500m radius
    );

    console.log(`✅ Firebase connected - found ${obstacles.length} obstacles`);

    if (obstacles.length > 0) {
      console.log("📋 Sample obstacles:");
      obstacles.slice(0, 3).forEach((obstacle, index) => {
        console.log(`   ${index + 1}. ${obstacle.type} - ${obstacle.severity}`);
      });
    }
  } catch (error) {
    console.error("❌ Firebase connection failed:", error);
    throw error;
  }
}

/**
 * Run all tests
 */
export async function runAllProximityTests(): Promise<void> {
  console.log("🧪 WAISPATH Proximity Detection Test Suite");
  console.log("=".repeat(50));

  try {
    // Test 1: Firebase connection
    await testFirebaseConnection();
    console.log("");

    // Test 2: Proximity detection algorithm
    await testProximityDetection();

    console.log(
      "\n🎉 All tests passed! Proximity detection is ready for integration."
    );
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    console.log("\n🔧 Next steps:");
    console.log("1. Check Firebase configuration in .env");
    console.log("2. Verify types are properly imported");
    console.log("3. Test Firebase connection manually");
  }
}
