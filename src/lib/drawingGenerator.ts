import { RoomLayout, PlotSettings, calculateSetbacks } from './layoutSolver';

export interface SVGDrawing {
  svgContent: string;
  width: number;
  height: number;
  scale: number;
}

// Generate Site Plan SVG
export function generateSitePlan(rooms: RoomLayout[], settings: PlotSettings): SVGDrawing {
  const { width, depth } = settings;
  const scale = 8; // pixels per foot
  const pad = 40; // padding
  const svgW = width * scale + pad * 2;
  const svgH = depth * scale + pad * 2;

  // Let's gather setbacks
  const left = 4;
  const right = 4;
  const front = 8;
  const rear = 5;

  const bW = width - left - right;
  const bH = depth - front - rear;

  let paths = '';

  // 1. Grid Background
  paths += `<defs>
    <pattern id="siteGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#10b981" stroke-width="0.5" opacity="0.1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#siteGrid)" />`;

  // 2. Plot Boundary
  paths += `<rect x="${pad}" y="${pad}" width="${width * scale}" height="${depth * scale}" 
    fill="none" stroke="#f8fafc" stroke-width="3" stroke-dasharray="10 5" />
    <text x="${pad}" y="${pad - 10}" fill="#f8fafc" font-size="12" font-family="monospace">PROPERTY LINE (${width}' x ${depth}')</text>`;

  // 3. Setback Lines
  paths += `<rect x="${pad + left * scale}" y="${pad + rear * scale}" width="${bW * scale}" height="${bH * scale}" 
    fill="rgba(16, 185, 129, 0.02)" stroke="#10b981" stroke-width="1.5" stroke-dasharray="5 5" />
    <text x="${pad + left * scale + 10}" y="${pad + rear * scale - 10}" fill="#10b981" font-size="10" font-family="monospace">BUILDING ENVELOPE (Setbacks: F:${front}', R:${rear}', L:${left}', R:${right}')</text>`;

  // 4. Building Position (Footprint)
  paths += `<rect x="${pad + left * scale}" y="${pad + rear * scale}" width="${bW * scale}" height="${bH * scale}" 
    fill="none" stroke="#06b6d4" stroke-width="2.5" />
    <text x="${pad + left * scale + bW * scale / 2}" y="${pad + rear * scale + bH * scale / 2}" 
      fill="#06b6d4" font-size="14" font-weight="bold" font-family="monospace" text-anchor="middle">BUILT-UP FOOTPRINT</text>`;

  // 5. Draw Parking & Garden from Layout
  rooms.forEach(r => {
    if (r.type === 'parking' || r.type === 'garden') {
      const rx = pad + r.x * scale;
      const ry = pad + r.y * scale;
      const rw = r.w * scale;
      const rh = r.h * scale;

      const fillCol = r.type === 'parking' ? 'rgba(100, 116, 139, 0.2)' : 'rgba(34, 197, 94, 0.1)';
      const strokeCol = r.type === 'parking' ? '#64748b' : '#22c55e';

      paths += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.5" />
        <text x="${rx + 8}" y="${ry + 18}" fill="${strokeCol}" font-size="11" font-weight="bold" font-family="monospace">${r.name}</text>`;
    }
  });

  // 6. Dimension lines
  // Front setback dimension
  const midX = pad + (width * scale) / 2;
  paths += `
    <line x1="${midX}" y1="${pad + (depth - front) * scale}" x2="${midX}" y2="${pad + depth * scale}" stroke="#94a3b8" stroke-width="1" />
    <polygon points="${midX},${pad + (depth - front) * scale} ${midX - 3},${pad + (depth - front) * scale + 6} ${midX + 3},${pad + (depth - front) * scale + 6}" fill="#94a3b8" />
    <polygon points="${midX},${pad + depth * scale} ${midX - 3},${pad + depth * scale - 6} ${midX + 3},${pad + depth * scale - 6}" fill="#94a3b8" />
    <text x="${midX + 8}" y="${pad + (depth - front / 2) * scale + 4}" fill="#94a3b8" font-size="10" font-family="monospace">Front: ${front}'</text>
  `;

  // Left setback dimension
  const midY = pad + (depth * scale) / 2;
  paths += `
    <line x1="${pad}" y1="${midY}" x2="${pad + left * scale}" stroke="#94a3b8" stroke-width="1" />
    <polygon points="${pad},${midY} ${pad + 6},${midY - 3} ${pad + 6},${midY + 3}" fill="#94a3b8" />
    <polygon points="${pad + left * scale},${midY} ${pad + left * scale - 6},${midY - 3} ${pad + left * scale - 6},${midY + 3}" fill="#94a3b8" />
    <text x="${pad + (left / 2) * scale}" y="${midY - 6}" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="middle">${left}'</text>
  `;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${svgW} ${svgH}">
      <style>
        text { select: none; pointer-events: none; }
      </style>
      <rect width="100%" height="100%" fill="#090d16" />
      ${paths}
    </svg>
  `;

  return { svgContent, width: svgW, height: svgH, scale };
}

// Generate Roof Plan SVG
export function generateRoofPlan(rooms: RoomLayout[], settings: PlotSettings): SVGDrawing {
  const { width, depth, location } = settings;
  const setbacks = calculateSetbacks(width, depth, location);
  const scale = 8;
  const pad = 40;
  const svgW = width * scale + pad * 2;
  const svgH = depth * scale + pad * 2;

  const buildW = width - setbacks.left - setbacks.right;
  const buildH = depth - setbacks.front - setbacks.rear;

  const rx = pad + setbacks.left * scale;
  const ry = pad + setbacks.rear * scale;
  const rw = buildW * scale;
  const rh = buildH * scale;

  let paths = '';

  // 1. Plot Boundary
  paths += `<rect x="${pad}" y="${pad}" width="${width * scale}" height="${depth * scale}" fill="none" stroke="#475569" stroke-width="1" stroke-dasharray="5 5" />`;

  // 2. Main Roof Slab
  paths += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#1e293b" stroke="#f8fafc" stroke-width="3" />
    <text x="${rx + 15}" y="${ry + 25}" fill="#f8fafc" font-size="14" font-weight="bold" font-family="monospace">ROOF SLAB PLAN</text>`;

  // 3. Parapet wall border
  const pSize = 0.75 * scale; // 9 inches
  paths += `<rect x="${rx + pSize}" y="${ry + pSize}" width="${rw - pSize * 2}" height="${rh - pSize * 2}" fill="none" stroke="#475569" stroke-width="1" />`;

  // 4. Staircase cabin projection
  // Locate the staircase in ground or first floor
  const stair = rooms.find(r => r.type === 'staircase');
  if (stair) {
    const scx = rx + stair.x * scale;
    const scy = ry + stair.y * scale;
    const scw = stair.w * scale;
    const sch = stair.h * scale;

    paths += `<rect x="${scx}" y="${scy}" width="${scw}" height="${sch}" fill="#0f172a" stroke="#f8fafc" stroke-width="2" />
      <text x="${scx + scw / 2}" y="${scy + sch / 2 + 4}" fill="#f8fafc" font-size="10" font-family="monospace" text-anchor="middle">STAIR CABIN</text>`;

    // Overhead water tank on top of Stair Cabin
    paths += `<rect x="${scx + 2 * scale}" y="${scy + 2 * scale}" width="${scw - 4 * scale}" height="${sch - 4 * scale}" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.5" />
      <text x="${scx + scw / 2}" y="${scy + sch / 2 + 18}" fill="#0284c7" font-size="8" font-family="monospace" text-anchor="middle">WATER TANK (2000L)</text>`;
  }

  // 5. Drainage Slopes (represented as diagonal lines converging to rainwater pipes)
  // Let's place 4 rainwater pipes (RWP) at the corners
  const rwp = [
    { x: rx + pSize + 2, y: ry + pSize + 2, label: 'RWP 1' },
    { x: rx + rw - pSize - 2, y: ry + pSize + 2, label: 'RWP 2' },
    { x: rx + pSize + 2, y: ry + rh - pSize - 2, label: 'RWP 3' },
    { x: rx + rw - pSize - 2, y: ry + rh - pSize - 2, label: 'RWP 4' },
  ];

  rwp.forEach(p => {
    paths += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#06b6d4" />
      <text x="${p.x + 8}" y="${p.y + 4}" fill="#06b6d4" font-size="8" font-family="monospace">${p.label}</text>`;
  });

  // Flow directions (arrows)
  paths += `
    <line x1="${rx + rw / 2}" y1="${ry + rh / 2}" x2="${rwp[0].x + 20}" y2="${rwp[0].y + 20}" stroke="#06b6d4" stroke-width="1" stroke-dasharray="4 2" />
    <line x1="${rx + rw / 2}" y1="${ry + rh / 2}" x2="${rwp[1].x - 20}" y2="${rwp[1].y + 20}" stroke="#06b6d4" stroke-width="1" stroke-dasharray="4 2" />
    <line x1="${rx + rw / 2}" y1="${ry + rh / 2}" x2="${rwp[2].x + 20}" y2="${rwp[2].y - 20}" stroke="#06b6d4" stroke-width="1" stroke-dasharray="4 2" />
    <line x1="${rx + rw / 2}" y1="${ry + rh / 2}" x2="${rwp[3].x - 20}" y2="${rwp[3].y - 20}" stroke="#06b6d4" stroke-width="1" stroke-dasharray="4 2" />
    
    <text x="${rx + rw / 2}" y="${ry + rh / 2 - 10}" fill="#06b6d4" font-size="9" font-family="monospace" text-anchor="middle">SLOPE 1:100 →</text>
  `;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${svgW} ${svgH}">
      <rect width="100%" height="100%" fill="#090d16" />
      ${paths}
    </svg>
  `;

  return { svgContent, width: svgW, height: svgH, scale };
}

// Generate Elevation SVG (Front, Rear, Left, Right)
export function generateElevation(rooms: RoomLayout[], settings: PlotSettings, side: 'front' | 'rear' | 'left' | 'right'): SVGDrawing {
  const { width, depth, floors, style } = settings;
  const scale = 12; // slightly larger scale for detail
  const pad = 60;

  // Let's compute width based on orientation
  const facadeWidth = (side === 'front' || side === 'rear') ? width : depth;

  // Floor heights: Plinth = 2ft, Ground floor = 10ft, First floor = 10ft, Parapet = 3ft
  const hPlinth = 2;
  const hGf = 10;
  const hFf = floors >= 2 ? 10 : 0;
  const hParapet = 3;
  const hStairCabin = floors >= 2 ? 8 : 0;

  const totalHeight = hPlinth + hGf + hFf + hParapet + hStairCabin;

  const svgW = facadeWidth * scale + pad * 2;
  const svgH = totalHeight * scale + pad * 4;

  let elements = '';

  // Ground reference line
  const groundY = svgH - pad * 2;
  elements += `<line x1="10" y1="${groundY}" x2="${svgW - 10}" y2="${groundY}" stroke="#94a3b8" stroke-width="4" />
    <text x="${svgW - 120}" y="${groundY + 15}" fill="#94a3b8" font-size="10" font-family="monospace">N.G.L (NATURAL GROUND LEVEL)</text>`;

  // 1. Plinth level box
  const plinthY = groundY - hPlinth * scale;
  elements += `<rect x="${pad}" y="${plinthY}" width="${facadeWidth * scale}" height="${hPlinth * scale}" fill="#334155" stroke="#475569" stroke-width="1.5" />
    <line x1="10" y1="${plinthY}" x2="${svgW - 10}" y2="${plinthY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
    <text x="${svgW - 120}" y="${plinthY - 5}" fill="#94a3b8" font-size="10" font-family="monospace">P.L. +2'-0" (PLINTH LEVEL)</text>`;

  // 2. Ground Floor Facade
  const gfY = plinthY - hGf * scale;
  let gfColor = '#1e293b';
  let cladding = '';

  // Architectural Style styling
  if (style === 'modern') {
    gfColor = '#0f172a';
    cladding = `<rect x="${pad + 4 * scale}" y="${gfY}" width="${6 * scale}" height="${hGf * scale}" fill="#b45309" opacity="0.8" />
      <text x="${pad + 7 * scale}" y="${gfY + 5 * scale}" fill="#ffffff" font-size="9" font-family="sans-serif" text-anchor="middle" opacity="0.7">WOOD PANEL</text>`;
  } else if (style === 'luxury') {
    gfColor = '#0b0f19';
    cladding = `<rect x="${pad}" y="${gfY}" width="${facadeWidth * scale}" height="${hGf * scale}" fill="none" stroke="rgba(16, 185, 129, 0.05)" stroke-width="2" />
      <line x1="${pad + facadeWidth * scale * 0.3}" y1="${gfY}" x2="${pad + facadeWidth * scale * 0.3}" y2="${plinthY}" stroke="#1e293b" stroke-width="3" />`;
  } else if (style === 'traditional') {
    gfColor = '#1c1917';
    cladding = `
      <path d="M ${pad} ${gfY} L ${pad + facadeWidth * scale / 2} ${gfY - 2 * scale} L ${pad + facadeWidth * scale} ${gfY} Z" fill="#78716c" opacity="0.6" />
    `;
  }

  // Draw GF Wall
  elements += `<rect x="${pad}" y="${gfY}" width="${facadeWidth * scale}" height="${hGf * scale}" fill="${gfColor}" stroke="#f8fafc" stroke-width="2" />
    ${cladding}`;

  // Ground Floor Doors and Windows (depends on front/rear/left/right view)
  if (side === 'front') {
    // Main Entry door (placed typically near right-center)
    const doorW = 4 * scale;
    const doorH = 7.5 * scale;
    const doorX = pad + facadeWidth * scale * 0.6;
    elements += `
      <!-- Main Door -->
      <rect x="${doorX}" y="${plinthY - doorH}" width="${doorW}" height="${doorH}" fill="#1e1b4b" stroke="#f8fafc" stroke-width="2" />
      <rect x="${doorX + 2}" y="${plinthY - doorH + 2}" width="${doorW - 4}" height="${doorH - 4}" fill="none" stroke="#06b6d4" stroke-width="1" />
      <circle cx="${doorX + doorW - 8}" cy="${plinthY - doorH / 2}" r="3" fill="#fbbf24" />
      
      <!-- Living Window -->
      <rect x="${pad + 4 * scale}" y="${plinthY - 6.5 * scale}" width="${7 * scale}" height="${5 * scale}" fill="#082f49" stroke="#f8fafc" stroke-width="2" />
      <rect x="${pad + 4.5 * scale}" y="${plinthY - 6.0 * scale}" width="${6 * scale}" height="${4 * scale}" fill="none" stroke="#06b6d4" stroke-width="1.5" />
      <line x1="${pad + 7.5 * scale}" y1="${plinthY - 6.0 * scale}" x2="${pad + 7.5 * scale}" y2="${plinthY - 2.0 * scale}" stroke="#06b6d4" stroke-width="1" />
      <text x="${pad + 7.5 * scale}" y="${plinthY - 7.0 * scale}" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">W1</text>
    `;
  } else {
    // Standard back/side windows
    elements += `
      <rect x="${pad + 5 * scale}" y="${plinthY - 6.0 * scale}" width="${4 * scale}" height="${4 * scale}" fill="#082f49" stroke="#f8fafc" stroke-width="1.5" />
      <rect x="${pad + facadeWidth * scale - 9 * scale}" y="${plinthY - 6.0 * scale}" width="${4 * scale}" height="${4 * scale}" fill="#082f49" stroke="#f8fafc" stroke-width="1.5" />
    `;
  }

  // 3. First Floor Facade
  let ffY = gfY;
  if (floors >= 2) {
    ffY = gfY - hFf * scale;
    let ffColor = gfColor;

    if (style === 'modern') {
      ffColor = '#1e293b';
    }

    elements += `
      <!-- First Floor Wall -->
      <rect x="${pad}" y="${ffY}" width="${facadeWidth * scale}" height="${hFf * scale}" fill="${ffColor}" stroke="#f8fafc" stroke-width="2" />
      <line x1="10" y1="${gfY}" x2="${svgW - 10}" y2="${gfY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
      <text x="${svgW - 120}" y="${gfY - 5}" fill="#94a3b8" font-size="10" font-family="monospace">FF SLAB LEVEL +12'-0"</text>
    `;

    // Balcony Railing (on Front)
    if (side === 'front') {
      const railH = 3.5 * scale;
      // Balcony extends on the left side
      const railW = facadeWidth * scale * 0.5;
      elements += `
        <!-- Glass/Metal Railing -->
        <rect x="${pad}" y="${gfY - railH}" width="${railW}" height="${railH}" fill="rgba(6, 180, 212, 0.15)" stroke="#06b6d4" stroke-width="1.5" />
        <line x1="${pad}" y1="${gfY - railH}" x2="${pad + railW}" y2="${gfY - railH}" stroke="#f8fafc" stroke-width="2" />
        <!-- Balcony Door behind -->
        <rect x="${pad + 4 * scale}" y="${gfY - 7 * scale}" width="${3 * scale}" height="${7 * scale}" fill="#082f49" stroke="#475569" stroke-width="1" />
        <!-- Master Bedroom Window on the right -->
        <rect x="${pad + facadeWidth * scale - 12 * scale}" y="${gfY - 6.5 * scale}" width="${6 * scale}" height="${5 * scale}" fill="#082f49" stroke="#f8fafc" stroke-width="2" />
      `;
    } else {
      // Rear/side windows
      elements += `
        <rect x="${pad + 6 * scale}" y="${gfY - 6.0 * scale}" width="${4 * scale}" height="${4 * scale}" fill="#082f49" stroke="#f8fafc" stroke-width="1.5" />
        <rect x="${pad + facadeWidth * scale - 10 * scale}" y="${gfY - 6.0 * scale}" width="${4 * scale}" height="${4 * scale}" fill="#082f49" stroke="#f8fafc" stroke-width="1.5" />
      `;
    }
  }

  // 4. Parapet Wall
  const paraY = ffY - hParapet * scale;
  elements += `
    <!-- Parapet -->
    <rect x="${pad}" y="${paraY}" width="${facadeWidth * scale}" height="${hParapet * scale}" fill="${style === 'luxury' ? '#0f172a' : '#334155'}" stroke="#f8fafc" stroke-width="1.5" />
    <line x1="10" y1="${ffY}" x2="${svgW - 10}" y2="${ffY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
    <text x="${svgW - 120}" y="${ffY - 5}" fill="#94a3b8" font-size="10" font-family="monospace">TERRACE LEVEL +22'-0"</text>
    
    <!-- Top slab indicator -->
    <line x1="10" y1="${paraY}" x2="${svgW - 10}" y2="${paraY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
    <text x="${svgW - 120}" y="${paraY - 5}" fill="#94a3b8" font-size="10" font-family="monospace">PARAPET LEVEL +25'-0"</text>
  `;

  // 5. Stair Cabin (if visible in this view)
  // Standard stair cabin drawn in center or left
  if (floors >= 2 && (side === 'front' || side === 'left')) {
    const cabW = 10 * scale;
    const cabH = hStairCabin * scale;
    const cabX = pad + 2 * scale;
    const cabY = ffY - cabH;

    // Draw cabin behind parapet
    elements += `
      <!-- Stair Cabin in Elevation -->
      <rect x="${cabX}" y="${cabY}" width="${cabW}" height="${cabH}" fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" />
      <!-- Water Tank on top -->
      <rect x="${cabX + 2 * scale}" y="${cabY - 3 * scale}" width="${4 * scale}" height="${3 * scale}" fill="#0369a1" stroke="#38bdf8" stroke-width="1.5" />
      <text x="${cabX + 4 * scale}" y="${cabY - 1.5 * scale}" fill="#e0f2fe" font-size="8" font-family="monospace" text-anchor="middle">WATER TANK</text>
    `;
  }

  // Side Labels
  elements += `<text x="${pad / 2}" y="${groundY - hPlinth * scale / 2}" fill="#64748b" font-size="9" font-family="monospace" transform="rotate(-90, ${pad / 2}, ${groundY - hPlinth * scale / 2})">PLINTH</text>
    <text x="${pad / 2}" y="${plinthY - hGf * scale / 2}" fill="#64748b" font-size="9" font-family="monospace" transform="rotate(-90, ${pad / 2}, ${plinthY - hGf * scale / 2})">GROUND FLOOR</text>`;
  if (floors >= 2) {
    elements += `<text x="${pad / 2}" y="${gfY - hFf * scale / 2}" fill="#64748b" font-size="9" font-family="monospace" transform="rotate(-90, ${pad / 2}, ${gfY - hFf * scale / 2})">FIRST FLOOR</text>`;
  }

  // Draw title card
  elements += `<rect x="${pad}" y="${svgH - 45}" width="${200}" height="${30}" fill="#0f172a" stroke="#1e293b" />
    <text x="${pad + 10}" y="${svgH - 26}" fill="#10b981" font-size="12" font-weight="bold" font-family="monospace">${side.toUpperCase()} ELEVATION (${style.toUpperCase()})</text>`;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${svgW} ${svgH}">
      <rect width="100%" height="100%" fill="#090d16" />
      ${elements}
    </svg>
  `;

  return { svgContent, width: svgW, height: svgH, scale };
}

// Generate Section SVG (Cross or Longitudinal)
export function generateSection(rooms: RoomLayout[], settings: PlotSettings, type: 'cross' | 'longitudinal'): SVGDrawing {
  const { width, depth, floors } = settings;
  const scale = 12;
  const pad = 60;
  const facadeWidth = type === 'cross' ? width : depth;

  const hFoundation = 4;
  const hPlinth = 2;
  const hGf = 10;
  const hFf = floors >= 2 ? 10 : 0;
  const hParapet = 3;

  const totalHeight = hFoundation + hPlinth + hGf + hFf + hParapet;
  const svgW = facadeWidth * scale + pad * 2;
  const svgH = totalHeight * scale + pad * 4;

  let elements = '';

  const groundY = svgH - pad * 2 - hFoundation * scale;

  // 1. Natural Ground Line
  elements += `<line x1="10" y1="${groundY}" x2="${svgW - 10}" y2="${groundY}" stroke="#94a3b8" stroke-width="2" />
    <text x="${svgW - 150}" y="${groundY - 5}" fill="#94a3b8" font-size="9" font-family="monospace">N.G.L (NATURAL GROUND LEVEL)</text>`;

  // 2. Soil and Foundation Pit (Depth -4')
  elements += `
    <!-- Soil Fill Hatch (simulated with dots or rectangle) -->
    <rect x="${pad}" y="${groundY}" width="${facadeWidth * scale}" height="${hFoundation * scale}" fill="#1c1917" opacity="0.4" stroke="#475569" stroke-width="1" />
    <text x="${pad + 20}" y="${groundY + 2.5 * scale}" fill="#78716c" font-size="10" font-family="monospace">SOIL STRATA (SBC ASSUMED 20 T/M²)</text>
  `;

  // Draw 3 concrete footings (foundation columns) at left, mid, right
  const footingX = [pad + 4 * scale, pad + (facadeWidth / 2) * scale, pad + (facadeWidth - 4) * scale];
  footingX.forEach((fx, idx) => {
    elements += `
      <!-- Footing ${idx + 1} -->
      <rect x="${fx - 2 * scale}" y="${groundY + 3 * scale}" width="${4 * scale}" height="${1 * scale}" fill="#475569" stroke="#f8fafc" stroke-width="1" />
      <polygon points="${fx - 2 * scale},${groundY + 3 * scale} ${fx - 1 * scale},${groundY + 1 * scale} ${fx + 1 * scale},${groundY + 1 * scale} ${fx + 2 * scale},${groundY + 3 * scale}" fill="#64748b" stroke="#f8fafc" stroke-width="1" />
      <rect x="${fx - 0.75 * scale}" y="${groundY}" width="${1.5 * scale}" height="${1 * scale}" fill="#334155" stroke="#f8fafc" stroke-width="1" />
    `;
  });

  // 3. Plinth beam and floor bed
  const plinthY = groundY - hPlinth * scale;
  elements += `
    <!-- Plinth concrete fill -->
    <rect x="${pad}" y="${plinthY}" width="${facadeWidth * scale}" height="${hPlinth * scale}" fill="#0f172a" stroke="#f8fafc" stroke-width="1.5" />
    <!-- PCC Layer -->
    <rect x="${pad}" y="${plinthY + hPlinth * scale - 0.4 * scale}" width="${facadeWidth * scale}" height="${0.4 * scale}" fill="#94a3b8" />
    <text x="${pad + 20}" y="${plinthY + 1.2 * scale}" fill="#cbd5e1" font-size="9" font-family="monospace">PLINTH FILLING (GRAVEL + SAND + PCC)</text>
  `;

  // 4. Ground floor walls cut (vertical columns or thick lines)
  const gfY = plinthY - hGf * scale;
  // Let's place cut walls at footing positions
  footingX.forEach((fx) => {
    // Cut columns extending up
    elements += `
      <!-- Cut Column/Wall GF -->
      <rect x="${fx - 0.5 * scale}" y="${gfY}" width="${1 * scale}" height="${hGf * scale}" fill="url(#wallHatch)" stroke="#ef4444" stroke-width="2" />
    `;
  });

  // Wall Hatch definition
  elements += `<defs>
    <pattern id="wallHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" stroke-width="1" opacity="0.4" />
    </pattern>
  </defs>`;

  // 5. Ceiling / Slab lines
  elements += `
    <!-- GF Roof Slab (9 inches concrete) -->
    <rect x="${pad}" y="${gfY}" width="${facadeWidth * scale}" height="${0.75 * scale}" fill="#334155" stroke="#ef4444" stroke-width="1" />
    <text x="${pad + 20}" y="${gfY + 6}" fill="#ef4444" font-size="9" font-family="monospace">CONCRETE SLAB (9")</text>
  `;

  // 6. First Floor Section details (if G+1)
  let ffY = gfY;
  if (floors >= 2) {
    ffY = gfY - hFf * scale;
    footingX.forEach((fx) => {
      elements += `
        <!-- Cut Column/Wall FF -->
        <rect x="${fx - 0.5 * scale}" y="${ffY}" width="${1 * scale}" height="${hFf * scale}" fill="url(#wallHatch)" stroke="#ef4444" stroke-width="2" />
      `;
    });

    // FF Roof Slab
    elements += `
      <rect x="${pad}" y="${ffY}" width="${facadeWidth * scale}" height="${0.75 * scale}" fill="#334155" stroke="#ef4444" stroke-width="1" />
    `;
  }

  // 7. Parapet cut
  const paraY = ffY - hParapet * scale;
  elements += `
    <!-- Parapet Wall Cuts -->
    <rect x="${pad}" y="${paraY}" width="${0.75 * scale}" height="${hParapet * scale}" fill="url(#wallHatch)" stroke="#ef4444" stroke-width="1" />
    <rect x="${pad + facadeWidth * scale - 0.75 * scale}" y="${paraY}" width="${0.75 * scale}" height="${hParapet * scale}" fill="url(#wallHatch)" stroke="#ef4444" stroke-width="1" />
  `;

  // 8. Stairs Cut (if we slice through the stairs in cross section)
  if (type === 'cross') {
    // Let's draw the staircase steps
    // Assume stairwell is in the center-left. Let's draw concrete dog-legged staircase
    let stairPath = '';
    const stairStartX = pad + 6 * scale;
    const stairStartY = plinthY;
    const stairMidX = stairStartX + 6 * scale;
    const stairMidY = plinthY - 5 * scale; // landing
    const stairEndX = stairStartX;
    const stairEndY = gfY;

    // First flight
    stairPath += `M ${stairStartX} ${stairStartY}`;
    for (let i = 0; i < 7; i++) {
      const stepX = stairStartX + i * 0.85 * scale;
      const stepY = stairStartY - i * 0.7 * scale;
      stairPath += ` L ${stepX + 0.85 * scale} ${stepY} L ${stepX + 0.85 * scale} ${stepY - 0.7 * scale}`;
    }
    // Landing
    stairPath += ` L ${stairMidX + 3 * scale} ${stairMidY}`;
    // Second flight (going back)
    for (let i = 0; i < 7; i++) {
      const stepX = stairMidX + 3 * scale - i * 0.85 * scale;
      const stepY = stairMidY - i * 0.7 * scale;
      stairPath += ` L ${stepX - 0.85 * scale} ${stepY} L ${stepX - 0.85 * scale} ${stepY - 0.7 * scale}`;
    }

    elements += `
      <!-- Concrete Staircase slab slice -->
      <path d="${stairPath}" fill="none" stroke="#f8fafc" stroke-width="5" />
      <path d="${stairPath}" fill="none" stroke="#ef4444" stroke-width="2" />
      <text x="${stairStartX + 3 * scale}" y="${stairStartY - 2 * scale}" fill="#ef4444" font-size="8" font-family="monospace">R.C.C STAIR SLAB</text>
    `;
  }

  // Annotations / Dimensions
  elements += `
    <line x1="${svgW - 50}" y1="${groundY}" x2="${svgW - 50}" y2="${plinthY}" stroke="#94a3b8" stroke-width="1" />
    <text x="${svgW - 40}" y="${(groundY + plinthY) / 2}" fill="#94a3b8" font-size="9" font-family="monospace">PLINTH: 2'-0"</text>

    <line x1="${svgW - 50}" y1="${plinthY}" x2="${svgW - 50}" y2="${gfY}" stroke="#94a3b8" stroke-width="1" />
    <text x="${svgW - 40}" y="${(plinthY + gfY) / 2}" fill="#94a3b8" font-size="9" font-family="monospace">GF HEIGHT: 10'-0"</text>
  `;

  // Draw title card
  elements += `<rect x="${pad}" y="${svgH - 45}" width="${220}" height="${30}" fill="#0f172a" stroke="#1e293b" />
    <text x="${pad + 10}" y="${svgH - 26}" fill="#ef4444" font-size="12" font-weight="bold" font-family="monospace">${type.toUpperCase()} SECTION CUT X-X'</text>`;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${svgW} ${svgH}">
      <rect width="100%" height="100%" fill="#090d16" />
      ${elements}
    </svg>
  `;

  return { svgContent, width: svgW, height: svgH, scale };
}

// Generate Schedule of Doors and Windows
export function generateSchedule(rooms: RoomLayout[]): { headers: string[]; rows: string[][] } {
  const doorsMap = new Map<number, number>();
  const windowsMap = new Map<number, number>();

  rooms.forEach(r => {
    if (r.type === 'parking' || r.type === 'garden') return;
    
    r.doors.forEach(d => {
      const w = d.width;
      doorsMap.set(w, (doorsMap.get(w) || 0) + 1);
    });

    r.windows.forEach(w => {
      const width = w.width;
      windowsMap.set(width, (windowsMap.get(width) || 0) + 1);
    });
  });

  const rows: string[][] = [];

  // Sort doors by width descending
  const sortedDoors = Array.from(doorsMap.entries()).sort((a, b) => b[0] - a[0]);
  sortedDoors.forEach(([w, qty], index) => {
    const code = `D${index + 1}`;
    let name = "Bedroom Flush Door";
    let height = "7.0";
    let desc = "Waterproof flush door with laminate finish";

    if (w >= 4.0) {
      name = "Main Entrance Door";
      height = "7.5";
      desc = "Solid teak wood paneled door with smart lock";
    } else if (w <= 2.5) {
      name = "Toilet / Utility Door";
      height = "7.0";
      desc = "PVC/Waterproof flush door for bathroom";
    }

    rows.push([code, name, w.toFixed(1), height, desc, qty.toString()]);
  });

  // Sort windows by width descending
  const sortedWindows = Array.from(windowsMap.entries()).sort((a, b) => b[0] - a[0]);
  sortedWindows.forEach(([w, qty], index) => {
    const code = `W${index + 1}`;
    let name = "Bedroom Standard Window";
    let height = "4.5";
    let desc = "Sliding UPVC glass window panel with security grill";

    if (w >= 6.0) {
      name = "Living Glazed Window";
      height = "5.0";
      desc = "Sliding UPVC clear glass window panel";
    } else if (w <= 2.0) {
      name = "Toilet Ventilator";
      height = "1.5";
      desc = "Frosted louvers glass vent with exhaust provision";
    } else if (w === 3.0) {
      name = "Standard Window";
      height = "4.5";
      desc = "UPVC sliding window with safety glass";
    }

    rows.push([code, name, w.toFixed(1), height, desc, qty.toString()]);
  });

  // Fallback if no doors/windows are loaded
  if (rows.length === 0) {
    rows.push(
      ['D1', 'Main Entrance Door', '4.0', '7.5', 'Solid teak wood paneled door with smart lock', '0'],
      ['D2', 'Bedroom Flush Door', '3.0', '7.0', 'Waterproof flush door with laminate finish', '0'],
      ['W1', 'Living Glazed Window', '6.0', '5.0', 'Sliding UPVC clear glass window panel', '0']
    );
  }

  return {
    headers: ['Code', 'Type', 'Width (ft)', 'Height (ft)', 'Description', 'Quantity'],
    rows
  };
}
