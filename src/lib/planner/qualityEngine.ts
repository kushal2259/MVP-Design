// ============================================================================
//  ARCHITECTURAL QUALITY ENGINE  (the Critic)
//  Reviews a generated layout the way an architect would and returns a score
//  per criterion + a total. The optimizer uses this to reject weak plans and
//  keep only top-performing ones (generator/critic loop).
//
//  ADJACENCY SATISFACTION is the dominant metric — it is what makes a plan read
//  as "designed" rather than "random": related rooms must actually touch.
// ============================================================================
import type { RoomLayout, AdjacencyMatrix, QualityReport } from './types';

const HABITABLE = new Set(['living', 'bedroom', 'kitchen', 'dining']);
const PUBLIC = new Set(['living', 'dining', 'lobby']);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

function sharesWall(a: RoomLayout, b: RoomLayout): boolean {
  const vert = (Math.abs((a.x + a.w) - b.x) < 0.4 || Math.abs((b.x + b.w) - a.x) < 0.4)
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2.5;
  const horiz = (Math.abs((a.y + a.h) - b.y) < 0.4 || Math.abs((b.y + b.h) - a.y) < 0.4)
    && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2.5;
  return vert || horiz;
}

export function evaluate(
  rooms: RoomLayout[],
  adjacency: AdjacencyMatrix,
  buildableArea: number,
  vastuScore = 60,
  opts: { threshold?: number; vastuEmphasis?: boolean } = {},
): QualityReport {
  const interior = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
  const byId = new Map(interior.map(r => [r.id, r] as const));
  const habit = interior.filter(r => HABITABLE.has(r.type));

  // ── ADJACENCY SATISFACTION (dominant) ──
  let wantW = 0, gotW = 0;
  const seen = new Set<string>();
  for (const aId of Object.keys(adjacency)) {
    for (const bId of Object.keys(adjacency[aId])) {
      const w = adjacency[aId][bId];
      if (w < 0.6) continue;
      const key = [aId, bId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = byId.get(aId), b = byId.get(bId);
      if (!a || !b || a.floor !== b.floor) continue;
      wantW += w;
      if (sharesWall(a, b)) gotW += w;
    }
  }
  const adjacency_ = wantW > 0 ? clamp((gotW / wantW) * 100) : 80;

  // ── PRIVACY: bedrooms buffered from public, pushed deep (low y = rear) ──
  let privacy = 80;
  const beds = interior.filter(r => r.type === 'bedroom');
  if (beds.length) {
    const ys = interior.map(r => r.y + r.h / 2);
    const minY = Math.min(...ys), span = (Math.max(...ys) - minY) || 1;
    privacy = clamp(beds.map(b => {
      const rel = ((b.y + b.h / 2) - minY) / span;     // 0 rear, 1 front(entrance)
      let s = 55 + (1 - rel) * 30;
      const touchesPublic = interior.some(o => PUBLIC.has(o.type) && sharesWall(b, o));
      if (touchesPublic) s -= 22;                        // bedroom opening onto living = bad
      return s;
    }).reduce((x, y) => x + y, 0) / beds.length);
  }

  // ── CIRCULATION: spine present + healthy circulation ratio ──
  const circArea = interior.filter(r => ['corridor', 'lobby', 'staircase'].includes(r.type)).reduce((s, r) => s + r.w * r.h, 0);
  const intArea = interior.reduce((s, r) => s + r.w * r.h, 0) || 1;
  const circFrac = circArea / intArea;
  let circulation = 100 - Math.abs(circFrac - 0.12) * 340;
  if (!interior.some(r => r.type === 'corridor' || r.type === 'lobby')) circulation -= 25;
  // bedrooms should reach a corridor/lobby, not pass through other rooms
  const circ = interior.filter(r => ['corridor', 'lobby', 'staircase'].includes(r.type));
  if (beds.length && circ.length) {
    const reached = beds.filter(b => circ.some(c => sharesWall(b, c))).length / beds.length;
    circulation = circulation * 0.6 + reached * 40;
  }
  circulation = clamp(circulation);

  // ── VENTILATION / LIGHTING ──
  let ventilation = 0;
  if (habit.length) {
    ventilation = habit.map(r => {
      const sides = new Set(r.windows.map(w => w.side));
      if (!sides.size) return 25;
      const opp = (sides.has('front') && sides.has('back')) || (sides.has('left') && sides.has('right'));
      return opp ? 100 : sides.size >= 2 ? 85 : 60;
    }).reduce((s, v) => s + v, 0) / habit.length;
  }
  const lighting = habit.length ? clamp(habit.filter(r => r.windows.length).length / habit.length * 100) : 50;

  // ── SPACE UTILISATION + aspect quality (penalise slivers) ──
  const floors = [...new Set(interior.map(r => r.floor))];
  const built = floors.length ? Math.max(...floors.map(f => interior.filter(r => r.floor === f).reduce((s, r) => s + r.w * r.h, 0))) : 0;
  const util = Math.min(1, built / (buildableArea || 1));
  const aspect = interior.length ? interior.map(r => {
    const a = Math.max(r.w, r.h) / Math.max(1, Math.min(r.w, r.h));
    return a <= 1.7 ? 100 : a <= 2.4 ? 75 : a <= 3.2 ? 45 : 15;
  }).reduce((s, v) => s + v, 0) / interior.length : 50;
  const spaceUtilization = clamp(util * 55 + (aspect / 100) * 45);

  // ── STRUCTURAL SIMPLICITY: fewer distinct wall lines = simpler frame ──
  const merge = (vals: number[]) => { const s = [...vals].sort((a, b) => a - b); const o: number[] = []; for (const v of s) if (!o.length || v - o[o.length - 1] > 2) o.push(v); return o.length; };
  const nx = merge(interior.flatMap(r => [r.x, r.x + r.w]));
  const ny = merge(interior.flatMap(r => [r.y, r.y + r.h]));
  const gridLines = nx + ny;
  const structural = clamp(100 - Math.max(0, gridLines - (interior.length + 4)) * 6);

  const a = {
    adjacency: Math.round(adjacency_), privacy: Math.round(privacy), circulation: Math.round(circulation),
    ventilation: Math.round(ventilation), lighting: Math.round(lighting), spaceUtilization: Math.round(spaceUtilization),
    structural: Math.round(structural), vastu: Math.round(vastuScore),
  };

  const W = opts.vastuEmphasis
    ? { adjacency: 0.24, privacy: 0.12, circulation: 0.11, ventilation: 0.11, lighting: 0.09, spaceUtilization: 0.09, structural: 0.05, vastu: 0.19 }
    : { adjacency: 0.30, privacy: 0.14, circulation: 0.12, ventilation: 0.12, lighting: 0.10, spaceUtilization: 0.10, structural: 0.06, vastu: 0.06 };
  const total = Math.round(
    a.adjacency * W.adjacency + a.privacy * W.privacy + a.circulation * W.circulation +
    a.ventilation * W.ventilation + a.lighting * W.lighting + a.spaceUtilization * W.spaceUtilization +
    a.structural * W.structural + a.vastu * W.vastu,
  );
  return { ...a, total, accept: total >= (opts.threshold ?? 55) };
}
