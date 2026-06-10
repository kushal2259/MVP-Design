// ============================================================================
//  CONSTRAINT GENERATOR
//  ParsedRequirements + RuleEngine  →  RoomProgram (the building program).
//  Decides WHICH rooms exist, on WHICH floor, and their TARGET areas — all
//  bounded by the architectural rules and normalised to fill each floor.
//  No coordinates are produced here (that is the Geometry Engine's job).
// ============================================================================
import type { ParsedRequirements, RoomProgram, RoomSpec, Setbacks, RoomType } from './types';
import { getRoomRule, clampArea } from './ruleEngine';

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
  return {
    id: rid(type, floor), type, name, floor, priority, locked,
    minArea: r.minArea, maxArea: r.maxArea,
    targetArea: clampArea(type, target),
    minWidth: r.minWidth, preferredAspect: r.preferredAspect,
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
  bedroom:   10,   // §6.2.1
  living:    10,   // §6.1.1
  kitchen:   7.5,  // §6.3.1
  toilet:    4.5,  // §6.4.1
  staircase: 3.5,  // §8.2.1 clear width
  corridor:  3.0,  // §8 access way
  lobby:     4.0,
  dining:    7.5,
  balcony:   3.0,  // unusable below this
};

/** NBC 2016 minimum areas (sqft) per room type. */
const NBC_MIN_AREA: Partial<Record<RoomType, number>> = {
  bedroom:   100,  // §6.2.1 (habitable)
  living:    130,  // §6.1.1
  kitchen:    50,  // §6.3.1
  toilet:     20,  // §6.4.1
  staircase:  40,
  lobby:      25,
  dining:     60,
  balcony:    24,
};

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
  const specialRooms: string[] = req.specialRooms || [];

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
  rooms.push(spec('lobby',   'Entrance Lobby', 0, Math.max(60, Math.round(110 * fpScale)), 6));
  rooms.push(spec('living',  'Living Room',    0, Math.max(NBC_MIN_AREA.living!,  livingTarget),  9));
  rooms.push(spec('dining',  'Dining',         0, Math.max(NBC_MIN_AREA.dining!,  Math.round(170 * fpScale)), 7));
  rooms.push(spec('kitchen', 'Kitchen',        0, Math.max(NBC_MIN_AREA.kitchen!, kitchenTarget), 8));

  for (let b = 0; b < groundBeds; b++) {
    const isMaster = floors === 1 && b === 0;
    rooms.push(spec('bedroom', isMaster ? 'Master Bedroom' : floors > 1 ? 'Guest Bedroom' : `Bedroom ${b + 1}`,
      0, Math.max(NBC_MIN_AREA.bedroom!, Math.round((isMaster ? 220 : 170) * fpScale)), 8));
    rooms.push(spec('toilet', isMaster ? 'Master Bath' : `Bath ${b + 1}`,
      0, Math.max(NBC_MIN_AREA.toilet!, Math.round(55 * fpScale)), 4));
  }
  if (floors === 1 && req.bedrooms > 1 && !tinyPlot) {
    rooms.push(spec('toilet', 'Common Bath', 0, Math.max(20, Math.round(50 * fpScale)), 3));
  } else if (floors > 1) {
    rooms.push(spec('toilet', 'Powder Room', 0, Math.max(20, Math.round(45 * fpScale)), 3));
  }
  if (floors > 1) rooms.push(spec('staircase', 'Staircase', 0, Math.max(40, Math.round(90 * fpScale)), 7));
  rooms.push(spec('corridor', 'Corridor', 0, Math.max(30, Math.round(70 * fpScale)), 5));

  // Special rooms only on large enough plots
  if (!tinyPlot) {
    if (specialRooms.includes('pooja'))   rooms.push(spec('lobby',    'Pooja Room',         0, Math.round(50 * fpScale),  4));
    if (specialRooms.includes('study'))   rooms.push(spec('bedroom',  'Study / Home Office', 0, Math.round(120 * fpScale), 5));
    if (specialRooms.includes('store'))   rooms.push(spec('corridor', 'Store',              0, Math.round(55 * fpScale),  3));
    if (specialRooms.includes('servant')) rooms.push(spec('bedroom',  'Servant Room',       0, Math.round(100 * fpScale), 4));
    if (specialRooms.includes('gym') && floorFootprint > 900) rooms.push(spec('bedroom', 'Gym', 0, Math.round(130 * fpScale), 3));
    if (req.balconyRequired && !tinyPlot) rooms.push(spec('balcony', 'Balcony', 0, Math.max(NBC_MIN_AREA.balcony!, Math.round(70 * fpScale)), 2));
  }

  // ── UPPER FLOORS interior
  for (let f = 1; f < floors; f++) {
    const bedsThisFloor = Math.max(1, f === 1 ? Math.ceil(upperBeds / (floors - 1)) : Math.floor(upperBeds / (floors - 1)));
    rooms.push(spec('staircase', 'Staircase',     f, Math.max(40,  Math.round(90 * fpScale)),  7));
    rooms.push(spec('corridor',  'Corridor',      f, Math.max(30,  Math.round(80 * fpScale)),  5));
    rooms.push(spec('living',    'Family Lounge', f, Math.max(130, Math.round(220 * fpScale)), 6));
    for (let b = 0; b < bedsThisFloor; b++) {
      const master = f === 1 && b === 0;
      rooms.push(spec('bedroom', master ? 'Master Bedroom' : `Bedroom ${b + 1}`,
        f, Math.max(NBC_MIN_AREA.bedroom!, Math.round((master ? 230 : 175) * fpScale)), master ? 9 : 8));
      rooms.push(spec('toilet', master ? 'Master Bath' : `Bath ${b + 1}`,
        f, Math.max(NBC_MIN_AREA.toilet!, Math.round((master ? 60 : 50) * fpScale)), 4));
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
          r.targetArea = clampArea(r.type, Math.max(nbcMin, scaled));
        }
      });
    }
  }

  return {
    floors,
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
