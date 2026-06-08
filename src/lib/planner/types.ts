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

export interface LayoutCandidate {
  strategyId: string;
  strategyName: string;
  tagline: string;
  description: string;
  costMultiplier: number;
  rooms: RoomLayout[];
  scores: CandidateScores;
}

export type { RoomLayout, PlotSettings };
