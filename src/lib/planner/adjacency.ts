// ============================================================================
//  ADJACENCY MATRIX GENERATOR
//  Encodes desired spatial relationships between rooms (stored separately so
//  the optimizer / geometry engine can consume them). Weights: 1 = must be
//  adjacent, 0.5 = nice to be near, negative = keep apart.
// ============================================================================
import type { RoomProgram, RoomSpec, AdjacencyMatrix, RoomType } from './types';

// Relationship preferences expressed at the *type* level.
const TYPE_AFFINITY: Array<[RoomType, RoomType, number]> = [
  ['kitchen', 'dining', 1.0],
  ['dining', 'living', 0.9],
  ['living', 'lobby', 0.8],
  ['lobby', 'staircase', 0.7],
  ['corridor', 'bedroom', 0.9],
  ['corridor', 'staircase', 0.6],
  ['living', 'balcony', 0.7],
  ['bedroom', 'balcony', 0.5],
  ['bedroom', 'toilet', 0.8],
  ['kitchen', 'living', -0.3],   // keep cooking smells away from formal living
  ['toilet', 'kitchen', -0.6],
  ['toilet', 'dining', -0.7],
  ['parking', 'lobby', 0.4],
];

function affinity(a: RoomType, b: RoomType): number {
  for (const [x, y, w] of TYPE_AFFINITY) {
    if ((a === x && b === y) || (a === y && b === x)) return w;
  }
  return 0;
}

/** Pair each bedroom with its own attached toilet (hard adjacency). */
function attachBedroomBaths(rooms: RoomSpec[], floor: number, m: AdjacencyMatrix) {
  const beds = rooms.filter(r => r.floor === floor && r.type === 'bedroom');
  const baths = rooms.filter(r => r.floor === floor && r.type === 'toilet');
  beds.forEach((bed, i) => {
    const bath = baths[i];
    if (bath) {
      m[bed.id][bath.id] = 1.0;
      m[bath.id][bed.id] = 1.0;
    }
  });
}

export function generateAdjacencyMatrix(program: RoomProgram): AdjacencyMatrix {
  const m: AdjacencyMatrix = {};
  program.rooms.forEach(r => { m[r.id] = {}; });

  // Same-floor type affinities
  for (let f = 0; f < program.floors; f++) {
    const floorRooms = program.rooms.filter(r => r.floor === f);
    for (let i = 0; i < floorRooms.length; i++) {
      for (let j = i + 1; j < floorRooms.length; j++) {
        const a = floorRooms[i], b = floorRooms[j];
        const w = affinity(a.type, b.type);
        if (w !== 0) { m[a.id][b.id] = w; m[b.id][a.id] = w; }
      }
    }
    attachBedroomBaths(program.rooms, f, m);
  }
  return m;
}

/** Returns the ids strongly tied to `roomId` (weight >= threshold). */
export function strongNeighbors(m: AdjacencyMatrix, roomId: string, threshold = 0.7): string[] {
  const row = m[roomId] || {};
  return Object.keys(row).filter(k => row[k] >= threshold);
}
