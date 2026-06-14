// ============================================================================
//  ARCHITECTURAL PLANNING ENGINE
//  Thinks like an architect BEFORE geometry is generated.
// ============================================================================
import type {
  RoomSpec, RoomProgram, AdjacencyMatrix, DesignStrategy, Setbacks, RoomType,
  PlanningDecisions, ZoneInfo, AdjacencyRelation, CirculationDecisions,
  PrivacyDecisions, ServiceCoreDecisions, StructuralDecisions,
  NaturalLightDecisions, SpaceDecisions, PlotDecisions, FutureExpansionDecisions,
  MacroZone
} from './types';
import { ARCHITECTURAL_STANDARDS, getRoomStandard } from './architecturalStandards';

// ── 1. ZONING ENGINE ─────────────────────────────────────────────────────────
export function getMacroZone(type: string, name: string): MacroZone {
  const normType = type.toLowerCase();
  const normName = (name || '').toLowerCase();
  
  if (normType === 'bedroom') {
    if (normName.includes('guest')) return 'semi_private';
    return 'private';
  }
  if (normType === 'kitchen') return 'semi_private';
  if (normType === 'toilet' || normType === 'utility' || normName.includes('utility') || normName.includes('store') || normName.includes('servant')) {
    return 'service';
  }
  if (normType === 'corridor' || normType === 'staircase' || normType === 'lobby') {
    return 'circ';
  }
  return 'public'; // living, dining, balcony, pooja
}

// ── 2. DESIGN PATTERN LIBRARY ───────────────────────────────────────────────
const CORE_ADJACENCY_PATTERNS: { from: RoomType; to: RoomType; weight: number; type: 'must_connect' | 'preferred' | 'should_avoid' }[] = [
  { from: 'lobby', to: 'living', weight: 0.95, type: 'preferred' },
  { from: 'living', to: 'dining', weight: 0.9, type: 'preferred' },
  { from: 'kitchen', to: 'dining', weight: 1.0, type: 'must_connect' },
  { from: 'kitchen', to: 'corridor', weight: 0.55, type: 'preferred' },
  { from: 'living', to: 'balcony', weight: 0.7, type: 'preferred' },
  { from: 'bedroom', to: 'toilet', weight: 0.9, type: 'must_connect' },
  { from: 'toilet', to: 'kitchen', weight: -0.6, type: 'should_avoid' },
  { from: 'toilet', to: 'dining', weight: -0.7, type: 'should_avoid' },
  { from: 'toilet', to: 'living', weight: -0.5, type: 'should_avoid' },
];

export function buildAdjacencyRelations(rooms: RoomSpec[]): AdjacencyRelation[] {
  const relations: AdjacencyRelation[] = [];
  
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const r1 = rooms[i];
      const r2 = rooms[j];
      if (r1.floor !== r2.floor) continue;

      const pattern = CORE_ADJACENCY_PATTERNS.find(p => 
        (p.from === r1.type && p.to === r2.type) || (p.from === r2.type && p.to === r1.type)
      );

      if (pattern) {
        relations.push({
          fromRoomId: r1.id,
          toRoomId: r2.id,
          type: pattern.type,
          weight: pattern.weight,
        });
      }

      // Special check: Kitchen ↔ Utility (Utility Room has type 'toilet' or 'corridor' but name 'Utility')
      const isKitchen = r1.type === 'kitchen' || r2.type === 'kitchen';
      const isUtility = r1.name.toLowerCase().includes('utility') || r2.name.toLowerCase().includes('utility');
      if (isKitchen && isUtility) {
        relations.push({
          fromRoomId: r1.id,
          toRoomId: r2.id,
          type: 'preferred',
          weight: 0.8,
        });
      }
    }
  }

  // Attached bathrooms logic
  const floorsCount = Math.max(...rooms.map(r => r.floor), 0) + 1;
  for (let f = 0; f < floorsCount; f++) {
    const fRooms = rooms.filter(r => r.floor === f);
    const beds = fRooms.filter(r => r.type === 'bedroom');
    const baths = fRooms.filter(r => r.type === 'toilet');
    beds.forEach((bed, idx) => {
      const bath = baths[idx];
      if (bath && bed.name.toLowerCase().includes('master')) {
        relations.push({
          fromRoomId: bed.id,
          toRoomId: bath.id,
          type: 'must_connect',
          weight: 1.0,
        });
      }
    });
  }

  return relations;
}

// ── 3. PRIVACY PLANNING ENGINE ───────────────────────────────────────────────
export function runPrivacyPlanning(rooms: RoomSpec[]): PrivacyDecisions {
  const roomPrivacyClasses: Record<string, 'PUBLIC' | 'SEMI_PRIVATE' | 'PRIVATE' | 'SERVICE'> = {};
  const requireBufferCorridor: string[] = [];

  for (const r of rooms) {
    const zone = getMacroZone(r.type, r.name);
    if (zone === 'public') {
      roomPrivacyClasses[r.id] = 'PUBLIC';
    } else if (zone === 'semi_private') {
      roomPrivacyClasses[r.id] = 'SEMI_PRIVATE';
    } else if (zone === 'private') {
      roomPrivacyClasses[r.id] = 'PRIVATE';
      requireBufferCorridor.push(r.id);
    } else {
      roomPrivacyClasses[r.id] = 'SERVICE';
    }
  }

  return { roomPrivacyClasses, requireBufferCorridor };
}

// ── 4. CIRCULATION PLANNING ENGINE ───────────────────────────────────────────
export function runCirculationPlanning(strategy: DesignStrategy): CirculationDecisions {
  const isCompact = strategy.id === 'compact';
  return {
    corridorWidth: isCompact ? 3.0 : 3.5,
    staircaseReservingBox: { w: 8.0, h: 10.0 },
    lobbyWidth: isCompact ? 4.0 : 5.0,
  };
}

// ── 5. SERVICE CORE PLANNING ENGINE ──────────────────────────────────────────
export function runServiceCorePlanning(rooms: RoomSpec[]): ServiceCoreDecisions {
  const wetRoomIds = rooms
    .filter(r => r.type === 'kitchen' || r.type === 'toilet' || r.name.toLowerCase().includes('utility'))
    .map(r => r.id);

  const maxDistanceFromCore: Record<string, number> = {};
  for (const id of wetRoomIds) {
    maxDistanceFromCore[id] = 15.0;
  }

  return {
    wetCoreCentroidFraction: { x: 0.5, y: 0.5 },
    wetRoomIds,
    maxDistanceFromCore,
  };
}

// ── 6. STRUCTURAL PLANNING ENGINE ────────────────────────────────────────────
export function runStructuralPlanning(strategy: DesignStrategy): StructuralDecisions {
  const isLuxury = strategy.id === 'luxury';
  return {
    preferredSpan: isLuxury ? 16.0 : 14.0,
    maxSpan: 20.0,
    columnPositions: [],
  };
}

// ── 7. NATURAL LIGHT PLANNING ENGINE ─────────────────────────────────────────
export function runNaturalLightPlanning(rooms: RoomSpec[]): NaturalLightDecisions {
  const windowAreaFractions: Record<string, number> = {};
  const requiresExternalWall: string[] = [];

  for (const r of rooms) {
    const std = ARCHITECTURAL_STANDARDS.rooms[r.type] || ARCHITECTURAL_STANDARDS.rooms.living_room;
    windowAreaFractions[r.id] = std.minWindowAreaFraction || 0.10;
    
    if (r.type === 'bedroom' || r.type === 'living' || r.type === 'kitchen' || r.type === 'toilet') {
      requiresExternalWall.push(r.id);
    }
  }

  return { windowAreaFractions, requiresExternalWall };
}

// ── 8. FUTURE EXPANSION ENGINE ───────────────────────────────────────────────
export function runFutureExpansionPlanning(strategy: DesignStrategy): FutureExpansionDecisions {
  const isExpansionReady = strategy.id === 'future-expansion';
  return {
    allowVerticalGrow: isExpansionReady,
    foundationLoadMultiplier: isExpansionReady ? 1.35 : 1.0,
    gridAlignRequired: isExpansionReady,
  };
}

// ── 9. SPACE ALLOCATION ENGINE ───────────────────────────────────────────────
export function runSpaceAllocation(program: RoomProgram, strategy: DesignStrategy): SpaceDecisions {
  const allocatedAreas: Record<string, number> = {};

  for (const r of program.rooms) {
    let target = r.targetArea;
    if (strategy.id === 'luxury') {
      if (r.type === 'bedroom' && r.name.toLowerCase().includes('master')) {
        target = Math.round(target * 1.25);
      }
      if (r.type === 'living') {
        target = Math.round(target * 1.2);
      }
    } else if (strategy.id === 'compact') {
      if (r.type === 'toilet') {
        target = Math.max(35, Math.round(target * 0.85));
      }
      if (r.type === 'corridor') {
        target = Math.max(24, Math.round(target * 0.75));
      }
    } else if (strategy.id === 'family') {
      if (r.type === 'dining' || r.name.toLowerCase().includes('lounge')) {
        target = Math.round(target * 1.15);
      }
    }
    allocatedAreas[r.id] = target;
  }

  // Normalize areas per floor to fit target footprint
  const floors = program.floors;
  for (let f = 0; f < floors; f++) {
    const floorRooms = program.rooms.filter(r => r.floor === f && r.zone !== 'outdoor');
    const sum = floorRooms.reduce((s, r) => s + (allocatedAreas[r.id] || r.targetArea), 0);
    if (sum > 0) {
      const scale = program.global.targetFootprintSqft / sum;
      floorRooms.forEach(r => {
        if (!r.locked) {
          const scaled = (allocatedAreas[r.id] || r.targetArea) * scale;
          const std = getRoomStandard(r.type, r.name || '');
          // Clamp between minArea and maxArea — prevents bathrooms/service rooms from
          // ballooning on large plots when the scaling factor is > 1.
          allocatedAreas[r.id] = Math.round(Math.max(std.minArea, Math.min(std.maxArea, scaled)));
        }
      });
    }
  }

  return { allocatedAreas };
}

// ── 10. PLOT ADAPTATION ENGINE ───────────────────────────────────────────────
export function runPlotAdaptation(
  program: RoomProgram,
  facing: 'N' | 'E' | 'S' | 'W',
  rooms: RoomSpec[]
): PlotDecisions {
  const setbacks = { ...program.buildable.setbacks };
  const isCorner = false;
  const isIrregular = false;
  
  const usableW = program.buildable.width - setbacks.left - setbacks.right;
  const usableD = program.buildable.depth - setbacks.front - setbacks.rear;

  // Entrance door side and target room
  const groundRooms = rooms.filter(r => r.floor === 0);
  const lobbyRooms = groundRooms.filter(r => r.type === 'lobby');
  const livingRooms = groundRooms.filter(r => r.type === 'living');
  const entranceRoom = lobbyRooms.length ? lobbyRooms[0] : (livingRooms.length ? livingRooms[0] : groundRooms[0]);

  let entranceSide: 'front' | 'back' | 'left' | 'right' = 'front';
  if (facing === 'N') entranceSide = 'back';
  else if (facing === 'E') entranceSide = 'right';
  else if (facing === 'W') entranceSide = 'left';

  return {
    facing,
    isCornerPlot: isCorner,
    isIrregularPlot: isIrregular,
    setbacks,
    buildableRect: { w: usableW, h: usableD },
    entranceRoomId: entranceRoom ? entranceRoom.id : '',
    entranceSide,
  };
}

// ── MAIN ORCHESTRATOR: ARCHITECTURAL PLANNING ENGINE ─────────────────────────
export function runPlanningDecisions(
  program: RoomProgram,
  strategy: DesignStrategy,
  facing: 'N' | 'E' | 'S' | 'W',
  seed: number
): PlanningDecisions {
  const zones: ZoneInfo[] = program.rooms.map(r => ({
    roomId: r.id,
    zone: getMacroZone(r.type, r.name),
    privacyLevel: r.privacyLevel,
  }));

  const adjacencies = buildAdjacencyRelations(program.rooms);
  const circulation = runCirculationPlanning(strategy);
  const privacy = runPrivacyPlanning(program.rooms);
  const serviceCore = runServiceCorePlanning(program.rooms);
  const structural = runStructuralPlanning(strategy);
  const naturalLight = runNaturalLightPlanning(program.rooms);
  const spaceAllocation = runSpaceAllocation(program, strategy);
  const plotAdaptation = runPlotAdaptation(program, facing, program.rooms);
  const futureExpansion = runFutureExpansionPlanning(strategy);

  // Sequence macro zones dynamically
  const zoneOrderMap: Record<MacroZone, number> = { public: 0, semi_private: 1, circ: 2, private: 3, service: 4 };
  const strategyOrder = strategy.zoneOrder.map(tag => {
    if (tag === 'public') return 'public';
    if (tag === 'private') return 'private';
    if (tag === 'service' || tag === 'utility') return 'service';
    if (tag === 'circulation') return 'circ';
    return 'public';
  }) as MacroZone[];
  
  strategyOrder.forEach((m, idx) => { zoneOrderMap[m] = idx; });

  const rng = rngFrom(seed);
  
  // Build adjacency matrix for graph traversal
  const adjacencyMatrix: AdjacencyMatrix = {};
  program.rooms.forEach(r => { adjacencyMatrix[r.id] = {}; });
  for (const rel of adjacencies) {
    adjacencyMatrix[rel.fromRoomId][rel.toRoomId] = rel.weight;
    adjacencyMatrix[rel.toRoomId][rel.fromRoomId] = rel.weight;
  }

  // Same-floor adjacency ordering
  const orderedRooms: RoomSpec[] = [];
  const floors = program.floors;
  for (let f = 0; f < floors; f++) {
    const fRooms = program.rooms.filter(r => r.floor === f);
    if (!fRooms.length) continue;
    
    const fInterior = fRooms.filter(r => r.zone !== 'outdoor');
    const fOutdoor = fRooms.filter(r => r.zone === 'outdoor');
    
    if (fInterior.length) {
      const orderedInterior = adjacencyOrderCustom(fInterior, adjacencyMatrix, zoneOrderMap, rng);
      orderedRooms.push(...orderedInterior);
    }
    orderedRooms.push(...fOutdoor);
  }

  // Apply allocated target areas back to ordered room specifications
  orderedRooms.forEach(r => {
    if (spaceAllocation.allocatedAreas[r.id]) {
      r.targetArea = spaceAllocation.allocatedAreas[r.id];
    }
  });

  return {
    strategy,
    zones,
    adjacencies,
    circulation,
    privacy,
    serviceCore,
    structural,
    naturalLight,
    spaceAllocation,
    plotAdaptation,
    futureExpansion,
    orderedRooms,
  };
}

// ── LEGACY HELPERS FOR BACKWARD COMPATIBILITY ─────────────────────────────────
export function macroOf(r: RoomSpec): string {
  return getMacroZone(r.type, r.name);
}

export function macroSequence(strategy: DesignStrategy): string[] {
  return strategy.zoneOrder;
}

export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function adjacencyOrder(
  rooms: RoomSpec[],
  adjacency: AdjacencyMatrix,
  strategy: DesignStrategy,
  rng: () => number,
): RoomSpec[] {
  const zoneOrderMap: Record<MacroZone, number> = { public: 0, semi_private: 1, circ: 2, private: 3, service: 4 };
  return adjacencyOrderCustom(rooms, adjacency, zoneOrderMap, rng);
}

function adjacencyOrderCustom(
  rooms: RoomSpec[],
  adjacency: AdjacencyMatrix,
  zoneOrderMap: Record<MacroZone, number>,
  rng: () => number,
): RoomSpec[] {
  const aff = (a: RoomSpec, b: RoomSpec) => adjacency[a.id]?.[b.id] ?? 0;
  
  const out: RoomSpec[] = [];
  const used = new Set<string>();

  const start = [...rooms].sort((a, b) => {
    const pa = zoneOrderMap[getMacroZone(a.type, a.name)];
    const pb = zoneOrderMap[getMacroZone(b.type, b.name)];
    return pa - pb || b.priority - a.priority;
  })[0];
  
  if (start) {
    out.push(start);
    used.add(start.id);
  }

  while (out.length < rooms.length) {
    const last = out[out.length - 1];
    const lastZone = getMacroZone(last.type, last.name);
    const lastPhase = zoneOrderMap[lastZone];
    const avail = rooms.filter(r => !used.has(r.id));
    
    if (avail.length === 0) break;

    const scored = avail.map(r => {
      const a = aff(last, r);
      const rZone = getMacroZone(r.type, r.name);
      const ph = zoneOrderMap[rZone];
      const sameZone = rZone === lastZone ? 0.5 : 0;
      const phasePenalty = ph < lastPhase ? (lastPhase - ph) * 0.35 : 0;
      const forwardBonus = ph === lastPhase + 1 ? 0.25 : 0;
      return { r, s: a * 4 + sameZone + forwardBonus - phasePenalty + r.priority * 0.015 + rng() * 0.2 };
    }).sort((x, y) => y.s - x.s);

    const pick = (scored.length > 1 && rng() < 0.2) ? scored[1].r : scored[0].r;
    out.push(pick);
    used.add(pick.id);
  }
  return out;
}
