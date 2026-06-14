// ============================================================================
//  PLANNER PIPELINE — shared types
//  Pipeline:  Prompt → RequirementParser → RuleEngine → ConstraintGenerator
//             → AdjacencyMatrix → LayoutOptimizer → GeometryEngine
//             → DrawingGenerator → Visualization
//
//  HARD RULE: the LLM only produces ParsedRequirements / intents. Everything
//  from RoomSpec onwards (areas, coordinates, walls, doors, windows) is
//  computed deterministically by the engine — never by the LLM.
// ============================================================================
import type { RoomLayout, PlotSettings } from '@/types';

export type RoomType = RoomLayout['type'];
export type ZoneTag = 'public' | 'private' | 'service' | 'circulation' | 'utility' | 'outdoor';

/** Output of the AI Requirement Parser (the only LLM-authored structure). */
export interface ParsedRequirements {
  plotArea: number;
  unit: 'sq_ft' | 'sq_yd' | 'sq_m';
  plotWidth: number;            // feet
  plotDepth: number;            // feet
  floors: number;
  bedrooms: number;
  bathrooms?: number;
  style: 'modern' | 'contemporary' | 'traditional' | 'luxury';
  budgetLakhs: number;
  location: string;
  kitchen: 'large' | 'compact' | 'open';
  livingRoom: 'large' | 'standard' | 'compact';
  balconyRequired: boolean;
  specialRooms: string[];       // e.g. ['pooja', 'study', 'store']
  priorities: string[];         // e.g. ['privacy', 'ventilation', 'vastu']
  vastu: boolean;
  facing: 'N' | 'E' | 'S' | 'W'; // plot/entrance facing direction
  raw: string;
}

/** Configurable architectural rule for a room category. */
export interface RoomRule {
  type: RoomType;
  label: string;
  minArea: number;              // sq ft
  maxArea: number;              // sq ft
  minWidth: number;             // ft (shortest side)
  preferredAspect: number;      // width / depth target (1 = square)
  needsExterior: boolean;       // must touch an outer wall (window)
  needsVentilation: boolean;
  zone: ZoneTag;
  privacyLevel: number;         // 0 (public) .. 1 (very private)
}

/** A single concrete room to be placed (post constraint generation). */
export interface RoomSpec {
  id: string;
  type: RoomType;
  name: string;
  minArea: number;
  maxArea: number;
  targetArea: number;
  minWidth: number;
  preferredAspect: number;
  needsExterior: boolean;
  needsVentilation: boolean;
  zone: ZoneTag;
  privacyLevel: number;
  floor: number;
  priority: number;             // higher = placed/sized first
  locked?: boolean;             // revision engine: keep geometry fixed
}

/** The full building program produced by the Constraint Generator. */
export interface RoomProgram {
  floors: number;
  rooms: RoomSpec[];            // all rooms across all floors
  buildable: { width: number; depth: number; setbacks: Setbacks };
  global: GlobalConstraints;
}

export interface Setbacks { front: number; rear: number; left: number; right: number; }

export interface GlobalConstraints {
  maxFar: number;               // floor-area-ratio cap
  minCorridorWidth: number;
  minStairWidth: number;
  targetFootprintSqft: number;  // per-floor built area target
  facing: 'N' | 'E' | 'S' | 'W';
}

/** Weighted adjacency graph between room *ids*. weight 0..1, negative = avoid. */
export type AdjacencyMatrix = Record<string, Record<string, number>>;

export interface DesignStrategy {
  id: string;
  name: string;
  tagline: string;
  description: string;
  weights: ScoreWeights;
  costMultiplier: number;
  features: {
    courtyard: boolean;
    openPlan: boolean;          // merge living+dining+kitchen visually
    extraBalconies: boolean;
    centralCirculation: boolean;
    vastu: boolean;
  };
  /** Ordering bias: how strongly to push each zone toward front/back. */
  zoneOrder: ZoneTag[];         // first => placed toward the entrance/front
  seed: number;
}

export interface ScoreWeights {
  ventilation: number;
  privacy: number;
  lighting: number;
  circulation: number;
  spaceUtilization: number;
  futureExpansion: number;
}

export interface CandidateScores {
  ventilation: number;
  privacy: number;
  lighting: number;
  circulation: number;
  spaceUtilization: number;
  futureExpansion: number;
  total: number;               // weighted 0..100
}

export interface QualityReport {
  adjacency: number;
  privacy: number;
  circulation: number;
  ventilation: number;
  lighting: number;
  spaceUtilization: number;
  structural: number;
  vastu: number;
  naturalLight: number;
  plumbing: number;
  accessibility: number;
  futureExpansion: number;
  costEfficiency: number;
  furnitureUsability: number;
  constructionPracticality: number;
  marketAppeal: number;
  aestheticBalance: number;
  preferenceMatch: number;
  total: number;
  totalScore: number;
  accept: boolean;
}

export type MacroZone = 'public' | 'semi_private' | 'private' | 'service' | 'circ';

export interface ZoneInfo {
  roomId: string;
  zone: MacroZone;
  privacyLevel: number;
}

export interface AdjacencyRelation {
  fromRoomId: string;
  toRoomId: string;
  type: 'must_connect' | 'preferred' | 'should_avoid';
  weight: number;
}

export interface CirculationDecisions {
  corridorWidth: number;
  staircaseReservingBox: { w: number; h: number };
  lobbyWidth: number;
}

export interface PrivacyDecisions {
  roomPrivacyClasses: Record<string, 'PUBLIC' | 'SEMI_PRIVATE' | 'PRIVATE' | 'SERVICE'>;
  requireBufferCorridor: string[];
}

export interface ServiceCoreDecisions {
  wetCoreCentroidFraction: { x: number; y: number };
  wetRoomIds: string[];
  maxDistanceFromCore: Record<string, number>;
}

export interface StructuralDecisions {
  preferredSpan: number;
  maxSpan: number;
  columnPositions: { x: number; y: number }[];
}

export interface NaturalLightDecisions {
  windowAreaFractions: Record<string, number>;
  requiresExternalWall: string[];
}

export interface SpaceDecisions {
  allocatedAreas: Record<string, number>;
}

export interface PlotDecisions {
  facing: 'N' | 'E' | 'S' | 'W';
  isCornerPlot: boolean;
  isIrregularPlot: boolean;
  setbacks: Setbacks;
  buildableRect: { w: number; h: number };
  entranceRoomId: string;
  entranceSide: 'front' | 'back' | 'left' | 'right';
}

export interface FutureExpansionDecisions {
  allowVerticalGrow: boolean;
  foundationLoadMultiplier: number;
  gridAlignRequired: boolean;
}

export interface PlanningDecisions {
  strategy: DesignStrategy;
  zones: ZoneInfo[];
  adjacencies: AdjacencyRelation[];
  circulation: CirculationDecisions;
  privacy: PrivacyDecisions;
  serviceCore: ServiceCoreDecisions;
  structural: StructuralDecisions;
  naturalLight: NaturalLightDecisions;
  spaceAllocation: SpaceDecisions;
  plotAdaptation: PlotDecisions;
  futureExpansion: FutureExpansionDecisions;
  orderedRooms: RoomSpec[];
}

export interface BuildabilityReport {
  structuralLoadSafety: 'excellent' | 'good' | 'fair' | 'poor';
  plumbingGrouping: 'optimal' | 'standard' | 'dispersed';
  constructionComplexity: 'low' | 'medium' | 'high';
  estimatedMaterialWastePercent: number;
  complianceWarnings: string[];
}

export interface PlanExplanation {
  conceptTagline: string;
  zoningJustification: string;
  circulationHighlights: string;
  ventilationStrengths: string;
  roomLayoutDetails: string;
}

export interface ComparativeRanking {
  rankedOptionIds: string[];
  rankings: {
    optionId: string;
    rank: number;
    score: number;
    bestFor: string;
    worseFor: string;
    summary: string;
  }[];
}

export interface AuditorReport {
  fatalIssues: string[];
  majorIssues: string[];
  minorIssues: string[];
  suggestions: string[];
  recommendations: string[];
  buildability: BuildabilityReport;
  explanation: PlanExplanation;
}

export interface LayoutCandidate {
  strategyId: string;
  strategyName: string;
  tagline: string;
  description: string;
  costMultiplier: number;
  rooms: RoomLayout[];
  scores: QualityReport;
  seedName?: string;
  planningDecisions?: PlanningDecisions;
  auditorReport?: AuditorReport;
}

export type { RoomLayout, PlotSettings };

