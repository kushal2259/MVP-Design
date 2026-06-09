// ============================================================================
//  PLAN-DRIVEN ELEVATION GENERATOR
//  Builds a façade SVG from the ACTUAL room geometry of a layout option, so
//  every option (and every side) yields a different, plan-accurate elevation —
//  windows/doors line up with the rooms that face that side.
// ============================================================================
import type { RoomLayout, PlotSettings } from '@/types';

export type ElevSide = 'front' | 'rear' | 'left' | 'right';
const FLOOR_H = 10;            // ft per floor
const S = 9;                   // px per ft
const PAD = 40;

const COL = {
  ink: '#1a2744', wall1: '#eef1f5', wall2: '#dfe5ec', glass: '#9fc4e8', frame: '#2b3a55',
  amber: '#c8853a', steel: '#64748b', roof: '#243a63', sky: '#eaf0f7', ground: '#dfe5da',
};

function interior(rooms: RoomLayout[]) {
  return rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
}
function bbox(rooms: RoomLayout[]) {
  const rs = interior(rooms);
  return {
    x0: Math.min(...rs.map(r => r.x)), x1: Math.max(...rs.map(r => r.x + r.w)),
    y0: Math.min(...rs.map(r => r.y)), y1: Math.max(...rs.map(r => r.y + r.h)),
  };
}

/** Openings on a given side, projected to the façade's horizontal axis (ft from left). */
function openingsForSide(rooms: RoomLayout[], side: ElevSide, bb: ReturnType<typeof bbox>) {
  const out: { pos: number; width: number; isDoor: boolean }[] = [];
  for (const r of interior(rooms)) {
    const onEdge =
      (side === 'front' && Math.abs((r.y + r.h) - bb.y1) < 0.6) ||
      (side === 'rear' && Math.abs(r.y - bb.y0) < 0.6) ||
      (side === 'left' && Math.abs(r.x - bb.x0) < 0.6) ||
      (side === 'right' && Math.abs((r.x + r.w) - bb.x1) < 0.6);
    if (!onEdge) continue;
    const winSide = side === 'front' ? 'front' : side === 'rear' ? 'back' : side === 'left' ? 'left' : 'right';
    r.windows.filter(w => w.side === winSide).forEach(w => {
      const base = (side === 'front' || side === 'rear') ? r.x - bb.x0 : r.y - bb.y0;
      out.push({ pos: base + w.offset, width: w.width, isDoor: false });
    });
    r.doors.filter(d => d.side === winSide && /entry|main/.test(d.id)).forEach(d => {
      const base = (side === 'front' || side === 'rear') ? r.x - bb.x0 : r.y - bb.y0;
      out.push({ pos: base + d.offset, width: d.width, isDoor: true });
    });
  }
  return out;
}

export function generateElevation(
  allRooms: RoomLayout[],
  settings: PlotSettings,
  side: ElevSide,
  style: string,
  floors: number,
): string {
  const bb = bbox(allRooms.filter(r => r.floor === 0));
  const span = (side === 'front' || side === 'rear') ? bb.x1 - bb.x0 : bb.y1 - bb.y0;
  const facadeW = span * S;
  const facadeH = floors * FLOOR_H * S;
  const W = facadeW + PAD * 2;
  const H = facadeH + PAD * 2 + 40;
  const x0 = PAD, yGround = PAD + facadeH;

  const flat = style === 'modern' || style === 'contemporary' || style === 'luxury';
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:${COL.sky};max-width:100%;height:auto">`;
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="${COL.sky}"/>`;
  svg += `<rect x="0" y="${yGround}" width="${W}" height="${H - yGround}" fill="${COL.ground}"/>`;
  svg += `<text x="${PAD}" y="22" font-family="monospace" font-size="12" fill="${COL.ink}" font-weight="700">${side.toUpperCase()} ELEVATION</text>`;
  svg += `<text x="${W - PAD}" y="22" text-anchor="end" font-family="monospace" font-size="9" fill="${COL.steel}">${style.toUpperCase()} · ${floors === 1 ? 'G' : 'G+' + (floors - 1)} · AI DRAFT</text>`;

  // façade body per floor (alternating tone)
  for (let f = 0; f < floors; f++) {
    const fy = yGround - (f + 1) * FLOOR_H * S;
    svg += `<rect x="${x0}" y="${fy}" width="${facadeW}" height="${FLOOR_H * S}" fill="${f % 2 ? COL.wall2 : COL.wall1}" stroke="${COL.frame}" stroke-width="1"/>`;
    // floor band line
    svg += `<line x1="${x0}" y1="${fy}" x2="${x0 + facadeW}" y2="${fy}" stroke="${COL.frame}" stroke-width="1.5"/>`;
    // openings for this floor
    const ops = openingsForSide(allRooms.filter(r => r.floor === f), side, bbox(allRooms.filter(r => r.floor === (f === 0 ? 0 : f))));
    ops.forEach(o => {
      const ox = x0 + o.pos * S;
      const ow = Math.max(8, o.width * S);
      if (o.isDoor && f === 0) {
        const dh = FLOOR_H * S * 0.85;
        svg += `<rect x="${ox}" y="${yGround - dh}" width="${ow}" height="${dh}" fill="${COL.frame}"/><rect x="${ox + 2}" y="${yGround - dh + 2}" width="${ow - 4}" height="${dh - 4}" fill="${COL.amber}"/>`;
        svg += `<text x="${ox + ow / 2}" y="${yGround + 16}" text-anchor="middle" font-family="monospace" font-size="8" fill="${COL.amber}" font-weight="700">▲ MAIN ENTRANCE</text>`;
      } else {
        const wh = FLOOR_H * S * 0.42, wy = fy + FLOOR_H * S * 0.28;
        svg += `<rect x="${ox}" y="${wy}" width="${ow}" height="${wh}" fill="${COL.glass}" stroke="${COL.frame}" stroke-width="1.5"/>`;
        svg += `<line x1="${ox + ow / 2}" y1="${wy}" x2="${ox + ow / 2}" y2="${wy + wh}" stroke="${COL.frame}" stroke-width="0.8"/><line x1="${ox}" y1="${wy + wh / 2}" x2="${ox + ow}" y2="${wy + wh / 2}" stroke="${COL.frame}" stroke-width="0.8"/>`;
      }
    });
  }

  // roof / parapet
  if (flat) {
    svg += `<rect x="${x0 - 6}" y="${PAD - 6}" width="${facadeW + 12}" height="10" fill="${COL.roof}"/>`;
    // a cantilever slab accent (modern)
    svg += `<rect x="${x0 - 6}" y="${PAD + 4}" width="${facadeW * 0.42}" height="5" fill="${COL.amber}" opacity="0.8"/>`;
  } else {
    // sloped roof (traditional)
    svg += `<path d="M${x0 - 10},${PAD + 4} L${x0 + facadeW / 2},${PAD - 26} L${x0 + facadeW + 10},${PAD + 4} Z" fill="${COL.roof}"/>`;
  }

  // ground line + parapet railing on roof for terraces
  svg += `<line x1="0" y1="${yGround}" x2="${W}" y2="${yGround}" stroke="${COL.steel}" stroke-width="2"/>`;
  // simple landscaping
  svg += `<circle cx="${x0 - 22}" cy="${yGround - 10}" r="12" fill="#7d9e6c"/><rect x="${x0 - 24}" y="${yGround - 4}" width="4" height="6" fill="#6b4c2a"/>`;
  svg += `<circle cx="${x0 + facadeW + 22}" cy="${yGround - 8}" r="10" fill="#85a874"/>`;

  svg += `</svg>`;
  return svg;
}
