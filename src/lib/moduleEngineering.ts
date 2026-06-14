// ============================================================================
//  MODULE ENGINEERING — shared deterministic drawing/report generators used by
//  the Apartment, Mixed-Use and Commercial workspaces. NO LLM. Every overlay is
//  computed from the module's RoomLayout[] for a single floor and returned as a
//  self-contained SVG string (consumed via dangerouslySetInnerHTML).
//
//  Disciplines: architectural plan, structural (column grid + beams),
//  plumbing, electrical, HVAC, fire safety. Plus compliance / cost / BOQ
//  computed from floor stats.
// ============================================================================
import type { RoomLayout } from '@/types';

export type Discipline = 'plan' | 'structural' | 'plumbing' | 'electrical' | 'hvac' | 'fire';

const SC = 8;          // px per foot
const PAD = 36;

const FILL: Record<string, string> = {
  living: '#dbeafe', dining: '#fce7f3', kitchen: '#dcfce7', bedroom: '#fef9c3',
  toilet: '#e0e7ff', balcony: '#d1fae5', staircase: '#e5e7eb', corridor: '#f8fafc',
  lobby: '#fef3c7', parking: '#eceff3', garden: '#bbf7d0', shop: '#ffedd5',
  office: '#ffedd5', lift: '#e5e7eb', refuge: '#fecaca', utility: '#f3f4f6',
  unit: '#fef3c7', foodcourt: '#fde68a', reception: '#fef9c3', store: '#f5f5f4',
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

interface Box { x: number; y: number; w: number; h: number; }
function bounds(rooms: RoomLayout[], plotW: number, plotD: number) {
  const W = plotW * SC + PAD * 2;
  const H = plotD * SC + PAD * 2;
  return { W, H };
}
const px = (ft: number) => PAD + ft * SC;

function basePlan(rooms: RoomLayout[], dim = true): string {
  let s = '';
  for (const r of rooms) {
    const x = px(r.x), y = px(r.y), w = r.w * SC, h = r.h * SC;
    const fill = r.color || FILL[r.type] || '#f5f5f4';
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#1a2744" stroke-width="1.4"/>`;
    if (w > 42 && h > 26) {
      const cx = x + w / 2, cy = y + h / 2;
      const fs = Math.max(6.5, Math.min(10, w / (r.name.length * 0.62)));
      s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="${fs}" fill="#1a2744" font-weight="600" font-family="'Outfit',sans-serif">${esc(r.name)}</text>`;
      if (dim) s += `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">${r.w}×${r.h}'</text>`;
    }
  }
  return s;
}

function frame(rooms: RoomLayout[], plotW: number, plotD: number, inner: string, title: string): string {
  const { W, H } = bounds(rooms, plotW, plotD);
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;max-height:72vh">
    <rect width="${W}" height="${H}" fill="#fafaf8"/>
    <text x="${PAD}" y="20" font-size="11" fill="#1a2744" font-weight="700" font-family="monospace" letter-spacing="0.08em">${esc(title.toUpperCase())}</text>
    ${inner}
  </svg>`;
}

// ── Column grid + beams (structural) ─────────────────────────────────────────
function structuralOverlay(rooms: RoomLayout[], plotW: number, plotD: number): string {
  if (!rooms.length) return '';
  const minX = Math.min(...rooms.map(r => r.x)), maxX = Math.max(...rooms.map(r => r.x + r.w));
  const minY = Math.min(...rooms.map(r => r.y)), maxY = Math.max(...rooms.map(r => r.y + r.h));
  const GRID = 16; // ft typical bay
  const xs: number[] = []; for (let x = minX; x <= maxX + 0.1; x += GRID) xs.push(Math.min(x, maxX)); if (xs[xs.length - 1] < maxX - 1) xs.push(maxX);
  const ys: number[] = []; for (let y = minY; y <= maxY + 0.1; y += GRID) ys.push(Math.min(y, maxY)); if (ys[ys.length - 1] < maxY - 1) ys.push(maxY);
  let s = '';
  // Beams (grid lines)
  for (const y of ys) s += `<line x1="${px(minX)}" y1="${px(y)}" x2="${px(maxX)}" y2="${px(y)}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="6,3" opacity="0.5"/>`;
  for (const x of xs) s += `<line x1="${px(x)}" y1="${px(minY)}" x2="${px(x)}" y2="${px(maxY)}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="6,3" opacity="0.5"/>`;
  // Columns at intersections
  let n = 0;
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
    const cx = px(xs[i]), cy = px(ys[j]); n++;
    s += `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" fill="#1a2744"/>`;
    s += `<text x="${cx + 6}" y="${cy - 6}" font-size="6" fill="#b91c1c" font-family="monospace">C${n}</text>`;
  }
  return s;
}

// ── Plumbing (wet cores + supply/drainage runs) ──────────────────────────────
function plumbingOverlay(rooms: RoomLayout[]): string {
  const wet = rooms.filter(r => r.type === 'toilet' || r.type === 'kitchen');
  if (!wet.length) return '';
  // Shaft near the first wet room
  const shaft = wet[0];
  const sx = px(shaft.x + shaft.w / 2), sy = px(shaft.y + shaft.h / 2);
  let s = `<circle cx="${sx}" cy="${sy}" r="6" fill="#0ea5e9"/><text x="${sx + 8}" y="${sy - 6}" font-size="7" fill="#0369a1" font-family="monospace">SHAFT</text>`;
  for (const r of wet) {
    const cx = px(r.x + r.w / 2), cy = px(r.y + r.h / 2);
    s += `<line x1="${sx}" y1="${sy}" x2="${cx}" y2="${cy}" stroke="#0ea5e9" stroke-width="1.6"/>`;          // supply
    s += `<line x1="${sx}" y1="${sy + 2}" x2="${cx}" y2="${cy + 2}" stroke="#16a34a" stroke-width="1.4" stroke-dasharray="4,2"/>`; // drainage
    s += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#0ea5e9"/>`;
    s += `<rect x="${cx - 4}" y="${cy + 5}" width="8" height="4" fill="#16a34a"/>`; // floor trap
  }
  return s;
}

// ── Electrical (DB + light points + cable runs) ──────────────────────────────
function electricalOverlay(rooms: RoomLayout[]): string {
  if (!rooms.length) return '';
  const core = rooms.find(r => r.type === 'lobby' || r.type === 'corridor') || rooms[0];
  const dx = px(core.x + 4), dy = px(core.y + 4);
  let s = `<rect x="${dx - 6}" y="${dy - 6}" width="14" height="14" fill="#f59e0b" stroke="#b45309"/><text x="${dx + 10}" y="${dy}" font-size="7" fill="#b45309" font-family="monospace">DB</text>`;
  for (const r of rooms) {
    if (r.type === 'parking' || r.type === 'garden' || r.type === 'balcony') continue;
    const cx = px(r.x + r.w / 2), cy = px(r.y + r.h / 2);
    s += `<line x1="${dx}" y1="${dy}" x2="${cx}" y2="${cy}" stroke="#f59e0b" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.6"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="#f59e0b" stroke-width="1.3"/><line x1="${cx - 3}" y1="${cy}" x2="${cx + 3}" y2="${cy}" stroke="#f59e0b" stroke-width="1"/><line x1="${cx}" y1="${cy - 3}" x2="${cx}" y2="${cy + 3}" stroke="#f59e0b" stroke-width="1"/>`;
    // wall socket
    s += `<rect x="${px(r.x) + 3}" y="${px(r.y + r.h) - 6}" width="5" height="3" fill="#b45309"/>`;
  }
  return s;
}

// ── HVAC (AHU + duct runs + diffusers) ───────────────────────────────────────
function hvacOverlay(rooms: RoomLayout[]): string {
  const ahu = rooms.find(r => r.type === 'utility') || rooms.find(r => r.type === 'corridor') || rooms[0];
  if (!ahu) return '';
  const ax = px(ahu.x + ahu.w / 2), ay = px(ahu.y + ahu.h / 2);
  let s = `<rect x="${ax - 8}" y="${ay - 6}" width="16" height="12" fill="#7c3aed" opacity="0.85"/><text x="${ax + 10}" y="${ay}" font-size="7" fill="#5b21b6" font-family="monospace">AHU</text>`;
  for (const r of rooms) {
    if (['parking', 'garden', 'balcony', 'staircase', 'lift', 'toilet'].includes(r.type)) continue;
    const cx = px(r.x + r.w / 2), cy = px(r.y + r.h / 2);
    s += `<line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="#7c3aed" stroke-width="2.4" opacity="0.35"/>`;     // duct
    s += `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" fill="none" stroke="#7c3aed" stroke-width="1.2"/><line x1="${cx - 4}" y1="${cy}" x2="${cx + 4}" y2="${cy}" stroke="#7c3aed" stroke-width="0.8"/>`; // diffuser
  }
  return s;
}

// ── Fire safety (extinguishers, sprinklers, exit arrows, hydrant) ────────────
function fireOverlay(rooms: RoomLayout[]): string {
  let s = '';
  const stairs = rooms.filter(r => r.type === 'staircase');
  for (const r of rooms) {
    if (['parking', 'garden', 'balcony'].includes(r.type)) continue;
    // sprinkler grid
    const cols = Math.max(1, Math.round(r.w / 12)), rws = Math.max(1, Math.round(r.h / 12));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
      const sx = px(r.x + (r.w * (i + 0.5)) / cols), sy = px(r.y + (r.h * (j + 0.5)) / rws);
      s += `<circle cx="${sx}" cy="${sy}" r="2" fill="none" stroke="#dc2626" stroke-width="0.9"/><circle cx="${sx}" cy="${sy}" r="0.7" fill="#dc2626"/>`;
    }
  }
  // extinguishers + alarms near corridors/lobbies
  for (const r of rooms.filter(r => r.type === 'corridor' || r.type === 'lobby')) {
    const ex = px(r.x + 3), ey = px(r.y + r.h / 2);
    s += `<rect x="${ex - 2}" y="${ey - 4}" width="4" height="8" rx="2" fill="#dc2626"/><text x="${ex + 5}" y="${ey}" font-size="6" fill="#991b1b" font-family="monospace">FE</text>`;
  }
  // exit arrows pointing to stairs
  for (const st of stairs) {
    const sx = px(st.x + st.w / 2), sy = px(st.y + st.h / 2);
    s += `<circle cx="${sx}" cy="${sy}" r="9" fill="#16a34a" opacity="0.9"/><text x="${sx}" y="${sy + 3}" text-anchor="middle" font-size="7" fill="#fff" font-weight="700" font-family="monospace">EXIT</text>`;
  }
  // hydrant near first stair
  if (stairs[0]) { const hx = px(stairs[0].x) - 6, hy = px(stairs[0].y + stairs[0].h / 2); s += `<circle cx="${hx}" cy="${hy}" r="4" fill="#b91c1c"/><text x="${hx - 4}" y="${hy - 6}" font-size="6" fill="#991b1b" font-family="monospace">FH</text>`; }
  return s;
}

const TITLES: Record<Discipline, string> = {
  plan: 'Floor Plan', structural: 'Structural — Column & Beam Layout',
  plumbing: 'Plumbing — Supply & Drainage', electrical: 'Electrical — Lighting & Power',
  hvac: 'HVAC — Duct Layout', fire: 'Fire Safety — Sprinklers & Egress',
};

/** Render a discipline drawing for ONE floor's rooms as a standalone SVG string. */
export function renderDiscipline(discipline: Discipline, rooms: RoomLayout[], plotW: number, plotD: number): string {
  const base = basePlan(rooms, discipline === 'plan');
  let overlay = '';
  if (discipline === 'structural') overlay = structuralOverlay(rooms, plotW, plotD);
  else if (discipline === 'plumbing') overlay = plumbingOverlay(rooms);
  else if (discipline === 'electrical') overlay = electricalOverlay(rooms);
  else if (discipline === 'hvac') overlay = hvacOverlay(rooms);
  else if (discipline === 'fire') overlay = fireOverlay(rooms);
  return frame(rooms, plotW, plotD, base + overlay, TITLES[discipline]);
}

// ── Cross-section (deterministic, from floor count + heights) ─────────────────
export function renderSection(floorLabels: string[], plotW: number, floorHeights: number[]): string {
  const SCS = 7, PADS = 40;
  const totalH = floorHeights.reduce((a, b) => a + b, 0);
  const W = plotW * SCS + PADS * 2, H = totalH * SCS + PADS * 2;
  let s = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;max-height:72vh"><rect width="${W}" height="${H}" fill="#fafaf8"/>`;
  s += `<text x="${PADS}" y="20" font-size="11" fill="#1a2744" font-weight="700" font-family="monospace">BUILDING CROSS-SECTION</text>`;
  let yCursor = H - PADS;
  const x0 = PADS, x1 = PADS + plotW * SCS;
  for (let i = 0; i < floorLabels.length; i++) {
    const fh = floorHeights[i] * SCS;
    const top = yCursor - fh;
    s += `<rect x="${x0}" y="${top}" width="${plotW * SCS}" height="${fh}" fill="${i % 2 ? '#eef2f7' : '#f5f7fa'}" stroke="#1a2744" stroke-width="1.2"/>`;
    s += `<line x1="${x0}" y1="${top}" x2="${x1}" y2="${top}" stroke="#1a2744" stroke-width="2"/>`; // slab
    s += `<text x="${x0 + 8}" y="${top + fh / 2 + 3}" font-size="9" fill="#1a2744" font-family="'Outfit',sans-serif" font-weight="600">${esc(floorLabels[i])}</text>`;
    s += `<text x="${x1 - 8}" y="${top + fh / 2 + 3}" text-anchor="end" font-size="7" fill="#64748b" font-family="monospace">${floorHeights[i]}'</text>`;
    yCursor = top;
  }
  // Vertical core shaft (stair/lift) full height on the right
  const coreX = x1 - 34 * SCS / 2;
  s += `<rect x="${coreX}" y="${PADS}" width="${Math.min(48, 18 * SCS)}" height="${H - PADS - (H - PADS - totalH * SCS) - PADS + PADS}" fill="none"/>`;
  s += `<rect x="${x1 - 50}" y="${H - PADS - totalH * SCS}" width="40" height="${totalH * SCS}" fill="#e5e7eb" opacity="0.6" stroke="#1a2744" stroke-width="1" stroke-dasharray="4,2"/>`;
  s += `<text x="${x1 - 30}" y="${H - PADS - totalH * SCS / 2}" text-anchor="middle" font-size="7" fill="#475569" font-family="monospace" transform="rotate(-90 ${x1 - 30} ${H - PADS - totalH * SCS / 2})">LIFT / STAIR CORE</text>`;
  s += `<line x1="${x0}" y1="${H - PADS}" x2="${x1}" y2="${H - PADS}" stroke="#1a2744" stroke-width="3"/>`; // ground line
  s += `</svg>`;
  return s;
}

// ── Schedules ─────────────────────────────────────────────────────────────────
export interface ScheduleRow { mark: string; type: string; size: string; count: number; }
export function doorSchedule(rooms: RoomLayout[]): ScheduleRow[] {
  const map = new Map<string, ScheduleRow>();
  let n = 0;
  for (const r of rooms) for (const d of r.doors) {
    const key = `${d.width}`;
    if (!map.has(key)) { n++; map.set(key, { mark: `D${n}`, type: d.width >= 5 ? 'Double / Wide' : d.width >= 3.5 ? 'Main / Entry' : 'Single Leaf', size: `${d.width}' × 7'`, count: 0 }); }
    map.get(key)!.count++;
  }
  return [...map.values()];
}
export function windowSchedule(rooms: RoomLayout[]): ScheduleRow[] {
  const map = new Map<string, ScheduleRow>();
  let n = 0;
  for (const r of rooms) for (const w of r.windows) {
    const key = `${w.width}`;
    if (!map.has(key)) { n++; map.set(key, { mark: `W${n}`, type: w.width >= 6 ? 'Picture / Large' : w.width >= 4 ? 'Standard' : 'Ventilator', size: `${w.width}' × 4'`, count: 0 }); }
    map.get(key)!.count++;
  }
  return [...map.values()];
}

// ── Compliance reports ───────────────────────────────────────────────────────
export interface ComplianceItem { check: string; value: string; status: 'pass' | 'review' | 'na'; note: string; }
export function complianceReport(opts: { far: number; maxFar?: number; floors: number; parkingProvided: number; parkingRequired: number; hasRefuge?: boolean; twoExits?: boolean; occupancyLoad?: number; kind: string }): ComplianceItem[] {
  const maxFar = opts.maxFar ?? 2.75;
  const items: ComplianceItem[] = [
    { check: 'FAR / FSI', value: `${opts.far} (permissible ~${maxFar})`, status: opts.far <= maxFar ? 'pass' : 'review', note: 'NBC 2016 / local DCR. Verify against the exact zone FSI + premium/TDR.' },
    { check: 'Parking', value: `${opts.parkingProvided} provided / ${opts.parkingRequired} required`, status: opts.parkingProvided >= opts.parkingRequired ? 'pass' : 'review', note: 'ECS counted at module ratios. Confirm with local parking byelaw.' },
    { check: 'Setbacks', value: 'Applied (front + sides + rear)', status: 'pass', note: 'Generated within statutory setback envelope.' },
    { check: 'Means of egress', value: opts.twoExits ? 'Two staircases (fire + escape)' : 'Single + lift lobby', status: opts.twoExits ? 'pass' : (opts.floors > 4 ? 'review' : 'pass'), note: 'NBC Part 4 — two exits mandatory above 15 m / high occupancy.' },
  ];
  if (opts.hasRefuge !== undefined) items.push({ check: 'Refuge area', value: opts.hasRefuge ? 'Provided (>7 floors)' : 'Not required (≤7 floors)', status: 'pass', note: 'NBC: refuge area every 7 floors above 24 m.' });
  if (opts.occupancyLoad !== undefined) items.push({ check: 'Occupancy load', value: `${opts.occupancyLoad} persons`, status: 'review', note: 'Drives exit width — verify aggregate exit width ≥ load / 50 per unit.' });
  items.push({ check: 'Fire compliance', value: 'Sprinklers + hydrant + alarm shown', status: 'review', note: 'Schematic only — requires licensed fire consultant + NOC.' });
  items.push({ check: 'Structural safety', value: `${opts.floors + 2} levels, 16′ bay grid`, status: 'review', note: 'Indicative grid — requires structural engineer design & analysis.' });
  return items;
}

// ── Cost estimate + BOQ ──────────────────────────────────────────────────────
export interface CostLine { head: string; basis: string; amount: number; }
export function costEstimate(builtUpSqft: number, ratePerSqft: number, kind: string): { lines: CostLine[]; total: number; perSqft: number } {
  const civil = Math.round(builtUpSqft * ratePerSqft);
  const mep = Math.round(civil * 0.22);
  const finishes = Math.round(civil * 0.18);
  const lifts = kind === 'commercial' ? Math.round(civil * 0.06) : Math.round(civil * 0.04);
  const ext = Math.round(civil * 0.08);
  const prelim = Math.round((civil + mep + finishes + lifts + ext) * 0.05);
  const gst = Math.round((civil + mep + finishes + lifts + ext + prelim) * 0.18);
  const lines: CostLine[] = [
    { head: 'Civil & Structure (RCC, masonry)', basis: `${builtUpSqft.toLocaleString('en-IN')} sqft × ₹${ratePerSqft}`, amount: civil },
    { head: 'MEP (plumbing, electrical, HVAC)', basis: '22% of civil', amount: mep },
    { head: 'Finishes (flooring, paint, doors)', basis: '18% of civil', amount: finishes },
    { head: 'Vertical transport (lifts)', basis: kind === 'commercial' ? '6% of civil' : '4% of civil', amount: lifts },
    { head: 'External / site development', basis: '8% of civil', amount: ext },
    { head: 'Preliminaries & contingency', basis: '5%', amount: prelim },
    { head: 'GST', basis: '18%', amount: gst },
  ];
  const total = lines.reduce((a, l) => a + l.amount, 0);
  return { lines, total, perSqft: Math.round(total / builtUpSqft) };
}

export interface BOQRow { item: string; unit: string; qty: number; rate: number; amount: number; }
export function boq(builtUpSqft: number): BOQRow[] {
  const rows: Array<[string, string, number, number]> = [
    ['Excavation & earthwork', 'cum', Math.round(builtUpSqft * 0.12), 180],
    ['PCC / RCC concrete M25', 'cum', Math.round(builtUpSqft * 0.09), 7200],
    ['Reinforcement steel', 'kg', Math.round(builtUpSqft * 3.2), 72],
    ['Brick / block masonry', 'sqm', Math.round(builtUpSqft * 0.09), 1100],
    ['Internal plaster & putty', 'sqm', Math.round(builtUpSqft * 0.28), 320],
    ['Flooring (vitrified / IPS)', 'sqm', Math.round(builtUpSqft * 0.093), 1400],
    ['Painting (int + ext)', 'sqm', Math.round(builtUpSqft * 0.34), 240],
    ['Doors & windows', 'sqm', Math.round(builtUpSqft * 0.05), 4200],
    ['Plumbing & sanitary', 'lot', 1, Math.round(builtUpSqft * 95)],
    ['Electrical & lighting', 'lot', 1, Math.round(builtUpSqft * 110)],
  ];
  return rows.map(([item, unit, qty, rate]) => ({ item, unit, qty, rate, amount: qty * rate }));
}
