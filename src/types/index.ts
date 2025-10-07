// src/types/index.ts - COMPLETELY FIXED - All exports added
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

  // ENHANCED: Validation system fields
  upvotes?: number;
  downvotes?: number;
  status?: "pending" | "verified" | "resolved" | "false_report";
  reportsCount?: number; // Total engagement count

  // NEW: Admin badge support (safe additions)
  adminReported?: boolean; // Flag indicating this was reported by an admin
  adminRole?: "super_admin" | "lgu_admin" | "field_admin"; // Which type of admin reported it
  adminEmail?: string; // Admin identifier for audit purposes

  // ENHANCED: Auto-verification support
  autoVerified?: boolean; // True if admin report bypassed community validation

  // Media and metadata
  photoBase64?: string;

  // Admin fields (optional)
  reviewedBy?: string;
  reviewedAt?: Date;
  adminNotes?: string;
  confidenceScore?: number;
  lastVerifiedAt?: Date;
}

// Philippine street reality obstacle types
export type ObstacleType =
  | "vendor_blocking"
  | "parked_vehicles"
  | "stairs_no_ramp"
  | "narrow_passage"
  | "broken_infrastructure" // ✅ NEW
  | "flooding"
  | "construction"
  | "electrical_post"
  | "debris" // ✅ NEW
  | "no_sidewalk"
  | "steep_slope"
  | "other";

// Enhanced User Mobility Profile for Option B implementation
export interface UserMobilityProfile {
  id: string;
  type: "wheelchair" | "walker" | "cane" | "crutches" | "none";

  // Physical requirements (calculated from device type + user preferences)
  maxRampSlope: number; // Maximum ramp slope tolerable (degrees)
  minPathWidth: number; // Minimum path width needed (cm)
  avoidStairs: boolean;
  avoidCrowds: boolean;

  // Filipino context preferences
  preferShade: boolean; // Important in Philippine heat
  maxWalkingDistance?: number; // meters before rest needed

  // Profile metadata
  createdAt?: Date;
  lastUpdated?: Date;
}

export interface AccessibilityScore {
  traversability: number; // 0-100: Can user physically pass?
  safety: number; // 0-100: How safe from traffic/hazards?
  comfort: number; // 0-100: Shade, smooth surface, etc.
  overall: number; // Weighted AHP score
  grade: "A" | "B" | "C" | "D" | "F"; // Easy to understand grade
  userSpecificAdjustment: number; // Additional penalty/bonus for user type
  confidence?: RouteConfidence; // Data quality and reliability metrics
}

export interface RouteConfidence {
  overall: number; // 0-100: Overall confidence percentage
  dataFreshness: "high" | "medium" | "low"; // Based on obstacle report age
  communityValidation: number; // Number of users who validated this data
  verificationStatus: "verified" | "estimated" | "unverified";
  lastVerified: Date | null; // When this route data was last confirmed
  confidenceFactors: {
    obstacleAge: number; // Average age of obstacle reports in days
    validationCount: number; // Total upvotes/downvotes for obstacles
    verifiedObstacles: number; // Number of verified vs unverified obstacles
    routePopularity: number; // How often this route is used/reported
  };
}

export interface RouteFeedback {
  id: string;
  routeId: string; // Identifier for the route taken
  userId: string;
  userProfile: UserMobilityProfile;
  completedAt: Date;

  // Core accessibility ratings (1-5 scale)
  traversabilityRating: number; // How easily user could navigate
  safetyRating: number; // How safe user felt from traffic/hazards
  comfortRating: number; // Overall comfort level

  // Additional feedback
  overallExperience:
    | "excellent"
    | "good"
    | "acceptable"
    | "difficult"
    | "impossible";
  wouldRecommend: boolean;
  comments?: string;

  // Route-specific data
  routeStartLocation: UserLocation;
  routeEndLocation: UserLocation;
  actualDuration: number; // minutes taken
  estimatedDuration: number; // minutes predicted
  routeType: "fastest" | "accessible";

  // Obstacles encountered
  obstaclesEncountered: EncounteredObstacle[];
  newObstaclesReported: AccessibilityObstacle[];

  // Verification data
  confidenceContribution: number; // How much this feedback should boost confidence
  deviceSpecificInsights: DeviceSpecificFeedback;
}

export interface EncounteredObstacle {
  obstacleId: string;
  actualSeverity: "low" | "medium" | "high" | "blocking";
  reportedSeverity: "low" | "medium" | "high" | "blocking";
  userImpact: "no_impact" | "minor_delay" | "major_detour" | "route_blocked";
  accuracyRating: number; // 1-5: how accurate was the original report
  stillPresent: boolean;
}

export interface DeviceSpecificFeedback {
  deviceType: "wheelchair" | "walker" | "cane" | "crutches" | "none";
  specificChallenges: string[]; // Device-specific issues encountered
  adaptationsUsed: string[]; // How user adapted to obstacles
  recommendedImprovements: string[]; // Suggestions for this device type
}

export interface RouteJourney {
  id: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "active" | "completed" | "abandoned";

  // Route data
  selectedRoute: {
    routeId: string;
    routeType: "fastest" | "accessible";
    estimatedDuration: number;
    accessibilityScore: AccessibilityScore;
  };

  // Journey tracking
  startLocation: UserLocation;
  destinationLocation: UserLocation;
  currentLocation?: UserLocation;

  // Completion detection
  distanceFromDestination: number; // meters
  completionTriggered: boolean;
  feedbackSubmitted: boolean;
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

  // Route personalization info
  personalizedFor: {
    deviceType: UserMobilityProfile["type"];
    avoidedObstacles: ObstacleType[];
    routeReasons: string[]; // ["Avoided stairs at City Hall", "Used shaded path on Ortigas"]
  };
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

  // Enhanced POI info for user profiles
  accessibilityFeatures?: {
    hasRamp: boolean;
    hasElevator: boolean;
    doorWidth: number; // cm
    accessibleParking: boolean;
    accessibleRestroom: boolean;
  };
}

// Screen navigation types - Enhanced for user profiles
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
  Profile: undefined; // New profile management screen
  Settings: undefined;
};

// Enhanced route interface for personalized navigation
export interface PersonalizedRoute {
  route: WaispathRoute;
  alternatives: WaispathRoute[]; // Alternative routes for comparison
  personalizedInsights: {
    whyThisRoute: string; // "This route avoids stairs and has shade"
    timeComparison: string; // "2 minutes longer than fastest route, but fully accessible"
    accessibilityScore: number; // 0-100 overall accessibility for this user
  };
}

// User preferences for UI/UX
export interface UserPreferences {
  language: "en" | "fil"; // English or Filipino
  notifications: {
    obstacleAlerts: boolean;
    routeUpdates: boolean;
    communityReports: boolean;
  };
  display: {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
  };
}

// Community reporting types
export interface ObstacleReport {
  id: string;
  location: UserLocation;
  obstacleType: ObstacleType;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
  photoUri?: string;
  reportedBy: {
    userId: string;
    deviceType: UserMobilityProfile["type"];
  };
  reportedAt: Date;
  status: "pending" | "verified" | "resolved" | "false_report";
  upvotes: number;
  downvotes: number;
}

// NEW AHP-specific interfaces that extend your existing types
export interface CommunityObstacle extends AccessibilityObstacle {
  // Uses your existing AccessibilityObstacle as base
  // Adds any additional fields if needed
}

export interface SidewalkData {
  obstacles: CommunityObstacle[]; // From existing Firebase system
  estimatedWidth: number; // Meters (default: 1.5m)
  surfaceCondition: "smooth" | "rough" | "broken";
  slope: number; // Degrees (default: 0)
  lighting: "good" | "poor" | "none";
  shadeLevel: "covered" | "partial" | "none";
  trafficLevel: "high" | "medium" | "low";
  hasRamp: boolean; // Accessibility feature
  hasHandrails: boolean; // Additional support
}

export interface AHPCriteria {
  traversability: number; // 0.7 - Can PWD physically pass through?
  safety: number; // 0.2 - Safe from traffic/hazards?
  comfort: number; // 0.1 - Shade, smooth surface, comfort factors?
}

// Enhanced obstacle with AHP analysis
export interface EnhancedObstacleReport extends CommunityObstacle {
  accessibilityImpact: AccessibilityScore;
  userSpecificRating: number; // 1-5 stars for this user type
  affectedUserTypes: string[]; // Which PWD types are most affected
  priorityLevel: "critical" | "high" | "medium" | "low";
  estimatedDetourTime: number; // Additional minutes needed to avoid
}

export interface RouteAccessibilityAnalysis {
  routeId: string;
  segments: RouteSegmentScore[];
  overallAccessibilityScore: AccessibilityScore;
  userProfile: UserMobilityProfile;
  totalDistance: number;
  estimatedDuration: number;
  obstacleCount: number;
  warnings: AccessibilityWarning[];
  recommendations: string[];
  analyzedAt: Date;
}

export interface RouteSegmentScore {
  segmentIndex: number;
  startLocation: { latitude: number; longitude: number };
  endLocation: { latitude: number; longitude: number };
  distance: number; // meters
  obstacles: CommunityObstacle[];
  accessibilityScore: AccessibilityScore;
  estimatedSidewalkData: SidewalkData;
  confidence: number; // 0-1, how confident we are in this assessment
}

export interface AccessibilityWarning {
  type: "blocking" | "difficult" | "detour_needed" | "time_sensitive";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  location: { latitude: number; longitude: number };
  affectedUserTypes: string[];
  suggestedAction: string;
}
