// ============================================================================
//  APARTMENT ENGINE — deterministic generator for residential apartment towers
//  (G+4 … G+12). Floors are NOT repeated — one representative plate each:
//    floor 0           → Ground (entrance lobby + lift/stair core + parking +
//                        garden + services)
//    floor 1           → Typical Floor (represents floors 1..N, units around
//                        a central core)
//    floor 2 (>7 only) → Refuge Floor variant (one balcony → refuge area)
//    last floor        → Terrace (stair cabin, lift machine room, OHT, open roof)
//
//  The lift + stair + lobby core occupies the IDENTICAL rects on every floor.
//  All coordinates in FEET. (0,0) = plot corner; the FRONT/street edge is the
//  high-y wall (door/window side 'front' = the high-y wall, matching the
//  bungalow layoutSolver convention).
// ============================================================================
import type { RoomLayout, WindowConfig, DoorConfig } from '@/types';

export type BHK = '1bhk' | '2bhk' | '3bhk';

export interface ApartmentConfig {
  plotWidth: number;
  plotDepth: number;
  floors: number;                 // habitable floors above ground (G+N → N)
  unitsPerFloor: 2 | 3 | 4;
  unitMix: BHK[];                 // length === unitsPerFloor
  location: string;
  budgetLakhs: number;
}

export interface ApartmentStats {
  totalUnits: number;
  builtUpPerFloor: number;
  far: number;
  parkingSlots: number;
  carpetByBhk: Record<string, number>;
}

export interface ApartmentResult {
  rooms: RoomLayout[];
  floorLabels: string[];
  stats: ApartmentStats;
}

const C = {
  living: '#ffedd5', kitchen: '#fef3c7', bedroom: '#fde68a', toilet: '#e0e7ff',
  balcony: '#d1fae5', corridor: '#f1f5f9', lobby: '#fef3c7', lift: '#e5e7eb',
  stair: '#e5e7eb', utility: '#f3f4f6', parking: '#e8eaed', garden: '#bbf7d0',
  refuge: '#fecaca', terrace: '#ecfdf5',
};

const r05 = (n: number) => Math.round(n * 2) / 2;
let seq = 0;
const rid = (tag: string) => `ap-${tag}-${++seq}`;

function win(side: WindowConfig['side'], offset: number, width = 4): WindowConfig {
  return { id: rid('w'), side, offset: r05(Math.max(0.5, offset)), width };
}
function door(side: DoorConfig['side'], offset: number, width = 3, openDirection: DoorConfig['openDirection'] = 'in-right'): DoorConfig {
  return { id: rid('d'), side, offset: r05(Math.max(0.5, offset)), width, openDirection };
}
function room(p: Pick<RoomLayout, 'name' | 'type' | 'floor'> & { x: number; y: number; w: number; h: number; color?: string; windows?: WindowConfig[]; doors?: DoorConfig[] }): RoomLayout {
  return {
    id: rid(p.type), name: p.name, type: p.type,
    x: r05(p.x), y: r05(p.y), w: r05(p.w), h: r05(p.h),
    floor: p.floor, color: p.color, windows: p.windows || [], doors: p.doors || [], furniture: [],
  };
}

function sliceX(x0: number, x1: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const bounds = [x0];
  let acc = x0;
  for (let i = 0; i < weights.length - 1; i++) { acc += (x1 - x0) * (weights[i] / total); bounds.push(r05(acc)); }
  bounds.push(x1);
  return bounds;
}
const sliceY = sliceX;

export function validateNoOverlaps(rooms: RoomLayout[]): string[] {
  const EPS = 0.01;
  const issues: string[] = [];
  for (const f of Array.from(new Set(rooms.map(r => r.floor)))) {
    const fr = rooms.filter(r => r.floor === f);
    for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) {
      const a = fr[i], b = fr[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > EPS && oy > EPS) {
        const aInB = a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;
        const bInA = b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS;
        if (aInB || bInA) continue;
        issues.push(`Floor ${f}: "${a.name}" overlaps "${b.name}" (${ox.toFixed(1)}×${oy.toFixed(1)} ft)`);
      }
    }
  }
  issues.forEach(m => console.warn('[apartmentEngine] overlap:', m));
  return issues;
}

const bedCount = (b: BHK) => (b === '1bhk' ? 1 : b === '2bhk' ? 2 : 3);
const bathCount = (b: BHK) => (b === '1bhk' ? 1 : 2);

/** Subdivide one unit rectangle into real rooms, tiling exactly (no gaps/overlaps). */
function subdivideUnit(x0: number, y0: number, w: number, d: number, bhk: BHK, floor: number, tag: string, isFirst: boolean, isLast: boolean, refuge: boolean): RoomLayout[] {
  const out: RoomLayout[] = [];
  const nBed = bedCount(bhk), nBath = bathCount(bhk);

  // Rear social row (faces the common corridor at y0): living + kitchen
  const d1 = r05(d * 0.4);
  const livW = r05(w * 0.6);
  out.push(room({
    name: `Unit ${tag} — Living`, type: 'living', floor, x: x0, y: y0, w: livW, h: d1, color: C.living,
    doors: [door('back', 2, 3.5, 'in-right')],  // unit entry from corridor (low-y side)
    windows: isFirst ? [win('left', d1 / 2 - 2, 4)] : [],
  }));
  out.push(room({
    name: `Unit ${tag} — Kitchen`, type: 'kitchen', floor, x: x0 + livW, y: y0, w: w - livW, h: d1, color: C.kitchen,
    doors: [door('left', 2, 3, 'in-left')],
    windows: isLast ? [win('right', d1 / 2 - 2, 4)] : [],
  }));

  // Front private row: bedroom band + bath stack
  const ry0 = y0 + d1, d2 = d - d1;
  const balcD = d2 >= 16 ? 5 : 4;
  const bathW = r05(w * 0.2);
  const bedBandW = w - bathW;
  const bb = sliceX(x0, x0 + bedBandW, Array(nBed).fill(1));
  for (let i = 0; i < nBed; i++) {
    const bw = bb[i + 1] - bb[i];
    out.push(room({
      name: `Unit ${tag} — Bedroom ${nBed > 1 ? i + 1 : ''}`.trim(), type: 'bedroom', floor,
      x: bb[i], y: ry0, w: bw, h: d2 - balcD, color: C.bedroom,
      doors: [door('back', 2, 3, 'in-right')],
      windows: (i === 0 && isFirst) ? [win('left', (d2 - balcD) / 2 - 2, 4)] : [win('front', bw / 2 - 2, 4)],
    }));
  }
  // Balcony (or refuge area) strip across the bedroom band, at the front edge
  out.push(room({
    name: refuge ? `Refuge Area ${tag}` : `Unit ${tag} — Balcony`, type: refuge ? 'refuge' : 'balcony', floor,
    x: x0, y: ry0 + d2 - balcD, w: bedBandW, h: balcD, color: refuge ? C.refuge : C.balcony,
    doors: [door('back', bedBandW / 2 - 1.5, 3, 'in-left')],
    windows: [win('front', bedBandW / 2 - 2, 5)],
  }));
  // Bath stack column (full private-row depth)
  const tb = sliceY(ry0, ry0 + d2, Array(nBath).fill(1));
  for (let j = 0; j < nBath; j++) {
    const th = tb[j + 1] - tb[j];
    out.push(room({
      name: `Unit ${tag} — Toilet ${nBath > 1 ? j + 1 : ''}`.trim(), type: 'toilet', floor,
      x: x0 + bedBandW, y: tb[j], w: bathW, h: th, color: C.toilet,
      doors: [door('left', 1.5, 2.5, 'in-right')],
      windows: isLast ? [win('right', th / 2 - 1, 2)] : [],
    }));
  }
  return out;
}

export function generateApartment(config: ApartmentConfig): ApartmentResult {
  seq = 0;
  const W = config.plotWidth, D = config.plotDepth;
  const N = Math.min(12, Math.max(3, config.floors));
  const nUnits = config.unitsPerFloor;
  const mix = config.unitMix.slice(0, nUnits);
  while (mix.length < nUnits) mix.push('2bhk');
  const hasRefuge = N > 7;

  // Building footprint within setbacks: 10 ft front, 5 ft sides/rear
  const xL = 5, xR = W - 5, bw = xR - xL;
  const yRear = 5, yFront = D - 10;

  // Shared core (identical on every floor) — rear-right corner
  const CORE = {
    stair: { x: xR - 22, y: yRear, w: 12, h: 10 },
    lift: { x: xR - 10, y: yRear + 1, w: 9, h: 9 },
    lobby: { x: xR - 22, y: yRear + 10, w: 22, h: 8 },
  };
  const coreRooms = (floor: number, ground: boolean): RoomLayout[] => [
    room({ name: 'Staircase', type: 'staircase', floor, ...CORE.stair, color: C.stair, doors: [door('front', 4, 3, 'in-left')] }),
    room({ name: 'Lift', type: 'lift', floor, ...CORE.lift, color: C.lift, doors: [door('front', 3, 3, 'in-right')] }),
    room({
      name: ground ? 'Entrance Lobby' : 'Lift Lobby', type: 'lobby', floor, ...CORE.lobby, color: C.lobby,
      doors: [door('front', CORE.lobby.w / 2 - 2, 4, 'in-right')], windows: [win('right', 2, 4)],
    }),
  ];

  const rooms: RoomLayout[] = [];
  const floorLabels: string[] = [];

  // ── FLOOR 0 — GROUND ──────────────────────────────────────────────────────
  {
    const f = 0;
    rooms.push(...coreRooms(f, true));
    // Garden strip along the front-left, parking filling the rest of the plate
    const gardenW = r05(bw * 0.28);
    rooms.push(room({
      name: 'Landscape / Garden', type: 'garden', floor: f, x: xL, y: yFront - 14, w: gardenW, h: 14, color: C.garden,
    }));
    rooms.push(room({
      name: 'Visitor Parking', type: 'parking', floor: f, x: xL + gardenW, y: yRear, w: (xR - 22) - (xL + gardenW), h: yFront - yRear, color: C.parking,
      doors: [door('front', ((xR - 22) - (xL + gardenW)) / 2 - 2, 5, 'in-right')],
    }));
    rooms.push(room({
      name: 'Stilt Parking', type: 'parking', floor: f, x: xL, y: yRear, w: gardenW, h: (yFront - 14) - yRear, color: C.parking,
    }));
    rooms.push(room({
      name: 'Electrical / Pump Room', type: 'utility', floor: f, x: xR - 22, y: yRear + 18, w: 10, h: 8, color: C.utility,
      doors: [door('left', 2.5, 3, 'in-right')], windows: [win('back', 3, 4)],
    }));
    rooms.push(room({
      name: 'Mailroom / Services', type: 'utility', floor: f, x: xR - 12, y: yRear + 18, w: 11, h: 8, color: C.utility,
      doors: [door('left', 2.5, 3, 'in-right')],
    }));
    floorLabels.push('Ground Floor');
  }

  // ── FLOOR 1 — TYPICAL ─────────────────────────────────────────────────────
  const buildTypical = (f: number, refuge: boolean) => {
    rooms.push(...coreRooms(f, false));
    const corrY0 = yRear + 18, corrH = 6;
    rooms.push(room({
      name: 'Common Corridor', type: 'corridor', floor: f, x: xL, y: corrY0, w: bw, h: corrH, color: C.corridor,
      doors: [door('left', 1.5, 3, 'in-right')],
    }));
    const uy0 = corrY0 + corrH, uy1 = yFront, ud = uy1 - uy0;
    const weights = mix.map(m => (m === '3bhk' ? 1.8 : m === '2bhk' ? 1.4 : 1));
    const ub = sliceX(xL, xR, weights);
    for (let u = 0; u < nUnits; u++) {
      const tag = String.fromCharCode(65 + u);
      const ux0 = ub[u], ux1 = ub[u + 1];
      // Refuge: convert the first unit's balcony to a refuge area on this floor
      rooms.push(...subdivideUnit(ux0, uy0, ux1 - ux0, ud, mix[u], f, tag, u === 0, u === nUnits - 1, refuge && u === 0));
    }
  };
  buildTypical(1, false);
  floorLabels.push(`Typical Floor (1–${N})`);

  // ── REFUGE FLOOR (only for tall towers) ───────────────────────────────────
  let nextFloor = 2;
  if (hasRefuge) {
    buildTypical(2, true);
    floorLabels.push('Refuge Floor');
    nextFloor = 3;
  }

  // ── TERRACE ───────────────────────────────────────────────────────────────
  {
    const f = nextFloor;
    rooms.push(room({ name: 'Open Terrace', type: 'balcony', floor: f, x: xL, y: yRear, w: bw, h: yFront - yRear, color: C.terrace, doors: [door('front', bw / 2 - 1.5, 3, 'in-right')] }));
    rooms.push(room({ name: 'Staircase Cabin', type: 'staircase', floor: f, ...CORE.stair, color: C.stair, doors: [door('front', 4, 3, 'in-left')], windows: [win('back', 4, 3)] }));
    rooms.push(room({ name: 'Lift Machine Room', type: 'lift', floor: f, ...CORE.lift, color: C.lift, doors: [door('front', 3, 3, 'in-right')] }));
    rooms.push(room({ name: 'Overhead Tank', type: 'utility', floor: f, x: xR - 22, y: yRear + 18, w: 12, h: 9, color: C.utility, doors: [door('left', 2.5, 2.5, 'in-right')] }));
    floorLabels.push('Terrace');
  }

  // ── stats ──────────────────────────────────────────────────────────────────
  const area = (r: RoomLayout) => r.w * r.h;
  const isBuilt = (r: RoomLayout) => r.type !== 'parking' && r.type !== 'garden';
  const builtUpPerFloor = Math.round(rooms.filter(r => r.floor === 1 && isBuilt(r)).reduce((a, r) => a + area(r), 0));
  const totalUnits = nUnits * N;
  const totalBuilt = builtUpPerFloor * N + Math.round(rooms.filter(r => r.floor === 0 && isBuilt(r)).reduce((a, r) => a + area(r), 0));
  const carpetByBhk: Record<string, number> = {};
  mix.forEach((m, u) => {
    const tag = String.fromCharCode(65 + u);
    const carpet = Math.round(rooms.filter(r => r.floor === 1 && r.name.startsWith(`Unit ${tag}`)).reduce((a, r) => a + area(r), 0));
    carpetByBhk[`Unit ${tag} (${m.toUpperCase()})`] = carpet;
  });
  const stats: ApartmentStats = {
    totalUnits, builtUpPerFloor,
    far: Math.round((totalBuilt / (W * D)) * 100) / 100,
    parkingSlots: Math.ceil(totalUnits * 1),
    carpetByBhk,
  };

  validateNoOverlaps(rooms);
  return { rooms, floorLabels, stats };
}
