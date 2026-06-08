// ============================================================================
//  CANDIDATE SCORER
//  Multi-criteria evaluation of a generated layout: ventilation, privacy,
//  lighting, circulation, space utilisation, future expansion. Each criterion
//  is 0..100; the strategy's weights combine them into a total.
// ============================================================================
import type { RoomLayout, CandidateScores, ScoreWeights } from './types';

const HABITABLE = new Set(['living', 'bedroom', 'kitchen', 'dining']);
const PUBLIC = new Set(['living', 'dining', 'lobby']);

function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

export function scoreLayout(
  rooms: RoomLayout[],
  weights: ScoreWeights,
  buildableArea: number,
): CandidateScores {
  const interior = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
  const habit = interior.filter(r => HABITABLE.has(r.type));

  // ── Ventilation: habitable rooms with windows; cross-vent bonus ──
  let ventScore = 0;
  if (habit.length) {
    const per = habit.map(r => {
      const sides = new Set(r.windows.map(w => w.side));
      if (sides.size === 0) return 20;
      const opposite = (sides.has('front') && sides.has('back')) || (sides.has('left') && sides.has('right'));
      return opposite ? 100 : sides.size >= 2 ? 85 : 60;
    });
    ventScore = per.reduce((s, v) => s + v, 0) / per.length;
  }

  // ── Lighting: share of habitable rooms with an exterior window ──
  const litShare = habit.length ? habit.filter(r => r.windows.length > 0).length / habit.length : 0;
  const lightScore = clamp(litShare * 100);

  // ── Privacy: bedrooms away from public, toward the rear ──
  let privScore = 80;
  const beds = interior.filter(r => r.type === 'bedroom');
  if (beds.length) {
    const ys = interior.map(r => r.y + r.h / 2);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = (maxY - minY) || 1;
    let acc = 0;
    beds.forEach(b => {
      const rel = ((b.y + b.h / 2) - minY) / span; // 0 = back/top, 1 = front/bottom (entrance)
      // rear placement (low rel) = more private
      let s = 60 + (1 - rel) * 30;
      // penalty if a bedroom door connects straight to a public room
      const opensPublic = b.doors.some(d => {
        return interior.some(o => PUBLIC.has(o.type) && sharesWall(b, o));
      });
      if (opensPublic) s -= 18;
      acc += s;
    });
    privScore = clamp(acc / beds.length);
  }

  // ── Circulation: corridor/lobby present, sensible circulation ratio ──
  const circArea = interior.filter(r => r.type === 'corridor' || r.type === 'lobby' || r.type === 'staircase')
    .reduce((s, r) => s + r.w * r.h, 0);
  const intArea = interior.reduce((s, r) => s + r.w * r.h, 0) || 1;
  const circFrac = circArea / intArea;
  const hasSpine = interior.some(r => r.type === 'corridor' || r.type === 'lobby');
  let circScore = 100 - Math.abs(circFrac - 0.13) * 320;
  if (!hasSpine) circScore -= 25;
  circScore = clamp(circScore);

  // ── Space utilisation: filled footprint + healthy aspect ratios ──
  const builtPerFloor = (() => {
    const floors = [...new Set(interior.map(r => r.floor))];
    const areas = floors.map(f => interior.filter(r => r.floor === f).reduce((s, r) => s + r.w * r.h, 0));
    return areas.length ? Math.max(...areas) : 0;
  })();
  const utilisation = Math.min(1, builtPerFloor / (buildableArea || 1));
  const aspectQuality = interior.length
    ? interior.map(r => {
        const a = Math.max(r.w, r.h) / Math.max(1, Math.min(r.w, r.h));
        return a <= 1.8 ? 100 : a <= 2.6 ? 70 : a <= 3.5 ? 40 : 15;
      }).reduce((s, v) => s + v, 0) / interior.length
    : 50;
  const spaceScore = clamp(utilisation * 60 + (aspectQuality / 100) * 40);

  // ── Future expansion: balconies/terrace + simpler massing + spare FAR ──
  const hasBalcony = rooms.some(r => r.type === 'balcony');
  const hasYard = rooms.some(r => r.type === 'garden');
  let futureScore = 50 + (hasBalcony ? 15 : 0) + (hasYard ? 20 : 0) + (aspectQuality > 70 ? 15 : 0);
  futureScore = clamp(futureScore);

  const parts = {
    ventilation: Math.round(ventScore),
    privacy: Math.round(privScore),
    lighting: Math.round(lightScore),
    circulation: Math.round(circScore),
    spaceUtilization: Math.round(spaceScore),
    futureExpansion: Math.round(futureScore),
  };
  const total = Math.round(
    parts.ventilation * weights.ventilation +
    parts.privacy * weights.privacy +
    parts.lighting * weights.lighting +
    parts.circulation * weights.circulation +
    parts.spaceUtilization * weights.spaceUtilization +
    parts.futureExpansion * weights.futureExpansion,
  );
  return { ...parts, total };
}

function sharesWall(a: RoomLayout, b: RoomLayout): boolean {
  const vert = (Math.abs((a.x + a.w) - b.x) < 0.3 || Math.abs((b.x + b.w) - a.x) < 0.3)
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;
  const horiz = (Math.abs((a.y + a.h) - b.y) < 0.3 || Math.abs((b.y + b.h) - a.y) < 0.3)
    && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2;
  return vert || horiz;
}
