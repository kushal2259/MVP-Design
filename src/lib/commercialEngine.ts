// ============================================================================
//  COMMERCIAL ENGINE — deterministic generator for commercial buildings
//  (office / mall / hotel / hospital / school). Floors are NOT repeated — one
//  representative plate each:
//    floor 0     → Ground (entrance plaza + reception/atrium + core + program)
//    floor 1     → Typical Floor (represents floors 1..N-1)
//    last floor  → Roof (stair cabins, lift machine room, plant, open roof)
//
//  Shared skeleton: rear-center SERVICE CORE (2 lifts + fire stair + toilets +
//  AHU) identical on every floor, plus a SECOND ESCAPE STAIR at the opposite
//  corner (NBC two-exit rule). All coordinates in FEET; (0,0) = plot corner.
// ============================================================================
import type { RoomLayout, WindowConfig, DoorConfig } from '@/types';

export type CommercialUse = 'office' | 'mall' | 'hotel' | 'hospital' | 'school';

export interface CommercialConfig {
  plotWidth: number;
  plotDepth: number;
  floors: number;            // habitable floors above ground (2–10)
  use: CommercialUse;
  location: string;
  budgetLakhs: number;
}

export interface CommercialStats {
  totalBuiltUp: number;
  far: number;
  occupancyLoad: number;
  parkingSlots: number;
  unitsOrRooms: number;
}

export interface CommercialResult {
  rooms: RoomLayout[];
  floorLabels: string[];
  stats: CommercialStats;
  use: CommercialUse;
  occFactor: number;         // sqft per person (for occupancy tab)
}

const C = {
  office: '#ffedd5', shop: '#fed7aa', foodcourt: '#fde68a', unit: '#fef3c7',
  reception: '#fef9c3', corridor: '#f1f5f9', lift: '#e5e7eb', stair: '#e5e7eb',
  toilet: '#e0e7ff', utility: '#f3f4f6', store: '#f5f5f4', parking: '#e8eaed',
  garden: '#bbf7d0', roof: '#ecfdf5', kitchen: '#dcfce7',
};

const r05 = (n: number) => Math.round(n * 2) / 2;
let seq = 0;
const rid = (t: string) => `cm-${t}-${++seq}`;
function win(side: WindowConfig['side'], offset: number, width = 5): WindowConfig { return { id: rid('w'), side, offset: r05(Math.max(0.5, offset)), width }; }
function door(side: DoorConfig['side'], offset: number, width = 3.5, openDirection: DoorConfig['openDirection'] = 'in-right'): DoorConfig { return { id: rid('d'), side, offset: r05(Math.max(0.5, offset)), width, openDirection }; }
function room(p: Pick<RoomLayout, 'name' | 'type' | 'floor'> & { x: number; y: number; w: number; h: number; color?: string; windows?: WindowConfig[]; doors?: DoorConfig[] }): RoomLayout {
  return { id: rid(p.type), name: p.name, type: p.type, x: r05(p.x), y: r05(p.y), w: r05(p.w), h: r05(p.h), floor: p.floor, color: p.color, windows: p.windows || [], doors: p.doors || [], furniture: [] };
}
function sliceX(x0: number, x1: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0); const bounds = [x0]; let acc = x0;
  for (let i = 0; i < weights.length - 1; i++) { acc += (x1 - x0) * (weights[i] / total); bounds.push(r05(acc)); }
  bounds.push(x1); return bounds;
}

export function validateNoOverlaps(rooms: RoomLayout[]): string[] {
  const EPS = 0.01; const issues: string[] = [];
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
  issues.forEach(m => console.warn('[commercialEngine] overlap:', m));
  return issues;
}

const OCC_FACTOR: Record<CommercialUse, number> = { office: 100, mall: 30, hotel: 200, hospital: 120, school: 40 };

export function generateCommercial(config: CommercialConfig): CommercialResult {
  seq = 0;
  const W = config.plotWidth, D = config.plotDepth;
  const N = Math.min(10, Math.max(2, config.floors));
  const use = config.use;

  // Setbacks 12 ft front, 6 ft sides/rear
  const xL = 6, xR = W - 6, bw = xR - xL;
  const yRear = 6, yFront = D - 12;

  // Service core (rear-center) + second escape stair (front-left corner)
  const coreW = 34, coreX = r05((xL + xR) / 2 - coreW / 2);
  const CORE = {
    lift1: { x: coreX, y: yRear, w: 8, h: 8 },
    lift2: { x: coreX + 9, y: yRear, w: 8, h: 8 },
    stair: { x: coreX + 18, y: yRear, w: 14, h: 11 },           // fire stair
    toiletM: { x: coreX, y: yRear + 9, w: 9, h: 8 },
    toiletW: { x: coreX + 9, y: yRear + 9, w: 9, h: 8 },
    ahu: { x: coreX + 18, y: yRear + 11, w: 14, h: 6 },
  };
  const escStair = { x: xL, y: yRear, w: 12, h: 11 };            // second egress

  const coreRooms = (floor: number): RoomLayout[] => [
    room({ name: 'Lift 1', type: 'lift', floor, ...CORE.lift1, color: C.lift, doors: [door('front', 2.5, 3, 'in-right')] }),
    room({ name: 'Lift 2', type: 'lift', floor, ...CORE.lift2, color: C.lift, doors: [door('front', 2.5, 3, 'in-right')] }),
    room({ name: 'Fire Staircase', type: 'staircase', floor, ...CORE.stair, color: C.stair, doors: [door('front', 5, 3.5, 'in-left')] }),
    room({ name: "Toilet (M)", type: 'toilet', floor, ...CORE.toiletM, color: C.toilet, doors: [door('front', 3, 3, 'in-right')] }),
    room({ name: "Toilet (W)", type: 'toilet', floor, ...CORE.toiletW, color: C.toilet, doors: [door('front', 3, 3, 'in-right')] }),
    room({ name: 'AHU / Electrical', type: 'utility', floor, ...CORE.ahu, color: C.utility, doors: [door('front', 5, 3, 'in-right')] }),
    room({ name: 'Escape Staircase', type: 'staircase', floor, ...escStair, color: C.stair, doors: [door('front', 4, 3.5, 'in-left')], windows: [win('left', 4, 4)] }),
  ];

  const rooms: RoomLayout[] = [];
  const floorLabels: string[] = [];
  let unitsOrRooms = 0;

  // Cellular-rooms-along-corridor program used by hotel/hospital/school
  const cellular = (f: number, namer: (i: number) => string, cellType: RoomLayout['type'], singleLoaded: boolean) => {
    const corrY = yRear + 18, corrH = 7;
    rooms.push(room({ name: 'Corridor', type: 'corridor', floor: f, x: xL, y: corrY, w: bw, h: corrH, color: C.corridor, doors: [door('left', 2, 3.5, 'in-right')] }));
    // Front band of cells
    const cellD = singleLoaded ? (yFront - (corrY + corrH)) : r05((yFront - (corrY + corrH)));
    const frontY = corrY + corrH;
    const nCells = Math.max(4, Math.round(bw / 16));
    const cb = sliceX(xL, xR, Array(nCells).fill(1));
    for (let i = 0; i < nCells; i++) {
      const cw = cb[i + 1] - cb[i];
      rooms.push(room({ name: namer(i), type: cellType, floor: f, x: cb[i], y: frontY, w: cw, h: cellD, color: C.unit, doors: [door('back', cw / 2 - 1.5, 3, 'in-right')], windows: [win('front', cw / 2 - 2.5, 5)] }));
      unitsOrRooms++;
    }
    // Rear band of cells (double-loaded only) between core sides and rear wall
    if (!singleLoaded) {
      // Left rear strip
      const leftW = coreX - escStair.x - escStair.w;
      if (leftW > 14) {
        const nL = Math.max(1, Math.round(leftW / 16));
        const lb = sliceX(escStair.x + escStair.w, coreX, Array(nL).fill(1));
        for (let i = 0; i < nL; i++) { const cw = lb[i + 1] - lb[i]; rooms.push(room({ name: namer(nCells + i), type: cellType, floor: f, x: lb[i], y: yRear, w: cw, h: 17, color: C.unit, doors: [door('front', cw / 2 - 1.5, 3, 'in-right')], windows: [win('back', cw / 2 - 2.5, 5)] })); unitsOrRooms++; }
      }
      // Right rear strip
      const rightW = xR - (coreX + coreW);
      if (rightW > 14) {
        const nR = Math.max(1, Math.round(rightW / 16));
        const rb = sliceX(coreX + coreW, xR, Array(nR).fill(1));
        for (let i = 0; i < nR; i++) { const cw = rb[i + 1] - rb[i]; rooms.push(room({ name: namer(nCells + 10 + i), type: cellType, floor: f, x: rb[i], y: yRear, w: cw, h: 17, color: C.unit, doors: [door('front', cw / 2 - 1.5, 3, 'in-right')], windows: [win('back', cw / 2 - 2.5, 5)] })); unitsOrRooms++; }
      }
    }
  };

  const buildTypical = (f: number, ground: boolean) => {
    rooms.push(...coreRooms(f));
    if (use === 'office') {
      const corrY = yRear + 18, corrH = 7;
      rooms.push(room({ name: 'Corridor', type: 'corridor', floor: f, x: xL, y: corrY, w: bw, h: corrH, color: C.corridor, doors: [door('left', 2, 3.5, 'in-right')] }));
      if (ground) {
        rooms.push(room({ name: 'Reception / Atrium', type: 'reception', floor: f, x: xL, y: corrY + corrH, w: bw, h: yFront - (corrY + corrH), color: C.reception, doors: [door('front', bw / 2 - 3, 6, 'in-right')], windows: [win('front', 6, 6), win('front', bw - 12, 6)] }));
        unitsOrRooms += 1;
      } else {
        // Open office (front) + cabins (rear strips)
        const fb = sliceX(xL, xR, [1, 1]);
        rooms.push(room({ name: 'Open Office A', type: 'office', floor: f, x: xL, y: corrY + corrH, w: fb[1] - xL, h: yFront - (corrY + corrH), color: C.office, doors: [door('back', 3, 3.5, 'in-right')], windows: [win('front', 6, 6), win('left', 6, 6)] }));
        rooms.push(room({ name: 'Open Office B', type: 'office', floor: f, x: fb[1], y: corrY + corrH, w: xR - fb[1], h: yFront - (corrY + corrH), color: C.office, doors: [door('back', 3, 3.5, 'in-right')], windows: [win('front', 6, 6), win('right', 6, 6)] }));
        // Rear cabins beside the core
        const leftW = coreX - (escStair.x + escStair.w);
        if (leftW > 14) { const nL = Math.max(2, Math.round(leftW / 12)); const lb = sliceX(escStair.x + escStair.w, coreX, Array(nL).fill(1)); for (let i = 0; i < nL; i++) { const cw = lb[i + 1] - lb[i]; rooms.push(room({ name: i === 0 ? 'Conference' : `Cabin ${i}`, type: 'office', floor: f, x: lb[i], y: yRear, w: cw, h: 17, color: C.office, doors: [door('front', cw / 2 - 1.5, 3, 'in-right')], windows: [win('back', cw / 2 - 2.5, 5)] })); } }
        const rightW = xR - (coreX + coreW);
        if (rightW > 14) { rooms.push(room({ name: 'Pantry', type: 'kitchen', floor: f, x: coreX + coreW, y: yRear, w: r05(rightW / 2), h: 17, color: C.kitchen, doors: [door('front', 2, 3, 'in-right')], windows: [win('back', 3, 4)] })); rooms.push(room({ name: 'Server / Store', type: 'store', floor: f, x: coreX + coreW + r05(rightW / 2), y: yRear, w: rightW - r05(rightW / 2), h: 17, color: C.store, doors: [door('front', 2, 3, 'in-right')] })); }
        unitsOrRooms += 3;
      }
    } else if (use === 'mall') {
      const corrY = yRear + 18, corrH = 8;
      if (ground) {
        rooms.push(room({ name: 'Mall Concourse', type: 'corridor', floor: f, x: xL, y: corrY, w: bw, h: corrH, color: C.corridor, doors: [door('left', 2, 4, 'in-right')] }));
        rooms.push(room({ name: 'Anchor Store', type: 'shop', floor: f, x: xL, y: corrY + corrH, w: r05(bw * 0.5), h: yFront - (corrY + corrH), color: C.shop, doors: [door('back', 4, 6, 'in-right')], windows: [win('front', 8, 8)] }));
        const sb = sliceX(xL + r05(bw * 0.5), xR, [1, 1, 1]);
        for (let i = 0; i < 3; i++) { const sw = sb[i + 1] - sb[i]; rooms.push(room({ name: `Shop G-${i + 1}`, type: 'shop', floor: f, x: sb[i], y: corrY + corrH, w: sw, h: yFront - (corrY + corrH), color: C.shop, doors: [door('back', sw / 2 - 2, 4, 'in-right')], windows: [win('front', sw / 2 - 3, 6)] })); }
        unitsOrRooms += 4;
      } else {
        // Atrium void in the centre, shops along both sides. Shared slice
        // boundaries → exact gap-free / overlap-free tiling of [xL,xR].
        const zb = sliceX(xL, xR, [0.35, 0.3, 0.35]);   // [xL, a, b, xR]
        const isTop = f === N; // top typical → food court
        rooms.push(room({ name: 'Atrium Void', type: 'corridor', floor: f, x: zb[1], y: corrY, w: zb[2] - zb[1], h: yFront - corrY, color: C.corridor }));
        const leftShops = sliceX(zb[0], zb[1], [1, 1]);
        const rightShops = sliceX(zb[2], zb[3], [1, 1]);
        for (let i = 0; i < 2; i++) { const sw = leftShops[i + 1] - leftShops[i]; rooms.push(room({ name: isTop ? `Food Stall L${i + 1}` : `Shop L-${i + 1}`, type: isTop ? 'foodcourt' : 'shop', floor: f, x: leftShops[i], y: corrY, w: sw, h: yFront - corrY, color: isTop ? C.foodcourt : C.shop, doors: [door('right', 3, 4, 'in-right')], windows: [win('left', 4, 6)] })); unitsOrRooms++; }
        for (let i = 0; i < 2; i++) { const sw = rightShops[i + 1] - rightShops[i]; rooms.push(room({ name: isTop ? `Food Stall R${i + 1}` : `Shop R-${i + 1}`, type: isTop ? 'foodcourt' : 'shop', floor: f, x: rightShops[i], y: corrY, w: sw, h: yFront - corrY, color: isTop ? C.foodcourt : C.shop, doors: [door('left', 3, 4, 'in-right')], windows: [win('right', 4, 6)] })); unitsOrRooms++; }
      }
    } else {
      // hotel / hospital / school — cellular rooms along corridor
      const namer =
        use === 'hotel' ? (i: number) => `Room ${f}${String(i + 1).padStart(2, '0')}` :
        use === 'hospital' ? (i: number) => (ground ? ['OPD', 'Emergency', 'Pharmacy', 'Lab', 'Consult 1', 'Consult 2'][i] || `Ward ${i}` : `Ward ${i + 1}`) :
        (i: number) => (ground ? ['Admin Office', 'Library', 'Staff Room', 'Classroom 1', 'Classroom 2'][i] || `Classroom ${i}` : `Classroom ${f}${String(i + 1).padStart(2, '0')}`);
      if (ground) {
        // Ground gets a reception + program band instead of full cellular
        const corrY = yRear + 18, corrH = 7;
        rooms.push(room({ name: 'Corridor', type: 'corridor', floor: f, x: xL, y: corrY, w: bw, h: corrH, color: C.corridor, doors: [door('left', 2, 3.5, 'in-right')] }));
        const recName = use === 'hotel' ? 'Lobby Lounge' : use === 'hospital' ? 'OPD Reception' : 'Reception / Admin';
        const rb = sliceX(xL, xR, [1.4, 1, 1]);
        rooms.push(room({ name: recName, type: 'reception', floor: f, x: xL, y: corrY + corrH, w: rb[1] - xL, h: yFront - (corrY + corrH), color: C.reception, doors: [door('front', 4, 6, 'in-right')], windows: [win('front', 6, 6)] }));
        const second = use === 'hotel' ? 'Restaurant' : use === 'hospital' ? 'Pharmacy' : 'Library';
        rooms.push(room({ name: second, type: use === 'hotel' ? 'foodcourt' : use === 'hospital' ? 'store' : 'office', floor: f, x: rb[1], y: corrY + corrH, w: rb[2] - rb[1], h: yFront - (corrY + corrH), color: use === 'hotel' ? C.foodcourt : C.store, doors: [door('back', 3, 3.5, 'in-right')], windows: [win('front', 4, 6)] }));
        const third = use === 'hotel' ? 'Back of House' : use === 'hospital' ? 'Emergency' : 'Assembly Hall';
        rooms.push(room({ name: third, type: use === 'school' ? 'reception' : 'utility', floor: f, x: rb[2], y: corrY + corrH, w: xR - rb[2], h: yFront - (corrY + corrH), color: use === 'school' ? C.reception : C.utility, doors: [door('back', 3, 3.5, 'in-right')], windows: [win('front', 4, 6), win('right', 4, 6)] }));
        unitsOrRooms += 3;
      } else {
        cellular(f, namer, 'unit', use === 'school');
      }
    }
  };

  // ── FLOOR 0 — GROUND (with front plaza/parking) ───────────────────────────
  buildTypical(0, true);
  // Ground front plaza is the front setback (not a room); add front parking strip + garden along the front band inside plate edges? Keep parking in setback as a labelled strip:
  rooms.push(room({ name: 'Drop-off / Parking', type: 'parking', floor: 0, x: xL, y: yFront, w: bw, h: 0.5, color: C.parking }));
  floorLabels.push('Ground Floor');

  // ── FLOOR 1 — TYPICAL ─────────────────────────────────────────────────────
  buildTypical(1, false);
  floorLabels.push(`Typical Floor (1–${N})`);

  // ── ROOF ────────────────────────────────────────────────────────────────────
  {
    const f = 2;
    rooms.push(room({ name: 'Open Roof', type: 'balcony', floor: f, x: xL, y: yRear, w: bw, h: yFront - yRear, color: C.roof, doors: [door('front', bw / 2 - 1.5, 3, 'in-right')] }));
    rooms.push(room({ name: 'Fire Stair Cabin', type: 'staircase', floor: f, ...CORE.stair, color: C.stair, doors: [door('front', 5, 3.5, 'in-left')] }));
    rooms.push(room({ name: 'Escape Stair Cabin', type: 'staircase', floor: f, ...escStair, color: C.stair, doors: [door('front', 4, 3.5, 'in-left')] }));
    rooms.push(room({ name: 'Lift Machine Room', type: 'lift', floor: f, x: CORE.lift1.x, y: CORE.lift1.y, w: 17, h: 8, color: C.lift, doors: [door('front', 7, 3, 'in-right')] }));
    // Plant sits below the stair/lift cabins (which extend to yRear+11) to avoid overlap
    rooms.push(room({ name: 'Chiller / AHU Plant', type: 'utility', floor: f, x: coreX, y: yRear + 12, w: coreW, h: 8, color: C.utility, doors: [door('front', coreW / 2 - 2, 3, 'in-right')] }));
    rooms.push(room({ name: 'Overhead Tank', type: 'utility', floor: f, x: xR - 14, y: yRear + 18, w: 12, h: 9, color: C.utility, doors: [door('left', 2.5, 2.5, 'in-right')] }));
    floorLabels.push('Roof');
  }

  // ── stats ──────────────────────────────────────────────────────────────────
  const area = (r: RoomLayout) => r.w * r.h;
  const isBuilt = (r: RoomLayout) => r.type !== 'parking' && r.type !== 'garden';
  const typicalBuilt = Math.round(rooms.filter(r => r.floor === 1 && isBuilt(r)).reduce((a, r) => a + area(r), 0));
  const groundBuilt = Math.round(rooms.filter(r => r.floor === 0 && isBuilt(r)).reduce((a, r) => a + area(r), 0));
  const totalBuiltUp = groundBuilt + typicalBuilt * N;
  const occFactor = OCC_FACTOR[use];
  const stats: CommercialStats = {
    totalBuiltUp,
    far: Math.round((totalBuiltUp / (W * D)) * 100) / 100,
    occupancyLoad: Math.round(totalBuiltUp / occFactor),
    parkingSlots: Math.ceil((totalBuiltUp / 1000) * 1.5),
    unitsOrRooms,
  };

  validateNoOverlaps(rooms);
  return { rooms, floorLabels, stats, use, occFactor };
}
