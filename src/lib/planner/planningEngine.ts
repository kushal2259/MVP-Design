// ============================================================================
//  ARCHITECTURAL PLANNING + ZONING ENGINE
//  Thinks like an architect BEFORE geometry exists.
//
//  1. ZONING: every room is bucketed into a macro-zone
//        public  → entrance, living, dining, balcony
//        service → kitchen, toilets, utility, store
//        circ    → lobby, corridor, staircase
//        private → bedrooms, study
//  2. SEQUENCING: rooms are ordered as an ADJACENCY CHAIN within and across
//     zones (greedy nearest-neighbour on the adjacency graph), so that when the
//     geometry engine slices the footprint, graph-adjacent rooms end up sharing
//     a wall. This is what fixes "kitchen disconnected from dining", scattered
//     bedrooms, and weak zoning — it is real planning logic, not a template.
// ============================================================================
import type { RoomSpec, AdjacencyMatrix, DesignStrategy } from './types';

export type MacroZone = 'public' | 'service' | 'circ' | 'private';

export function macroOf(r: RoomSpec): MacroZone {
  if (r.type === 'bedroom') return 'private';
  if (r.type === 'kitchen' || r.type === 'toilet') return 'service';
  if (r.type === 'corridor' || r.type === 'staircase' || r.type === 'lobby') return 'circ';
  return 'public'; // living, dining, balcony
}

const TAG_TO_MACRO: Record<string, MacroZone> = {
  public: 'public', service: 'service', utility: 'service',
  circulation: 'circ', private: 'private', outdoor: 'public',
};

/** Macro-zone sequence (entrance → deep) implied by the strategy + facing. */
export function macroSequence(strategy: DesignStrategy): MacroZone[] {
  const seq: MacroZone[] = [];
  for (const z of strategy.zoneOrder) {
    const m = TAG_TO_MACRO[z];
    if (m && !seq.includes(m)) seq.push(m);
  }
  (['public', 'service', 'circ', 'private'] as MacroZone[]).forEach(m => { if (!seq.includes(m)) seq.push(m); });
  return seq;
}

/** Deterministic seeded RNG (mulberry32) for reproducible candidate variation. */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Produce an adjacency-respecting linear ordering of the rooms.
 * Because the slicer places consecutive rooms next to each other, a good
 * adjacency chain ⇒ good spatial adjacency.
 *
 * @param rng inject variation so the optimizer can explore many candidates.
 */
export function adjacencyOrder(
  rooms: RoomSpec[],
  adjacency: AdjacencyMatrix,
  strategy: DesignStrategy,
  rng: () => number,
): RoomSpec[] {
  const aff = (a: RoomSpec, b: RoomSpec) => adjacency[a.id]?.[b.id] ?? 0;
  // macro phase index (lower = placed first / toward entrance)
  const phase: Record<MacroZone, number> = { public: 0, service: 1, circ: 2, private: 3 };
  const seq = macroSequence(strategy);
  seq.forEach((m, i) => { phase[m] = i; });

  const out: RoomSpec[] = [];
  const used = new Set<string>();

  // start at the entrance anchor: the highest-priority public room (living/lobby)
  const start = [...rooms].sort((a, b) => {
    const pa = phase[macroOf(a)], pb = phase[macroOf(b)];
    return pa - pb || b.priority - a.priority || b.targetArea - a.targetArea;
  })[0];
  out.push(start); used.add(start.id);

  // greedy Hamiltonian-ish path: always step to the unplaced room with the best
  // blend of (graph affinity to the last room) + (staying in/advancing zone phase).
  while (out.length < rooms.length) {
    const last = out[out.length - 1];
    const lastPhase = phase[macroOf(last)];
    const avail = rooms.filter(r => !used.has(r.id));
    const scored = avail.map(r => {
      const a = aff(last, r);
      const ph = phase[macroOf(r)];
      const sameZone = macroOf(r) === macroOf(last) ? 0.5 : 0;
      // gently prefer not jumping backwards across zones (keeps zones contiguous)
      const phasePenalty = ph < lastPhase ? (lastPhase - ph) * 0.35 : 0;
      const forwardBonus = ph === lastPhase + 1 ? 0.25 : 0;
      return { r, s: a * 4 + sameZone + forwardBonus - phasePenalty + r.priority * 0.015 + rng() * 0.2 };
    }).sort((x, y) => y.s - x.s);
    // mostly take the best; sometimes the runner-up → candidate diversity
    const pick = (scored.length > 1 && rng() < 0.2) ? scored[1].r : scored[0].r;
    out.push(pick); used.add(pick.id);
  }
  return out;
}
