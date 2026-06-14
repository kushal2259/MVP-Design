// ============================================================================
//  ADJACENCY MATRIX GENERATOR
//  Encodes desired spatial relationships between rooms (stored separately so
//  the optimizer / geometry engine can consume them). Weights: 1 = must be
//  adjacent, 0.5 = nice to be near, negative = keep apart.
// ============================================================================
import type { RoomProgram, RoomSpec, AdjacencyMatrix, RoomType } from './types';

// Relationship preferences expressed at the *type* level.
// These encode well-known residential planning patterns ("architect clusters"):
//   • Foyer → Living entry sequence
//   • Kitchen–Dining–Living social triangle (with a utility/store off the kitchen)
//   • Bedroom + en-suite bath private suite
const TYPE_AFFINITY: Array<[RoomType, RoomType, number]> = [
  // Entry sequence — you enter the foyer/living, never a service room
  ['lobby', 'living', 0.97],
  ['living', 'dining', 0.92],
  // Kitchen–Dining–Utility cluster
  ['kitchen', 'dining', 1.0],
  ['kitchen', 'corridor', 0.55],   // utility/store access off the kitchen
  // Circulation spine
  ['lobby', 'staircase', 0.75],
  ['corridor', 'bedroom', 0.92],
  ['corridor', 'staircase', 0.7],
  ['corridor', 'lobby', 0.7],
  // Outdoor connections
  ['living', 'balcony', 0.7],
  ['bedroom', 'balcony', 0.5],
  // Private suite
  ['bedroom', 'toilet', 0.9],
  // Negative (keep apart)
  ['kitchen', 'living', -0.2],
  ['toilet', 'kitchen', -0.6],
  ['toilet', 'dining', -0.7],
  ['toilet', 'living', -0.5],
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

/**
 * Suite clustering (reference-plan pattern): each bedroom's walk-in closet
 * ("<Bedroom Name> Closet") sits between the bedroom and its bath — strong
 * adjacency to both so the slicer keeps the suite together.
 */
function attachBedroomClosets(rooms: RoomSpec[], floor: number, m: AdjacencyMatrix) {
  const floorRooms = rooms.filter(r => r.floor === floor);
  const closets = floorRooms.filter(r => (r.name || '').toLowerCase().includes('closet'));
  for (const closet of closets) {
    const bedName = (closet.name || '').replace(/\s*closet\s*$/i, '').trim().toLowerCase();
    const bed = floorRooms.find(r => r.type === 'bedroom' && (r.name || '').toLowerCase() === bedName);
    if (!bed) continue;
    m[closet.id][bed.id] = 0.95;
    m[bed.id][closet.id] = 0.95;
    // and near that bedroom's bath (closet at the bath entrance)
    const bedIdx = floorRooms.filter(r => r.type === 'bedroom').indexOf(bed);
    const bath = floorRooms.filter(r => r.type === 'toilet')[bedIdx];
    if (bath) {
      m[closet.id][bath.id] = 0.9;
      m[bath.id][closet.id] = 0.9;
    }
  }
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
    attachBedroomClosets(program.rooms, f, m);
  }
  return m;
}

/** Returns the ids strongly tied to `roomId` (weight >= threshold). */
export function strongNeighbors(m: AdjacencyMatrix, roomId: string, threshold = 0.7): string[] {
  const row = m[roomId] || {};
  return Object.keys(row).filter(k => row[k] >= threshold);
}
