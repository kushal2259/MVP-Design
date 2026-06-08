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
  RoomLayout,
} from './types';
import type { DoorConfig, WindowConfig, FurnitureConfig } from '@/types';
import { strongNeighbors } from './adjacency';

interface Rect { x: number; y: number; w: number; h: number; }

const EPS = 0.01;

// ── Room ordering (drives spatial arrangement → strategy diversity) ──────────
function orderRooms(rooms: RoomSpec[], strategy: DesignStrategy): RoomSpec[] {
  const zoneRank = (z: string) => {
    const i = strategy.zoneOrder.indexOf(z as DesignStrategy['zoneOrder'][number]);
    return i < 0 ? 99 : i;
  };
  const base = [...rooms].sort((a, b) =>
    (zoneRank(a.zone) - zoneRank(b.zone)) ||
    (b.priority - a.priority) ||
    (b.targetArea - a.targetArea),
  );
  // Pull each bedroom's attached bath immediately after it (hard adjacency).
  const out: RoomSpec[] = [];
  const used = new Set<string>();
  const baths = rooms.filter(r => r.type === 'toilet');
  let bathPtr = 0;
  for (const r of base) {
    if (used.has(r.id)) continue;
    out.push(r); used.add(r.id);
    if (r.type === 'bedroom') {
      const bath = baths[bathPtr++];
      if (bath && !used.has(bath.id)) { out.push(bath); used.add(bath.id); }
    }
  }
  // any remaining (unpaired baths etc.)
  for (const r of base) if (!used.has(r.id)) { out.push(r); used.add(r.id); }
  return out;
}

// ── Recursive area-proportional slicing ──────────────────────────────────────
function slice(rect: Rect, items: RoomSpec[], variation: number, out: Map<string, Rect>): void {
  if (items.length === 0) return;
  if (items.length === 1) { out.set(items[0].id, rect); return; }

  const total = items.reduce((s, r) => s + r.targetArea, 0);
  // split index ~ half the area (nudged by `variation` for candidate diversity)
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

  let rectA: Rect, rectB: Rect;
  if (rect.w >= rect.h) {
    const wA = rect.w * frac;
    rectA = { x: rect.x, y: rect.y, w: wA, h: rect.h };
    rectB = { x: rect.x + wA, y: rect.y, w: rect.w - wA, h: rect.h };
  } else {
    const hA = rect.h * frac;
    rectA = { x: rect.x, y: rect.y, w: rect.w, h: hA };
    rectB = { x: rect.x, y: rect.y + hA, w: rect.w, h: rect.h - hA };
  }
  slice(rectA, groupA, variation, out);
  slice(rectB, groupB, variation, out);
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

function furnitureFor(type: string, w: number, h: number): FurnitureConfig[] {
  const cx = w / 2, cy = h / 2;
  const f: FurnitureConfig[] = [];
  const push = (t: FurnitureConfig['type'], x: number, y: number, fw: number, fh: number, rot = 0) =>
    f.push({ id: `${t}-${Math.random().toString(36).slice(2, 6)}`, type: t, x, y, w: fw, h: fh, rotation: rot });
  switch (type) {
    case 'living':
      push('sofa', cx, h - 2.5, Math.min(8, w - 2), 3);
      push('coffee-table', cx, cy, 3.5, 2);
      push('tv-unit', cx, 1.5, Math.min(6, w - 2), 1.2);
      break;
    case 'bedroom':
      push('bed-queen', cx, cy + 1, 6, 6.5);
      push('wardrobe', w - 1.2, cy, 2, Math.min(6, h - 2));
      break;
    case 'kitchen':
      push('kitchen-counter', cx, 1.2, Math.min(w - 1.5, 9), 2);
      push('refrigerator', w - 1.3, h - 1.5, 2.5, 2.5);
      break;
    case 'dining':
      push('dining-table-6seater', cx, cy, Math.min(6, w - 2), 3.5);
      break;
    case 'toilet':
      push('wc', 1.5, h - 1.5, 1.6, 2.2);
      push('basin', w - 1.4, 1.4, 2, 1.6);
      break;
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
 * @param variation small offset (-0.12..0.12) that nudges slicing → diversity.
 */
export function buildGeometry(
  program: RoomProgram,
  strategy: DesignStrategy,
  adjacency: AdjacencyMatrix,
  variation = 0,
): RoomLayout[] {
  const { setbacks } = program.buildable;
  const usableW = program.buildable.width - setbacks.left - setbacks.right;
  const usableD = program.buildable.depth - setbacks.front - setbacks.rear;

  // Front yard (outdoor) at the bottom; building occupies the top of the plot.
  const hasYardItems = program.rooms.some(r => r.floor === 0 && r.zone === 'outdoor');
  const yardDepth = hasYardItems ? Math.min(usableD * 0.28, 22) : 0;
  const buildRect: Rect = { x: setbacks.left, y: setbacks.rear, w: usableW, h: usableD - yardDepth };
  const yardRect: Rect = { x: setbacks.left, y: setbacks.rear + buildRect.h, w: usableW, h: yardDepth };

  const layouts: RoomLayout[] = [];

  // ── OUTDOOR (front yard) on ground floor only ──
  const outdoor = program.rooms.filter(r => r.floor === 0 && r.zone === 'outdoor' && (r.type === 'parking' || r.type === 'garden'));
  if (outdoor.length && yardRect.h > 1) {
    const totalA = outdoor.reduce((s, r) => s + r.targetArea, 0) || 1;
    let cursorX = yardRect.x;
    outdoor.forEach(r => {
      const w = yardRect.w * (r.targetArea / totalA);
      layouts.push(makeRoom(r, { x: cursorX, y: yardRect.y, w, h: yardRect.h }, buildRect, adjacency, []));
      cursorX += w;
    });
  }

  // ── INTERIOR per floor (slicing) ──
  for (let floor = 0; floor < program.floors; floor++) {
    const interior = program.rooms.filter(r => r.floor === floor && r.zone !== 'outdoor' || (r.floor === floor && r.type === 'balcony'));
    if (!interior.length) continue;

    // carve a balcony strip on the building's front edge if a balcony exists
    let rect = { ...buildRect };
    const balconies = interior.filter(r => r.type === 'balcony');
    const slicers = interior.filter(r => r.type !== 'balcony');
    if (balconies.length) {
      const bDepth = Math.min(5, rect.h * 0.12);
      const bWidth = rect.w * 0.5;
      const b = balconies[0];
      layouts.push(makeRoom(b, { x: rect.x, y: rect.y + rect.h - bDepth, w: bWidth, h: bDepth }, buildRect, adjacency, []));
      // shrink only the left half's bottom — simplest: shrink whole rect height a touch
      rect = { ...rect, h: rect.h - bDepth * (bWidth / rect.w) };
    }

    const ordered = orderRooms(slicers, strategy);
    const rectMap = new Map<string, Rect>();
    slice(rect, ordered, variation, rectMap);

    // collect rects for adjacency/door computation
    const placed: { spec: RoomSpec; rect: Rect }[] = [];
    ordered.forEach(s => { const r = rectMap.get(s.id); if (r) placed.push({ spec: s, rect: r }); });

    placed.forEach(({ spec, rect: r }) => {
      const neighbors = placed.filter(p => p.spec.id !== spec.id);
      layouts.push(makeRoom(spec, r, buildRect, adjacency, neighbors));
    });
  }

  return layouts;
}

function makeRoom(
  spec: RoomSpec, r: Rect, buildRect: Rect, adjacency: AdjacencyMatrix,
  neighbors: { spec: RoomSpec; rect: Rect }[],
): RoomLayout {
  const x = +r.x.toFixed(1), y = +r.y.toFixed(1), w = +r.w.toFixed(1), h = +r.h.toFixed(1);
  const doors: DoorConfig[] = [];
  const windows: WindowConfig[] = [];

  // ── Doors: connect to strong neighbours that share a wall ──
  const wanted = new Set(strongNeighbors(adjacency, spec.id, 0.6));
  const isCirculation = spec.type === 'corridor' || spec.type === 'lobby' || spec.type === 'staircase';
  let doorCount = 0;
  for (const nb of neighbors) {
    if (doorCount >= 3) break;
    const wantConnect = wanted.has(nb.spec.id) || isCirculation || nb.spec.type === 'corridor' || nb.spec.type === 'lobby';
    if (!wantConnect) continue;
    const edge = sharedEdge(r, nb.rect);
    if (!edge) continue;
    const width = Math.min(3, edge.len - 1);
    if (width < 2) continue;
    doors.push({
      id: `d-${spec.id}-${nb.spec.id}`,
      side: edge.side,
      offset: +(edge.start + (edge.len - width) / 2).toFixed(1),
      width: +width.toFixed(1),
      openDirection: 'in-left',
    });
    doorCount++;
  }
  // entry door for lobby/living on exterior front
  if ((spec.type === 'lobby' || spec.type === 'living') && Math.abs((y + h) - (buildRect.y + buildRect.h)) < 0.5) {
    doors.push({ id: `entry-${spec.id}`, side: 'front', offset: +(w / 2 - 1.5).toFixed(1), width: 3, openDirection: 'in-left' });
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
    ? [] : furnitureFor(spec.type, w, h);

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
