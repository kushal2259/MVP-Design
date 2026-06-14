// ============================================================================
//  CONSTRAINT GENERATOR
//  ParsedRequirements + RuleEngine  →  RoomProgram (the building program).
//  Decides WHICH rooms exist, on WHICH floor, and their TARGET areas — all
//  bounded by the architectural rules and normalised to fill each floor.
//  No coordinates are produced here (that is the Geometry Engine's job).
// ============================================================================
import type { ParsedRequirements, RoomProgram, RoomSpec, Setbacks, RoomType } from './types';
import { getRoomRule, clampArea } from './ruleEngine';
import { ARCHITECTURAL_STANDARDS, getStandardCategory } from './architecturalStandards';

const std = ARCHITECTURAL_STANDARDS.rooms;

export function computeSetbacks(width: number, depth: number): Setbacks {
  const area = width * depth;
  if (area <= 1500) return { front: 5, rear: 3, left: 3, right: 3 };
  if (area <= 2700) return { front: 6, rear: 5, left: 4, right: 4 };
  if (area <= 4500) return { front: 8, rear: 6, left: 5, right: 5 };
  return { front: 10, rear: 8, left: 6, right: 6 };
}

let _uid = 0;
function rid(type: string, floor: number) { return `${type}-f${floor}-${_uid++}`; }

function spec(
  type: RoomType, name: string, floor: number, target: number, priority: number, locked = false,
): RoomSpec {
  const r = getRoomRule(type);
  const category = getStandardCategory(type, name);
  const stdRoom = ARCHITECTURAL_STANDARDS.rooms[category] || std.living_room;
  const actualMinWidth = stdRoom.minWidth || r.minWidth;
  return {
    id: rid(type, floor), type, name, floor, priority, locked,
    minArea: r.minArea, maxArea: r.maxArea,
    targetArea: clampArea(type, target),
    minWidth: actualMinWidth, preferredAspect: r.preferredAspect,
    needsExterior: r.needsExterior, needsVentilation: r.needsVentilation,
    zone: r.zone, privacyLevel: r.privacyLevel,
  };
}

// Minimum sqft per floor that can realistically hold the essential rooms.
// Below this threshold we reduce the program (fewer specials / baths) rather
// than generating physically impossible dimensions.
const MIN_VIABLE_FOOTPRINT = 450; // sqft — ~42 sqm, smallest compliant single-floor

/** NBC 2016 minimum widths (shorter side) for each room type, in feet. */
const NBC_MIN_WIDTH: Partial<Record<RoomType, number>> = {
  bedroom:   std.guest_bedroom.minWidth,   // §6.2.1
  living:    std.living_room.minWidth,   // §6.1.1
  kitchen:   std.kitchen.minWidth,  // §6.3.1
  toilet:    std.common_bathroom.minWidth,  // §6.4.1
  staircase: std.staircase.minWidth,  // §8.2.1 clear width
  corridor:  std.corridor.minWidth,  // §8 access way
  lobby:     std.corridor.minWidth,
  dining:    std.dining_room.minWidth,
  balcony:   std.balcony.minWidth,  // unusable below this
};

/** NBC 2016 minimum areas (sqft) per room type. */
const NBC_MIN_AREA: Partial<Record<RoomType, number>> = {
  bedroom:   std.guest_bedroom.minArea,  // §6.2.1 (habitable)
  living:    std.living_room.minArea,  // §6.1.1
  kitchen:    std.kitchen.minArea,  // §6.3.1
  toilet:     std.common_bathroom.minArea,  // §6.4.1
  staircase:  std.staircase.minArea,
  lobby:      std.corridor.minArea,
  dining:     std.dining_room.minArea,
  balcony:    std.balcony.minArea,
};

// Map UI display names (from the project creation form) to planner keywords.
// The form stores full labels; the planner uses short keywords.
function normalizeSpecialRooms(rooms: string[]): string[] {
  const map: Record<string, string> = {
    'home office': 'study', 'office': 'study', 'study': 'study', 'library': 'study',
    'home theatre': 'theatre', 'theater': 'theatre', 'theatre': 'theatre', 'cinema': 'theatre',
    'gym': 'gym', 'fitness': 'gym', 'gym / fitness room': 'gym',
    'pooja room': 'pooja', 'pooja': 'pooja', 'puja': 'pooja', 'mandir': 'pooja',
    'guest suite': 'guest', 'guest': 'guest',
    'wine cellar': 'store', 'store': 'store', 'storage': 'store', 'laundry room': 'store', 'laundry': 'store',
    'multipurpose hall': 'study',
    'servant quarters': 'servant', 'servant room': 'servant', 'servant': 'servant',
  };
  const result = new Set<string>();
  for (const r of rooms) {
    const key = r.toLowerCase().trim();
    if (map[key]) result.add(map[key]);
    else {
      // Partial match fallback
      for (const [pattern, keyword] of Object.entries(map)) {
        if (key.includes(pattern) || pattern.includes(key)) { result.add(keyword); break; }
      }
    }
  }
  return [...result];
}

export function generateProgram(req: ParsedRequirements): RoomProgram {
  _uid = 0;
  // Guard: floors must be a valid integer
  const floors = Number.isFinite(req.floors) && req.floors >= 1 ? Math.round(req.floors) : 2;
  const setbacks = computeSetbacks(req.plotWidth, req.plotDepth);
  const usableW = req.plotWidth - setbacks.left - setbacks.right;
  const usableD = req.plotDepth - setbacks.front - setbacks.rear;

  const wantsParking = req.budgetLakhs >= 25 && usableW >= 12;
  const yardDepth = Math.min(usableD * 0.28, wantsParking ? 24 : 14);
  const buildingH = usableD - yardDepth;
  const rawFootprint = usableW * buildingH;
  const floorFootprint = Math.max(MIN_VIABLE_FOOTPRINT, rawFootprint);

  // On tiny plots reduce the program to what can physically fit.
  const tinyPlot = rawFootprint < MIN_VIABLE_FOOTPRINT;
  const specialRooms: string[] = normalizeSpecialRooms(req.specialRooms || []);

  const rooms: RoomSpec[] = [];

  // ── Outdoor (front yard) — these are placed in the YARD strip, not the
  //    interior buildable rectangle, so their target areas use yardDepth.
  //    Mark them so the geometry engine places them correctly.
  if (wantsParking) rooms.push(spec('parking', 'Parking / Portico', 0, Math.min(200, usableW * yardDepth * 0.55), 2));
  if (!tinyPlot)    rooms.push(spec('garden', 'Front Lawn', 0, Math.min(160, usableW * yardDepth * 0.45), 1));

  // ── Bedroom distribution
  const groundBeds = floors > 1 ? 1 : req.bedrooms;
  const upperBeds  = req.bedrooms - groundBeds;

  // Scale targets to plot size so rooms never exceed the footprint.
  const fpScale    = Math.min(1, floorFootprint / 1200); // 1200sqft = comfortable base
  const livingTarget  = Math.round((req.livingRoom === 'large' ? 340 : req.livingRoom === 'compact' ? 260 : 300) * fpScale);
  const kitchenTarget = Math.round((req.kitchen === 'large' ? 180 : req.kitchen === 'compact' ? 110 : 150) * fpScale);

  // ── GROUND FLOOR interior
  // Lower thresholds so medium plots (50×45 4BHK etc.) get separate dining room.
  // Compact plan only on truly tight plots.
  const compactThreshold = req.bedrooms >= 4 ? 900 : 750;
  const compactPlan = floorFootprint < compactThreshold;

  // Entrance Lobby is ALWAYS on ground floor (priority 9 = never dropped).
  // It must be the first room a visitor enters — directly adjacent to Living Room.
  if (compactPlan) {
    rooms.push(spec('lobby',  'Entrance Lobby',      0, Math.max(50,  Math.round(80  * fpScale)), 9));
    rooms.push(spec('living', 'Living & Dining Area', 0, Math.max(NBC_MIN_AREA.living! + NBC_MIN_AREA.dining!, livingTarget + Math.round(60 * fpScale)), 9));
  } else {
    rooms.push(spec('lobby',  'Entrance Lobby', 0, Math.max(60,  Math.round(110 * fpScale)), 9));
    rooms.push(spec('living', 'Living Room',    0, Math.max(NBC_MIN_AREA.living!, livingTarget), 9));
    rooms.push(spec('dining', 'Dining',         0, Math.max(NBC_MIN_AREA.dining!, Math.round(170 * fpScale)), 7));
  }
  rooms.push(spec('kitchen', 'Kitchen', 0, Math.max(NBC_MIN_AREA.kitchen!, kitchenTarget), 8));

  for (let b = 0; b < groundBeds; b++) {
    const isMaster = floors === 1 && b === 0;
    const bedName = isMaster ? 'Master Bedroom' : floors > 1 ? 'Guest Bedroom' : `Bedroom ${b + 1}`;
    const bathName = isMaster ? 'Master Bath' : compactPlan ? 'Common Bath' : `Bath ${b + 1}`;
    rooms.push(spec('bedroom', bedName, 0, Math.max(NBC_MIN_AREA.bedroom!, Math.round((isMaster ? 220 : 170) * fpScale)), 8));
    rooms.push(spec('toilet',  bathName, 0, Math.max(NBC_MIN_AREA.toilet!, Math.round(55 * fpScale)), 8));
    // Walk-in closet next to each bedroom's bathroom — same target size as the bath, low priority
    if (!tinyPlot && !compactPlan) {
      rooms.push(spec('corridor', `${bedName} Closet`, 0, Math.max(25, Math.round(50 * fpScale)), 3));
    }
  }
  if (floors > 1) rooms.push(spec('staircase', 'Staircase', 0, Math.max(100, Math.round(130 * fpScale)), 7));
  // Ground floor corridor only on non-compact multi-floor plans
  if (!compactPlan && floors > 1) rooms.push(spec('corridor', 'Corridor', 0, Math.max(30, Math.round(70 * fpScale)), 5));

  // Special rooms only on large enough plots
  if (!tinyPlot) {
    if (specialRooms.includes('pooja'))   rooms.push(spec('lobby',    'Pooja Room',         0, Math.round(50 * fpScale),  4));
    if (specialRooms.includes('study'))   rooms.push(spec('bedroom',  'Study / Home Office', 0, Math.round(120 * fpScale), 5));
    if (specialRooms.includes('store'))   rooms.push(spec('corridor', 'Store',              0, Math.round(55 * fpScale),  3));
    if (specialRooms.includes('servant')) rooms.push(spec('bedroom',  'Servant Room',       0, Math.round(100 * fpScale), 4));
    if (specialRooms.includes('gym') && floorFootprint > 900) rooms.push(spec('bedroom', 'Gym', 0, Math.round(130 * fpScale), 3));
    // Balcony is NOT added on ground floor — useless at ground level, placed on upper floors only
  }

  // ── UPPER FLOORS interior
  for (let f = 1; f < floors; f++) {
    const bedsThisFloor = Math.max(1, f === 1 ? Math.ceil(upperBeds / (floors - 1)) : Math.floor(upperBeds / (floors - 1)));
    rooms.push(spec('staircase', 'Staircase', f, Math.max(100, Math.round(130 * fpScale)), 7));
    // Top floor gets an open terrace instead of a corridor
    if (f === floors - 1 && floors > 1) {
      rooms.push(spec('balcony', 'Open Terrace', f, Math.max(150, Math.round(280 * fpScale)), 4));
    } else {
      rooms.push(spec('corridor', 'Corridor', f, Math.max(30, Math.round(80 * fpScale)), 5));
    }
    // Family Lounge only on the first upper floor — additional floors get the space as bedrooms/terrace
    if (!compactPlan && f === 1) {
      rooms.push(spec('living',  'Family Lounge', f, Math.max(130, Math.round(220 * fpScale)), 6));
    }
    for (let b = 0; b < bedsThisFloor; b++) {
      const master = f === 1 && b === 0;
      const bedName = master ? 'Master Bedroom' : `Bedroom ${b + 1}`;
      const bathName = master ? 'Master Bath' : `Bath ${b + 1}`;
      rooms.push(spec('bedroom', bedName, f, Math.max(NBC_MIN_AREA.bedroom!, Math.round((master ? 230 : 175) * fpScale)), master ? 9 : 8));
      rooms.push(spec('toilet',  bathName, f, Math.max(NBC_MIN_AREA.toilet!, Math.round((master ? 60 : 50) * fpScale)), 8));
      // Walk-in closet same size as bathroom, placed beside bathroom entrance
      if (!tinyPlot) {
        rooms.push(spec('corridor', `${bedName} Closet`, f, Math.max(25, Math.round(50 * fpScale)), 3));
      }
    }
    if (req.balconyRequired && !tinyPlot) rooms.push(spec('balcony', 'Balcony', f, Math.max(NBC_MIN_AREA.balcony!, Math.round(70 * fpScale)), 2));
  }

  // ── Normalise interior target areas to fill each floor footprint exactly,
  //    but never let any room shrink below NBC minimums after scaling.
  //    If too many rooms are requested for the available area, drop the lowest-
  //    priority ones (specials first, then extras) until all remaining rooms
  //    can meet their NBC minimums.
  for (let f = 0; f < floors; f++) {
    const interior = rooms.filter(r => r.floor === f && r.zone !== 'outdoor');
    // Iteratively drop lowest-priority rooms until every room can meet NBC min.
    for (let pass = 0; pass < 6; pass++) {
      const sum = interior.reduce((s, r) => s + r.targetArea, 0);
      if (sum === 0) break;
      const scale = floorFootprint / sum;
      // Check if any room would fall below NBC minimum after scaling.
      const violations = interior.filter(r => {
        const scaled = r.targetArea * scale;
        const nbcMin = NBC_MIN_AREA[r.type as RoomType] ?? r.minArea;
        return scaled < nbcMin * 0.85; // 15% tolerance
      });
      if (!violations.length) break;
      // Drop the lowest-priority violating room.
      violations.sort((a, b) => a.priority - b.priority);
      const drop = violations[0];
      const idx = interior.indexOf(drop);
      if (idx >= 0) interior.splice(idx, 1);
      const globalIdx = rooms.indexOf(drop);
      if (globalIdx >= 0) rooms.splice(globalIdx, 1);
    }
    // Final scaling pass.
    const interior2 = rooms.filter(r => r.floor === f && r.zone !== 'outdoor');
    const sum2 = interior2.reduce((s, r) => s + r.targetArea, 0);
    if (sum2 > 0) {
      const scale = floorFootprint / sum2;
      interior2.forEach(r => {
        if (!r.locked) {
          const scaled = r.targetArea * scale;
          const nbcMin = NBC_MIN_AREA[r.type as RoomType] ?? r.minArea;
          let area = clampArea(r.type, Math.max(nbcMin, scaled));
          // Cap bathroom area: master bath max 80 sqft, common bath max 60 sqft
          if (r.type === 'toilet') {
            const cap = /master/i.test(r.name) ? 80 : 60;
            area = Math.min(area, cap);
          }
          r.targetArea = area;
        }
      });
    }
  }

  // ── TERRACE FLOOR (always present, one above the topmost habitable floor)
  // Fixed layout: Staircase Cabin (10×10 = 100 sqft, same position as floors below),
  // Terrace Store (10×6 = 60 sqft), and Open Terrace fills the rest.
  // All three are LOCKED so runSpaceAllocation never scales them up.
  const terraceFloor = floors;
  const stairCabinArea  = 100;
  const storeArea       = 60;
  const openTerraceArea = Math.max(200, floorFootprint - stairCabinArea - storeArea);
  // Open Terrace FIRST so it renders as background; Cabin + Store drawn on top of it.
  rooms.push(spec('balcony',   'Open Terrace',    terraceFloor, openTerraceArea, 5));
  rooms.push(spec('staircase', 'Staircase Cabin', terraceFloor, stairCabinArea,  9, true));
  rooms.push(spec('corridor',  'Terrace Store',   terraceFloor, storeArea,       8, true));

  return {
    floors: floors + 1, // include terrace level
    rooms,
    buildable: { width: req.plotWidth, depth: req.plotDepth, setbacks },
    global: {
      maxFar: 2.5,
      minCorridorWidth: NBC_MIN_WIDTH.corridor!,
      minStairWidth: NBC_MIN_WIDTH.staircase!,
      targetFootprintSqft: floorFootprint,
      facing: req.facing || 'S',
    },
  };
}
