import { RoomLayout } from './layoutSolver';

export const ENGINEERING_DISCLAIMER = `
  AI-GENERATED PRELIMINARY DRAFT
  This drawing is intended for concept development only.
  Structural, electrical, plumbing, HVAC, fire safety
  and municipal compliance must be reviewed and approved
  by licensed professionals before construction or submission.
`;

// ─── STRUCTURAL ──────────────────────────────────────────────────────────────

export function generateStructuralOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  const corners: { x: number; y: number }[] = [];
  const addCorner = (x: number, y: number) => {
    if (!corners.some(c => Math.abs(c.x - x) < 1.5 && Math.abs(c.y - y) < 1.5)) corners.push({ x, y });
  };
  rooms.forEach(r => {
    if (r.type === 'parking' || r.type === 'garden') return;
    addCorner(r.x, r.y); addCorner(r.x + r.w, r.y);
    addCorner(r.x, r.y + r.h); addCorner(r.x + r.w, r.y + r.h);
  });

  rooms.forEach((r, idx) => {
    if (r.type === 'parking' || r.type === 'garden') return;
    const rx = r.x * scale, ry = r.y * scale, rw = r.w * scale, rh = r.h * scale;
    layers += `
      <line x1="${rx}" y1="${ry}" x2="${rx+rw}" y2="${ry}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.7"/>
      <line x1="${rx}" y1="${ry}" x2="${rx}" y2="${ry+rh}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.7"/>
      <line x1="${rx+rw}" y1="${ry}" x2="${rx+rw}" y2="${ry+rh}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.7"/>
      <line x1="${rx}" y1="${ry+rh}" x2="${rx+rw}" y2="${ry+rh}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.7"/>
      <text x="${rx+rw/2}" y="${ry+rh/2}" fill="#be123c" font-size="8" font-family="monospace" opacity="0.35" text-anchor="middle">S${idx+1} (150mm)</text>`;
  });

  corners.forEach((c, i) => {
    const cx = c.x * scale, cy = c.y * scale, s = 0.75 * scale;
    layers += `
      <rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" fill="#f43f5e" stroke="#be123c" stroke-width="1.5"/>
      <line x1="${cx-s/2}" y1="${cy-s/2}" x2="${cx+s/2}" y2="${cy+s/2}" stroke="#be123c" stroke-width="0.5"/>
      <line x1="${cx+s/2}" y1="${cy-s/2}" x2="${cx-s/2}" y2="${cy+s/2}" stroke="#be123c" stroke-width="0.5"/>
      <text x="${cx+s/2+3}" y="${cy+3}" fill="#f43f5e" font-size="7" font-family="monospace" font-weight="bold">C${i+1}</text>`;
  });
  return layers;
}

// ─── ELECTRICAL — looping circuit diagram ────────────────────────────────────

export function generateElectricalOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';

  const dbRoom = rooms.find(r => r.type === 'lobby' || r.type === 'living') || rooms[0];
  if (!dbRoom) return '';
  const dbX = (dbRoom.x + 1) * scale;
  const dbY = (dbRoom.y + 1) * scale;

  layers += `
    <rect x="${dbX}" y="${dbY}" width="${1.5*scale}" height="${2.5*scale}" fill="#1e293b" stroke="#eab308" stroke-width="2" rx="2"/>
    <text x="${dbX + 0.75*scale}" y="${dbY - 4}" fill="#eab308" font-size="7" font-family="monospace" text-anchor="middle" font-weight="bold">DB</text>
    <text x="${dbX + 0.75*scale}" y="${dbY + 1*scale}" fill="#eab308" font-size="6" font-family="monospace" text-anchor="middle">MCB</text>
    <text x="${dbX + 0.75*scale}" y="${dbY + 1.6*scale}" fill="#64748b" font-size="5" font-family="monospace" text-anchor="middle">PANEL</text>`;

  let prevX = dbX + 0.75 * scale;
  let prevY = dbY + 2.5 * scale;
  const circuitColors = ['#eab308', '#f97316', '#a3e635', '#38bdf8'];
  let colorIdx = 0;

  rooms.forEach((r, idx) => {
    if (r.type === 'parking' || r.type === 'garden') return;
    const rx = r.x * scale, ry = r.y * scale, rw = r.w * scale, rh = r.h * scale;
    const cx = rx + rw / 2, cy = ry + rh / 2;
    const col = circuitColors[colorIdx % circuitColors.length];
    colorIdx++;

    layers += `
      <polyline points="${prevX},${prevY} ${prevX},${cy} ${cx},${cy}"
        fill="none" stroke="${col}" stroke-width="1" stroke-dasharray="6 2" opacity="0.6"/>`;
    prevX = cx; prevY = cy;

    // Ceiling light/fan
    layers += `
      <circle cx="${cx}" cy="${cy}" r="${0.5*scale}" fill="none" stroke="${col}" stroke-width="1.5"/>
      <line x1="${cx - 0.7*scale}" y1="${cy}" x2="${cx + 0.7*scale}" y2="${cy}" stroke="${col}" stroke-width="1.2"/>
      <line x1="${cx}" y1="${cy - 0.7*scale}" x2="${cx}" y2="${cy + 0.7*scale}" stroke="${col}" stroke-width="1.2"/>`;

    // Switch board near door
    const sw = r.doors[0];
    const swX = sw ? rx + Math.min(sw.offset * scale + 0.5*scale, rw - scale) : rx + 1.5*scale;
    const swY = sw?.side === 'front' ? ry + rh - 0.5*scale : ry + 0.5*scale;
    layers += `
      <rect x="${swX - 0.35*scale}" y="${swY - 0.2*scale}" width="${0.7*scale}" height="${0.4*scale}" fill="${col}" rx="1"/>
      <text x="${swX + 0.5*scale}" y="${swY + 0.1*scale}" fill="${col}" font-size="5.5" font-family="monospace">SW</text>
      <line x1="${swX}" y1="${swY}" x2="${cx}" y2="${cy}" stroke="${col}" stroke-width="0.8" opacity="0.4" stroke-dasharray="3 2"/>`;

    // 5A socket
    layers += `
      <circle cx="${rx + 0.5*scale}" cy="${cy - 1*scale}" r="${0.25*scale}" fill="none" stroke="${col}" stroke-width="1"/>
      <line x1="${rx + 0.25*scale}" y1="${cy - 1*scale}" x2="${rx + 0.75*scale}" y2="${cy - 1*scale}" stroke="${col}" stroke-width="0.8"/>
      <text x="${rx + 1*scale}" y="${cy - 0.85*scale}" fill="${col}" font-size="5" font-family="monospace">5A</text>`;

    // 15A for AC
    if (r.type === 'bedroom' || r.type === 'living') {
      layers += `
        <rect x="${rx+rw-1.5*scale}" y="${ry+0.4*scale}" width="${0.8*scale}" height="${0.5*scale}" fill="none" stroke="${col}" stroke-width="1" rx="1"/>
        <text x="${rx+rw-1.5*scale}" y="${ry+1.2*scale}" fill="${col}" font-size="5.5" font-family="monospace">15A AC</text>`;
    }

    // Ceiling fan for bedrooms
    if (r.type === 'bedroom') {
      layers += `
        <circle cx="${cx + 1.5*scale}" cy="${cy}" r="${0.35*scale}" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 1"/>
        <text x="${cx + 2*scale}" y="${cy + 0.1*scale}" fill="#38bdf8" font-size="5" font-family="monospace">FAN</text>`;
    }

    // Earth point
    layers += `
      <line x1="${rx+rw-0.5*scale}" y1="${ry+rh-0.8*scale}" x2="${rx+rw-0.5*scale}" y2="${ry+rh-0.3*scale}" stroke="${col}" stroke-width="1"/>
      <line x1="${rx+rw-0.8*scale}" y1="${ry+rh-0.3*scale}" x2="${rx+rw-0.2*scale}" y2="${ry+rh-0.3*scale}" stroke="${col}" stroke-width="1"/>
      <line x1="${rx+rw-0.65*scale}" y1="${ry+rh-0.1*scale}" x2="${rx+rw-0.35*scale}" y2="${ry+rh-0.1*scale}" stroke="${col}" stroke-width="0.8"/>
      <text x="${rx+rw-0.5*scale}" y="${ry+rh+0.3*scale}" fill="${col}" font-size="5" font-family="monospace" text-anchor="middle">E</text>`;

    layers += `<text x="${rx+4}" y="${ry+12}" fill="${col}" font-size="6" font-family="monospace" font-weight="bold" opacity="0.7">L${idx+1}</text>`;
  });

  // Close loop to DB
  layers += `
    <polyline points="${prevX},${prevY} ${dbX + 0.75*scale},${prevY} ${dbX + 0.75*scale},${dbY + 2.5*scale}"
      fill="none" stroke="#475569" stroke-width="0.8" stroke-dasharray="4 4" opacity="0.4"/>`;

  // Legend
  const lgX = 4, lgY = 4;
  layers += `
    <rect x="${lgX}" y="${lgY}" width="${8*scale}" height="${5*scale}" fill="rgba(15,23,42,0.85)" rx="4"/>
    <text x="${lgX + 4*scale}" y="${lgY + 0.8*scale}" fill="#eab308" font-size="7" font-family="monospace" text-anchor="middle" font-weight="bold">ELECTRICAL LEGEND</text>
    ${[
      { col: '#eab308', lbl: '⊕  Ceiling Light / Fan Point' },
      { col: '#eab308', lbl: '▪  Switch Board (MCB)' },
      { col: '#eab308', lbl: '○  5A Power Socket' },
      { col: '#38bdf8', lbl: '□  15A AC / Heavy Appliance' },
      { col: '#a3e635', lbl: '⏚  Earth Point (IS 3043)' },
    ].map((l, i) => `<text x="${lgX + 0.5*scale}" y="${lgY + (1.6 + i*0.7)*scale}" fill="${l.col}" font-size="6.5" font-family="monospace">${l.lbl}</text>`).join('')}`;

  return layers;
}

// ─── PLUMBING ────────────────────────────────────────────────────────────────

export function generatePlumbingOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  const frontRooms = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
  if (frontRooms.length === 0) return '';

  const plotMinX = Math.min(...rooms.map(r => r.x)) * scale;
  const plotMaxX = Math.max(...rooms.map(r => r.x + r.w)) * scale;
  const plotMaxY = Math.max(...rooms.map(r => r.y + r.h)) * scale;
  const mainSupplyY = plotMaxY + 1.5 * scale;

  // Main supply line
  layers += `
    <line x1="${plotMinX}" y1="${mainSupplyY}" x2="${plotMaxX}" y2="${mainSupplyY}" stroke="#3b82f6" stroke-width="2.5"/>
    <text x="${(plotMinX+plotMaxX)/2}" y="${mainSupplyY + 0.8*scale}" fill="#3b82f6" font-size="7" font-family="monospace" text-anchor="middle" font-weight="bold">MAIN WATER SUPPLY (25mm CPVC)</text>
    <circle cx="${plotMinX + 3*scale}" cy="${mainSupplyY}" r="${0.5*scale}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>
    <text x="${plotMinX + 3*scale}" y="${mainSupplyY + 1.5*scale}" fill="#3b82f6" font-size="6" font-family="monospace" text-anchor="middle">WM</text>`;

  // OHT
  const tankX = plotMaxX + 0.5 * scale, tankY = 1 * scale;
  layers += `
    <rect x="${tankX}" y="${tankY}" width="${2*scale}" height="${1.5*scale}" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" stroke-width="2" rx="2"/>
    <text x="${tankX + scale}" y="${tankY - 0.3*scale}" fill="#3b82f6" font-size="6.5" font-family="monospace" text-anchor="middle" font-weight="bold">OHT (2000L)</text>
    <line x1="${tankX + scale}" y1="${tankY + 1.5*scale}" x2="${tankX + scale}" y2="${mainSupplyY}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="5 3"/>`;

  // Sump
  const sumpX = plotMinX - 3 * scale, sumpY = mainSupplyY - 1.5 * scale;
  layers += `
    <rect x="${sumpX}" y="${sumpY}" width="${2*scale}" height="${1.5*scale}" fill="rgba(59,130,246,0.1)" stroke="#1d4ed8" stroke-width="1.5" rx="2" stroke-dasharray="4 2"/>
    <text x="${sumpX + scale}" y="${sumpY - 0.3*scale}" fill="#1d4ed8" font-size="6.5" font-family="monospace" text-anchor="middle" font-weight="bold">SUMP (5000L)</text>
    <line x1="${sumpX + 2*scale}" y1="${sumpY + 0.75*scale}" x2="${plotMinX}" y2="${mainSupplyY}" stroke="#1d4ed8" stroke-width="1.5"/>`;

  rooms.forEach(r => {
    const rx = r.x * scale, ry = r.y * scale, rw = r.w * scale, rh = r.h * scale;
    const cx = rx + rw / 2, cy = ry + rh / 2;

    if (r.type === 'toilet') {
      layers += `
        <circle cx="${rx+rw-1.5*scale}" cy="${ry+rh-1.5*scale}" r="${0.4*scale}" fill="rgba(180,83,9,0.2)" stroke="#b45309" stroke-width="1.5"/>
        <text x="${rx+rw-0.9*scale}" y="${ry+rh-1.3*scale}" fill="#b45309" font-size="5.5" font-family="monospace">SP 100mm</text>
        <circle cx="${rx+1*scale}" cy="${ry+1*scale}" r="${0.3*scale}" fill="rgba(180,83,9,0.2)" stroke="#b45309" stroke-width="1"/>
        <text x="${rx+1.5*scale}" y="${ry+1.2*scale}" fill="#b45309" font-size="5" font-family="monospace">BW 50mm</text>
        <path d="M ${rx} ${cy-0.5*scale} L ${cx} ${cy-0.5*scale} L ${cx} ${ry+rh}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="${rx+0.3*scale}" y="${cy-0.8*scale}" fill="#3b82f6" font-size="5" font-family="monospace">CWS</text>
        <path d="M ${rx+0.3*scale} ${cy} L ${cx-0.5*scale} ${cy}" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 2"/>
        <text x="${rx+0.3*scale}" y="${cy+0.5*scale}" fill="#ef4444" font-size="5" font-family="monospace">HWS</text>
        <circle cx="${rx+1.5*scale}" cy="${ry+1.5*scale}" r="${0.5*scale}" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1.2"/>
        <text x="${rx+1.5*scale}" y="${ry+2.2*scale}" fill="#ef4444" font-size="5.5" font-family="monospace" text-anchor="middle">GEY</text>
        <circle cx="${cx}" cy="${ry+rh-0.8*scale}" r="${0.25*scale}" fill="#b45309"/>
        <text x="${cx+0.4*scale}" y="${ry+rh-0.6*scale}" fill="#b45309" font-size="5" font-family="monospace">FT</text>
        <line x1="${rx+rw-0.8*scale}" y1="${ry}" x2="${rx+rw-0.8*scale}" y2="${ry-1.5*scale}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 2"/>
        <text x="${rx+rw-0.8*scale}" y="${ry-1.8*scale}" fill="#94a3b8" font-size="5" font-family="monospace" text-anchor="middle">VP</text>`;
    } else if (r.type === 'kitchen') {
      layers += `
        <circle cx="${rx+1*scale}" cy="${ry+0.8*scale}" r="${0.3*scale}" fill="rgba(59,130,246,0.2)" stroke="#3b82f6" stroke-width="1.2"/>
        <line x1="${rx+1*scale}" y1="${ry}" x2="${rx+1*scale}" y2="${ry+0.8*scale}" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="${rx+1.5*scale}" y="${ry+0.5*scale}" fill="#3b82f6" font-size="5" font-family="monospace">K-CW</text>
        <circle cx="${rx+1*scale}" cy="${ry+rh-1*scale}" r="${0.25*scale}" fill="rgba(180,83,9,0.2)" stroke="#b45309" stroke-width="1"/>
        <line x1="${rx+1*scale}" y1="${ry+rh-0.75*scale}" x2="${rx+1*scale}" y2="${ry+rh}" stroke="#b45309" stroke-width="1.5"/>
        <text x="${rx+1.5*scale}" y="${ry+rh-0.7*scale}" fill="#b45309" font-size="5" font-family="monospace">GT 50mm</text>
        <path d="M ${rx+rw-scale} ${ry+0.5*scale} Q ${rx+rw-0.5*scale} ${ry+scale} ${rx+rw-scale} ${ry+1.5*scale}" fill="none" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4 2"/>
        <text x="${rx+rw-2*scale}" y="${ry+0.3*scale}" fill="#f97316" font-size="5" font-family="monospace">GAS</text>`;
    } else if (r.type === 'balcony') {
      layers += `
        <circle cx="${cx}" cy="${ry+rh-0.8*scale}" r="${0.2*scale}" fill="#b45309"/>
        <text x="${cx}" y="${ry+rh-0.3*scale}" fill="#b45309" font-size="5" font-family="monospace" text-anchor="middle">FD</text>`;
    }
  });

  // Drainage stack
  const stackX = plotMaxX + 2 * scale;
  layers += `
    <line x1="${stackX}" y1="${0}" x2="${stackX}" y2="${plotMaxY}" stroke="#b45309" stroke-width="2.5"/>
    <text x="${stackX+0.3*scale}" y="${plotMaxY/2}" fill="#b45309" font-size="6" font-family="monospace" font-weight="bold" transform="rotate(90,${stackX+0.3*scale},${plotMaxY/2})">DRAINAGE STACK 100mm uPVC</text>`;

  // Legend
  const lgX = 4, lgY = 4;
  layers += `
    <rect x="${lgX}" y="${lgY}" width="${9*scale}" height="${5.5*scale}" fill="rgba(15,23,42,0.85)" rx="4"/>
    <text x="${lgX+4.5*scale}" y="${lgY+0.8*scale}" fill="#3b82f6" font-size="7" font-family="monospace" text-anchor="middle" font-weight="bold">PLUMBING LEGEND</text>
    ${[
      { col: '#3b82f6', lbl: '━━  Cold Water Supply (CPVC)' },
      { col: '#ef4444', lbl: '╌╌  Hot Water Supply' },
      { col: '#b45309', lbl: '━━  Soil / Waste Pipe (uPVC)' },
      { col: '#94a3b8', lbl: '╌╌  Vent Pipe (VP)' },
      { col: '#f97316', lbl: '╌╌  Gas Line' },
    ].map((l, i) => `<text x="${lgX+0.5*scale}" y="${lgY+(1.6+i*0.7)*scale}" fill="${l.col}" font-size="6.5" font-family="monospace">${l.lbl}</text>`).join('')}`;

  return layers;
}

// ─── HVAC ────────────────────────────────────────────────────────────────────

export function generateHvacOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  rooms.forEach(r => {
    if (r.type !== 'living' && r.type !== 'bedroom' && r.type !== 'kitchen') return;
    const rx = r.x * scale, ry = r.y * scale, rw = r.w * scale, rh = r.h * scale;
    const acW = 3.5 * scale, acH = 0.8 * scale;
    const acX = rx + rw / 2 - acW / 2, acY = ry + 2;
    layers += `
      <rect x="${acX}" y="${acY}" width="${acW}" height="${acH}" fill="#f0f9ff" stroke="#10b981" stroke-width="1.5" rx="2"/>
      <path d="M ${acX+acW/2} ${acY+acH} L ${acX+acW/2} ${acY+acH+10} M ${acX+acW/2-8} ${acY+acH} L ${acX+acW/2-12} ${acY+acH+8} M ${acX+acW/2+8} ${acY+acH} L ${acX+acW/2+12} ${acY+acH+8}"
        fill="none" stroke="#10b981" stroke-width="1" opacity="0.5"/>
      <text x="${acX+acW/2}" y="${acY+acH+18}" fill="#10b981" font-size="6.5" font-family="monospace" text-anchor="middle">AC (${r.type==='living'?'2.0':'1.5'} TON)</text>`;
  });
  return layers;
}

// ─── FIRE SAFETY ─────────────────────────────────────────────────────────────

export function generateFireSafetyOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  rooms.forEach(r => {
    if (r.type !== 'living' && r.type !== 'kitchen' && r.type !== 'lobby' && r.type !== 'corridor') return;
    const rx = r.x * scale, ry = r.y * scale, rw = r.w * scale, rh = r.h * scale;
    if (r.type === 'kitchen' || r.type === 'living') {
      const feX = rx + 12, feY = ry + rh - 12;
      layers += `
        <rect x="${feX-4}" y="${feY-8}" width="8" height="12" fill="#ef4444" rx="2"/>
        <line x1="${feX-4}" y1="${feY-4}" x2="${feX+4}" y2="${feY-4}" stroke="#fff" stroke-width="1.5"/>
        <text x="${feX+8}" y="${feY}" fill="#ef4444" font-size="7" font-family="monospace" font-weight="bold">FE</text>`;
    }
    if (r.type === 'lobby' || r.type === 'living') {
      const ax = rx + rw / 2, ay = ry + rh - 15;
      layers += `
        <path d="M ${ax-15} ${ay} L ${ax+15} ${ay} M ${ax+5} ${ay-5} L ${ax+15} ${ay} L ${ax+5} ${ay+5}" fill="none" stroke="#22c55e" stroke-width="2"/>
        <text x="${ax}" y="${ay-8}" fill="#22c55e" font-size="7" font-family="monospace" text-anchor="middle">EXIT ROUTE</text>`;
    }
  });
  return layers;
}

// ─── COLUMN / BEAM / FOUNDATION ──────────────────────────────────────────────

export function generateColumnPlanOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  const corners: { x: number; y: number }[] = [];
  const add = (x: number, y: number) => { if (!corners.some(c=>Math.abs(c.x-x)<1.5&&Math.abs(c.y-y)<1.5)) corners.push({x,y}); };
  rooms.forEach(r => { if(r.type==='parking'||r.type==='garden')return; add(r.x,r.y);add(r.x+r.w,r.y);add(r.x,r.y+r.h);add(r.x+r.w,r.y+r.h); });
  const uxs = Array.from(new Set(corners.map(c=>Math.round(c.x)))).sort((a,b)=>a-b);
  const uys = Array.from(new Set(corners.map(c=>Math.round(c.y)))).sort((a,b)=>a-b);
  uxs.forEach((ux,i) => {
    const gx=ux*scale;
    layers+=`<line x1="${gx}" y1="0" x2="${gx}" y2="800" stroke="#f43f5e" stroke-width="0.5" stroke-dasharray="8 4" opacity="0.4"/>
      <text x="${gx}" y="12" fill="#f43f5e" font-size="7" font-family="monospace" text-anchor="middle" font-weight="bold">${String.fromCharCode(65+i)}</text>`;
  });
  uys.forEach((uy,i) => {
    const gy=uy*scale;
    layers+=`<line x1="0" y1="${gy}" x2="1000" y2="${gy}" stroke="#f43f5e" stroke-width="0.5" stroke-dasharray="8 4" opacity="0.4"/>
      <text x="12" y="${gy+3}" fill="#f43f5e" font-size="7" font-family="monospace" font-weight="bold">${i+1}</text>`;
  });
  corners.forEach((c,i) => {
    const cx=c.x*scale,cy=c.y*scale,s=0.8*scale;
    layers+=`<rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" fill="#f43f5e" stroke="#be123c" stroke-width="1.5"/>
      <line x1="${cx-s/2}" y1="${cy-s/2}" x2="${cx+s/2}" y2="${cy+s/2}" stroke="#be123c" stroke-width="0.5"/>
      <line x1="${cx+s/2}" y1="${cy-s/2}" x2="${cx-s/2}" y2="${cy+s/2}" stroke="#be123c" stroke-width="0.5"/>
      <text x="${cx+s/2+3}" y="${cy+3}" fill="#f43f5e" font-size="8" font-family="monospace" font-weight="bold">C${i+1}</text>`;
  });
  return layers;
}

export function generateBeamPlanOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  const corners: { x: number; y: number }[] = [];
  const add = (x: number, y: number) => { if(!corners.some(c=>Math.abs(c.x-x)<1.5&&Math.abs(c.y-y)<1.5)) corners.push({x,y}); };
  rooms.forEach(r => { if(r.type==='parking'||r.type==='garden')return; add(r.x,r.y);add(r.x+r.w,r.y);add(r.x,r.y+r.h);add(r.x+r.w,r.y+r.h); });
  corners.forEach(c => {
    const cx=c.x*scale,cy=c.y*scale,s=0.6*scale;
    layers+=`<rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
  });
  rooms.forEach((r,i) => {
    if(r.type==='parking'||r.type==='garden') return;
    const rx=r.x*scale,ry=r.y*scale,rw=r.w*scale,rh=r.h*scale;
    layers+=`
      <line x1="${rx}" y1="${ry}" x2="${rx+rw}" y2="${ry}" stroke="#ef4444" stroke-width="3"/>
      <line x1="${rx}" y1="${ry}" x2="${rx}" y2="${ry+rh}" stroke="#ef4444" stroke-width="3"/>
      <line x1="${rx+rw}" y1="${ry}" x2="${rx+rw}" y2="${ry+rh}" stroke="#ef4444" stroke-width="3"/>
      <line x1="${rx}" y1="${ry+rh}" x2="${rx+rw}" y2="${ry+rh}" stroke="#ef4444" stroke-width="3"/>
      <text x="${rx+rw/2}" y="${ry-4}" fill="#ef4444" font-size="7" font-family="monospace" text-anchor="middle" font-weight="bold">TB-0${i+1}</text>
      <text x="${rx+rw/2}" y="${ry+rh/2}" fill="#f43f5e" font-size="7.5" font-family="monospace" font-weight="bold" opacity="0.55" text-anchor="middle">S${i+1} (T=150mm)</text>
      <text x="${rx+rw/2}" y="${ry+rh/2+10}" fill="#f43f5e" font-size="6" font-family="monospace" opacity="0.45" text-anchor="middle">T8@150 C/C</text>`;
  });
  return layers;
}

export function generateFoundationPlanOverlay(rooms: RoomLayout[], scale: number): string {
  let layers = '';
  const corners: { x: number; y: number }[] = [];
  const add = (x: number, y: number) => { if(!corners.some(c=>Math.abs(c.x-x)<1.5&&Math.abs(c.y-y)<1.5)) corners.push({x,y}); };
  rooms.forEach(r => { if(r.type==='parking'||r.type==='garden')return; add(r.x,r.y);add(r.x+r.w,r.y);add(r.x,r.y+r.h);add(r.x+r.w,r.y+r.h); });
  corners.forEach((c,i) => {
    const cx=c.x*scale,cy=c.y*scale,exc=3.5*scale,foot=2.5*scale,col=0.8*scale;
    layers+=`
      <rect x="${cx-exc/2}" y="${cy-exc/2}" width="${exc}" height="${exc}" fill="rgba(244,63,94,0.02)" stroke="#ef4444" stroke-width="1" stroke-dasharray="3 3"/>
      <rect x="${cx-foot/2}" y="${cy-foot/2}" width="${foot}" height="${foot}" fill="none" stroke="#be123c" stroke-width="2"/>
      <rect x="${cx-col/2}" y="${cy-col/2}" width="${col}" height="${col}" fill="#f43f5e"/>
      <line x1="${cx-exc/2-4}" y1="${cy}" x2="${cx+exc/2+4}" y2="${cy}" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="${cx}" y1="${cy-exc/2-4}" x2="${cx}" y2="${cy+exc/2+4}" stroke="#e2e8f0" stroke-width="0.5"/>
      <text x="${cx+foot/2+4}" y="${cy+3}" fill="#be123c" font-size="7" font-family="monospace" font-weight="bold">F${i+1}</text>`;
  });
  return layers;
}
