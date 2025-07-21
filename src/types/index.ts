// WAISPATH Core Types - Philippine Context

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface AccessibilityObstacle {
  id: string;
  location: UserLocation;
  type: ObstacleType;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
  reportedBy: string;
  reportedAt: Date;
  verified: boolean;
  timePattern?: "permanent" | "morning" | "afternoon" | "evening" | "weekend";
}

// Philippine street reality obstacle types
export type ObstacleType =
  | "vendor_blocking" // Sari-sari store, food vendors
  | "parked_vehicles" // Motorcycles, cars on sidewalk
  | "construction" // Materials, ongoing work
  | "electrical_post" // Posts planted in walkway
  | "tree_roots" // Broken/raised sidewalk
  | "no_sidewalk" // Must walk on road
  | "flooding" // Rainy season issues
  | "stairs_no_ramp" // Accessibility barrier
  | "narrow_passage" // Less than wheelchair width
  | "broken_pavement" // Dangerous surface
  | "open_manhole" // Safety hazard
  | "other";

export interface UserMobilityProfile {
  id: string;
  type: "wheelchair" | "walker" | "cane" | "crutches" | "none";
  maxRampSlope: number; // Maximum ramp slope tolerable (degrees)
  minPathWidth: number; // Minimum path width needed (cm)
  avoidStairs: boolean;
  avoidCrowds: boolean;
  preferShade: boolean; // Important in Philippine heat
  maxWalkingDistance: number; // meters
}

export interface AccessibilityScore {
  traversability: number; // 0-100: Can user physically pass?
  safety: number; // 0-100: How safe from traffic/hazards?
  comfort: number; // 0-100: Shade, smooth surface, etc.
  overall: number; // Weighted AHP score
}

export interface RouteSegment {
  startPoint: UserLocation;
  endPoint: UserLocation;
  type: "sidewalk" | "road_shoulder" | "crossing" | "building_path";
  accessibilityScore: AccessibilityScore;
  obstacles: AccessibilityObstacle[];
  estimatedTime: number; // minutes
  notes?: string; // "Vendor usually here 8-10am"
}

export interface WaispathRoute {
  id: string;
  segments: RouteSegment[];
  totalDistance: number; // meters
  totalTime: number; // minutes
  overallScore: AccessibilityScore;
  generatedAt: Date;
  userProfile: UserMobilityProfile;
}

// AHP (Analytic Hierarchy Process) weights for Philippine context
export interface AHPWeights {
  traversability: number; // Most important (70%)
  safety: number; // Important (20%)
  comfort: number; // Nice to have (10%)
}

// Location types in Pasig City context
export interface PointOfInterest {
  id: string;
  name: string;
  location: UserLocation;
  type:
    | "government"
    | "hospital"
    | "mall"
    | "school"
    | "transport"
    | "business";
  accessibilityRating?: AccessibilityScore;
  verified: boolean;
}

// Screen navigation types
export type RootTabParamList = {
  Home: undefined;
  Navigate: {
    destination?: UserLocation;
    searchQuery?: string;
  };
  Report: {
    location?: UserLocation;
    obstacleType?: ObstacleType;
  };
};

// Simple "make it work" data structure for Month 1
export interface SimpleRoute {
  from: UserLocation;
  to: UserLocation;
  waypoints: UserLocation[];
  avoidAreas: UserLocation[]; // Known problem spots
  safetyNotes: string[];
}
