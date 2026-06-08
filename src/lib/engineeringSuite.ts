// ============================================================================
//  ENGINEERING DRAWING SUITE
//  Generates the full catalogue of discipline drawings (Structural, Electrical,
//  Plumbing, HVAC, Fire, Site) as schematic, geometry-derived SVG/table sheets.
//  Every drawing is computed from the selected option's room geometry — so each
//  architectural option gets its own consistent engineering package.
//
//  These are AI DRAFT CONCEPTS. Every sheet must carry a licensed-approval note.
// ============================================================================
import type { RoomLayout, PlotSettings } from '@/types';

export type Discipline = 'structural' | 'electrical' | 'plumbing' | 'hvac' | 'fire' | 'site';

export interface Drawing {
  id: string;
  name: string;
  category: string;
  render: (rooms: RoomLayout[], settings: PlotSettings) => string; // HTML/SVG string
}

export const APPROVAL: Record<Discipline, string> = {
  structural: 'Requires Licensed Structural Engineer Approval',
  electrical: 'Requires Licensed Electrical Engineer Approval',
  plumbing: 'Requires Licensed Plumbing Engineer Approval',
  hvac: 'Requires Licensed HVAC Engineer Approval',
  fire: 'Requires Fire Safety Consultant Approval',
  site: 'Requires Licensed Architect / Civil Approval',
};

const S = 9;            // px per foot
const B = 32;           // border

const C = {
  ink: '#1a2744', steel: '#64748b', line: '#cbd5e1', faint: '#e8edf3',
  amber: '#c8853a', red: '#dc2626', blue: '#2563eb', green: '#16a34a',
  cyan: '#0891b2', violet: '#7c3aed', wall: '#94a3b8',
};

interface BBox { x0: number; y0: number; x1: number; y1: number; }

function interiorRooms(rooms: RoomLayout[]) {
  return rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
}
function bboxOf(rooms: RoomLayout[]): BBox {
  const rs = interiorRooms(rooms);
  if (!rs.length) return { x0: 0, y0: 0, x1: 10, y1: 10 };
  return {
    x0: Math.min(...rs.map(r => r.x)), y0: Math.min(...rs.map(r => r.y)),
    x1: Math.max(...rs.map(r => r.x + r.w)), y1: Math.max(...rs.map(r => r.y + r.h)),
  };
}
const PX = (ft: number) => B + ft * S;

function svgWrap(settings: PlotSettings, inner: string, title: string): string {
  const W = settings.width * S + B * 2;
  const H = settings.depth * S + B * 2;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfa;max-width:100%;height:auto">
    <text x="${B}" y="20" font-family="monospace" font-size="12" fill="${C.ink}" font-weight="700">${title}</text>
    <text x="${W - B}" y="20" text-anchor="end" font-family="monospace" font-size="9" fill="${C.steel}">N ↑  ·  SCALE ~1:100  ·  AI DRAFT</text>
    ${inner}
  </svg>`;
}

/** Light floor-plan backdrop that every overlay sits on. */
function planLayer(rooms: RoomLayout[], opts: { labels?: boolean } = {}): string {
  return rooms.map(r => {
    const x = PX(r.x), y = PX(r.y), w = r.w * S, h = r.h * S;
    const fill = r.type === 'parking' || r.type === 'garden' ? '#f1f5ee' : '#f8fafc';
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${C.wall}" stroke-width="1.5"/>
      ${opts.labels !== false ? `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-family="monospace" font-size="7.5" fill="${C.steel}">${r.name}</text>` : ''}
    </g>`;
  }).join('');
}

function legend(items: [string, string][], x = B, y = -1): string {
  const yy = y < 0 ? undefined : y;
  return `<g transform="translate(${x}, ${yy ?? 0})">` + items.map((it, i) =>
    `<g transform="translate(0, ${i * 16})"><rect width="11" height="11" fill="${it[0]}" rx="2"/><text x="16" y="9.5" font-family="monospace" font-size="9" fill="${C.ink}">${it[1]}</text></g>`,
  ).join('') + `</g>`;
}

function table(title: string, cols: string[], rows: (string | number)[][]): string {
  return `<div style="font-family:monospace">
    <h3 style="font-size:14px;color:${C.ink};margin:0 0 12px;font-weight:700">${title}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:${C.ink};color:#fff">${cols.map(c => `<th style="padding:8px 10px;text-align:left">${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr style="background:${i % 2 ? '#f6f8fb' : '#fff'};border-bottom:1px solid ${C.line}">${r.map(c => `<td style="padding:7px 10px">${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}

// ── Structural grid derivation (the backbone for all structural sheets) ──────
interface Grid { xs: number[]; ys: number[]; bbox: BBox; }
function mergeLines(vals: number[], tol = 3, lo: number, hi: number, maxGap = 16): number[] {
  const sorted = [...new Set(vals.map(v => Math.round(v)))].sort((a, b) => a - b);
  const merged: number[] = [];
  for (const v of sorted) { if (!merged.length || v - merged[merged.length - 1] > tol) merged.push(v); }
  if (!merged.includes(lo)) merged.unshift(lo);
  if (!merged.includes(hi)) merged.push(hi);
  // insert intermediate columns where bays are too large
  const out: number[] = [];
  for (let i = 0; i < merged.length; i++) {
    out.push(merged[i]);
    if (i < merged.length - 1) {
      const gap = merged[i + 1] - merged[i];
      if (gap > maxGap) { const n = Math.ceil(gap / maxGap); for (let k = 1; k < n; k++) out.push(Math.round(merged[i] + (gap * k) / n)); }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
function deriveGrid(rooms: RoomLayout[]): Grid {
  const bbox = bboxOf(rooms);
  const rs = interiorRooms(rooms);
  const xs = mergeLines(rs.flatMap(r => [r.x, r.x + r.w]), 3, bbox.x0, bbox.x1);
  const ys = mergeLines(rs.flatMap(r => [r.y, r.y + r.h]), 3, bbox.y0, bbox.y1);
  return { xs, ys, bbox };
}

function gridLabels(g: Grid): string {
  let s = '';
  g.xs.forEach((x, i) => { s += `<text x="${PX(x)}" y="${PX(g.bbox.y0) - 8}" text-anchor="middle" font-family="monospace" font-size="9" fill="${C.amber}" font-weight="700">${i + 1}</text>`; });
  g.ys.forEach((y, i) => { s += `<text x="${PX(g.bbox.x0) - 12}" y="${PX(y) + 3}" text-anchor="middle" font-family="monospace" font-size="9" fill="${C.amber}" font-weight="700">${String.fromCharCode(65 + i)}</text>`; });
  return s;
}
function gridLines(g: Grid, color = C.faint): string {
  let s = '';
  g.xs.forEach(x => { s += `<line x1="${PX(x)}" y1="${PX(g.bbox.y0)}" x2="${PX(x)}" y2="${PX(g.bbox.y1)}" stroke="${color}" stroke-width="1"/>`; });
  g.ys.forEach(y => { s += `<line x1="${PX(g.bbox.x0)}" y1="${PX(y)}" x2="${PX(g.bbox.x1)}" y2="${PX(y)}" stroke="${color}" stroke-width="1"/>`; });
  return s;
}
function columns(g: Grid): { x: number; y: number }[] {
  const cols: { x: number; y: number }[] = [];
  g.xs.forEach(x => g.ys.forEach(y => cols.push({ x, y })));
  return cols;
}

// ── symbol helpers (px coords) ──
const sym = {
  light: (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${C.amber}" stroke-width="1.5"/><line x1="${x - 3.5}" y1="${y - 3.5}" x2="${x + 3.5}" y2="${y + 3.5}" stroke="${C.amber}" stroke-width="1.2"/><line x1="${x - 3.5}" y1="${y + 3.5}" x2="${x + 3.5}" y2="${y - 3.5}" stroke="${C.amber}" stroke-width="1.2"/>`,
  sw: (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="${C.ink}" stroke-width="1.2"/><text x="${x}" y="${y + 2.5}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.ink}">S</text>`,
  socket: (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4.5" fill="none" stroke="${C.green}" stroke-width="1.2"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 4.5}" stroke="${C.green}" stroke-width="1.2"/>`,
  ac: (x: number, y: number) => `<rect x="${x - 7}" y="${y - 3}" width="14" height="6" rx="2" fill="#fff" stroke="${C.blue}" stroke-width="1.2"/><text x="${x}" y="${y + 2}" text-anchor="middle" font-family="monospace" font-size="5.5" fill="${C.blue}">AC</text>`,
  cam: (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4" fill="${C.violet}"/><path d="M${x + 3},${y} l6,-3 v6 z" fill="${C.violet}"/>`,
  smoke: (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${C.red}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="1.5" fill="${C.red}"/>`,
  ext: (x: number, y: number) => `<rect x="${x - 2.5}" y="${y - 5}" width="5" height="10" rx="2" fill="${C.red}"/>`,
  tap: (x: number, y: number, color: string) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`,
};

// each room center px
function center(r: RoomLayout) { return { cx: PX(r.x) + (r.w * S) / 2, cy: PX(r.y) + (r.h * S) / 2 }; }

// ── DB / source anchor (entry side) ──
function entryPoint(rooms: RoomLayout[]) {
  const b = bboxOf(rooms);
  return { x: PX((b.x0 + b.x1) / 2), y: PX(b.y1) }; // front-centre
}

// ============================================================================
//  STRUCTURAL
// ============================================================================
function structuralGridDrawing(name: string, opts: { footings?: boolean; beams?: boolean; slab?: boolean; cols?: boolean; roof?: boolean }) {
  return (rooms: RoomLayout[], settings: PlotSettings) => {
    const g = deriveGrid(rooms);
    let inner = planLayer(rooms, { labels: false }) + gridLines(g, C.faint) + gridLabels(g);
    if (opts.slab) {
      for (let i = 0; i < g.xs.length - 1; i++) for (let j = 0; j < g.ys.length - 1; j++) {
        const x = PX(g.xs[i]), y = PX(g.ys[j]), w = (g.xs[i + 1] - g.xs[i]) * S, h = (g.ys[j + 1] - g.ys[j]) * S;
        const ratio = Math.max(w, h) / Math.min(w, h);
        inner += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.roof ? 'rgba(37,99,235,0.05)' : 'rgba(200,133,58,0.05)'}" stroke="${C.amber}" stroke-width="0.6"/>
          <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-family="monospace" font-size="7" fill="${C.steel}">${ratio < 2 ? 'TWO-WAY' : 'ONE-WAY'}</text>`;
      }
    }
    if (opts.beams) {
      g.xs.forEach(x => inner += `<line x1="${PX(x)}" y1="${PX(g.bbox.y0)}" x2="${PX(x)}" y2="${PX(g.bbox.y1)}" stroke="${C.ink}" stroke-width="2.5"/>`);
      g.ys.forEach(y => inner += `<line x1="${PX(g.bbox.x0)}" y1="${PX(y)}" x2="${PX(g.bbox.x1)}" y2="${PX(y)}" stroke="${C.ink}" stroke-width="2.5"/>`);
    }
    columns(g).forEach((c, i) => {
      const x = PX(c.x), y = PX(c.y);
      if (opts.footings) inner += `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="none" stroke="${C.steel}" stroke-width="1" stroke-dasharray="3 2"/>`;
      if (opts.cols !== false) inner += `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="${C.ink}"/>`;
      if (opts.footings && i < 60) inner += `<text x="${x + 11}" y="${y - 11}" font-family="monospace" font-size="6" fill="${C.steel}">F${i + 1}</text>`;
    });
    return svgWrap(settings, inner, name);
  };
}

function structuralSection(rooms: RoomLayout[], settings: PlotSettings) {
  const W = 560, H = 360;
  const gx = 60, gy = 60, bw = 440, levels = [
    ['Roof Slab (RCC 125mm)', 60], ['First Floor Slab (125mm)', 150], ['Plinth Beam (230×300)', 240], ['Footing (Isolated)', 300],
  ];
  let inner = `<text x="20" y="24" font-family="monospace" font-size="12" fill="${C.ink}" font-weight="700">TYPICAL STRUCTURAL SECTION</text>`;
  // columns
  [gx + 40, gx + bw - 40, gx + bw / 2].forEach(cx => { inner += `<rect x="${cx - 6}" y="60" width="12" height="220" fill="${C.ink}"/>`; });
  levels.forEach(([lbl, y]) => {
    inner += `<rect x="${gx}" y="${y as number}" width="${bw}" height="10" fill="${C.amber}"/><text x="${gx + bw + 6}" y="${(y as number) + 9}" font-family="monospace" font-size="9" fill="${C.steel}">${lbl}</text>`;
  });
  // footing pads
  [gx + 40, gx + bw - 40, gx + bw / 2].forEach(cx => { inner += `<rect x="${cx - 24}" y="300" width="48" height="16" fill="${C.steel}"/><rect x="${cx - 34}" y="316" width="68" height="10" fill="#94a3b8"/>`; });
  inner += `<line x1="${gx}" y1="340" x2="${gx + bw}" y2="340" stroke="${C.steel}" stroke-width="1" stroke-dasharray="4 3"/><text x="${gx}" y="354" font-family="monospace" font-size="8" fill="${C.steel}">Founding strata — depth per soil report (SBC to be confirmed)</text>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfa;max-width:100%;height:auto">${inner}</svg>`;
}

function loadPath(rooms: RoomLayout[], settings: PlotSettings) {
  const g = deriveGrid(rooms);
  let inner = planLayer(rooms, { labels: false }) + gridLines(g);
  columns(g).forEach(c => {
    const x = PX(c.x), y = PX(c.y);
    inner += `<circle cx="${x}" cy="${y}" r="6" fill="rgba(220,38,38,0.15)" stroke="${C.red}" stroke-width="1"/><rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${C.ink}"/>`;
  });
  // arrows: slab -> nearest column
  interiorRooms(rooms).forEach(r => {
    const { cx, cy } = center(r);
    inner += `<path d="M${cx},${cy} l0,10" stroke="${C.red}" stroke-width="1.4" marker-end="url(#ar)"/>`;
  });
  inner = `<defs><marker id="ar" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${C.red}"/></marker></defs>` + inner;
  return svgWrap(settings, inner, 'LOAD PATH (Slab → Beam → Column → Footing)');
}

function staircaseStructural(rooms: RoomLayout[], settings: PlotSettings) {
  const st = rooms.find(r => r.type === 'staircase');
  if (!st) return svgWrap(settings, planLayer(rooms, { labels: false }) + `<text x="${B}" y="${B + 40}" font-family="monospace" font-size="11" fill="${C.steel}">No staircase in this option (single floor).</text>`, 'STAIRCASE STRUCTURAL PLAN');
  const x = PX(st.x), y = PX(st.y), w = st.w * S, h = st.h * S;
  let inner = planLayer(rooms, { labels: false });
  inner += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(200,133,58,0.06)" stroke="${C.amber}" stroke-width="2"/>`;
  const steps = Math.floor(h / (S * 0.9));
  for (let i = 1; i < steps; i++) inner += `<line x1="${x}" y1="${y + i * (h / steps)}" x2="${x + w}" y2="${y + i * (h / steps)}" stroke="${C.ink}" stroke-width="1"/>`;
  inner += `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-family="monospace" font-size="8" fill="${C.ink}">WAIST SLAB 150mm · RISER 150 · TREAD 300</text>`;
  return svgWrap(settings, inner, 'STAIRCASE STRUCTURAL PLAN');
}

function structuralSchedules(kind: 'column' | 'beam' | 'footing' | 'slab') {
  return (rooms: RoomLayout[]) => {
    const g = deriveGrid(rooms);
    const nCols = columns(g).length;
    if (kind === 'column') return table('COLUMN SCHEDULE', ['Mark', 'Size (mm)', 'Concrete', 'Main Bars', 'Ties'],
      Array.from({ length: Math.min(nCols, 12) }, (_, i) => [`C${i + 1}`, '230 × 450', 'M25', '6–8 × 16Ø', '8Ø @ 150 c/c']));
    if (kind === 'beam') return table('BEAM SCHEDULE', ['Mark', 'Size (mm)', 'Concrete', 'Top', 'Bottom', 'Stirrups'],
      [['B1 (Plinth)', '230 × 300', 'M25', '2×12Ø', '2×12Ø', '8Ø @ 180'], ['B2 (Floor)', '230 × 450', 'M25', '3×16Ø', '3×16Ø', '8Ø @ 150'], ['B3 (Lintel)', '230 × 150', 'M20', '2×10Ø', '2×10Ø', '6Ø @ 200']]);
    if (kind === 'footing') return table('FOOTING SCHEDULE', ['Mark', 'Size (m)', 'Depth', 'Concrete', 'Reinforcement'],
      Array.from({ length: Math.min(nCols, 12) }, (_, i) => [`F${i + 1}`, '1.5 × 1.5', '300 mm', 'M25', '12Ø @ 150 both ways']));
    return table('SLAB SCHEDULE', ['Panel', 'Type', 'Thk', 'Concrete', 'Main Steel', 'Dist. Steel'],
      [['S1', 'Two-way', '125 mm', 'M25', '10Ø @ 150', '8Ø @ 150'], ['S2', 'One-way', '125 mm', 'M25', '10Ø @ 125', '8Ø @ 180'], ['Roof', 'Two-way', '125 mm', 'M25', '10Ø @ 150', '8Ø @ 150']]);
  };
}
function reinforcementNotes(rooms: RoomLayout[]) {
  return table('PRELIMINARY REINFORCEMENT SUGGESTIONS (concept only)', ['Element', 'Concrete', 'Steel (Fe500D)', 'Cover', 'Note'],
    [['Footings', 'M25', '12Ø @ 150 both ways', '50 mm', 'Confirm with SBC / soil report'],
     ['Columns', 'M25', '6–8 × 16Ø, ties 8Ø@150', '40 mm', 'Size per axial + moment'],
     ['Beams', 'M25', '3×16Ø top & bottom', '25 mm', 'Check deflection & shear'],
     ['Slabs', 'M25', '10Ø @ 150 c/c', '20 mm', 'Two-way where L/B < 2'],
     ['Staircase', 'M25', '12Ø @ 150 (waist)', '20 mm', 'Landing band beams'],
     ['Lintels', 'M20', '2×10Ø', '20 mm', 'Over all openings']]);
}

// ============================================================================
//  ELECTRICAL
// ============================================================================
function perRoomSymbols(rooms: RoomLayout[], settings: PlotSettings, title: string, fn: (r: RoomLayout) => string, lg?: [string, string][]) {
  let inner = planLayer(rooms);
  interiorRooms(rooms).forEach(r => { inner += fn(r); });
  if (lg) inner += `<g transform="translate(${B}, ${settings.depth * S + B - lg.length * 16})">${legend(lg, 0, 0)}</g>`;
  return svgWrap(settings, inner, title);
}
function circuitsFromDB(rooms: RoomLayout[], settings: PlotSettings, title: string, color: string, filter?: (r: RoomLayout) => boolean) {
  const db = entryPoint(rooms);
  let inner = planLayer(rooms);
  inner += `<rect x="${db.x - 9}" y="${db.y - 9}" width="18" height="18" fill="${C.ink}"/><text x="${db.x}" y="${db.y + 3}" text-anchor="middle" font-family="monospace" font-size="7" fill="#fff">DB</text>`;
  interiorRooms(rooms).filter(r => !filter || filter(r)).forEach(r => {
    const { cx, cy } = center(r);
    inner += `<path d="M${db.x},${db.y} L${cx},${cy}" stroke="${color}" stroke-width="1.2" fill="none" stroke-dasharray="4 3" opacity="0.8"/><circle cx="${cx}" cy="${cy}" r="3" fill="${color}"/>`;
  });
  return svgWrap(settings, inner, title);
}
function sld(rooms: RoomLayout[], settings: PlotSettings) {
  const W = 560, H = 380;
  const circuits = ['Lighting 6A', 'Power 16A', 'Kitchen 20A', 'AC 20A', 'Geyser 16A', 'Spare 16A'];
  let inner = `<text x="20" y="24" font-family="monospace" font-size="12" fill="${C.ink}" font-weight="700">SINGLE LINE DIAGRAM (SLD)</text>`;
  inner += `<text x="30" y="60" font-family="monospace" font-size="10">⏚ Grid</text><rect x="90" y="48" width="60" height="22" fill="none" stroke="${C.ink}"/><text x="120" y="63" text-anchor="middle" font-family="monospace" font-size="9">kWh Meter</text>`;
  inner += `<line x1="150" y1="59" x2="200" y2="59" stroke="${C.ink}" stroke-width="1.5"/><rect x="200" y="44" width="70" height="30" fill="none" stroke="${C.red}" stroke-width="1.5"/><text x="235" y="63" text-anchor="middle" font-family="monospace" font-size="9">Main MCB</text>`;
  inner += `<line x1="270" y1="59" x2="320" y2="59" stroke="${C.ink}" stroke-width="1.5"/><rect x="320" y="40" width="60" height="40" fill="none" stroke="${C.ink}" stroke-width="1.5"/><text x="350" y="64" text-anchor="middle" font-family="monospace" font-size="9">DB / RCCB</text>`;
  circuits.forEach((c, i) => {
    const y = 110 + i * 42;
    inner += `<line x1="350" y1="80" x2="350" y2="${y}" stroke="${C.ink}"/><line x1="350" y1="${y}" x2="410" y2="${y}" stroke="${C.blue}" stroke-width="1.5"/><circle cx="410" cy="${y}" r="6" fill="none" stroke="${C.blue}"/><text x="425" y="${y + 4}" font-family="monospace" font-size="10" fill="${C.ink}">${c}</text>`;
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfa;max-width:100%;height:auto">${inner}</svg>`;
}
function loadEstimation(rooms: RoomLayout[]) {
  const loadByType: Record<string, number> = { living: 800, bedroom: 1500, kitchen: 2500, dining: 600, toilet: 2200, lobby: 200, corridor: 150, staircase: 150, balcony: 200 };
  const rows = interiorRooms(rooms).map(r => {
    const load = loadByType[r.type] ?? 400;
    return [r.name, `${load} W`, r.type === 'bedroom' || r.type === 'living' ? '1 (AC)' : '0', `${(load / 1000).toFixed(1)} kW`];
  });
  const total = interiorRooms(rooms).reduce((s, r) => s + (loadByType[r.type] ?? 400), 0);
  const conn = total * 0.8 / 1000;
  rows.push(['—', '', '', '']);
  rows.push(['Connected Load', `${(total / 1000).toFixed(1)} kW`, '', '']);
  rows.push(['Demand Load (×0.8)', `${conn.toFixed(1)} kW`, '', `Sanction ≈ ${Math.ceil(conn / 0.9)} kW`]);
  return table('ELECTRICAL LOAD ESTIMATION', ['Room', 'Est. Load', 'AC Points', 'kW'], rows);
}
function upsInverter(rooms: RoomLayout[], settings: PlotSettings) {
  const db = entryPoint(rooms);
  let inner = planLayer(rooms);
  inner += `<rect x="${db.x - 20}" y="${db.y - 9}" width="18" height="18" fill="${C.ink}"/><text x="${db.x - 11}" y="${db.y + 3}" text-anchor="middle" font-family="monospace" font-size="6" fill="#fff">DB</text>`;
  inner += `<rect x="${db.x + 4}" y="${db.y - 9}" width="22" height="18" fill="${C.green}"/><text x="${db.x + 15}" y="${db.y + 3}" text-anchor="middle" font-family="monospace" font-size="6" fill="#fff">INV</text>`;
  interiorRooms(rooms).filter(r => ['bedroom', 'living', 'kitchen'].includes(r.type)).forEach(r => {
    const { cx, cy } = center(r); inner += `<path d="M${db.x + 15},${db.y} L${cx},${cy}" stroke="${C.green}" stroke-width="1" stroke-dasharray="3 3"/><circle cx="${cx}" cy="${cy}" r="3" fill="${C.green}"/>`;
  });
  inner += `<text x="${B}" y="${settings.depth * S + B - 4}" font-family="monospace" font-size="9" fill="${C.steel}">Backup: essential lights, fans, TV, Wi-Fi, 1 socket/room — size inverter ≈ 1.5–2.5 kVA + battery bank.</text>`;
  return svgWrap(settings, inner, 'UPS / INVERTER BACKUP PLAN');
}
function solarPlan(rooms: RoomLayout[], settings: PlotSettings) {
  const b = bboxOf(rooms);
  let inner = planLayer(rooms, { labels: false });
  const x0 = PX(b.x0) + 6, y0 = PX(b.y0) + 6, w = (b.x1 - b.x0) * S - 12, h = (b.y1 - b.y0) * S - 12;
  const cols = Math.max(2, Math.floor(w / 26)), rowsN = Math.max(1, Math.floor(h / 40));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rowsN; j++)
    inner += `<rect x="${x0 + i * 26}" y="${y0 + j * 40}" width="22" height="34" fill="rgba(37,99,235,0.18)" stroke="${C.blue}" stroke-width="1"/>`;
  const kw = (cols * rowsN * 0.4).toFixed(1);
  inner += `<text x="${B}" y="${settings.depth * S + B - 4}" font-family="monospace" font-size="9" fill="${C.steel}">Rooftop PV (south-tilt): ${cols * rowsN} panels ≈ ${kw} kWp · est. ${(+kw * 4).toFixed(0)} units/day. Net-metering recommended.</text>`;
  return svgWrap(settings, inner, 'SOLAR PANEL PLANNING (ROOF)');
}

// ============================================================================
//  PLUMBING
// ============================================================================
function wetRooms(rooms: RoomLayout[]) { return interiorRooms(rooms).filter(r => r.type === 'toilet' || r.type === 'kitchen'); }
function plumbingLayout(rooms: RoomLayout[], settings: PlotSettings, title: string, mode: 'supply' | 'drainage' | 'sewer' | 'hot') {
  const src = entryPoint(rooms);
  const color = mode === 'supply' ? C.blue : mode === 'hot' ? C.red : mode === 'sewer' ? '#7c5e2a' : '#16a34a';
  let inner = planLayer(rooms);
  const label = mode === 'supply' ? 'OHT' : mode === 'hot' ? 'GEYSER LINE' : mode === 'sewer' ? 'IC → SEWER' : 'DRAIN STACK';
  inner += `<circle cx="${src.x}" cy="${src.y}" r="10" fill="${color}"/><text x="${src.x}" y="${src.y + 3}" text-anchor="middle" font-family="monospace" font-size="6" fill="#fff">${mode === 'supply' ? 'OHT' : 'STK'}</text>`;
  wetRooms(rooms).filter(r => mode === 'hot' ? r.type !== 'kitchen' || true : true).forEach(r => {
    const { cx, cy } = center(r);
    inner += `<path d="M${src.x},${src.y} L${src.x},${cy} L${cx},${cy}" stroke="${color}" stroke-width="1.6" fill="none" opacity="0.85"/>${sym.tap(cx, cy, color)}`;
  });
  inner += `<text x="${B}" y="${settings.depth * S + B - 4}" font-family="monospace" font-size="9" fill="${color}">${label} · ${mode === 'supply' ? 'CPVC 20mm' : mode === 'hot' ? 'CPVC hot 15mm' : mode === 'sewer' ? 'uPVC 110mm to inspection chamber' : 'uPVC 75–110mm'}</text>`;
  return svgWrap(settings, inner, title);
}
function tankPlan(rooms: RoomLayout[], settings: PlotSettings, which: 'overhead' | 'rwh' | 'septic') {
  const b = bboxOf(rooms);
  let inner = planLayer(rooms, { labels: false });
  if (which === 'overhead') {
    inner += `<rect x="${PX(b.x0) + 10}" y="${PX(b.y0) + 10}" width="60" height="40" fill="rgba(37,99,235,0.15)" stroke="${C.blue}" stroke-width="1.5"/><text x="${PX(b.x0) + 40}" y="${PX(b.y0) + 34}" text-anchor="middle" font-family="monospace" font-size="8" fill="${C.blue}">OHT 2000L</text>`;
    inner += `<rect x="${PX(b.x0) + 10}" y="${PX(b.y1) - 50}" width="70" height="40" fill="rgba(2,132,199,0.10)" stroke="${C.cyan}" stroke-width="1.5"/><text x="${PX(b.x0) + 45}" y="${PX(b.y1) - 26}" text-anchor="middle" font-family="monospace" font-size="8" fill="${C.cyan}">SUMP 5000L</text>`;
  } else if (which === 'rwh') {
    inner += `<circle cx="${PX(b.x1) - 30}" cy="${PX(b.y1) - 30}" r="26" fill="rgba(22,163,74,0.12)" stroke="${C.green}" stroke-width="1.5"/><text x="${PX(b.x1) - 30}" y="${PX(b.y1) - 27}" text-anchor="middle" font-family="monospace" font-size="7" fill="${C.green}">RWH PIT</text>`;
    inner += `<path d="M${PX(b.x0)},${PX(b.y0)} L${PX(b.x1) - 30},${PX(b.y1) - 30}" stroke="${C.green}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    inner += `<text x="${B}" y="${settings.depth * S + B - 4}" font-family="monospace" font-size="9" fill="${C.green}">Roof runoff → filter → recharge pit (1.5×1.5×2m with boulders/sand/charcoal).</text>`;
  } else {
    inner += `<rect x="${PX(b.x1) - 70}" y="${PX(b.y1) - 40}" width="60" height="30" fill="rgba(124,94,42,0.15)" stroke="#7c5e2a" stroke-width="1.5"/><text x="${PX(b.x1) - 40}" y="${PX(b.y1) - 22}" text-anchor="middle" font-family="monospace" font-size="7" fill="#7c5e2a">SEPTIC</text>`;
    inner += `<circle cx="${PX(b.x1) - 90}" cy="${PX(b.y1) - 25}" r="12" fill="none" stroke="#7c5e2a"/><text x="${PX(b.x1) - 90}" y="${PX(b.y1) - 22}" text-anchor="middle" font-family="monospace" font-size="6">SOAK</text>`;
    inner += `<text x="${B}" y="${settings.depth * S + B - 4}" font-family="monospace" font-size="9" fill="#7c5e2a">Septic tank (min 2m³) → soak pit. Keep 7.5m from any borewell/well.</text>`;
  }
  return svgWrap(settings, inner, which === 'overhead' ? 'WATER TANK LAYOUT' : which === 'rwh' ? 'RAINWATER HARVESTING' : 'SEPTIC TANK LAYOUT');
}
function riserDiagram(rooms: RoomLayout[], settings: PlotSettings) {
  const W = 520, H = 360, floors = settings.floors;
  let inner = `<text x="20" y="24" font-family="monospace" font-size="12" fill="${C.ink}" font-weight="700">PLUMBING RISER DIAGRAM</text>`;
  const baseY = 300, fh = (baseY - 60) / Math.max(1, floors);
  inner += `<line x1="120" y1="40" x2="120" y2="${baseY}" stroke="${C.blue}" stroke-width="2"/><text x="120" y="36" text-anchor="middle" font-family="monospace" font-size="8" fill="${C.blue}">WATER</text>`;
  inner += `<line x1="260" y1="40" x2="260" y2="${baseY + 20}" stroke="#16a34a" stroke-width="2"/><text x="260" y="36" text-anchor="middle" font-family="monospace" font-size="8" fill="#16a34a">WASTE</text>`;
  inner += `<line x1="360" y1="40" x2="360" y2="${baseY + 20}" stroke="#7c5e2a" stroke-width="2"/><text x="360" y="36" text-anchor="middle" font-family="monospace" font-size="8" fill="#7c5e2a">SOIL</text>`;
  for (let f = 0; f < floors; f++) {
    const y = baseY - (f + 1) * fh;
    inner += `<line x1="80" y1="${y}" x2="420" y2="${y}" stroke="${C.line}"/><text x="40" y="${y + 4}" font-family="monospace" font-size="9" fill="${C.steel}">${f === 0 ? 'GF' : 'F' + f}</text>`;
    [120, 260, 360].forEach(x => inner += `<circle cx="${x}" cy="${y}" r="3" fill="${C.ink}"/><line x1="${x}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="${C.steel}" stroke-width="1" stroke-dasharray="2 2"/>`);
  }
  inner += `<text x="120" y="${baseY + 16}" text-anchor="middle" font-family="monospace" font-size="7" fill="${C.steel}">from OHT</text><rect x="240" y="${baseY + 24}" width="140" height="20" fill="none" stroke="#7c5e2a"/><text x="310" y="${baseY + 38}" text-anchor="middle" font-family="monospace" font-size="8">IC → Septic/Sewer</text>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfa;max-width:100%;height:auto">${inner}</svg>`;
}
function fixturePlan(rooms: RoomLayout[], settings: PlotSettings, type: 'toilet' | 'kitchen') {
  const target = interiorRooms(rooms).filter(r => r.type === type);
  let inner = planLayer(rooms);
  target.forEach(r => {
    const x = PX(r.x), y = PX(r.y), w = r.w * S, h = r.h * S;
    inner += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(2,132,199,0.06)" stroke="${C.cyan}" stroke-width="2"/>`;
    if (type === 'toilet') {
      inner += `${sym.tap(x + 8, y + h - 8, C.blue)}<rect x="${x + w - 16}" y="${y + 6}" width="10" height="8" fill="none" stroke="${C.cyan}"/><text x="${x + 8}" y="${y + h - 12}" font-family="monospace" font-size="6" fill="${C.blue}">WC</text><circle cx="${x + w / 2}" cy="${y + h - 6}" r="3" fill="none" stroke="#16a34a"/><text x="${x + w / 2}" y="${y - 4}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.steel}">FT+WC+Basin</text>`;
    } else {
      inner += `${sym.tap(x + 10, y + 8, C.blue)}<rect x="${x + 6}" y="${y + h - 14}" width="${w - 12}" height="6" fill="none" stroke="${C.cyan}"/><text x="${x + w / 2}" y="${y - 4}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.steel}">Sink+Gas+Drain</text>`;
    }
  });
  if (!target.length) inner += `<text x="${B}" y="${B + 40}" font-family="monospace" font-size="11" fill="${C.steel}">No ${type} on this floor.</text>`;
  return svgWrap(settings, inner, type === 'toilet' ? 'BATHROOM PLUMBING LAYOUT' : 'KITCHEN PLUMBING LAYOUT');
}

// ============================================================================
//  HVAC / FIRE / SITE
// ============================================================================
function hvacLayout(rooms: RoomLayout[], settings: PlotSettings, mode: 'ac' | 'duct' | 'exhaust' | 'airflow' | 'vent') {
  let inner = planLayer(rooms);
  interiorRooms(rooms).forEach(r => {
    const { cx, cy } = center(r); const x = PX(r.x), y = PX(r.y), w = r.w * S, h = r.h * S;
    if (mode === 'ac' && ['bedroom', 'living'].includes(r.type)) inner += sym.ac(cx, y + 8);
    if (mode === 'exhaust' && ['toilet', 'kitchen'].includes(r.type)) inner += `<circle cx="${x + w - 8}" cy="${y + 8}" r="4" fill="none" stroke="${C.violet}" stroke-width="1.3"/><text x="${x + w - 8}" y="${y + 18}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.violet}">EXH</text>`;
    if (mode === 'duct' && ['bedroom', 'living', 'dining'].includes(r.type)) inner += `<rect x="${cx - w * 0.3}" y="${cy - 3}" width="${w * 0.6}" height="6" fill="rgba(37,99,235,0.15)" stroke="${C.blue}" stroke-width="0.8"/>`;
    if (mode === 'airflow' || mode === 'vent') {
      const cross = r.windows.length >= 2 && (new Set(r.windows.map(wd => wd.side)).size >= 2);
      if (r.windows.length) inner += `<path d="M${x + 4},${cy} L${x + w - 4},${cy}" stroke="${cross ? C.green : C.amber}" stroke-width="1.4" marker-end="url(#fa)" opacity="0.8"/>`;
    }
  });
  if (mode === 'airflow' || mode === 'vent') inner = `<defs><marker id="fa" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="${C.green}"/></marker></defs>` + inner + `<g transform="translate(${B},${settings.depth * S + B - 32})">${legend([[C.green, 'Cross-ventilated'], [C.amber, 'Single-side only']], 0, 0)}</g>`;
  const title = mode === 'ac' ? 'AC PLACEMENT LAYOUT' : mode === 'duct' ? 'DUCT ROUTING' : mode === 'exhaust' ? 'EXHAUST PLANNING' : mode === 'airflow' ? 'AIRFLOW SIMULATION (schematic)' : 'VENTILATION ANALYSIS';
  return svgWrap(settings, inner, title);
}
function fireLayout(rooms: RoomLayout[], settings: PlotSettings, mode: 'exit' | 'evac' | 'ext' | 'smoke' | 'sign') {
  const exit = entryPoint(rooms);
  let inner = planLayer(rooms);
  if (mode === 'exit' || mode === 'evac' || mode === 'sign') {
    inner += `<rect x="${exit.x - 14}" y="${exit.y - 6}" width="28" height="12" fill="${C.green}"/><text x="${exit.x}" y="${exit.y + 3}" text-anchor="middle" font-family="monospace" font-size="7" fill="#fff">EXIT</text>`;
  }
  if (mode === 'evac') {
    inner += `<defs><marker id="ev" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.green}"/></marker></defs>`;
    interiorRooms(rooms).forEach(r => { const { cx, cy } = center(r); inner += `<path d="M${cx},${cy} L${exit.x},${exit.y}" stroke="${C.green}" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#ev)" opacity="0.7"/>`; });
  }
  if (mode === 'ext') interiorRooms(rooms).filter(r => ['kitchen', 'living', 'corridor', 'lobby', 'staircase'].includes(r.type)).forEach(r => { const x = PX(r.x), y = PX(r.y); inner += sym.ext(x + 8, y + 10) + `<text x="${x + 8}" y="${y + 22}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.red}">FE</text>`; });
  if (mode === 'smoke') interiorRooms(rooms).forEach(r => { const { cx, cy } = center(r); inner += sym.smoke(cx, cy); });
  if (mode === 'sign') interiorRooms(rooms).filter(r => ['corridor', 'lobby', 'staircase'].includes(r.type)).forEach(r => { const { cx, cy } = center(r); inner += `<rect x="${cx - 10}" y="${cy - 6}" width="20" height="12" fill="${C.green}"/><text x="${cx}" y="${cy + 3}" text-anchor="middle" font-family="monospace" font-size="6" fill="#fff">→EXIT</text>`; });
  const title = mode === 'exit' ? 'FIRE EXIT PLAN' : mode === 'evac' ? 'EMERGENCY EVACUATION ROUTES' : mode === 'ext' ? 'FIRE EXTINGUISHER LOCATIONS' : mode === 'smoke' ? 'SMOKE DETECTOR LAYOUT' : 'EMERGENCY SIGNAGE';
  return svgWrap(settings, inner, title);
}
function siteLayout(rooms: RoomLayout[], settings: PlotSettings, mode: 'site' | 'parking' | 'landscape' | 'compound' | 'gate' | 'driveway' | 'extdrain' | 'utility') {
  const pw = settings.width * S, pd = settings.depth * S;
  const b = bboxOf(rooms);
  let inner = `<rect x="${B}" y="${B}" width="${pw}" height="${pd}" fill="#f1f5ee" stroke="${C.green}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  inner += planLayer(rooms, { labels: false });
  inner += `<rect x="${PX(b.x0)}" y="${PX(b.y0)}" width="${(b.x1 - b.x0) * S}" height="${(b.y1 - b.y0) * S}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  if (mode === 'compound' || mode === 'site') inner += `<rect x="${B + 3}" y="${B + 3}" width="${pw - 6}" height="${pd - 6}" fill="none" stroke="#7c5e2a" stroke-width="3"/>`;
  if (mode === 'gate' || mode === 'site') inner += `<rect x="${B + pw / 2 - 18}" y="${B + pd - 6}" width="36" height="8" fill="${C.amber}"/><text x="${B + pw / 2}" y="${B + pd + 16}" text-anchor="middle" font-family="monospace" font-size="8" fill="${C.amber}">MAIN GATE</text>`;
  if (mode === 'parking' || mode === 'site') { const py = PX(b.y1) + 6; for (let i = 0; i < 2; i++) inner += `<rect x="${B + 8 + i * 70}" y="${py}" width="62" height="${Math.max(20, pd - (PX(b.y1) - B) - 16)}" fill="rgba(100,116,139,0.1)" stroke="${C.steel}" stroke-width="1"/><text x="${B + 39 + i * 70}" y="${py + 14}" text-anchor="middle" font-family="monospace" font-size="7" fill="${C.steel}">CAR ${i + 1}</text>`; }
  if (mode === 'driveway' || mode === 'site') inner += `<rect x="${B + pw / 2 - 30}" y="${PX(b.y1)}" width="60" height="${B + pd - PX(b.y1)}" fill="rgba(148,163,184,0.18)"/><text x="${B + pw / 2}" y="${PX(b.y1) + 16}" text-anchor="middle" font-family="monospace" font-size="7" fill="${C.steel}">DRIVEWAY</text>`;
  if (mode === 'landscape' || mode === 'site') { for (let i = 0; i < 6; i++) { const cx = B + 14 + (i % 3) * (pw - 28) / 2, cy = B + 14 + Math.floor(i / 3) * (pd - 28); inner += `<circle cx="${cx}" cy="${cy}" r="7" fill="rgba(22,163,74,0.3)" stroke="${C.green}"/>`; } }
  if (mode === 'extdrain') { inner += `<rect x="${B}" y="${B}" width="${pw}" height="${pd}" fill="none"/>`; [[B, B + pd], [B + pw, B + pd]].forEach(([x]) => inner += `<line x1="${x}" y1="${B}" x2="${x}" y2="${B + pd}" stroke="${C.blue}" stroke-width="2" stroke-dasharray="3 3"/>`); inner += `<text x="${B + 4}" y="${B + pd - 4}" font-family="monospace" font-size="8" fill="${C.blue}">Perimeter storm drain → municipal connection</text>`; }
  if (mode === 'utility') { inner += `<line x1="${B}" y1="${B + pd - 10}" x2="${PX(b.x0)}" y2="${PX(b.y1)}" stroke="${C.amber}" stroke-width="2"/><text x="${B + 4}" y="${B + pd - 14}" font-family="monospace" font-size="8" fill="${C.amber}">Electric+water service entry</text>`; }
  const title = { site: 'SITE LAYOUT PLAN', parking: 'PARKING PLAN', landscape: 'LANDSCAPE PLAN', compound: 'COMPOUND WALL PLAN', gate: 'GATE LAYOUT', driveway: 'DRIVEWAY PLAN', extdrain: 'EXTERNAL DRAINAGE PLAN', utility: 'UTILITY ROUTING PLAN' }[mode];
  return svgWrap(settings, inner, title);
}

// ============================================================================
//  CATALOG
// ============================================================================
export function getCatalog(discipline: Discipline): Drawing[] {
  switch (discipline) {
    case 'structural': return [
      { id: 'grid', name: 'Structural Grid Plan', category: 'Grid', render: structuralGridDrawing('STRUCTURAL GRID PLAN', { cols: true }) },
      { id: 'column', name: 'Column Layout Plan', category: 'Plans', render: structuralGridDrawing('COLUMN LAYOUT PLAN', { cols: true }) },
      { id: 'beam', name: 'Beam Layout Plan', category: 'Plans', render: structuralGridDrawing('BEAM LAYOUT PLAN', { beams: true }) },
      { id: 'plinth', name: 'Plinth Beam Plan', category: 'Plans', render: structuralGridDrawing('PLINTH BEAM PLAN', { beams: true }) },
      { id: 'foundation', name: 'Foundation Layout Plan', category: 'Foundation', render: structuralGridDrawing('FOUNDATION LAYOUT PLAN', { footings: true }) },
      { id: 'footing', name: 'Footing Layout Plan', category: 'Foundation', render: structuralGridDrawing('FOOTING LAYOUT PLAN', { footings: true }) },
      { id: 'slab', name: 'Slab Layout Plan', category: 'Plans', render: structuralGridDrawing('SLAB LAYOUT PLAN', { slab: true, beams: true }) },
      { id: 'roof', name: 'Roof Structural Plan', category: 'Plans', render: structuralGridDrawing('ROOF STRUCTURAL PLAN', { slab: true, beams: true, roof: true }) },
      { id: 'stair', name: 'Staircase Structural Plan', category: 'Plans', render: staircaseStructural },
      { id: 'section', name: 'Structural Section', category: 'Sections', render: structuralSection },
      { id: 'loadpath', name: 'Load Path Visualization', category: 'Analysis', render: loadPath },
      { id: 'col-sched', name: 'Column Schedule', category: 'Schedules', render: structuralSchedules('column') },
      { id: 'beam-sched', name: 'Beam Schedule', category: 'Schedules', render: structuralSchedules('beam') },
      { id: 'foot-sched', name: 'Footing Schedule', category: 'Schedules', render: structuralSchedules('footing') },
      { id: 'slab-sched', name: 'Slab Schedule', category: 'Schedules', render: structuralSchedules('slab') },
      { id: 'reinf', name: 'Reinforcement Suggestions', category: 'Schedules', render: reinforcementNotes },
    ];
    case 'electrical': return [
      { id: 'lighting', name: 'Lighting Layout', category: 'Layouts', render: (r, s) => perRoomSymbols(r, s, 'LIGHTING LAYOUT', rm => { const c = center(rm); return sym.light(c.cx, c.cy); }, [[C.amber, 'Ceiling light']]) },
      { id: 'switch', name: 'Switch Layout', category: 'Layouts', render: (r, s) => perRoomSymbols(r, s, 'SWITCH LAYOUT', rm => sym.sw(PX(rm.x) + 10, PX(rm.y) + rm.h * S - 8), [['#1a2744', 'Switch board']]) },
      { id: 'socket', name: 'Socket Layout', category: 'Layouts', render: (r, s) => perRoomSymbols(r, s, 'SOCKET LAYOUT', rm => sym.socket(PX(rm.x) + rm.w * S - 8, PX(rm.y) + 10) + sym.socket(PX(rm.x) + 8, PX(rm.y) + rm.h * S - 10), [[C.green, '6/16A socket']]) },
      { id: 'ac', name: 'AC Point Layout', category: 'Layouts', render: (r, s) => perRoomSymbols(r, s, 'AC POINT LAYOUT', rm => ['bedroom', 'living'].includes(rm.type) ? sym.ac(center(rm).cx, PX(rm.y) + 8) : '', [[C.blue, 'AC point (15A)']]) },
      { id: 'power', name: 'Power Circuit Layout', category: 'Circuits', render: (r, s) => circuitsFromDB(r, s, 'POWER CIRCUIT LAYOUT', C.blue) },
      { id: 'db', name: 'DB Layout', category: 'Circuits', render: (r, s) => circuitsFromDB(r, s, 'DISTRIBUTION BOARD (DB) LAYOUT', C.ink) },
      { id: 'sld', name: 'Single Line Diagram', category: 'Diagrams', render: sld },
      { id: 'load', name: 'Electrical Load Estimation', category: 'Calc', render: (r) => loadEstimation(r) },
      { id: 'ups', name: 'UPS / Inverter Planning', category: 'Backup', render: upsInverter },
      { id: 'solar', name: 'Solar Panel Planning', category: 'Backup', render: solarPlan },
      { id: 'cctv', name: 'CCTV Layout', category: 'Low Voltage', render: (r, s) => perRoomSymbols(r, s, 'CCTV LAYOUT', rm => ['lobby', 'living', 'corridor', 'staircase'].includes(rm.type) ? sym.cam(PX(rm.x) + 8, PX(rm.y) + 8) : '', [[C.violet, 'Camera']]) },
      { id: 'network', name: 'Internet / WiFi Points', category: 'Low Voltage', render: (r, s) => perRoomSymbols(r, s, 'INTERNET / WIFI POINT LAYOUT', rm => ['living', 'bedroom', 'lobby'].includes(rm.type) ? `<circle cx="${center(rm).cx}" cy="${center(rm).cy}" r="5" fill="none" stroke="${C.cyan}" stroke-width="1.3"/><text x="${center(rm).cx}" y="${center(rm).cy + 2.5}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.cyan}">))</text>` : '', [[C.cyan, 'AP / LAN point']]) },
      { id: 'automation', name: 'Home Automation Points', category: 'Low Voltage', render: (r, s) => perRoomSymbols(r, s, 'HOME AUTOMATION POINTS', rm => `<rect x="${center(rm).cx - 5}" y="${center(rm).cy - 5}" width="10" height="10" rx="2" fill="none" stroke="${C.amber}" stroke-width="1.3"/><text x="${center(rm).cx}" y="${center(rm).cy + 2.5}" text-anchor="middle" font-family="monospace" font-size="6" fill="${C.amber}">⌂</text>`, [[C.amber, 'Smart control']]) },
    ];
    case 'plumbing': return [
      { id: 'supply', name: 'Water Supply Layout', category: 'Supply', render: (r, s) => plumbingLayout(r, s, 'WATER SUPPLY LAYOUT', 'supply') },
      { id: 'hot', name: 'Hot Water Routing', category: 'Supply', render: (r, s) => plumbingLayout(r, s, 'HOT WATER ROUTING', 'hot') },
      { id: 'drain', name: 'Drainage Layout', category: 'Drainage', render: (r, s) => plumbingLayout(r, s, 'DRAINAGE LAYOUT', 'drainage') },
      { id: 'sewer', name: 'Sewer Layout', category: 'Drainage', render: (r, s) => plumbingLayout(r, s, 'SEWER LAYOUT', 'sewer') },
      { id: 'tank', name: 'Water Tank Layout', category: 'Tanks', render: (r, s) => tankPlan(r, s, 'overhead') },
      { id: 'septic', name: 'Septic Tank Layout', category: 'Tanks', render: (r, s) => tankPlan(r, s, 'septic') },
      { id: 'rwh', name: 'Rainwater Harvesting', category: 'Tanks', render: (r, s) => tankPlan(r, s, 'rwh') },
      { id: 'riser', name: 'Plumbing Riser Diagram', category: 'Diagrams', render: riserDiagram },
      { id: 'bath', name: 'Bathroom Plumbing Layout', category: 'Rooms', render: (r, s) => fixturePlan(r, s, 'toilet') },
      { id: 'kitchen', name: 'Kitchen Plumbing Layout', category: 'Rooms', render: (r, s) => fixturePlan(r, s, 'kitchen') },
    ];
    case 'hvac': return [
      { id: 'hvac', name: 'HVAC Layout', category: 'HVAC', render: (r, s) => hvacLayout(r, s, 'ac') },
      { id: 'ac', name: 'AC Placement Layout', category: 'HVAC', render: (r, s) => hvacLayout(r, s, 'ac') },
      { id: 'vent', name: 'Ventilation Analysis', category: 'Air', render: (r, s) => hvacLayout(r, s, 'vent') },
      { id: 'duct', name: 'Duct Routing', category: 'HVAC', render: (r, s) => hvacLayout(r, s, 'duct') },
      { id: 'exhaust', name: 'Exhaust Planning', category: 'Air', render: (r, s) => hvacLayout(r, s, 'exhaust') },
      { id: 'airflow', name: 'Airflow Simulation', category: 'Air', render: (r, s) => hvacLayout(r, s, 'airflow') },
    ];
    case 'fire': return [
      { id: 'exit', name: 'Fire Exit Plan', category: 'Fire', render: (r, s) => fireLayout(r, s, 'exit') },
      { id: 'evac', name: 'Emergency Evacuation Routes', category: 'Fire', render: (r, s) => fireLayout(r, s, 'evac') },
      { id: 'ext', name: 'Fire Extinguisher Locations', category: 'Fire', render: (r, s) => fireLayout(r, s, 'ext') },
      { id: 'smoke', name: 'Smoke Detector Layout', category: 'Fire', render: (r, s) => fireLayout(r, s, 'smoke') },
      { id: 'sign', name: 'Emergency Signage', category: 'Fire', render: (r, s) => fireLayout(r, s, 'sign') },
    ];
    case 'site': return [
      { id: 'site', name: 'Site Layout Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'site') },
      { id: 'parking', name: 'Parking Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'parking') },
      { id: 'landscape', name: 'Landscape Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'landscape') },
      { id: 'compound', name: 'Compound Wall Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'compound') },
      { id: 'gate', name: 'Gate Layout', category: 'Site', render: (r, s) => siteLayout(r, s, 'gate') },
      { id: 'driveway', name: 'Driveway Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'driveway') },
      { id: 'extdrain', name: 'External Drainage Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'extdrain') },
      { id: 'utility', name: 'Utility Routing Plan', category: 'Site', render: (r, s) => siteLayout(r, s, 'utility') },
    ];
  }
}
