// ============================================================================
//  LAYOUT OPTIMIZATION ENGINE  (Generator + Critic loop)
//  For every design strategy it GENERATES many candidate layouts (varying the
//  adjacency-chain seed + slice ratios), the CRITIC (quality engine) scores
//  each, weak candidates are REJECTED below a threshold, and only the best
//  per strategy survive. Finally returns a DIVERSE top-N across strategies.
// ============================================================================
import type { RoomProgram, AdjacencyMatrix, DesignStrategy, LayoutCandidate } from './types';
import { buildGeometry } from './geometryEngine';
import { evaluate, auditPlan } from './qualityEngine';
import { analyzeVastu } from '../vastuEngine';
import { validateLayout } from './validationEngine';
import { runPlanningDecisions } from './planningEngine';

const CANDIDATES_PER_STRATEGY = 28;   // generator breadth (≈ 250 total for 9 strategies)
const ACCEPT_THRESHOLD = 58;          // critic reject line

function buildableArea(program: RoomProgram): number {
  const { width, depth, setbacks } = program.buildable;
  return (width - setbacks.left - setbacks.right) * (depth - setbacks.front - setbacks.rear);
}

export interface OptimizeResult {
  candidates: LayoutCandidate[];
  generated: number;
  accepted: number;
}

export function optimizeDetailed(
  program: RoomProgram,
  adjacency: AdjacencyMatrix,
  strategies: DesignStrategy[],
  topN = 3,
): OptimizeResult {
  const ba = buildableArea(program);
  const { width, depth } = program.buildable;
  let generated = 0, accepted = 0;
  const winners: LayoutCandidate[] = [];

  for (const strategy of strategies) {
    let best: LayoutCandidate | null = null;
    let bestRejected: LayoutCandidate | null = null;

    for (let k = 0; k < CANDIDATES_PER_STRATEGY; k++) {
      generated++;
      const seed = strategy.seed * 1000 + k * 7 + 13;
      const variation = (((k % 7) - 3) / 45);   // -0.066 .. 0.066 slice jitter
      
      const decisions = runPlanningDecisions(program, strategy, program.global.facing, seed);
      const rooms = buildGeometry(program, strategy, adjacency, variation, seed, decisions);
      const vastu = analyzeVastu(rooms, width, depth).score;
      const q = evaluate(rooms, adjacency, ba, vastu, { threshold: ACCEPT_THRESHOLD, vastuEmphasis: strategy.features.vastu });

      const expectedBedrooms = program.rooms.filter(r => r.type === 'bedroom' && r.zone !== 'outdoor').length;
      const expectedFloors = program.floors;
      const valReport = validateLayout(rooms, expectedBedrooms, expectedFloors);

      // Validation errors deduct from score but do NOT hard-reject — the quality
      // engine threshold (58) is the only gate. Hard errors appear in the audit.
      if (!valReport.valid) {
        const errorPenalty = Math.min(20, valReport.errors.length * 2);
        q.total = Math.max(0, q.total - errorPenalty);
        q.accept = q.total >= ACCEPT_THRESHOLD;
      }

      const cand: LayoutCandidate = {
        strategyId: strategy.id, strategyName: strategy.name, tagline: strategy.tagline,
        description: strategy.description, costMultiplier: strategy.costMultiplier,
        rooms, scores: q, seedName: `${strategy.id}_v${k + 1}`,
        planningDecisions: decisions,
      };

      if (q.accept) {
        accepted++;
        if (!best || q.total > best.scores.total) best = cand;
      } else if (!bestRejected || q.total > bestRejected.scores.total) {
        bestRejected = cand;
      }
    }
    // keep the best accepted candidate; if none passed the critic, keep the least-bad
    if (best || bestRejected) winners.push((best || bestRejected)!);
  }

  // Rank strategies by their best layout, return a diverse set (one per strategy)
  winners.sort((a, b) => b.scores.total - a.scores.total);
  const seen = new Set<string>();
  const diverse: LayoutCandidate[] = [];
  for (const c of winners) {
    if (seen.has(c.strategyId)) continue;
    seen.add(c.strategyId); diverse.push(c);
    if (diverse.length >= topN) break;
  }

  const finalCandidates = diverse.length ? diverse : winners.slice(0, topN);

  for (const cand of finalCandidates) {
    const expectedBedrooms = program.rooms.filter(r => r.type === 'bedroom' && r.zone !== 'outdoor').length;
    const expectedFloors = program.floors;
    cand.auditorReport = auditPlan(
      cand.rooms,
      expectedBedrooms,
      expectedFloors,
      cand.strategyId,
      program.global.facing
    );
  }

  return { candidates: finalCandidates, generated, accepted };
}

/** Back-compat: returns just the ranked candidates. */
export function optimize(
  program: RoomProgram,
  adjacency: AdjacencyMatrix,
  strategies: DesignStrategy[],
  topN = 3,
): LayoutCandidate[] {
  return optimizeDetailed(program, adjacency, strategies, topN).candidates;
}
