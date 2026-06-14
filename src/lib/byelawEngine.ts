import type { RoomLayout, PlotSettings } from '@/types';
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
} from './planner/architecturalStandards';
import { validateLayout } from './planner/validationEngine';
import { auditPlan } from './planner/qualityEngine';

// ============================================================================
//  NBC INDIA + MUNICIPAL BYELAW COMPLIANCE ENGINE
//  Checks a generated plan against National Building Code (NBC 2016) minimums
//  and city-specific development-control rules (FAR/FSI, setbacks, ground
//  coverage). Rates are approximate and editable — always verify with the
//  local sanctioning authority.
// ============================================================================

export interface CityRule {
  city: string;
  far: number;              // max Floor Area Ratio (FSI)
  groundCoverage: number;   // max ground coverage fraction (0–1)
  note: string;
}

// Typical development-control values for major Indian cities (approximate).
const CITY_RULES: Record<string, CityRule> = {
  mumbai:    { city: 'Mumbai (MCGM)',      far: 2.5,  groundCoverage: 0.60, note: 'FSI is fungible/premium-based; TDR can raise effective FSI.' },
  delhi:     { city: 'Delhi (MCD/DDA)',    far: 1.8,  groundCoverage: 0.60, note: 'FAR varies 1.2–2.0 by plot size per MPD-2021.' },
  bangalore: { city: 'Bengaluru (BBMP)',   far: 2.25, groundCoverage: 0.65, note: 'FAR depends on abutting road width (BBMP byelaws).' },
  bengaluru: { city: 'Bengaluru (BBMP)',   far: 2.25, groundCoverage: 0.65, note: 'FAR depends on abutting road width (BBMP byelaws).' },
  pune:      { city: 'Pune (PMC)',         far: 1.5,  groundCoverage: 0.60, note: 'Base FSI 1.1 + premium/TDR per UDCPR.' },
  ahmedabad: { city: 'Ahmedabad (AUDA)',   far: 1.8,  groundCoverage: 0.65, note: 'FSI 1.8–2.7 by road width / TP scheme.' },
  hyderabad: { city: 'Hyderabad (GHMC)',   far: 3.0,  groundCoverage: 0.65, note: 'No FAR cap for many plots if setbacks are met (GHMC).' },
  chennai:   { city: 'Chennai (CMDA)',     far: 1.5,  groundCoverage: 0.60, note: 'FSI 1.5–2.0 per CMDA development regulations.' },
  default:   { city: 'Generic Municipal',  far: 1.8,  groundCoverage: 0.65, note: 'Generic values — confirm with your local authority.' },
};

export function getCityRule(location: string): CityRule {
  const key = (location || '').toLowerCase();
  for (const k of Object.keys(CITY_RULES)) {
    if (k !== 'default' && key.includes(k)) return CITY_RULES[k];
  }
  return CITY_RULES.default;
}

// Required setbacks (in feet) by plot area tier — approximate NBC/municipal norms.
function requiredSetbacks(plotAreaSqft: number) {
  if (plotAreaSqft <= 1500) return { front: 5, rear: 3, side: 3 };
  if (plotAreaSqft <= 2700) return { front: 6, rear: 5, side: 4 };
  if (plotAreaSqft <= 4500) return { front: 8, rear: 6, side: 5 };
  return { front: 10, rear: 8, side: 6 };
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface ByelawCheck {
  category: string;
  item: string;
  required: string;
  actual: string;
  status: CheckStatus;
  note?: string;
}

export interface ByelawReport {
  city: string;
  cityNote: string;
  score: number;                // % of checks passed (warn counts half)
  summary: { pass: number; warn: number; fail: number };
  far: { required: number; actual: number; status: CheckStatus };
  groundCoverage: { required: number; actual: number; status: CheckStatus };
  checks: ByelawCheck[];
}

// NBC 2016 minimum room areas (sqft) and widths (ft)
const NBC_MIN = {
  habitableAreaSqft: 102,   // 9.5 sq.m
  habitableWidthFt: 7.9,    // 2.4 m
  kitchenAreaSqft: 54,      // 5.0 sq.m
  kitchenWidthFt: 5.9,      // 1.8 m
  bathAreaSqft: 19.4,       // 1.8 sq.m
  toiletAreaSqft: 12,       // ~1.1 sq.m (WC)
  staircaseWidthFt: 3.0,    // ~0.9–1.0 m residential
  corridorWidthFt: 3.0,     // ~0.9 m
  ventilationFraction: 0.10 // openings >= 10% of floor area
};

export function analyzeByelaws(rooms: RoomLayout[], settings: PlotSettings): ByelawReport {
  const rule = getCityRule(settings.location);
  const plotArea = settings.width * settings.depth;
  const ground = rooms.filter(r => r.floor === 0);
  const built = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');

  // Built-up area
  const footprint = ground.filter(r => r.type !== 'parking' && r.type !== 'garden')
    .reduce((s, r) => s + r.w * r.h, 0);
  const totalBuiltUp = built.reduce((s, r) => s + r.w * r.h, 0);

  const actualFar = +(totalBuiltUp / plotArea).toFixed(2);
  const actualGC = +(footprint / plotArea).toFixed(2);

  const checks: ByelawCheck[] = [];

  // ── ARCHITECTURAL VALIDATION ENGINE INTEGRATION ──
  const valReport = validateLayout(rooms, settings.bedrooms, settings.floors);
  for (const err of valReport.errors) {
    checks.push({
      category: 'Validation Engine (Errors)',
      item: 'Structural/Architectural Limit',
      required: 'Compliance',
      actual: 'Critical Failure',
      status: 'fail',
      note: err,
    });
  }
  for (const warn of valReport.warnings) {
    checks.push({
      category: 'Validation Engine (Warnings)',
      item: 'Design recommendation',
      required: 'Clearance/Proximity standard',
      actual: 'Sub-optimal design',
      status: 'warn',
      note: warn,
    });
  }

  // ── PLAN AUDITOR RECOMMENDATIONS INTEGRATION ──
  const audit = auditPlan(rooms, settings.bedrooms, settings.floors);
  for (const rec of audit.recommendations) {
    checks.push({
      category: 'Plan Auditor (Recommendations)',
      item: 'Architectural Best Practice',
      required: 'Optimal design standard',
      actual: 'Recommendation',
      status: 'pass',
      note: rec,
    });
  }

  // FAR
  const farStatus: CheckStatus = actualFar <= rule.far ? 'pass' : actualFar <= rule.far * 1.05 ? 'warn' : 'fail';
  // Ground coverage
  const gcStatus: CheckStatus = actualGC <= rule.groundCoverage ? 'pass' : actualGC <= rule.groundCoverage * 1.05 ? 'warn' : 'fail';

  // Setbacks — measure building bbox vs plot
  const req = requiredSetbacks(plotArea);
  const bRooms = ground.filter(r => r.type !== 'garden');
  if (bRooms.length) {
    const minX = Math.min(...bRooms.map(r => r.x));
    const maxX = Math.max(...bRooms.map(r => r.x + r.w));
    const minY = Math.min(...bRooms.map(r => r.y));
    const maxY = Math.max(...bRooms.map(r => r.y + r.h));
    const front = +minY.toFixed(1);
    const rear = +(settings.depth - maxY).toFixed(1);
    const left = +minX.toFixed(1);
    const right = +(settings.width - maxX).toFixed(1);
    const mkSet = (name: string, actual: number, reqd: number): ByelawCheck => ({
      category: 'Setbacks',
      item: `${name} setback`,
      required: `≥ ${reqd} ft`,
      actual: `${actual} ft`,
      status: actual >= reqd ? 'pass' : actual >= reqd - 1 ? 'warn' : 'fail',
    });
    checks.push(mkSet('Front', front, req.front));
    checks.push(mkSet('Rear', rear, req.rear));
    checks.push(mkSet('Left side', left, req.side));
    checks.push(mkSet('Right side', right, req.side));
  }

  // Room-level NBC checks
  for (const r of ground) {
    const area = r.w * r.h;
    const minDim = Math.min(r.w, r.h);
    if (r.type === 'bedroom' || r.type === 'living') {
      checks.push({
        category: 'Room Sizes (NBC)',
        item: `${r.name} area`,
        required: `≥ ${NBC_MIN.habitableAreaSqft} sq ft`,
        actual: `${area} sq ft`,
        status: area >= NBC_MIN.habitableAreaSqft ? 'pass' : 'fail',
      });
      checks.push({
        category: 'Room Sizes (NBC)',
        item: `${r.name} min width`,
        required: `≥ ${NBC_MIN.habitableWidthFt} ft`,
        actual: `${minDim} ft`,
        status: minDim >= NBC_MIN.habitableWidthFt ? 'pass' : 'warn',
      });
    } else if (r.type === 'kitchen') {
      checks.push({
        category: 'Room Sizes (NBC)',
        item: 'Kitchen area',
        required: `≥ ${NBC_MIN.kitchenAreaSqft} sq ft`,
        actual: `${area} sq ft`,
        status: area >= NBC_MIN.kitchenAreaSqft ? 'pass' : 'fail',
      });
    } else if (r.type === 'toilet') {
      checks.push({
        category: 'Room Sizes (NBC)',
        item: `${r.name} area`,
        required: `≥ ${NBC_MIN.toiletAreaSqft} sq ft`,
        actual: `${area} sq ft`,
        status: area >= NBC_MIN.toiletAreaSqft ? 'pass' : 'warn',
      });
    } else if (r.type === 'staircase') {
      checks.push({
        category: 'Circulation (NBC)',
        item: 'Staircase width',
        required: `≥ ${NBC_MIN.staircaseWidthFt} ft`,
        actual: `${minDim} ft`,
        status: minDim >= NBC_MIN.staircaseWidthFt ? 'pass' : 'fail',
      });
    } else if (r.type === 'corridor') {
      checks.push({
        category: 'Circulation (NBC)',
        item: 'Corridor width',
        required: `≥ ${NBC_MIN.corridorWidthFt} ft`,
        actual: `${minDim} ft`,
        status: minDim >= NBC_MIN.corridorWidthFt ? 'pass' : 'warn',
      });
    }

    // Ventilation: window opening area vs floor area (habitable rooms)
    if (r.type === 'bedroom' || r.type === 'living' || r.type === 'kitchen') {
      const winArea = r.windows.reduce((s, w) => s + w.width * 4, 0); // assume ~4 ft window height
      const reqWin = +(area * NBC_MIN.ventilationFraction).toFixed(1);
      checks.push({
        category: 'Light & Ventilation (NBC)',
        item: `${r.name} window opening`,
        required: `≥ ${reqWin} sq ft (10% floor)`,
        actual: `${winArea.toFixed(1)} sq ft`,
        status: winArea >= reqWin ? 'pass' : winArea >= reqWin * 0.7 ? 'warn' : 'fail',
      });
    }
  }

  // Parking provision
  const hasParking = rooms.some(r => r.type === 'parking');
  checks.push({
    category: 'Parking',
    item: 'Car parking provision',
    required: 'At least 1 covered/open space',
    actual: hasParking ? 'Provided' : 'Not found',
    status: hasParking ? 'pass' : 'warn',
    note: 'Most municipalities require 1 ECS per dwelling unit.',
  });

  // ── CENTRALIZED ARCHITECTURAL STANDARDS CHECKS ──

  // 1. Adjacency checks
  const adjIssues = validateAdjacency(rooms);
  for (const issue of adjIssues) {
    checks.push({
      category: 'Adjacency Standards',
      item: 'Room Relationship',
      required: 'Compliant adjacency/walls',
      actual: 'Violation',
      status: issue.type === 'error' ? 'fail' : 'warn',
      note: issue.message,
    });
  }

  // 2. Plumbing checks
  const plumbIssues = validatePlumbing(rooms);
  for (const issue of plumbIssues) {
    checks.push({
      category: 'Plumbing Layout',
      item: 'Stack Proximity',
      required: 'Wet core proximity limit',
      actual: 'Exceeded',
      status: issue.type === 'error' ? 'fail' : 'warn',
      note: issue.message,
    });
  }

  // 3. Circulation checks
  const circIssues = validateCirculation(rooms);
  for (const issue of circIssues) {
    checks.push({
      category: 'Circulation Standards',
      item: 'Corridor Width / dead-end check',
      required: 'Standard corridor specs',
      actual: 'Non-compliant',
      status: issue.type === 'error' ? 'fail' : 'warn',
      note: issue.message,
    });
  }

  // Room-specific validation
  for (const r of rooms) {
    if (r.type === 'garden') continue;

    if (r.type === 'parking') {
      const parkIssues = validateParking(r);
      for (const issue of parkIssues) {
        checks.push({
          category: 'Parking Standards',
          item: `${r.name} clearance`,
          required: 'Clear width/length for parking',
          actual: 'Tight clearance',
          status: 'warn',
          note: issue.message,
        });
      }
      continue;
    }

    // Dimension, Area, Aspect Ratio check
    const roomIssues = validateRoom(r);
    for (const issue of roomIssues) {
      checks.push({
        category: 'Room Dimension Standards',
        item: `${r.name} ${issue.field}`,
        required: 'Standard room metrics',
        actual: 'Non-compliant',
        status: issue.type === 'error' ? 'fail' : 'warn',
        note: issue.message,
      });
    }

    // Furniture Fit checks
    const furnIssues = validateFurnitureFit(r);
    for (const issue of furnIssues) {
      checks.push({
        category: 'Furniture Fit & Usability',
        item: `${r.name} layout`,
        required: 'Fits standard furniture + clearance',
        actual: 'Cramped space',
        status: issue.type === 'error' ? 'fail' : 'warn',
        note: issue.message,
      });
    }

    // Ventilation checks
    const ventIssues = validateVentilation(r);
    for (const issue of ventIssues) {
      checks.push({
        category: 'Ventilation & Openings',
        item: `${r.name} window/ventilator`,
        required: 'Min window area or ventilator',
        actual: 'Insufficient ventilation',
        status: issue.type === 'error' ? 'fail' : 'warn',
        note: issue.message,
      });
    }

    // Shape checks
    const shapeIssues = validateShape(r);
    for (const issue of shapeIssues) {
      checks.push({
        category: 'Shape Standards',
        item: `${r.name} shape`,
        required: 'Simple geometries',
        actual: 'Irregular shape',
        status: issue.type === 'error' ? 'fail' : 'warn',
        note: issue.message,
      });
    }

    // Staircase checks
    if (r.type === 'staircase') {
      const stairIssues = validateStairs(r);
      for (const issue of stairIssues) {
        checks.push({
          category: 'Staircase Standards',
          item: `${r.name} flight/landing`,
          required: 'Flight width and landings',
          actual: 'Non-compliant',
          status: issue.type === 'error' ? 'fail' : 'warn',
          note: issue.message,
        });
      }
    }

    // Door check
    for (const d of r.doors) {
      const doorIssues = validateDoor(d, r.type);
      for (const issue of doorIssues) {
        checks.push({
          category: 'Door Standards',
          item: `${r.name} door width`,
          required: 'Standard clear opening',
          actual: 'Narrow door',
          status: issue.type === 'error' ? 'fail' : 'warn',
          note: issue.message,
        });
      }
    }

    // Window check
    for (const w of r.windows) {
      const winIssues = validateWindow(w, r.type);
      for (const issue of winIssues) {
        checks.push({
          category: 'Window Standards',
          item: `${r.name} window width`,
          required: 'Standard window width',
          actual: 'Narrow window',
          status: issue.type === 'error' ? 'fail' : 'warn',
          note: issue.message,
        });
      }
    }
  }

  const pass = checks.filter(c => c.status === 'pass').length + (farStatus === 'pass' ? 1 : 0) + (gcStatus === 'pass' ? 1 : 0);
  const warn = checks.filter(c => c.status === 'warn').length + (farStatus === 'warn' ? 1 : 0) + (gcStatus === 'warn' ? 1 : 0);
  const fail = checks.filter(c => c.status === 'fail').length + (farStatus === 'fail' ? 1 : 0) + (gcStatus === 'fail' ? 1 : 0);
  const total = pass + warn + fail;
  const score = total ? Math.round(((pass + warn * 0.5) / total) * 100) : 0;

  return {
    city: rule.city,
    cityNote: rule.note,
    score,
    summary: { pass, warn, fail },
    far: { required: rule.far, actual: actualFar, status: farStatus },
    groundCoverage: { required: rule.groundCoverage, actual: actualGC, status: gcStatus },
    checks,
  };
}
