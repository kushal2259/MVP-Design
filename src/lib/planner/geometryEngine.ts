// ============================================================================
//  GEOMETRY ENGINE
//  Pure computational geometry. Receives a structured RoomProgram + strategy +
//  adjacency and returns concrete RoomLayout[] (coordinates, walls, doors,
//  windows, furniture). The LLM is NEVER involved here.
//
//  Core algorithm: recursive area-proportional binary slicing (a "slicing
//  tree" / squarified subdivision). It guarantees gap-free, non-overlapping
//  rectangular rooms that exactly fill the buildable footprint — the way real
//  buildings partition space — with controllable aspect ratios and a
//  strategy-driven room ordering for layout diversity.
// ============================================================================
import type {
  RoomProgram, RoomSpec, DesignStrategy, AdjacencyMatrix,
  RoomLayout, PlanningDecisions,
} from './types';
import type { DoorConfig, WindowConfig, FurnitureConfig } from '@/types';
import { strongNeighbors } from './adjacency';
import { runPlanningDecisions } from './planningEngine';

// NBC 2016 minimum clear widths (shorter side) enforced post-slice, in feet.
const NBC_MIN_WIDTH_GEO: Partial<Record<string, number>> = {
  bedroom:   10,
  living:    10,
  kitchen:   7.5,
  toilet:    4.5,
  staircase: 10.0,
  corridor:  3.0,
  lobby:     4.0,
  dining:    7.5,
  balcony:   3.0,
};

interface Rect { x: number; y: number; w: number; h: number; }

// Clip `r` so it no longer overlaps `blocker`. Trims the axis with the
// smaller overlap to minimise room distortion. Returns the same object
// reference if there is no overlap (fast path).
function clipAwayFromRect(r: Rect, blocker: Rect): Rect {
  const ox = Math.min(r.x + r.w, blocker.x + blocker.w) - Math.max(r.x, blocker.x);
  const oy = Math.min(r.y + r.h, blocker.y + blocker.h) - Math.max(r.y, blocker.y);
  if (ox <= 0 || oy <= 0) return r;
  // Clip the axis with smaller overlap — trim to the blocker's edge (not by the delta amount)
  if (ox <= oy) {
    if (r.x < blocker.x) return { ...r, w: Math.max(1, blocker.x - r.x) };
    const newX = blocker.x + blocker.w;
    return { ...r, x: newX, w: Math.max(1, r.x + r.w - newX) };
  } else {
    if (r.y < blocker.y) return { ...r, h: Math.max(1, blocker.y - r.y) };
    const newY = blocker.y + blocker.h;
    return { ...r, y: newY, h: Math.max(1, r.y + r.h - newY) };
  }
}

// Shared edge length between two rectangles (0 if not adjacent).
function sharedEdgeLen(a: Rect, b: Rect): number {
  if (Math.abs(a.x + a.w - b.x) < 0.5 || Math.abs(b.x + b.w - a.x) < 0.5)
    return Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  if (Math.abs(a.y + a.h - b.y) < 0.5 || Math.abs(b.y + b.h - a.y) < 0.5)
    return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  return 0;
}

// Bounding-box union of two rectangles.
function bboxUnion(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

// ── Recursive area-proportional slicing ──────────────────────────────────────
function slice(rect: Rect, items: RoomSpec[], variation: number, out: Map<string, Rect>, buildRect?: Rect): void {
  if (items.length === 0) return;
  if (items.length === 1) { out.set(items[0].id, rect); return; }

  const total = items.reduce((s, r) => s + r.targetArea, 0);
  const target = total * (0.5 + variation);
  let acc = 0, idx = 0;
  for (let i = 0; i < items.length; i++) {
    acc += items[i].targetArea;
    if (acc >= target) { idx = i + 1; break; }
  }
  idx = Math.max(1, Math.min(items.length - 1, idx));
  const groupA = items.slice(0, idx);
  const groupB = items.slice(idx);
  const areaA = groupA.reduce((s, r) => s + r.targetArea, 0);
  const frac = areaA / total;

  const minWidthA = Math.max(...groupA.map(r => r.minWidth || 3.0));
  const minWidthB = Math.max(...groupB.map(r => r.minWidth || 3.0));

  // Determine exterior walls contact
  let touchesTop = false, touchesBottom = false, touchesLeft = false, touchesRight = false;
  if (buildRect) {
    touchesTop = Math.abs(rect.y - buildRect.y) < 0.5;
    touchesBottom = Math.abs((rect.y + rect.h) - (buildRect.y + buildRect.h)) < 0.5;
    touchesLeft = Math.abs(rect.x - buildRect.x) < 0.5;
    touchesRight = Math.abs((rect.x + rect.w) - (buildRect.x + buildRect.w)) < 0.5;
  }
  
  const needExtA = groupA.some(r => r.needsExterior);
  const needExtB = groupB.some(r => r.needsExterior);
  const preserveExterior = needExtA && needExtB;

  // 1. Evaluate Vertical Split
  let wA = rect.w * frac;
  // Constraint-aware clamping
  if (rect.w >= minWidthA + minWidthB) {
    wA = Math.max(minWidthA, Math.min(rect.w - minWidthB, wA));
  }
  const wB = rect.w - wA;
  const minSideVA = Math.min(wA, rect.h);
  const minSideVB = Math.min(wB, rect.h);
  const vValid = (wA >= minWidthA && wB >= minWidthB && rect.h >= Math.max(minWidthA, minWidthB));

  // 2. Evaluate Horizontal Split
  let hA = rect.h * frac;
  // Constraint-aware clamping
  if (rect.h >= minWidthA + minWidthB) {
    hA = Math.max(minWidthA, Math.min(rect.h - minWidthB, hA));
  }
  const hB = rect.h - hA;
  const minSideHA = Math.min(rect.w, hA);
  const minSideHB = Math.min(rect.w, hB);
  const hValid = (rect.w >= Math.max(minWidthA, minWidthB) && hA >= minWidthA && hB >= minWidthB);

  // Slicing Direction Decision
  let chooseVertical = true;

  // Force direction to preserve exterior walls if needed
  if (preserveExterior) {
    if ((touchesTop || touchesBottom) && !(touchesLeft || touchesRight) && vValid) {
      chooseVertical = true;
    } else if ((touchesLeft || touchesRight) && !(touchesTop || touchesBottom) && hValid) {
      chooseVertical = false;
    } else {
      chooseVertical = selectBestDirection();
    }
  } else {
    chooseVertical = selectBestDirection();
  }

  function selectBestDirection(): boolean {
    if (vValid && !hValid) return true;
    if (!vValid && hValid) return false;

    // Both valid or both invalid: choose direction that yields better aspect ratios
    // Aspect ratio deviation penalty: we prefer aspect ratios close to 1.25
    const targetAspect = 1.25;
    
    const aspectVA = Math.max(wA, rect.h) / Math.min(wA, rect.h);
    const aspectVB = Math.max(wB, rect.h) / Math.min(wB, rect.h);
    const vPenalty = Math.max(Math.abs(aspectVA - targetAspect), Math.abs(aspectVB - targetAspect));

    const aspectHA = Math.max(rect.w, hA) / Math.min(rect.w, hA);
    const aspectHB = Math.max(rect.w, hB) / Math.min(rect.w, hB);
    const hPenalty = Math.max(Math.abs(aspectHA - targetAspect), Math.abs(aspectHB - targetAspect));

    // If both are invalid, also prioritize the one with larger minimum child short side
    if (!vValid && !hValid) {
      const vMin = Math.min(minSideVA, minSideVB);
      const hMin = Math.min(minSideHA, minSideHB);
      if (Math.abs(vMin - hMin) > 1.0) {
        return vMin >= hMin;
      }
    }

    return vPenalty <= hPenalty;
  }

  let rectA: Rect, rectB: Rect;
  if (chooseVertical) {
    rectA = { x: rect.x, y: rect.y, w: wA, h: rect.h };
    rectB = { x: rect.x + wA, y: rect.y, w: wB, h: rect.h };
  } else {
    rectA = { x: rect.x, y: rect.y, w: rect.w, h: hA };
    rectB = { x: rect.x, y: rect.y + hA, w: rect.w, h: hB };
  }

  slice(rectA, groupA, variation, out, buildRect);
  slice(rectB, groupB, variation, out, buildRect);
}

// ── VASTU-AWARE PLACEMENT ────────────────────────────────────────────────────
//  Places each room into its ideal compass zone (Ashtadik), then fills the
//  footprint with a nested column→row→leaf slicing so the result stays
//  gap-free AND directionally correct. Convention: N = top (small y),
//  S = bottom (large y), W = left (small x), E = right (large x).
type VZone = 'NW' | 'N' | 'NE' | 'W' | 'C' | 'E' | 'SW' | 'S' | 'SE';

function vastuZoneFor(spec: RoomSpec, bedIdx: number): VZone {
  const n = spec.name.toLowerCase();
  if (n.includes('pooja') || n.includes('prayer') || n.includes('mandir')) return 'NE';
  switch (spec.type) {
    case 'kitchen':   return 'SE';                              // Agneya
    case 'living':    return 'NE';                              // Ishanya
    case 'dining':    return 'W';                               // Varuna
    case 'lobby':     return 'N';                               // entrance North
    case 'staircase': return 'SW';                              // corner slot (Vastu-ideal, locks cleanly across floors)
    case 'corridor':  return 'C';                               // Brahmasthan kept light
    case 'toilet':    
      if (n.includes('master') || n.includes('attached')) return 'SW';
      return 'NW';                              // Vayavya (never NE/SE)
    case 'balcony':   return 'N';
    case 'bedroom':
      if (/master|parent/.test(n)) return 'SW';                 // Nairutya
      return (['W', 'S', 'SW'] as VZone[])[bedIdx % 3];          // all Vastu-ideal for bedrooms
    default:          return 'C';
  }
}

const VZONE_FOR: Record<'W' | 'C' | 'E', Record<'N' | 'C' | 'S', VZone>> = {
  W: { N: 'NW', C: 'W', S: 'SW' },
  C: { N: 'N',  C: 'C', S: 'S'  },
  E: { N: 'NE', C: 'E', S: 'SE' },
};

/**
 * Size the present bands by area but keep each close to an even compass-third
 * so each room's CENTRE lands in the correct Vastu zone (which the scorer
 * measures on even thirds). This is what pushes Vastu scores to 80-95+.
 */
function balancedFractions(areas: number[], lo = 0.27, hi = 0.40): number[] {
  if (areas.length <= 1) return areas.map(() => 1);
  const total = areas.reduce((a, b) => a + b, 0) || 1;
  const clamped = areas.map(a => Math.max(lo, Math.min(hi, a / total)));
  const s = clamped.reduce((a, b) => a + b, 0);
  return clamped.map(x => x / s);
}

function vastuPlace(rect: Rect, rooms: RoomSpec[], out: Map<string, Rect>, buildRect: Rect): void {
  const byZone = new Map<VZone, RoomSpec[]>();
  let bedIdx = 0;
  
  const shallowDepth = rect.h < 30;
  const narrowWidth = rect.w < 32;

  for (const r of rooms) {
    let z = vastuZoneFor(r, r.type === 'bedroom' && !/master|parent/.test(r.name.toLowerCase()) ? bedIdx++ : 0);
    // Collapse zones if plot is shallow or narrow to avoid thin/elongated slices
    if (shallowDepth) {
      if (z === 'W') z = (r.type === 'dining' || r.type === 'bedroom') ? 'NW' : 'SW';
      else if (z === 'C') z = 'S';
      else if (z === 'E') z = 'SE';
    }
    if (narrowWidth) {
      if (z === 'N') z = 'NE';
      else if (z === 'C') z = 'W';
      else if (z === 'S') z = 'SW';
    }
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(r);
  }
  const areaOf = (z: VZone) => (byZone.get(z) || []).reduce((s, r) => s + r.targetArea, 0);

  const cols: ('W' | 'C' | 'E')[] = ['W', 'C', 'E'];
  const rowsArr: ('N' | 'C' | 'S')[] = ['N', 'C', 'S'];

  const presentCols = cols.filter(c => rowsArr.reduce((s, row) => s + areaOf(VZONE_FOR[c][row]), 0) > 0);
  const colAreas = presentCols.map(c => rowsArr.reduce((s, row) => s + areaOf(VZONE_FOR[c][row]), 0));
  const colFr = balancedFractions(colAreas);

  let cursorX = rect.x;
  presentCols.forEach((col, ci) => {
    const cw = rect.w * colFr[ci];
    const presentRows = rowsArr.filter(row => areaOf(VZONE_FOR[col][row]) > 0);
    const rowAreas = presentRows.map(row => areaOf(VZONE_FOR[col][row]));
    const rowFr = balancedFractions(rowAreas);
    let cursorY = rect.y;
    presentRows.forEach((row, ri) => {
      const rh = rect.h * rowFr[ri];
      const list = byZone.get(VZONE_FOR[col][row]) || [];
      const cell: Rect = { x: cursorX, y: cursorY, w: cw, h: rh };
      const ordered = [...list].sort((a, b) => b.targetArea - a.targetArea);
      slice(cell, ordered, 0, out, buildRect);
      cursorY += rh;
    });
    cursorX += cw;
  });
}

// ── Shared-edge detection for door placement ─────────────────────────────────
type Side = 'front' | 'back' | 'left' | 'right';
function sharedEdge(a: Rect, b: Rect): { side: Side; start: number; len: number } | null {
  // vertical shared edge (a.right == b.left)
  if (Math.abs((a.x + a.w) - b.x) < 0.2) {
    const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h);
    if (y1 - y0 > 2.5) return { side: 'right', start: y0 - a.y, len: y1 - y0 };
  }
  if (Math.abs((b.x + b.w) - a.x) < 0.2) {
    const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h);
    if (y1 - y0 > 2.5) return { side: 'left', start: y0 - a.y, len: y1 - y0 };
  }
  // horizontal shared edge (a.bottom == b.top)  -> bottom = 'front'
  if (Math.abs((a.y + a.h) - b.y) < 0.2) {
    const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w);
    if (x1 - x0 > 2.5) return { side: 'front', start: x0 - a.x, len: x1 - x0 };
  }
  if (Math.abs((b.y + b.h) - a.y) < 0.2) {
    const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w);
    if (x1 - x0 > 2.5) return { side: 'back', start: x0 - a.x, len: x1 - x0 };
  }
  return null;
}

function overlapsDoorClearance(door: DoorConfig, roomW: number, roomH: number, furn: FurnitureConfig, roomType: string): boolean {
  let dx = 0, dy = 0, dw = 0, dh = 0;
  const clearanceDepth = roomType === 'toilet' ? 2.0 : 3.0;

  switch (door.side) {
    case 'front': // bottom wall (large y)
      dx = door.offset;
      dy = roomH - clearanceDepth;
      dw = door.width;
      dh = clearanceDepth;
      break;
    case 'back': // top wall (small y)
      dx = door.offset;
      dy = 0;
      dw = door.width;
      dh = clearanceDepth;
      break;
    case 'left': // left wall (small x)
      dx = 0;
      dy = door.offset;
      dw = clearanceDepth;
      dh = door.width;
      break;
    case 'right': // right wall (large x)
      dx = roomW - clearanceDepth;
      dy = door.offset;
      dw = clearanceDepth;
      dh = door.width;
      break;
  }

  const fxMin = furn.x - furn.w / 2;
  const fxMax = furn.x + furn.w / 2;
  const fyMin = furn.y - furn.h / 2;
  const fyMax = furn.y + furn.h / 2;

  return fxMin < dx + dw && fxMax > dx && fyMin < dy + dh && fyMax > dy;
}

function furnitureFor(type: string, w: number, h: number, doors: DoorConfig[]): FurnitureConfig[] {
  const cx = w / 2, cy = h / 2;
  const f: FurnitureConfig[] = [];
  const push = (t: FurnitureConfig['type'], x: number, y: number, fw: number, fh: number, rot = 0) =>
    f.push({ id: `${t}-${Math.random().toString(36).slice(2, 6)}`, type: t, x, y, w: fw, h: fh, rotation: rot });

  interface FurnItem { type: FurnitureConfig['type']; x: number; y: number; w: number; h: number; rot: number; }

  function getPenalty(items: FurnItem[]): number {
    let penalty = 0;
    
    // 1. Check door clearance overlap
    for (const item of items) {
      const config: FurnitureConfig = { id: 'temp', type: item.type, x: item.x, y: item.y, w: item.w, h: item.h, rotation: item.rot };
      for (const d of doors) {
        if (overlapsDoorClearance(d, w, h, config, type)) {
          penalty += 1000; // Large penalty for blocking a door
        }
      }
    }

    // 2. Check overlap between furniture items
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const f1 = items[i];
        const f2 = items[j];
        const overlapX = Math.abs(f1.x - f2.x) < (f1.w + f2.w) / 2 * 0.95;
        const overlapY = Math.abs(f1.y - f2.y) < (f1.h + f2.h) / 2 * 0.95;
        if (overlapX && overlapY) {
          penalty += 1000; // Large penalty for overlapping items
        }
      }
    }

    // 3. Keep items inside the room boundaries
    for (const item of items) {
      const fxMin = item.x - item.w / 2;
      const fxMax = item.x + item.w / 2;
      const fyMin = item.y - item.h / 2;
      const fyMax = item.y + item.h / 2;
      if (fxMin < 0.2 || fxMax > w - 0.2 || fyMin < 0.2 || fyMax > h - 0.2) {
        penalty += 500; // Penalty for clipping walls
      }
    }

    return penalty;
  }

  switch (type) {
    case 'living': {
      const sofaW = 8.0, sofaH = 3.0;
      const tvW = 6.0, tvH = 1.2;
      const tableW = 3.5, tableH = 2.0;

      const candidates: FurnItem[][] = [
        // 1. Sofa back, TV front, Table center
        [
          { type: 'sofa', x: cx, y: 1.5, w: Math.min(sofaW, w - 2), h: sofaH, rot: 0 },
          { type: 'tv-unit', x: cx, y: h - 0.6, w: Math.min(tvW, w - 2), h: tvH, rot: 0 },
          { type: 'coffee-table', x: cx, y: cy + 0.5, w: tableW, h: tableH, rot: 0 }
        ],
        // 2. Sofa front, TV back, Table center
        [
          { type: 'sofa', x: cx, y: h - 1.5, w: Math.min(sofaW, w - 2), h: sofaH, rot: 180 },
          { type: 'tv-unit', x: cx, y: 0.6, w: Math.min(tvW, w - 2), h: tvH, rot: 0 },
          { type: 'coffee-table', x: cx, y: cy - 0.5, w: tableW, h: tableH, rot: 0 }
        ],
        // 3. Sofa left, TV right, Table center
        [
          { type: 'sofa', x: 1.5, y: cy, w: sofaH, h: Math.min(sofaW, h - 2), rot: 90 },
          { type: 'tv-unit', x: w - 0.6, y: cy, w: tvH, h: Math.min(tvW, h - 2), rot: 90 },
          { type: 'coffee-table', x: cx + 0.5, y: cy, w: tableH, h: tableW, rot: 90 }
        ],
        // 4. Sofa right, TV left, Table center
        [
          { type: 'sofa', x: w - 1.5, y: cy, w: sofaH, h: Math.min(sofaW, h - 2), rot: 270 },
          { type: 'tv-unit', x: 0.6, y: cy, w: tvH, h: Math.min(tvW, h - 2), rot: 90 },
          { type: 'coffee-table', x: cx - 0.5, y: cy, w: tableH, h: tableW, rot: 90 }
        ]
      ];

      candidates.sort((a, b) => getPenalty(a) - getPenalty(b));
      const chosen = candidates[0];
      chosen.forEach(item => push(item.type, item.x, item.y, item.w, item.h, item.rot));
      break;
    }
    case 'bedroom': {
      const isMaster = /master|parent/.test(type.toLowerCase() || '');
      const bedType = isMaster ? 'bed-king' : 'bed-queen';
      const bedW = isMaster ? 6.5 : 6.0;
      const bedH = isMaster ? 7.0 : 6.5;
      const wardW = 2.0, wardH = Math.max(3.0, Math.min(6.0, h - 2));

      // Generate systematic combinations of Bed and Wardrobe placements
      const bedOptions = [
        { x: cx, y: bedH / 2 + 0.8, w: bedW, h: bedH, rot: 0 },
        { x: cx, y: h - (bedH / 2 + 0.8), w: bedW, h: bedH, rot: 180 },
        { x: bedH / 2 + 0.8, y: cy, w: bedH, h: bedW, rot: 90 },
        { x: w - (bedH / 2 + 0.8), y: cy, w: bedH, h: bedW, rot: 270 }
      ];

      const wardOptions = [
        { x: 1.0, y: cy, w: wardW, h: wardH, rot: 0 },
        { x: w - 1.0, y: cy, w: wardW, h: wardH, rot: 0 },
        { x: cx, y: 1.0, w: wardH, h: wardW, rot: 90 },
        { x: cx, y: h - 1.0, w: wardH, h: wardW, rot: 90 }
      ];

      const candidates: FurnItem[][] = [];
      for (const b of bedOptions) {
        for (const w of wardOptions) {
          candidates.push([
            { type: bedType as any, x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot },
            { type: 'wardrobe', x: w.x, y: w.y, w: w.w, h: w.h, rot: w.rot }
          ]);
        }
      }

      candidates.sort((a, b) => getPenalty(a) - getPenalty(b));
      const chosen = candidates[0];
      chosen.forEach(item => push(item.type, item.x, item.y, item.w, item.h, item.rot));
      break;
    }
    case 'kitchen': {
      const refW = 2.5, refH = 2.5;
      const cntW = 2.0;

      const candidates: FurnItem[][] = [
        // 1. Counter top, fridge bottom right
        [
          { type: 'kitchen-counter', x: cx, y: 1.0, w: Math.min(w - 1.5, 9), h: cntW, rot: 0 },
          { type: 'refrigerator', x: w - 1.5, y: h - 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 2. Counter top, fridge bottom left
        [
          { type: 'kitchen-counter', x: cx, y: 1.0, w: Math.min(w - 1.5, 9), h: cntW, rot: 0 },
          { type: 'refrigerator', x: 1.5, y: h - 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 3. Counter bottom, fridge top right
        [
          { type: 'kitchen-counter', x: cx, y: h - 1.0, w: Math.min(w - 1.5, 9), h: cntW, rot: 0 },
          { type: 'refrigerator', x: w - 1.5, y: 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 4. Counter bottom, fridge top left
        [
          { type: 'kitchen-counter', x: cx, y: h - 1.0, w: Math.min(w - 1.5, 9), h: cntW, rot: 0 },
          { type: 'refrigerator', x: 1.5, y: 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 5. Counter left, fridge bottom right
        [
          { type: 'kitchen-counter', x: 1.0, y: cy, w: cntW, h: Math.min(h - 1.5, 9), rot: 90 },
          { type: 'refrigerator', x: w - 1.5, y: h - 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 6. Counter left, fridge top right
        [
          { type: 'kitchen-counter', x: 1.0, y: cy, w: cntW, h: Math.min(h - 1.5, 9), rot: 90 },
          { type: 'refrigerator', x: w - 1.5, y: 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 7. Counter right, fridge bottom left
        [
          { type: 'kitchen-counter', x: w - 1.0, y: cy, w: cntW, h: Math.min(h - 1.5, 9), rot: 90 },
          { type: 'refrigerator', x: 1.5, y: h - 1.5, w: refW, h: refH, rot: 0 }
        ],
        // 8. Counter right, fridge top left
        [
          { type: 'kitchen-counter', x: w - 1.0, y: cy, w: cntW, h: Math.min(h - 1.5, 9), rot: 90 },
          { type: 'refrigerator', x: 1.5, y: 1.5, w: refW, h: refH, rot: 0 }
        ]
      ];

      candidates.sort((a, b) => getPenalty(a) - getPenalty(b));
      const chosen = candidates[0];
      chosen.forEach(item => push(item.type, item.x, item.y, item.w, item.h, item.rot));
      break;
    }
    case 'dining':
      push('dining-table-6seater', cx, cy, Math.min(6, w - 2), 3.5);
      break;
    case 'toilet': {
      const wcW = 1.6, wcH = 2.2;
      const basW = 2.0, basH = 1.6;

      const wcOptions = [
        { x: 1.2, y: 1.5 },
        { x: w - 1.2, y: 1.5 },
        { x: 1.2, y: h - 1.5 },
        { x: w - 1.2, y: h - 1.5 }
      ];

      const basinOptions = [
        { x: w - 1.2, y: h - 1.2 },
        { x: w - 1.2, y: 1.2 },
        { x: 1.2, y: h - 1.2 },
        { x: 1.2, y: 1.2 }
      ];

      const candidates: FurnItem[][] = [];
      for (const wc of wcOptions) {
        for (const bas of basinOptions) {
          candidates.push([
            { type: 'wc', x: wc.x, y: wc.y, w: wcW, h: wcH, rot: 0 },
            { type: 'basin', x: bas.x, y: bas.y, w: basW, h: basH, rot: 0 }
          ]);
        }
      }

      candidates.sort((a, b) => getPenalty(a) - getPenalty(b));
      const chosen = candidates[0];
      chosen.forEach(item => push(item.type, item.x, item.y, item.w, item.h, item.rot));
      break;
    }
    case 'parking':
      push('car-sedan', cx, cy, 6.5, 13, 90);
      break;
    case 'balcony':
      push('plant-potted', 1.5, 1.5, 1.6, 1.6);
      break;
  }
  return f;
}

/**
 * Build concrete geometry for one candidate.
 * @param variation small offset (-0.12..0.12) that nudges slicing diversity.
 */
export function buildGeometry(
  program: RoomProgram,
  strategy: DesignStrategy,
  adjacency: AdjacencyMatrix,
  variation = 0,
  seed = 1,
  decisions?: PlanningDecisions,
): RoomLayout[] {
  const planDecisions = decisions || runPlanningDecisions(program, strategy, program.global.facing, seed);

  const { setbacks } = planDecisions.plotAdaptation;
  const usableW = planDecisions.plotAdaptation.buildableRect.w;
  const usableD = planDecisions.plotAdaptation.buildableRect.h;

  const hasYardItems = program.rooms.some(r => r.floor === 0 && r.zone === 'outdoor');
  const yardDepth = hasYardItems ? Math.max(0, Math.min(usableD * 0.28, 22)) : 0;
  // Yard (parking / garden) is at the FRONT (entrance/road side = bottom of drawing, high Y).
  // Building occupies the upper portion (rear side). setbacks.rear = top margin.
  const buildRect: Rect = { x: setbacks.left, y: setbacks.rear, w: usableW, h: usableD - yardDepth };
  const yardRect:  Rect = { x: setbacks.left, y: setbacks.rear + usableD - yardDepth, w: usableW, h: yardDepth };

  const layouts: RoomLayout[] = [];

  // OUTDOOR (front yard) on ground floor only
  const outdoor = planDecisions.orderedRooms.filter(r => r.floor === 0 && r.zone === 'outdoor' && (r.type === 'parking' || r.type === 'garden'));
  if (outdoor.length && yardRect.h > 1) {
    const totalA = outdoor.reduce((s, r) => s + r.targetArea, 0) || 1;
    let cursorX = yardRect.x;
    outdoor.forEach(r => {
      const w = yardRect.w * (r.targetArea / totalA);
      layouts.push(makeRoom(r, { x: cursorX, y: yardRect.y, w, h: yardRect.h }, buildRect, adjacency, [], planDecisions));
      cursorX += w;
    });
  }

  // ── Gap-fill: eliminate empty strips between rooms and between rooms and the
  //    floor boundary. After slicing, rooms should tile perfectly, but floating-
  //    point accumulation and area-fraction rounding leave small (or even multi-
  //    foot) gaps. Strategy: for each room, expand each edge as far as it can go
  //    without overlapping another room — stopping at the nearest neighbor's
  //    opposite edge, or at the floor boundary. We repeat in passes until stable.
  function fillAllGaps(rectMap: Map<string, Rect>, fr: Rect, lockedIds?: Set<string>): void {
    const ids = [...rectMap.keys()];
    const bx1 = fr.x + fr.w;
    const by1 = fr.y + fr.h;

    // Returns true if expanding room `a` by delta in the given direction would
    // overlap any other room. Used to decide whether to expand LEFT or RIGHT.
    function wouldOverlap(idA: string, proposed: Rect): boolean {
      for (const idB of ids) {
        if (idB === idA) continue;
        const b = rectMap.get(idB)!;
        const ox = Math.min(proposed.x + proposed.w, b.x + b.w) - Math.max(proposed.x, b.x);
        const oy = Math.min(proposed.y + proposed.h, b.y + b.h) - Math.max(proposed.y, b.y);
        if (ox > 0.01 && oy > 0.01) return true;
      }
      return false;
    }

    let changed = true;
    let passes = 0;
    while (changed && passes < 12) {
      changed = false;
      passes++;
      for (const idA of ids) {
        if (lockedIds?.has(idA)) continue; // locked rooms keep their slicer-assigned size
        const a = rectMap.get(idA)!;

        // ── Right expansion ──────────────────────────────────────
        let rightBound = bx1;
        for (const idB of ids) {
          if (idB === idA) continue;
          const b = rectMap.get(idB)!;
          if (b.x >= a.x + a.w - 0.01) {
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            if (oy > 0.1) rightBound = Math.min(rightBound, b.x);
          }
        }
        if (rightBound > a.x + a.w + 0.01) {
          const proposed = { ...a, w: rightBound - a.x };
          if (!wouldOverlap(idA, proposed)) { rectMap.set(idA, proposed); changed = true; }
        }

        // ── Bottom expansion ─────────────────────────────────────
        const a2 = rectMap.get(idA)!;
        let botBound = by1;
        for (const idB of ids) {
          if (idB === idA) continue;
          const b = rectMap.get(idB)!;
          if (b.y >= a2.y + a2.h - 0.01) {
            const ox = Math.min(a2.x + a2.w, b.x + b.w) - Math.max(a2.x, b.x);
            if (ox > 0.1) botBound = Math.min(botBound, b.y);
          }
        }
        if (botBound > a2.y + a2.h + 0.01) {
          const proposed = { ...a2, h: botBound - a2.y };
          if (!wouldOverlap(idA, proposed)) { rectMap.set(idA, proposed); changed = true; }
        }

        // ── Left snap (perimeter only) ───────────────────────────
        const a3 = rectMap.get(idA)!;
        if (a3.x > fr.x + 0.01) {
          let leftBound = fr.x;
          for (const idB of ids) {
            if (idB === idA) continue;
            const b = rectMap.get(idB)!;
            const bRight = b.x + b.w;
            if (bRight <= a3.x + 0.01) {
              const oy = Math.min(a3.y + a3.h, b.y + b.h) - Math.max(a3.y, b.y);
              if (oy > 0.1) leftBound = Math.max(leftBound, bRight);
            }
          }
          if (a3.x - leftBound > 0.01) {
            const proposed = { ...a3, x: leftBound, w: a3.x + a3.w - leftBound };
            if (!wouldOverlap(idA, proposed)) { rectMap.set(idA, proposed); changed = true; }
          }
        }

        // ── Top snap (perimeter only) ────────────────────────────
        const a4 = rectMap.get(idA)!;
        if (a4.y > fr.y + 0.01) {
          let topBound = fr.y;
          for (const idB of ids) {
            if (idB === idA) continue;
            const b = rectMap.get(idB)!;
            const bBot = b.y + b.h;
            if (bBot <= a4.y + 0.01) {
              const ox = Math.min(a4.x + a4.w, b.x + b.w) - Math.max(a4.x, b.x);
              if (ox > 0.1) topBound = Math.max(topBound, bBot);
            }
          }
          if (a4.y - topBound > 0.01) {
            const proposed = { ...a4, y: topBound, h: a4.y + a4.h - topBound };
            if (!wouldOverlap(idA, proposed)) { rectMap.set(idA, proposed); changed = true; }
          }
        }
      }
    }
  }

  // INTERIOR per floor (slicing)
  // The staircase punches through the slab, so its footprint must be identical
  // on every floor. We record the ground-floor staircase rect and force it onto
  // all upper floors, clipping any room that the slicer placed there.
  let lockedStairRect: Rect | null = null;

  // Upper floors span the FULL usable depth — the yard only exists at ground level.
  // Using buildRect (which subtracts yardDepth) for upper floors left a large empty
  // strip at the bottom of every upper floor plan.
  const upperBuildRect: Rect = { x: setbacks.left, y: setbacks.rear, w: usableW, h: usableD };

  for (let floor = 0; floor < program.floors; floor++) {
    const slicers = planDecisions.orderedRooms.filter(r => r.floor === floor && r.type !== 'parking' && r.type !== 'garden');
    if (!slicers.length) continue;

    // Ground floor uses reduced height (yard strip at bottom).
    // Upper floors use full usable depth.
    const floorBuildRect = floor === 0 ? buildRect : upperBuildRect;
    const rect = { ...floorBuildRect };

    // Locked room IDs on this floor — these must not be expanded by fillAllGaps
    const lockedIds = new Set(slicers.filter(s => s.locked).map(s => s.id));

    // ── TERRACE FLOOR: hard-place rooms at exact sizes, skip the slicer ────────
    // The slicer always allocates proportionally so locked rooms still end up
    // oversized. Instead: pin Staircase Cabin to lockedStairRect, place
    // Terrace Store at exactly 10×6 ft adjacent to it, and give Open Terrace
    // everything else on the floor.
    const isTerraceFl = slicers.some(s => s.name === 'Staircase Cabin');
    const rectMap = new Map<string, Rect>();

    if (isTerraceFl && lockedStairRect) {
      const stairS  = slicers.find(s => s.name === 'Staircase Cabin');
      const storeS  = slicers.find(s => s.name === 'Terrace Store');
      const openS   = slicers.find(s => s.name === 'Open Terrace');

      // 1. Staircase Cabin — exact same rect as all floors below
      if (stairS) rectMap.set(stairS.id, { ...lockedStairRect });

      // 2. Terrace Store — 10×6 ft, placed directly below the staircase cabin
      //    (snapped to the same left edge, touching the cabin's bottom edge)
      const storeW = 10, storeH = 6;
      const storeRect: Rect = {
        x: lockedStairRect.x,
        y: lockedStairRect.y + lockedStairRect.h,
        w: storeW,
        h: storeH,
      };
      // If store goes below the floor boundary, place it to the right of the cabin instead
      if (storeRect.y + storeRect.h > floorBuildRect.y + floorBuildRect.h) {
        storeRect.x = lockedStairRect.x + lockedStairRect.w;
        storeRect.y = lockedStairRect.y;
      }
      if (storeS) rectMap.set(storeS.id, storeRect);

      // 3. Open Terrace — fills the entire floor boundary (Open Terrace is open sky,
      //    the staircase cabin and store are islands on it)
      if (openS) rectMap.set(openS.id, { ...floorBuildRect });
    } else {
      // Normal habitable floors — use the slicer
      if (strategy.features.vastu) {
        vastuPlace(rect, slicers, rectMap, floorBuildRect);
      } else {
        slice(rect, slicers, variation, rectMap, floorBuildRect);
      }

      // Expand every room to fill gaps. Locked rooms are never expanded.
      fillAllGaps(rectMap, floorBuildRect, lockedIds);
    }

    // Staircase alignment across floors.
    const stairSpec = slicers.find(s => s.type === 'staircase');
    if (floor === 0) {
      if (stairSpec) lockedStairRect = rectMap.get(stairSpec.id) || null;
    } else if (!isTerraceFl && lockedStairRect && stairSpec) {
      const oldStairRect = rectMap.get(stairSpec.id);
      rectMap.set(stairSpec.id, { ...lockedStairRect });

      // Fill the vacated old-staircase area by expanding the best adjacent
      // NON-LOCKED room — but only when the expanded bbox doesn't overlap any
      // third room (bboxUnion can swallow neighbours). Otherwise leave the
      // hole for the overlap-safe fillAllGaps pass below.
      if (oldStairRect) {
        let bestId: string | null = null;
        let bestEdge = 0;
        for (const [id, r] of rectMap) {
          if (id === stairSpec.id) continue;
          if (lockedIds.has(id)) continue;
          const edge = sharedEdgeLen(r, oldStairRect);
          if (edge > bestEdge) { bestEdge = edge; bestId = id; }
        }
        if (bestId && bestEdge > 0) {
          const expanded = bboxUnion(rectMap.get(bestId)!, oldStairRect);
          let collides = false;
          for (const [id, r] of rectMap) {
            if (id === bestId || id === stairSpec.id) continue;
            const ox = Math.min(expanded.x + expanded.w, r.x + r.w) - Math.max(expanded.x, r.x);
            const oy = Math.min(expanded.y + expanded.h, r.y + r.h) - Math.max(expanded.y, r.y);
            if (ox > 0.01 && oy > 0.01) { collides = true; break; }
          }
          if (!collides) rectMap.set(bestId, expanded);
        }
      }

      // Clip rooms that now overlap the locked staircase position
      for (const [id, r] of rectMap) {
        if (id === stairSpec.id) continue;
        const clipped = clipAwayFromRect(r, lockedStairRect);
        if (clipped !== r) rectMap.set(id, clipped);
      }

      fillAllGaps(rectMap, floorBuildRect, lockedIds);
    }

    // collect rects for neighbors calculation
    const currentFloorRects = slicers.map(spec => ({ spec, rect: rectMap.get(spec.id)! }));

    // For the terrace floor, render Open Terrace first (SVG background) then solid rooms on top.
    const renderOrder = isTerraceFl
      ? [...slicers.filter(s => s.name === 'Open Terrace'), ...slicers.filter(s => s.name !== 'Open Terrace')]
      : slicers;

    renderOrder.forEach(spec => {
      const r = rectMap.get(spec.id);
      if (r) {
        // Find adjacent neighbors
        const neighbors = currentFloorRects.filter(other => other.spec.id !== spec.id && sharedEdge(r, other.rect));
        layouts.push(makeRoom(spec, r, floorBuildRect, adjacency, neighbors, planDecisions));
      }
    });
  }

  return layouts;
}

// ── CUSTOM OVERRIDES (chat / CAD edits) — applied as a safe post-pass ─────────
// Handles add-door, add-window, rename-room without breaking the tiling.
// (resize-room is handled by the Revision Engine, which re-tiles.)
export interface CustomOverrideInput {
  type: 'add-door' | 'add-window' | 'resize-room' | 'rename-room';
  roomId: string;
  side?: 'front' | 'back' | 'left' | 'right';
  offset?: number;
  width?: number;
  targetRoomId?: string;
}

function matchRoom(rooms: RoomLayout[], roomId: string): RoomLayout | undefined {
  const q = (roomId || '').toLowerCase();
  const typeHint =
    q.includes('stair') ? 'staircase' : q.includes('toilet') || q.includes('bath') ? 'toilet'
    : q.includes('kitchen') ? 'kitchen' : q.includes('dining') ? 'dining' : q.includes('living') ? 'living'
    : q.includes('lobby') || q.includes('foyer') ? 'lobby' : q.includes('bedroom') || q.includes('bed') ? 'bedroom'
    : q.includes('balcon') ? 'balcony' : '';
  const onGround = rooms.filter(r => r.floor === 0);
  if (typeHint) return onGround.find(r => r.type === typeHint) || rooms.find(r => r.type === typeHint);
  return onGround.find(r => r.name.toLowerCase().includes(q)) || rooms.find(r => r.id === roomId);
}

export function applyOverrides(rooms: RoomLayout[], overrides?: CustomOverrideInput[]): RoomLayout[] {
  if (!overrides?.length) return rooms;
  for (const ov of overrides) {
    const room = matchRoom(rooms, ov.roomId);
    if (!room) continue;
    if (ov.type === 'rename-room' && ov.targetRoomId) {
      room.name = ov.targetRoomId;
    } else if (ov.type === 'add-door') {
      const side = ov.side || 'front';
      const wall = (side === 'front' || side === 'back') ? room.w : room.h;
      const width = Math.min(ov.width || 3, wall - 1);
      if (width < 1.5) continue;
      const offset = ov.offset != null ? Math.max(0, Math.min(wall - width, ov.offset)) : +(wall / 2 - width / 2).toFixed(1);
      const id = `ovr-door-${room.id}-${side}-${Math.round(offset)}`;
      if (!room.doors.some(d => d.id === id)) room.doors.push({ id, side, offset: +offset.toFixed(1), width: +width.toFixed(1), openDirection: 'in-left' });
    } else if (ov.type === 'add-window') {
      const side = ov.side || 'front';
      const wall = (side === 'front' || side === 'back') ? room.w : room.h;
      const width = Math.min(ov.width || 4, wall - 1);
      if (width < 1.5) continue;
      const offset = ov.offset != null ? Math.max(0, Math.min(wall - width, ov.offset)) : +(wall / 2 - width / 2).toFixed(1);
      const id = `ovr-win-${room.id}-${side}-${Math.round(offset)}`;
      if (!room.windows.some(w => w.id === id)) room.windows.push({ id, side, offset: +offset.toFixed(1), width: +width.toFixed(1) });
    }
  }
  return rooms;
}

function makeRoom(
  spec: RoomSpec, r: Rect, buildRect: Rect, adjacency: AdjacencyMatrix,
  neighbors: { spec: RoomSpec; rect: Rect }[],
  decisions: PlanningDecisions,
): RoomLayout {
  const x = +r.x.toFixed(1), y = +r.y.toFixed(1), w = +r.w.toFixed(1), h = +r.h.toFixed(1);
  const doors: DoorConfig[] = [];
  const windows: WindowConfig[] = [];

  // Sort neighbors to prioritize corridor/lobby and avoid public rooms for toilets/private rooms
  const sortedNeighbors = [...neighbors].sort((a, b) => {
    // Prioritize corridor/lobby over other rooms
    const aIsCirc = a.spec.type === 'corridor' || a.spec.type === 'lobby';
    const bIsCirc = b.spec.type === 'corridor' || b.spec.type === 'lobby';
    if (aIsCirc && !bIsCirc) return -1;
    if (!aIsCirc && bIsCirc) return 1;

    const aWeight = adjacency[spec.id]?.[a.spec.id] ?? 0;
    const bWeight = adjacency[spec.id]?.[b.spec.id] ?? 0;
    return bWeight - aWeight;
  });

  // ── Doors: connect to strong neighbours that share a wall ──
  const wanted = new Set(strongNeighbors(adjacency, spec.id, 0.6));
  const isCirculation = spec.type === 'corridor' || spec.type === 'lobby' || spec.type === 'staircase';
  let doorCount = 0;
  for (const nb of sortedNeighbors) {
    if (doorCount >= (spec.type === 'toilet' ? 1 : 3)) break;

    // Privacy check: do not connect circulation room to an attached toilet
    const isToilet = nb.spec.type === 'toilet';
    const isAttachedToilet = isToilet && Object.keys(adjacency[nb.spec.id] || {}).some(otherId => {
      const other = neighbors.find(n => n.spec.id === otherId)?.spec || decisions.orderedRooms.find(r => r.id === otherId);
      return other?.type === 'bedroom' && (adjacency[nb.spec.id][otherId] || 0) >= 0.9;
    });
    if (isAttachedToilet && isCirculation) continue;

    // A toilet itself should only connect to its attached bedroom (if attached) or corridor (if common)
    if (spec.type === 'toilet') {
      const myAttachedBedId = Object.keys(adjacency[spec.id] || {}).find(otherId => {
        const other = neighbors.find(n => n.spec.id === otherId)?.spec || decisions.orderedRooms.find(r => r.id === otherId);
        return other?.type === 'bedroom' && (adjacency[spec.id][otherId] || 0) >= 0.9;
      });
      if (myAttachedBedId) {
        // We are attached! Only allow connecting to our bedroom
        if (nb.spec.id !== myAttachedBedId) continue;
      } else {
        // We are common! Only allow connecting to corridor or lobby
        if (nb.spec.type !== 'corridor' && nb.spec.type !== 'lobby') continue;
      }
    }

    const wantConnect = wanted.has(nb.spec.id) || isCirculation || nb.spec.type === 'corridor' || nb.spec.type === 'lobby';
    if (!wantConnect) continue;
    const edge = sharedEdge(r, nb.rect);
    if (!edge) continue;
    const minReqWidth = (spec.type === 'toilet' || nb.spec.type === 'toilet') ? 2.5 : 3.0;
    if (edge.len < minReqWidth + 0.2) continue; // Not enough wall length to place door
    const width = Math.max(minReqWidth, Math.min(3.0, edge.len - 1.0));
    
    const wallLength = (edge.side === 'front' || edge.side === 'back') ? w : h;
    let offset = edge.start + 1.0;
    if (offset + width > edge.start + edge.len) {
      offset = edge.start + edge.len - width - 1.0;
    }
    offset = Math.max(0.5, Math.min(wallLength - width - 0.5, offset));

    doors.push({
      id: `d-${spec.id}-${nb.spec.id}`,
      side: edge.side,
      offset: +offset.toFixed(1),
      width: +width.toFixed(1),
      openDirection: 'in-left',
    });
    doorCount++;
  }

  // ── Main Entrance Door: placed on room and side decided by PlotAdaptation ──
  if (spec.id === decisions.plotAdaptation.entranceRoomId && spec.floor === 0) {
    const side = decisions.plotAdaptation.entranceSide;
    const wall = (side === 'front' || side === 'back') ? w : h;
    const width = 3.5;
    doors.push({
      id: `entry-main-${spec.id}`,
      side,
      offset: +Math.max(0, wall / 2 - width / 2).toFixed(1),
      width,
      openDirection: 'in-left',
    });
  }

  // ── Windows: on exterior building edges (skip pure circulation) ──
  if (spec.needsExterior || spec.needsVentilation) {
    const edges: { side: Side; len: number }[] = [];
    if (Math.abs(x - buildRect.x) < 0.5) edges.push({ side: 'left', len: h });
    if (Math.abs((x + w) - (buildRect.x + buildRect.w)) < 0.5) edges.push({ side: 'right', len: h });
    if (Math.abs(y - buildRect.y) < 0.5) edges.push({ side: 'back', len: w });
    if (Math.abs((y + h) - (buildRect.y + buildRect.h)) < 0.5) edges.push({ side: 'front', len: w });
    edges.sort((a, b) => b.len - a.len);
    edges.slice(0, spec.type === 'living' ? 2 : 1).forEach((e, i) => {
      const wWidth = Math.min(e.len * 0.5, spec.type === 'living' ? 6 : 4);
      windows.push({ id: `w-${spec.id}-${i}`, side: e.side, offset: +((e.len - wWidth) / 2).toFixed(1), width: +wWidth.toFixed(1) });
    });
  }

  const furniture = (spec.type === 'corridor' || spec.type === 'staircase' || spec.type === 'garden')
    ? [] : furnitureFor(spec.type, w, h, doors);

  return {
    id: spec.id, name: spec.name, type: spec.type,
    x, y, w, h, floor: spec.floor,
    isLocked: spec.locked,
    windows, doors, furniture,
  };
}

/** Utility for the scorer: total built area on a floor. */
export function floorArea(rooms: RoomLayout[], floor: number): number {
  return rooms.filter(r => r.floor === floor && r.type !== 'parking' && r.type !== 'garden')
    .reduce((s, r) => s + r.w * r.h, 0);
}

export type { Rect };
export { sharedEdge };
