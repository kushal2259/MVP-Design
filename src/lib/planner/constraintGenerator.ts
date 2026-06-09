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

export function generateProgram(req: ParsedRequirements): RoomProgram {
  _uid = 0;
  const setbacks = computeSetbacks(req.plotWidth, req.plotDepth);
  const usableW = req.plotWidth - setbacks.left - setbacks.right;
  const usableD = req.plotDepth - setbacks.front - setbacks.rear;

  const wantsParking = req.budgetLakhs >= 25;
  const yardDepth = Math.min(usableD * 0.28, wantsParking ? 24 : 14);
  const buildingH = usableD - yardDepth;
  const floorFootprint = Math.max(300, usableW * buildingH);

  const rooms: RoomSpec[] = [];

  // ── Outdoor (front yard) — placed by geometry in the yard, not the interior
  if (wantsParking) rooms.push(spec('parking', 'Parking / Portico', 0, 200, 2));
  rooms.push(spec('garden', 'Front Lawn', 0, 160, 1));

  // ── Bedroom distribution
  const groundBeds = req.floors > 1 ? 1 : req.bedrooms;
  const upperBeds = req.bedrooms - groundBeds;

  const livingTarget = req.livingRoom === 'large' ? 340 : req.livingRoom === 'compact' ? 260 : 300;
  const kitchenTarget = req.kitchen === 'large' ? 180 : req.kitchen === 'compact' ? 110 : 150;

  // ── GROUND FLOOR interior
  rooms.push(spec('lobby', 'Entrance Lobby', 0, 110, 6));
  rooms.push(spec('living', 'Living Room', 0, livingTarget, 9));
  rooms.push(spec('dining', 'Dining', 0, 170, 7));
  rooms.push(spec('kitchen', 'Kitchen', 0, kitchenTarget, 8));
  for (let b = 0; b < groundBeds; b++) {
    const isMaster = req.floors === 1 && b === 0;
    rooms.push(spec('bedroom', isMaster ? 'Master Bedroom' : req.floors > 1 ? 'Guest Bedroom' : `Bedroom ${b + 1}`, 0, isMaster ? 220 : 170, 8));
    rooms.push(spec('toilet', isMaster ? 'Master Bath' : `Bath ${b + 1}`, 0, 55, 4));
  }
  if (req.floors === 1 && req.bedrooms > 1) {
    // extra common bath for single-floor multi-bed
    rooms.push(spec('toilet', 'Common Bath', 0, 50, 3));
  } else if (req.floors > 1) {
    rooms.push(spec('toilet', 'Powder Room', 0, 45, 3));
  }
  if (req.floors > 1) rooms.push(spec('staircase', 'Staircase', 0, 90, 7));
  rooms.push(spec('corridor', 'Corridor', 0, 70, 5));

  // special rooms on ground
  if (req.specialRooms.includes('pooja')) rooms.push(spec('lobby', 'Pooja Room', 0, 50, 4));
  if (req.specialRooms.includes('study')) rooms.push(spec('bedroom', 'Study / Home Office', 0, 120, 5));
  if (req.specialRooms.includes('store')) rooms.push(spec('corridor', 'Store', 0, 55, 3));
  if (req.balconyRequired) rooms.push(spec('balcony', 'Balcony', 0, 70, 2));

  // ── UPPER FLOORS interior
  for (let f = 1; f < req.floors; f++) {
    const bedsThisFloor = Math.max(1, Math.round(upperBeds / (req.floors - 1)) + (f === 1 && upperBeds % (req.floors - 1) ? 0 : 0));
    rooms.push(spec('staircase', 'Staircase', f, 90, 7));
    rooms.push(spec('corridor', 'Corridor', f, 80, 5));
    rooms.push(spec('living', 'Family Lounge', f, 220, 6));
    const beds = f === 1 ? Math.ceil(upperBeds / (req.floors - 1)) : Math.floor(upperBeds / (req.floors - 1));
    for (let b = 0; b < Math.max(beds, bedsThisFloor); b++) {
      const master = f === 1 && b === 0;
      rooms.push(spec('bedroom', master ? 'Master Bedroom' : `Bedroom ${b + 1}`, f, master ? 230 : 175, master ? 9 : 8));
      rooms.push(spec('toilet', master ? 'Master Bath' : `Bath ${b + 1}`, f, master ? 60 : 50, 4));
    }
    if (req.balconyRequired) rooms.push(spec('balcony', 'Balcony', f, 70, 2));
  }

  // ── Normalise interior target areas to fill each floor footprint
  for (let f = 0; f < req.floors; f++) {
    const interior = rooms.filter(r => r.floor === f && r.zone !== 'outdoor');
    const sum = interior.reduce((s, r) => s + r.targetArea, 0);
    if (sum > 0) {
      const scale = floorFootprint / sum;
      interior.forEach(r => {
        if (!r.locked) r.targetArea = clampArea(r.type, r.targetArea * scale);
      });
    }
  }

  return {
    floors: req.floors,
    rooms,
    buildable: { width: req.plotWidth, depth: req.plotDepth, setbacks },
    global: {
      maxFar: 2.5,
      minCorridorWidth: 3,
      minStairWidth: 3.5,
      targetFootprintSqft: floorFootprint,
      facing: req.facing || 'S',
    },
  };
}
