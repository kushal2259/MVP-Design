// ============================================================================
//  MIXED-USE ENGINE — deterministic generator for Apartment + Commercial
//  Typical Indian pattern: Ground = shops, (First = shops/offices),
//  upper floors = apartments, terrace on top.
//
//  Floor model (floors are NOT repeated — one representative plate each):
//    floor 0                  → Ground Commercial (shops + service corridor +
//                               shared core + utility + parking)
//    floor 1 (if 2 comm.)     → First Commercial (double-loaded shops/offices)
//    floor cf                 → Typical Residential (represents all res floors)
//    floor cf+1               → Terrace
//
//  The lift + stair + lobby core occupies the IDENTICAL rects on every floor.
//  All coordinates in FEET. (0,0) = plot corner; the STREET / FRONT edge is
//  at y = plotDepth (renderer & elevation convention: door/window side
//  'front' = the high-y wall, matching the bungalow layoutSolver).
// ============================================================================
import type { RoomLayout, WindowConfig, DoorConfig } from '@/types';

export interface MixedUseConfig {
  plotWidth: number;
  plotDepth: number;
  commercialFloors: 1 | 2;
  residentialFloors: number;            // 2–8
  shopsPerFloor: number;                // 4–10
  unitsPerFloor: 2 | 3;
  unitMix: ('1bhk' | '2bhk')[];         // length === unitsPerFloor
  location: string;
  budgetLakhs: number;
}

export interface MixedUseStats {
  totalShops: number;
  totalUnits: number;
  far: number;
  parkingSlots: number;
  commercialArea: number;
  residentialArea: number;
}

export interface MixedUseResult {
  rooms: RoomLayout[];
  floorLabels: string[];
  stats: MixedUseStats;
}

// ── palette ────────────────────────────────────────────────────────────────
const C = {
  shop: '#ccfbf1',        // teal-ish commercial
  office: '#cffafe',
  corridor: '#f1f5f9',
  lobby: '#fef3c7',
  lift: '#e5e7eb',        // core grey
  stair: '#e5e7eb',
  utility: '#f3f4f6',
  parking: '#e8eaed',
  living: '#ffedd5',      // warm residential
  kitchen: '#fef3c7',
  bedroom: '#fde68a',
  toilet: '#e0e7ff',
  balcony: '#d1fae5',
  terrace: '#ecfdf5',
};

// round to nearest 0.5 ft — boundary-based slicing keeps tiling gap-free
const r05 = (n: number) => Math.round(n * 2) / 2;

let seq = 0;
const rid = (tag: string) => `mx-${tag}-${++seq}`;

function win(side: WindowConfig['side'], offset: number, width = 4): WindowConfig {
  return { id: rid('w'), side, offset: r05(Math.max(0.5, offset)), width };
}
function door(side: DoorConfig['side'], offset: number, width = 3, openDirection: DoorConfig['openDirection'] = 'in-right', idTag = 'd'): DoorConfig {
  return { id: rid(idTag), side, offset: r05(Math.max(0.5, offset)), width, openDirection };
}

function room(
  partial: Pick<RoomLayout, 'name' | 'type' | 'floor'> & { x: number; y: number; w: number; h: number; color?: string; windows?: WindowConfig[]; doors?: DoorConfig[] },
): RoomLayout {
  return {
    id: rid(partial.type),
    name: partial.name,
    type: partial.type,
    x: r05(partial.x), y: r05(partial.y), w: r05(partial.w), h: r05(partial.h),
    floor: partial.floor,
    color: partial.color,
    windows: partial.windows || [],
    doors: partial.doors || [],
    furniture: [],
  };
}

/** Split [x0, x1] into n segments with given weights → boundary array (length n+1). */
function sliceX(x0: number, x1: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const bounds = [x0];
  let acc = x0;
  for (let i = 0; i < weights.length - 1; i++) {
    acc += (x1 - x0) * (weights[i] / total);
    bounds.push(r05(acc));
  }
  bounds.push(x1);
  return bounds;
}

// ── overlap validation ─────────────────────────────────────────────────────
/**
 * Checks every floor for room-rectangle overlaps. Pairs where one room fully
 * contains the other are skipped (e.g. the full-footprint open terrace slab
 * deliberately sits behind the stair cabin / tank). console.warn on violation.
 */
export function validateNoOverlaps(rooms: RoomLayout[]): string[] {
  const EPS = 0.01;
  const issues: string[] = [];
  const floors = Array.from(new Set(rooms.map(r => r.floor)));
  for (const f of floors) {
    const fr = rooms.filter(r => r.floor === f);
    for (let i = 0; i < fr.length; i++) {
      for (let j = i + 1; j < fr.length; j++) {
        const a = fr[i], b = fr[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > EPS && oy > EPS) {
          const aInB = a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;
          const bInA = b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS;
          if (aInB || bInA) continue; // background slab containment — intended
          issues.push(`Floor ${f}: "${a.name}" overlaps "${b.name}" (${ox.toFixed(1)}×${oy.toFixed(1)} ft)`);
        }
      }
    }
  }
  issues.forEach(msg => console.warn('[mixedUseEngine] overlap:', msg));
  return issues;
}

// ── main generator ─────────────────────────────────────────────────────────
export function generateMixedUse(config: MixedUseConfig): MixedUseResult {
  seq = 0;
  const W = config.plotWidth;
  const D = config.plotDepth;
  const cf = config.commercialFloors;
  const rf = Math.min(8, Math.max(2, config.residentialFloors));
  const nShops = Math.min(10, Math.max(4, config.shopsPerFloor));
  const nUnits = config.unitsPerFloor;
  const mix = config.unitMix.slice(0, nUnits);
  while (mix.length < nUnits) mix.push('2bhk');

  // Setbacks: 10ft front, 5ft sides/rear. Shops may project to the front
  // setback line (commercial frontage) — shop fronts at D - 2.
  const xL = 5, xR = W - 5, bw = xR - xL;
  const yRear = 5;
  const resFrontY = D - 10;           // residential floors respect front setback
  const shopFrontY = D - 2;           // commercial frontage on the setback line

  // ── SHARED CORE — identical rects on EVERY floor ─────────────────────────
  const CORE = {
    stair: { x: xR - 20, y: yRear, w: 12, h: 10 },        // staircase 12×10
    lift: { x: xR - 8, y: yRear + 2, w: 8, h: 8 },        // lift 8×8 (door at lobby)
    lobby: { x: xR - 20, y: yRear + 10, w: 20, h: 8 },    // lobby 20×8
  };

  const coreRooms = (floor: number, isGround: boolean): RoomLayout[] => [
    room({
      name: 'Staircase', type: 'staircase', floor, ...CORE.stair, color: C.stair,
      doors: [door('front', 4, 3, 'in-left')],
    }),
    room({
      name: 'Lift', type: 'lift', floor, ...CORE.lift, color: C.lift,
      doors: [door('front', 2.5, 3, 'in-right')],
    }),
    room({
      name: isGround ? 'Residents’ Entrance Lobby' : 'Lift Lobby', type: 'lobby', floor, ...CORE.lobby, color: C.lobby,
      doors: [door('front', CORE.lobby.w / 2 - 2, 4, 'in-right', isGround ? 'd-lobby-main-entry' : 'd-lobby')],
      windows: [win('right', 2, 4)],
    }),
  ];

  const rooms: RoomLayout[] = [];
  const floorLabels: string[] = [];

  // ════ FLOOR 0 — GROUND COMMERCIAL ════════════════════════════════════════
  {
    const f = 0;
    const shopDepth = Math.min(20, Math.max(12, D - 52));
    const shopY0 = shopFrontY - shopDepth;
    const corrY0 = shopY0 - 6;

    // Row of shops along the street frontage
    const sb = sliceX(xL, xR, Array(nShops).fill(1));
    for (let i = 0; i < nShops; i++) {
      const sw = sb[i + 1] - sb[i];
      rooms.push(room({
        name: `Shop ${i + 1}`, type: 'shop', floor: f,
        x: sb[i], y: shopY0, w: sw, h: shopDepth, color: C.shop,
        doors: [
          door('front', 1, Math.min(6, sw - 3), 'in-right', 'd-shutter'),  // front rolling shutter
          door('back', sw / 2 - 1.5, 3, 'in-left'),                        // rear service door
        ],
        windows: sw >= 10 ? [win('front', sw - 5, 4)] : [],
      }));
    }

    // Service corridor behind the shops
    rooms.push(room({
      name: 'Service Corridor', type: 'corridor', floor: f,
      x: xL, y: corrY0, w: bw, h: 6, color: C.corridor,
      doors: [door('right', 1.5, 3, 'in-left')],
    }));

    // Driveway / open visitor parking between corridor and rear band
    rooms.push(room({
      name: 'Driveway / Visitor Parking', type: 'parking', floor: f,
      x: xL, y: yRear + 18, w: bw, h: corrY0 - (yRear + 18), color: C.parking,
      doors: [door('front', bw / 2 - 2, 4, 'in-right')],
    }));

    // Rear band: utility (left), covered parking strip (middle), core (right)
    rooms.push(room({
      name: 'Electrical / Pump Room', type: 'utility', floor: f,
      x: xL, y: yRear, w: 10, h: 8, color: C.utility,
      doors: [door('front', 3.5, 3, 'in-right')],
      windows: [win('back', 3, 4)],
    }));
    rooms.push(room({
      name: 'Covered Parking', type: 'parking', floor: f,
      x: xL + 10, y: yRear, w: (xR - 20) - (xL + 10), h: 18, color: C.parking,
      doors: [door('front', ((xR - 20) - (xL + 10)) / 2 - 2, 4, 'in-right')],
    }));
    rooms.push(...coreRooms(f, true));

    floorLabels.push('Ground — Shops');
  }

  // ════ FLOOR 1 — FIRST COMMERCIAL (double-loaded corridor) ════════════════
  if (cf === 2) {
    const f = 1;
    const shopDepth = Math.min(20, Math.max(12, D - 52));
    const shopY0 = shopFrontY - shopDepth;
    const corrY0 = shopY0 - 6;

    // Front side of corridor: shops
    const sb = sliceX(xL, xR, Array(nShops).fill(1));
    for (let i = 0; i < nShops; i++) {
      const sw = sb[i + 1] - sb[i];
      rooms.push(room({
        name: `Shop F1-${i + 1}`, type: 'shop', floor: f,
        x: sb[i], y: shopY0, w: sw, h: shopDepth, color: C.shop,
        doors: [door('back', sw / 2 - 1.5, 3, 'in-left')],   // entry from corridor
        windows: [win('front', sw / 2 - 2, 4)],
      }));
    }

    // Central corridor (double loaded)
    rooms.push(room({
      name: 'Central Corridor', type: 'corridor', floor: f,
      x: xL, y: corrY0, w: bw, h: 6, color: C.corridor,
      doors: [door('right', 1.5, 3, 'in-left')],
    }));

    // Rear side of corridor: offices
    const nOff = Math.max(2, nShops - 2);
    const ob = sliceX(xL, xR, Array(nOff).fill(1));
    for (let i = 0; i < nOff; i++) {
      const ow = ob[i + 1] - ob[i];
      rooms.push(room({
        name: `Office ${i + 1}`, type: 'office', floor: f,
        x: ob[i], y: yRear + 18, w: ow, h: corrY0 - (yRear + 18), color: C.office,
        doors: [door('front', ow / 2 - 1.5, 3, 'in-right')], // opens to corridor
        windows: i === 0 ? [win('left', 3, 4)] : i === nOff - 1 ? [win('right', 3, 4)] : [],
      }));
    }

    // Large rear office suite beside the core
    rooms.push(room({
      name: 'Office Suite', type: 'office', floor: f,
      x: xL, y: yRear, w: (xR - 20) - xL, h: 18, color: C.office,
      doors: [door('front', ((xR - 20) - xL) / 2 - 1.5, 3, 'in-right')],
      windows: [win('back', 4, 4), win('back', (xR - 20) - xL - 8, 4), win('left', 4, 4)],
    }));
    rooms.push(...coreRooms(f, false));

    floorLabels.push('First — Shops/Offices');
  }

  // ════ FLOOR cf — TYPICAL RESIDENTIAL (represents all residential floors) ═
  const typicalFloor = cf;
  {
    const f = typicalFloor;
    rooms.push(...coreRooms(f, false));

    // Corridor from the lobby serving all units
    const corrY0 = yRear + 18, corrH = 6;
    rooms.push(room({
      name: 'Common Corridor', type: 'corridor', floor: f,
      x: xL, y: corrY0, w: bw, h: corrH, color: C.corridor,
      doors: [door('left', 1.5, 3, 'in-right')],
    }));

    // Units tile the floor plate in front of the corridor (no overlaps/gaps —
    // boundary-based proportional slicing)
    const uy0 = corrY0 + corrH;                  // 29
    const uy1 = resFrontY;                       // D - 10
    const ud = uy1 - uy0;                        // unit depth
    const weights = mix.map(m => (m === '2bhk' ? 1.4 : 1));
    const ub = sliceX(xL, xR, weights);

    for (let u = 0; u < nUnits; u++) {
      const tag = String.fromCharCode(65 + u);   // A, B, C
      const ux0 = ub[u], ux1 = ub[u + 1], uw = ux1 - ux0;
      const isFirst = u === 0, isLast = u === nUnits - 1;
      const bhk = mix[u];

      // Row 1 (rear, faces corridor): living + kitchen
      const d1 = r05(ud * 0.4);
      const livW = r05(uw * 0.58);
      rooms.push(room({
        name: `Unit ${tag} — Living`, type: 'living', floor: f,
        x: ux0, y: uy0, w: livW, h: d1, color: C.living,
        doors: [door('back', 2, 3, 'in-right')], // unit entry from corridor
        windows: isFirst ? [win('left', d1 / 2 - 2, 4)] : [],
      }));
      rooms.push(room({
        name: `Unit ${tag} — Kitchen`, type: 'kitchen', floor: f,
        x: ux0 + livW, y: uy0, w: uw - livW, h: d1, color: C.kitchen,
        doors: [door('left', 2, 3, 'in-left')],
        windows: isLast ? [win('right', d1 / 2 - 2, 4)] : [],
      }));

      // Row 2 (front): bedrooms + toilets + balcony
      const ry0 = uy0 + d1, d2 = ud - d1;
      const balcD = d2 >= 16 ? 5 : 4;

      if (bhk === '2bhk') {
        const c1 = r05(uw * 0.42), c2 = r05(uw * 0.36);
        const x1 = ux0 + c1, x2 = x1 + c2;
        // Column 1: Bedroom 1 + front balcony
        rooms.push(room({
          name: `Unit ${tag} — Bedroom 1`, type: 'bedroom', floor: f,
          x: ux0, y: ry0, w: c1, h: d2 - balcD, color: C.bedroom,
          doors: [door('back', 2, 3, 'in-right')],
          windows: isFirst ? [win('left', (d2 - balcD) / 2 - 2, 4)] : [],
        }));
        rooms.push(room({
          name: `Unit ${tag} — Balcony`, type: 'balcony', floor: f,
          x: ux0, y: ry0 + d2 - balcD, w: c1, h: balcD, color: C.balcony,
          doors: [door('back', c1 / 2 - 1.5, 3, 'in-left')],
          windows: [win('front', c1 / 2 - 2, 4)],
        }));
        // Column 2: Bedroom 2 (full depth, front-facing)
        rooms.push(room({
          name: `Unit ${tag} — Bedroom 2`, type: 'bedroom', floor: f,
          x: x1, y: ry0, w: c2, h: d2, color: C.bedroom,
          doors: [door('back', 2, 3, 'in-left')],
          windows: [win('front', c2 / 2 - 2, 4)],
        }));
        // Column 3: two stacked toilets
        const c3 = ux1 - x2;
        const t1d = r05(d2 * 0.45);
        rooms.push(room({
          name: `Unit ${tag} — Toilet 1`, type: 'toilet', floor: f,
          x: x2, y: ry0, w: c3, h: t1d, color: C.toilet,
          doors: [door('left', 1.5, 2.5, 'in-right')],
          windows: isLast ? [win('right', t1d / 2 - 1, 2)] : [],
        }));
        rooms.push(room({
          name: `Unit ${tag} — Toilet 2`, type: 'toilet', floor: f,
          x: x2, y: ry0 + t1d, w: c3, h: d2 - t1d, color: C.toilet,
          doors: [door('left', 1.5, 2.5, 'in-right')],
          windows: [win('front', c3 / 2 - 1, 2)],
        }));
      } else {
        // 1 BHK
        const c1 = r05(uw * 0.58);
        const x1 = ux0 + c1;
        rooms.push(room({
          name: `Unit ${tag} — Bedroom`, type: 'bedroom', floor: f,
          x: ux0, y: ry0, w: c1, h: d2 - balcD, color: C.bedroom,
          doors: [door('back', 2, 3, 'in-right')],
          windows: isFirst ? [win('left', (d2 - balcD) / 2 - 2, 4)] : [],
        }));
        rooms.push(room({
          name: `Unit ${tag} — Balcony`, type: 'balcony', floor: f,
          x: ux0, y: ry0 + d2 - balcD, w: c1, h: balcD, color: C.balcony,
          doors: [door('back', c1 / 2 - 1.5, 3, 'in-left')],
          windows: [win('front', c1 / 2 - 2, 4)],
        }));
        const c2 = ux1 - x1;
        const t1d = r05(d2 * 0.45);
        rooms.push(room({
          name: `Unit ${tag} — Toilet`, type: 'toilet', floor: f,
          x: x1, y: ry0, w: c2, h: t1d, color: C.toilet,
          doors: [door('left', 1.5, 2.5, 'in-right')],
          windows: isLast ? [win('right', t1d / 2 - 1, 2)] : [],
        }));
        rooms.push(room({
          name: `Unit ${tag} — Utility / Store`, type: 'utility', floor: f,
          x: x1, y: ry0 + t1d, w: c2, h: d2 - t1d, color: C.utility,
          doors: [door('back', 1.5, 2.5, 'in-left')],
          windows: [win('front', c2 / 2 - 1, 3)],
        }));
      }
    }

    floorLabels.push(`Typical Residential (${cf}–${cf + rf - 1})`);
  }

  // ════ FLOOR cf+1 — TERRACE ═══════════════════════════════════════════════
  {
    const f = typicalFloor + 1;
    // Open terrace slab FIRST — renders as SVG background behind cabins
    rooms.push(room({
      name: 'Open Terrace', type: 'balcony', floor: f,
      x: xL, y: yRear, w: bw, h: resFrontY - yRear, color: C.terrace,
      doors: [door('front', bw / 2 - 1.5, 3, 'in-right')],
    }));
    rooms.push(room({
      name: 'Staircase Cabin', type: 'staircase', floor: f, ...CORE.stair, color: C.stair,
      doors: [door('front', 4, 3, 'in-left')],
      windows: [win('back', 4, 3)],
    }));
    rooms.push(room({
      name: 'Lift Machine Room', type: 'lift', floor: f, ...CORE.lift, color: C.lift,
      doors: [door('front', 2.5, 3, 'in-right')],
    }));
    rooms.push(room({
      name: 'Overhead Tank', type: 'utility', floor: f,
      x: xR - 20, y: yRear + 18, w: 10, h: 8, color: C.utility,
      doors: [door('left', 2.5, 2.5, 'in-right')],
    }));

    floorLabels.push('Terrace');
  }

  // ── stats ─────────────────────────────────────────────────────────────────
  const area = (r: RoomLayout) => r.w * r.h;
  const isBuilt = (r: RoomLayout) => r.type !== 'parking';
  const groundArea = rooms.filter(r => r.floor === 0 && isBuilt(r)).reduce((a, r) => a + area(r), 0);
  const firstArea = cf === 2 ? rooms.filter(r => r.floor === 1 && isBuilt(r)).reduce((a, r) => a + area(r), 0) : 0;
  const typicalArea = rooms.filter(r => r.floor === typicalFloor).reduce((a, r) => a + area(r), 0);

  const commercialArea = Math.round(groundArea + firstArea);
  const residentialArea = Math.round(typicalArea * rf);
  const totalShops = nShops * cf;
  const totalUnits = nUnits * rf;
  const stats: MixedUseStats = {
    totalShops,
    totalUnits,
    far: Math.round(((commercialArea + residentialArea) / (W * D)) * 100) / 100,
    parkingSlots: Math.ceil(totalShops * 0.5 + totalUnits * 1),
    commercialArea,
    residentialArea,
  };

  validateNoOverlaps(rooms);
  return { rooms, floorLabels, stats };
}
