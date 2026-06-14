// ============================================================================
//  ARCHITECTURAL QUALITY ENGINE & PLAN AUDITOR (AI Architect Reviewer)
// ============================================================================
import type {
  RoomLayout, AdjacencyMatrix, QualityReport, BuildabilityReport,
  PlanExplanation, ComparativeRanking, AuditorReport, LayoutCandidate
} from './types';
import {
  validateRoom,
  validateFurnitureFit,
  validateVentilation,
  validateDoor,
  validateWindow,
  validateStairs,
  validateParking,
  validateAdjacency,
  validatePlumbing,
  validateShape,
  validateCirculation
} from './architecturalStandards';
import { validateLayout } from './validationEngine';

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

  // ── ARCHITECTURAL STANDARDS VALIDATION ──
  let totalChecks = 0;
  let passedChecks = 0;

  const countIssues = (issues: any[]) => {
    totalChecks += issues.length + 1;
    const errors = issues.filter(i => i.type === 'error').length;
    const warnings = issues.filter(i => i.type === 'warning').length;
    passedChecks += 1 + (issues.length - errors - warnings * 0.5);
  };

  countIssues(validateAdjacency(rooms));
  countIssues(validatePlumbing(rooms));
  countIssues(validateCirculation(rooms));

  for (const r of rooms) {
    if (r.type === 'parking' || r.type === 'garden') {
      if (r.type === 'parking') countIssues(validateParking(r));
      continue;
    }
    countIssues(validateRoom(r));
    countIssues(validateFurnitureFit(r));
    countIssues(validateVentilation(r));
    countIssues(validateShape(r));

    if (r.type === 'staircase') {
      countIssues(validateStairs(r));
    }

    for (const d of r.doors) {
      countIssues(validateDoor(d, r.type));
    }
    for (const w of r.windows) {
      countIssues(validateWindow(w, r.type));
    }
  }

  const standardsScore = totalChecks > 0 ? clamp((passedChecks / totalChecks) * 100) : 100;

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

  // ── PRIVACY ──
  let privacy = 80;
  const beds = interior.filter(r => r.type === 'bedroom');
  if (beds.length) {
    const ys = interior.map(r => r.y + r.h / 2);
    const minY = Math.min(...ys), span = (Math.max(...ys) - minY) || 1;
    privacy = clamp(beds.map(b => {
      const rel = ((b.y + b.h / 2) - minY) / span;
      let s = 55 + (1 - rel) * 30;
      const touchesPublic = interior.some(o => PUBLIC.has(o.type) && sharesWall(b, o));
      if (touchesPublic) s -= 22;
      return s;
    }).reduce((x, y) => x + y, 0) / beds.length);
  }

  // ── CIRCULATION ──
  const circArea = interior.filter(r => ['corridor', 'lobby', 'staircase'].includes(r.type)).reduce((s, r) => s + r.w * r.h, 0);
  const intArea = interior.reduce((s, r) => s + r.w * r.h, 0) || 1;
  const circFrac = circArea / intArea;
  let circulation = 100 - Math.abs(circFrac - 0.12) * 340;
  if (!interior.some(r => r.type === 'corridor' || r.type === 'lobby')) circulation -= 25;
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

  // ── SPACE UTILISATION ──
  const floors = [...new Set(interior.map(r => r.floor))];
  const built = floors.length ? Math.max(...floors.map(f => interior.filter(r => r.floor === f).reduce((s, r) => s + r.w * r.h, 0))) : 0;
  const util = Math.min(1, built / (buildableArea || 1));
  const aspect = interior.length ? interior.map(r => {
    const a = Math.max(r.w, r.h) / Math.max(1, Math.min(r.w, r.h));
    return a <= 1.7 ? 100 : a <= 2.4 ? 75 : a <= 3.2 ? 45 : 15;
  }).reduce((s, v) => s + v, 0) / interior.length : 50;

  const spaceVal = clamp(util * 55 + (aspect / 100) * 45);
  const spaceUtilization = clamp(spaceVal * 0.4 + standardsScore * 0.6);

  // ── STRUCTURAL SIMPLICITY ──
  const merge = (vals: number[]) => { const s = [...vals].sort((a, b) => a - b); const o: number[] = []; for (const v of s) if (!o.length || v - o[o.length - 1] > 2) o.push(v); return o.length; };
  const nx = merge(interior.flatMap(r => [r.x, r.x + r.w]));
  const ny = merge(interior.flatMap(r => [r.y, r.y + r.h]));
  const gridLines = nx + ny;
  const structural = clamp(100 - Math.max(0, gridLines - (interior.length + 4)) * 6);

  // ── 16 SCORING CATEGORIES (NEW ENHANCEMENTS) ──
  const naturalLight = Math.round(lighting);
  
  const plumbIssues = validatePlumbing(rooms);
  const plumbing = Math.round(clamp(100 - plumbIssues.length * 15));

  let accessCount = 0;
  for (const r of rooms) {
    if (r.type === 'garden') continue;
    const minDim = Math.min(r.w, r.h);
    if (minDim < 3.0 && r.type !== 'toilet') accessCount++;
    for (const d of r.doors) {
      const doorIssues = validateDoor(d, r.type);
      if (doorIssues.some(i => i.type === 'error')) accessCount++;
    }
  }
  const corridors = rooms.filter(r => r.type === 'corridor' || r.type === 'lobby');
  for (const c of corridors) {
    const width = Math.min(c.w, c.h);
    if (width < 3.0) accessCount++;
  }
  const accessibility = Math.round(clamp(100 - accessCount * 12));

  const futureExpansion = Math.round(clamp((structural * 0.7) + (spaceUtilization * 0.3)));

  // Cost Efficiency: Based on structural simplicity and space utilization
  const costEfficiency = Math.round(clamp(100 - Math.abs(util - 0.8) * 100 - (opts.vastuEmphasis ? 8 : 0)));

  // Furniture Usability: Count room fit violations
  let furnCount = 0;
  for (const r of rooms) {
    const issues = validateFurnitureFit(r);
    furnCount += issues.length;
  }
  const furnitureUsability = Math.round(clamp(100 - furnCount * 12));

  // Construction Practicality: Combination of structural spans and service stacked areas
  const constructionPracticality = Math.round(clamp((structural * 0.5) + (plumbing * 0.3) + (accessibility * 0.2)));

  // Market Appeal: Lobby presence, privacy, and circulation spaces
  const hasFoyer = rooms.some(r => r.type === 'lobby');
  const hasUtility = rooms.some(r => r.name.toLowerCase().includes('utility'));
  const appealVal = (hasFoyer ? 20 : 0) + (hasUtility ? 15 : 0) + (privacy * 0.3) + (spaceUtilization * 0.35);
  const marketAppeal = Math.round(clamp(appealVal + 35));

  // Aesthetic Balance: Aspect ratios and shape complexities
  const shapeIssues = rooms.flatMap(r => validateShape(r));
  const aestheticBalance = Math.round(clamp(aspect - shapeIssues.length * 15));

  // Preference Match: Measures strategy alignment
  let matchVal = 70;
  if (opts.vastuEmphasis) {
    matchVal += (vastuScore - 60) * 0.5;
  } else {
    matchVal += (adjacency_ - 70) * 0.3;
  }
  const preferenceMatch = Math.round(clamp(matchVal));

  const a = {
    adjacency: Math.round(adjacency_),
    privacy: Math.round(privacy),
    circulation: Math.round(circulation),
    ventilation: Math.round(ventilation),
    lighting: Math.round(lighting),
    spaceUtilization: Math.round(spaceUtilization),
    structural: Math.round(structural),
    vastu: Math.round(vastuScore),
    naturalLight,
    plumbing,
    accessibility,
    futureExpansion,
    costEfficiency,
    furnitureUsability,
    constructionPracticality,
    marketAppeal,
    aestheticBalance,
    preferenceMatch
  };

  const W = opts.vastuEmphasis
    ? { adjacency: 0.20, privacy: 0.10, circulation: 0.10, ventilation: 0.10, lighting: 0.08, spaceUtilization: 0.08, structural: 0.04, vastu: 0.15, cost: 0.05, appeal: 0.05, practical: 0.05 }
    : { adjacency: 0.25, privacy: 0.12, circulation: 0.11, ventilation: 0.11, lighting: 0.09, spaceUtilization: 0.09, structural: 0.05, vastu: 0.05, cost: 0.05, appeal: 0.04, practical: 0.04 };
  
  let total = Math.round(
    a.adjacency * W.adjacency + a.privacy * W.privacy + a.circulation * W.circulation +
    a.ventilation * W.ventilation + a.lighting * W.lighting + a.spaceUtilization * W.spaceUtilization +
    a.structural * W.structural + a.vastu * W.vastu + a.costEfficiency * W.cost +
    a.marketAppeal * W.appeal + a.constructionPracticality * W.practical
  );

  // Penalty only when >20% of standard checks fail — avoids over-penalising tight plots
  if (standardsScore < 80) {
    total = Math.max(0, Math.round(total - (80 - standardsScore) * 0.6));
  }

  return { ...a, total, totalScore: total, accept: total >= (opts.threshold ?? 55) };
}

// ── PLAN EXPLANATION GENERATOR ──────────────────────────────────────────────
export function generateExplanation(
  rooms: RoomLayout[],
  strategyId: string,
  facing: string
): PlanExplanation {
  const strategyName = strategyId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    conceptTagline: `A professionally designed layout optimized for the ${strategyName} strategy.`,
    zoningJustification: `The plan is organized into clear zones. Public areas are positioned near the ${facing}-facing entrance, while private bedrooms are isolated towards the rear to preserve privacy.`,
    circulationHighlights: `A central circulation lobby minimizes waste corridors, creating direct access routes to bedrooms, stairs, and common wet areas.`,
    ventilationStrengths: `Habitable zones (Bedrooms and Living Room) are aligned along the external walls to maximize window openings, supporting daylighting and cross-ventilation.`,
    roomLayoutDetails: `Features a balanced layout of ${rooms.filter(r => r.type === 'bedroom').length} Bedrooms, with attached toilets for suites, and a spacious Kitchen-Dining service core.`
  };
}

// ============================================================================
//  PLAN AUDITOR ENGINE
// ============================================================================
export interface AuditReport {
  fatalIssues: string[];
  majorIssues: string[];
  minorIssues: string[];
  suggestions: string[];
  recommendations: string[];
  buildability: BuildabilityReport;
  explanation: PlanExplanation;
}

export function auditPlan(
  rooms: RoomLayout[],
  expectedBedrooms: number,
  expectedFloors: number,
  strategyId = 'family',
  facing = 'S'
): AuditorReport {
  const fatalIssues: string[] = [];
  const majorIssues: string[] = [];
  const minorIssues: string[] = [];
  const suggestions: string[] = [];
  const recommendations: string[] = [];

  // 1. Run the Validation Engine to gather core errors and warnings
  const valReport = validateLayout(rooms, expectedBedrooms, expectedFloors);

  // Categorize errors into Fatal and Major
  for (const err of valReport.errors) {
    const isFatal = err.includes('overlapping') || 
                    err.includes('missing a Living Room') || 
                    err.includes('missing a Kitchen') || 
                    err.includes('BHK') || 
                    err.includes('safety span limit');
    if (isFatal) {
      fatalIssues.push(err);
    } else {
      majorIssues.push(err);
    }
  }

  // Categorize warnings into Minor and Suggestions
  for (const warn of valReport.warnings) {
    const isMinor = warn.includes('dimension') || 
                    warn.includes('width') || 
                    warn.includes('aspect ratio') || 
                    warn.includes('opening');
    if (isMinor) {
      minorIssues.push(warn);
    } else {
      suggestions.push(warn);
    }
  }

  // 2. Generate expert architectural Recommendations
  const interior = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
  const bedrooms = interior.filter(r => r.type === 'bedroom');
  const kitchen = interior.find(r => r.type === 'kitchen');
  const dining = interior.find(r => r.type === 'dining');

  // Utility Room recommendation
  if (bedrooms.length >= 3 && !rooms.some(r => r.name.toLowerCase().includes('utility'))) {
    recommendations.push("For layouts with 3 or more Bedrooms, adding a dedicated Utility Room near the kitchen is recommended for washing and household services.");
  }

  // Powder Room recommendation
  if (expectedFloors > 1 && !rooms.some(r => r.name.toLowerCase().includes('powder'))) {
    recommendations.push("A ground-floor Powder Room is highly recommended in multi-story houses to maintain family privacy on upper floors.");
  }

  // Walk-in Closet recommendation
  const masterBed = bedrooms.find(b => b.name.toLowerCase().includes('master'));
  if (masterBed && masterBed.w * masterBed.h > 180) {
    recommendations.push("The Master Bedroom is large enough to create a distinct walk-in closet partition adjacent to the en-suite bath.");
  }

  // Serve hatch connection recommendation
  if (kitchen && dining) {
    recommendations.push("Adding a kitchen hatch opening directly to the Dining Room will improve day-to-day food serving circulation.");
  }

  // Cross ventilation recommendation
  const crossVentRooms = interior.filter(r => {
    const sides = new Set(r.windows.map(w => w.side));
    return sides.size >= 2;
  });
  if (crossVentRooms.length < interior.length * 0.4) {
    recommendations.push("Consider adding dual-aspect windows in corner bedrooms to encourage natural cross-ventilation.");
  }

  // Structural path recommendation
  recommendations.push("Align the column grids and load-bearing walls across floors to simplify structural framing and lower steel costs.");

  // Vastu quadrant recommendation
  if (kitchen) {
    if (kitchen.x < 15 || kitchen.y < 15) {
      recommendations.push("Vastu recommendation: Positioning the kitchen in the South-East corner (Agneya quadrant) facilitates healthy energy flow.");
    }
  }

  // 3. Generate Buildability Report
  const scores = evaluate(rooms, {}, 500);
  const structuralLoadSafety = scores.structural >= 85 ? 'excellent' : scores.structural >= 70 ? 'good' : scores.structural >= 50 ? 'fair' : 'poor';
  const plumbingGrouping = scores.plumbing >= 85 ? 'optimal' : scores.plumbing >= 60 ? 'standard' : 'dispersed';
  const constructionComplexity = scores.structural >= 80 ? 'low' : scores.structural >= 50 ? 'medium' : 'high';
  const estimatedMaterialWastePercent = Math.round(5 + (100 - scores.spaceUtilization) * 0.15);

  const buildability: BuildabilityReport = {
    structuralLoadSafety,
    plumbingGrouping,
    constructionComplexity,
    estimatedMaterialWastePercent,
    complianceWarnings: minorIssues
  };

  // 4. Generate Explanation Report
  const explanation = generateExplanation(rooms, strategyId, facing);

  return {
    fatalIssues,
    majorIssues,
    minorIssues,
    suggestions,
    recommendations,
    buildability,
    explanation
  };
}

// ============================================================================
//  COMPARATIVE RANKING ENGINE
// ============================================================================
export function rankPlans(candidates: LayoutCandidate[]): ComparativeRanking {
  const ranked = [...candidates]
    .map((c, idx) => ({ id: c.strategyId, score: c.scores.totalScore || c.scores.total, idx }))
    .sort((a, b) => b.score - a.score);

  const rankings = ranked.map((r, i) => {
    const cand = candidates[r.idx];
    const scores = cand.scores;
    const strengths = [
      { name: 'Adjacency', val: scores.adjacency },
      { name: 'Privacy', val: scores.privacy },
      { name: 'Circulation', val: scores.circulation },
      { name: 'Ventilation', val: scores.ventilation },
      { name: 'Vastu', val: scores.vastu },
      { name: 'Structural', val: scores.structural },
      { name: 'Cost Efficiency', val: scores.costEfficiency },
      { name: 'Furniture Usability', val: scores.furnitureUsability },
    ].sort((a, b) => b.val - a.val);

    return {
      optionId: cand.strategyId,
      rank: i + 1,
      score: r.score,
      bestFor: strengths[0].name,
      worseFor: strengths[strengths.length - 1].name,
      summary: `Ranked #${i + 1}: ${cand.strategyName} with a score of ${r.score}/100. It excels in ${strengths[0].name} (scored ${strengths[0].val}) and is less optimal in ${strengths[strengths.length - 1].name} (scored ${strengths[strengths.length - 1].val}).`
    };
  });

  return {
    rankedOptionIds: ranked.map(r => r.id),
    rankings
  };
}
