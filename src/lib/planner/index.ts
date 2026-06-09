// ============================================================================
//  PLANNER ORCHESTRATOR
//  Wires the full deterministic pipeline:
//    ParsedRequirements → ConstraintGenerator → AdjacencyMatrix
//    → Strategy selection → LayoutOptimizer → (GeometryEngine inside)
//  Produces ranked LayoutCandidates and maps the top 3 to the app's
//  LayoutOption shape so the rest of the UI keeps working unchanged.
// ============================================================================
import type { LayoutOption, PlotSettings } from '@/types';
import type { ParsedRequirements, RoomProgram, AdjacencyMatrix, LayoutCandidate } from './types';
import { generateProgram } from './constraintGenerator';
import { generateAdjacencyMatrix } from './adjacency';
import { selectStrategies } from './strategies';
import { optimizeDetailed } from './optimizer';
import { applyOverrides, type CustomOverrideInput } from './geometryEngine';
import { fromPlotSettings } from './requirementParser';

export interface PlanResult {
  program: RoomProgram;
  adjacency: AdjacencyMatrix;
  candidates: LayoutCandidate[];
  options: LayoutOption[];
  generated: number;
  accepted: number;
}

const OPTION_IDS: LayoutOption['id'][] = ['option-a', 'option-b', 'option-c'];

export function candidatesToOptions(candidates: LayoutCandidate[]): LayoutOption[] {
  return candidates.slice(0, 3).map((c, i) => ({
    id: OPTION_IDS[i],
    name: c.strategyName,
    tagline: c.tagline,
    description: `${c.description}  ·  Seed ${c.seedName || c.strategyId}  ·  Score ${c.scores.total}/100 (adjacency ${c.scores.adjacency}, privacy ${c.scores.privacy}, circulation ${c.scores.circulation}, vent ${c.scores.ventilation}, vastu ${c.scores.vastu}).`,
    rooms: c.rooms,
    costMultiplier: c.costMultiplier,
  }));
}

/** Full pipeline from parsed (LLM-extracted) requirements. */
export function generatePlan(req: ParsedRequirements): PlanResult {
  const program = generateProgram(req);
  const adjacency = generateAdjacencyMatrix(program);
  // Explore broadly (more strategies → the critic picks the best diverse 3).
  const strategies = selectStrategies(req.priorities, req.vastu, 6);
  const { candidates, generated, accepted } = optimizeDetailed(program, adjacency, strategies, 3);
  return { program, adjacency, candidates, options: candidatesToOptions(candidates), generated, accepted };
}

/** Drop-in deterministic replacement for the legacy generateLayouts().
 *  Applies any chat/CAD customOverrides (doors/windows/renames) as a post-pass
 *  so Copilot edits actually appear on every option. */
export function generatePlanFromSettings(settings: PlotSettings): LayoutOption[] {
  const req = fromPlotSettings(settings);
  const options = generatePlan(req).options;
  const overrides = settings.customOverrides as CustomOverrideInput[] | undefined;
  if (overrides?.length) options.forEach(o => applyOverrides(o.rooms, overrides));
  return options;
}

export * from './types';
export { generateProgram } from './constraintGenerator';
export { generateAdjacencyMatrix } from './adjacency';
export { STRATEGIES, selectStrategies, getStrategy } from './strategies';
export { optimize } from './optimizer';
export { buildGeometry, applyOverrides, type CustomOverrideInput } from './geometryEngine';
export { scoreLayout } from './scorer';
export { parseRequirements, parseRequirementsLocal, fromPlotSettings } from './requirementParser';
export { getAllRoomRules, setRoomRule, getRoomRule } from './ruleEngine';
