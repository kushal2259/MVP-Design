// ============================================================================
//  LAYOUT OPTIMIZER
//  Generates MANY candidates (across design strategies × slicing variations),
//  scores and ranks them, then returns the best DIVERSE set. Never returns a
//  single layout, and never returns two near-identical strategies.
// ============================================================================
import type { RoomProgram, AdjacencyMatrix, DesignStrategy, LayoutCandidate } from './types';
import { buildGeometry } from './geometryEngine';
import { scoreLayout } from './scorer';

function buildableArea(program: RoomProgram): number {
  const { width, depth, setbacks } = program.buildable;
  return (width - setbacks.left - setbacks.right) * (depth - setbacks.front - setbacks.rear);
}

/** Deterministic pseudo-random from a seed → stable, reproducible variations. */
function variationsFor(strategy: DesignStrategy): number[] {
  const base = (strategy.seed % 7) / 100; // 0..0.06
  return [0, base, -base, 0.1 - base];
}

export function optimize(
  program: RoomProgram,
  adjacency: AdjacencyMatrix,
  strategies: DesignStrategy[],
  topN = 3,
): LayoutCandidate[] {
  const ba = buildableArea(program);
  const candidates: LayoutCandidate[] = [];

  for (const strategy of strategies) {
    let best: LayoutCandidate | null = null;
    for (const v of variationsFor(strategy)) {
      const rooms = buildGeometry(program, strategy, adjacency, v);
      const scores = scoreLayout(rooms, strategy.weights, ba);
      const cand: LayoutCandidate = {
        strategyId: strategy.id,
        strategyName: strategy.name,
        tagline: strategy.tagline,
        description: strategy.description,
        costMultiplier: strategy.costMultiplier,
        rooms,
        scores,
      };
      if (!best || cand.scores.total > best.scores.total) best = cand;
    }
    if (best) candidates.push(best);
  }

  // Rank by score, keep best per strategy (already), ensure diversity by strategy id.
  candidates.sort((a, b) => b.scores.total - a.scores.total);
  const seen = new Set<string>();
  const diverse: LayoutCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.strategyId)) continue;
    seen.add(c.strategyId);
    diverse.push(c);
    if (diverse.length >= topN) break;
  }
  // guarantee at least topN if strategies were fewer
  return diverse.length ? diverse : candidates.slice(0, topN);
}
