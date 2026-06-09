// ============================================================================
//  REVISION ENGINE
//  Partial regeneration. Interprets an edit *intent* (which the LLM may have
//  extracted) into constraint deltas, locks the requested rooms, re-normalises
//  only the unlocked rooms on the affected floor, and re-runs the geometry
//  with a stable strategy/seed so unchanged areas stay visually consistent.
//
//  The LLM, if used upstream, only produces RevisionIntent — never geometry.
// ============================================================================
import type { RoomProgram, AdjacencyMatrix, DesignStrategy, LayoutCandidate, RoomSpec, RoomLayout } from './types';
import { buildGeometry } from './geometryEngine';
import { evaluate } from './qualityEngine';
import { getStrategy } from './strategies';
import { clampArea } from './ruleEngine';
import { analyzeVastu } from '../vastuEngine';

export interface RevisionIntent {
  /** e.g. 'kitchen' or a specific room name fragment to target. */
  targetMatch: string;
  action: 'resize' | 'enlarge' | 'shrink' | 'set-area';
  factor?: number;             // 1.2 = +20%
  area?: number;               // explicit target sq ft for 'set-area'
  /** room types/names to keep fixed (locked). */
  lockMatches: string[];
  floor?: number;              // restrict to a floor (default: target's floor)
}

function matches(spec: RoomSpec, q: string): boolean {
  const s = q.toLowerCase();
  return spec.type.toLowerCase().includes(s) || spec.name.toLowerCase().includes(s);
}

function buildableArea(program: RoomProgram): number {
  const { width, depth, setbacks } = program.buildable;
  return (width - setbacks.left - setbacks.right) * (depth - setbacks.front - setbacks.rear);
}

/**
 * Apply a partial revision and re-optimise ONLY the affected floor.
 * Locked rooms keep their target area; the freed/needed area is redistributed
 * across the remaining unlocked rooms on that floor.
 */
export function applyRevision(
  program: RoomProgram,
  strategyId: string,
  adjacency: AdjacencyMatrix,
  intent: RevisionIntent,
): { program: RoomProgram; candidate: LayoutCandidate; summary: string } {
  const strategy: DesignStrategy = getStrategy(strategyId);

  // deep clone program
  const next: RoomProgram = JSON.parse(JSON.stringify(program));

  const target = next.rooms.find(r => matches(r, intent.targetMatch));
  if (!target) {
    // nothing matched — just rebuild unchanged
    const rooms = buildGeometry(next, strategy, adjacency, 0);
    return {
      program: next,
      candidate: makeCandidate(strategy, rooms, next, adjacency),
      summary: `No room matched "${intent.targetMatch}"; layout left unchanged.`,
    };
  }
  const floor = intent.floor ?? target.floor;

  // 1) Lock requested rooms (architect intent)
  next.rooms.forEach(r => {
    if (intent.lockMatches.some(m => matches(r, m))) r.locked = true;
  });

  // 2) Modify the target room's area
  const before = target.targetArea;
  let desired = before;
  if (intent.action === 'set-area' && intent.area) desired = intent.area;
  else if (intent.action === 'shrink') desired = before * (intent.factor ?? 0.8);
  else desired = before * (intent.factor ?? 1.2); // resize/enlarge default +20%
  target.targetArea = clampArea(target.type, desired);
  target.locked = true; // the edited room is now fixed at its new size

  // 3) Recalculate constraints: redistribute the delta across unlocked rooms
  const floorInterior = next.rooms.filter(r => r.floor === floor && r.zone !== 'outdoor');
  const lockedArea = floorInterior.filter(r => r.locked).reduce((s, r) => s + r.targetArea, 0);
  const footprint = next.global.targetFootprintSqft;
  const unlocked = floorInterior.filter(r => !r.locked);
  const unlockedSum = unlocked.reduce((s, r) => s + r.targetArea, 0);
  const remaining = Math.max(0, footprint - lockedArea);
  if (unlockedSum > 0 && remaining > 0) {
    const scale = remaining / unlockedSum;
    unlocked.forEach(r => { r.targetArea = clampArea(r.type, r.targetArea * scale); });
  }

  // 4) Re-run geometry for the whole building (stable seed → consistent look)
  const rooms = buildGeometry(next, strategy, adjacency, 0);
  const candidate = makeCandidate(strategy, rooms, next, adjacency);

  const pct = Math.round((target.targetArea / before - 1) * 100);
  const summary = `${target.name} ${pct >= 0 ? 'increased' : 'reduced'} by ${Math.abs(pct)}% to ${Math.round(target.targetArea)} sq ft; ` +
    `${intent.lockMatches.length ? `locked ${intent.lockMatches.join(', ')}; ` : ''}re-optimised floor ${floor}.`;

  return { program: next, candidate, summary };
}

function makeCandidate(strategy: DesignStrategy, rooms: RoomLayout[], program: RoomProgram, adjacency: AdjacencyMatrix): LayoutCandidate {
  const ba = buildableArea(program);
  const vastu = analyzeVastu(rooms, program.buildable.width, program.buildable.depth).score;
  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    tagline: strategy.tagline,
    description: strategy.description,
    costMultiplier: strategy.costMultiplier,
    rooms,
    scores: evaluate(rooms, adjacency, ba, vastu, { vastuEmphasis: strategy.features.vastu }),
  };
}
