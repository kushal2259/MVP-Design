import type { RoomLayout, DoorConfig, WindowConfig, FurnitureConfig } from '@/types';
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
  validateCirculation,
  getRoomStandard,
  getStandardCategory,
  ARCHITECTURAL_STANDARDS
} from './architecturalStandards';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Helper to check if two rooms share a wall or direct edge. */
function sharesEdge(a: RoomLayout, b: RoomLayout): boolean {
  if (a.floor !== b.floor) return false;
  // Vertical shared edge
  const vert = (Math.abs((a.x + a.w) - b.x) < 0.4 || Math.abs((b.x + b.w) - a.x) < 0.4)
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2.5;
  // Horizontal shared edge
  const horiz = (Math.abs((a.y + a.h) - b.y) < 0.4 || Math.abs((b.y + b.h) - a.y) < 0.4)
    && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2.5;
  return vert || horiz;
}

/** Helper to check if a furniture item overlaps a door clearance zone. */
function overlapsDoorClearance(door: DoorConfig, roomW: number, roomH: number, furn: FurnitureConfig, roomType: string): boolean {
  let dx = 0, dy = 0, dw = 0, dh = 0;
  const clearanceDepth = roomType === 'toilet' ? 2.0 : 3.0;

  switch (door.side) {
    case 'front': // bottom wall (large y)
      dx = door.offset;
      dy = roomH - clearanceDepth;
      dw = door.width;
      dh = clearanceDepth;
      break;
    case 'back': // top wall (small y)
      dx = door.offset;
      dy = 0;
      dw = door.width;
      dh = clearanceDepth;
      break;
    case 'left': // left wall (small x)
      dx = 0;
      dy = door.offset;
      dw = clearanceDepth;
      dh = door.width;
      break;
    case 'right': // right wall (large x)
      dx = roomW - clearanceDepth;
      dy = door.offset;
      dw = clearanceDepth;
      dh = door.width;
      break;
  }

  const fxMin = furn.x - furn.w / 2;
  const fxMax = furn.x + furn.w / 2;
  const fyMin = furn.y - furn.h / 2;
  const fyMax = furn.y + furn.h / 2;

  return fxMin < dx + dw && fxMax > dx && fyMin < dy + dh && fyMax > dy;
}

// ============================================================================
//  1. FURNITURE LAYOUT VALIDATOR
// ============================================================================
export function FurnitureLayoutValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const r of rooms) {
    if (r.type === 'garden' || r.type === 'parking') continue;
    const std = getRoomStandard(r.type, r.name);

    // A. Clearances around doors
    const doors = r.doors || [];
    const furniture = r.furniture || [];
    for (const d of doors) {
      for (const f of furniture) {
        if (overlapsDoorClearance(d, r.w, r.h, f, r.type)) {
          // Furniture near doors is a layout concern, not a hard structural error
          warnings.push(`Furniture near door in ${r.name}: '${f.type}' may restrict door swing clearance`);
        }
      }
    }

    // B. Furniture overlap checks
    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        const f1 = furniture[i];
        const f2 = furniture[j];

        // A simple overlapping bounding box check
        const overlapX = Math.abs(f1.x - f2.x) < (f1.w + f2.w) / 2 * 0.9;
        const overlapY = Math.abs(f1.y - f2.y) < (f1.h + f2.h) / 2 * 0.9;

        if (overlapX && overlapY) {
          errors.push(`Furniture overlap error: ${r.name} has overlapping furniture items '${f1.type}' and '${f2.type}'`);
        }
      }
    }

    // C. Base furniture clearances and fit bounds
    const fitIssues = validateFurnitureFit(r);
    for (const issue of fitIssues) {
      if (issue.type === 'error') {
        errors.push(`${r.name}: ${issue.message}`);
      } else {
        warnings.push(`${r.name}: ${issue.message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  2. SHAPE VALIDATOR
// ============================================================================
export function ShapeValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const r of rooms) {
    if (r.type === 'garden') continue;

    const std = ARCHITECTURAL_STANDARDS.shape;
    const w = r.w;
    const h = r.h;
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);

    // Calculate complexity score: (perimeter^2) / (16 * area) - 1.0
    // A perfect square gives (4w)^2 / 16w^2 - 1.0 = 16w^2 / 16w^2 - 1.0 = 0.0
    const perimeter = 2 * (w + h);
    const area = w * h;
    const score = (perimeter * perimeter) / (16 * area) - 1.0;

    if (score > std.maxComplexityScore) {
      warnings.push(`Shape complexity warning: ${r.name} has an elongated shape (Complexity: ${score.toFixed(2)}, limit: ${std.maxComplexityScore})`);
    }

    // Validate shape checks
    const shapeIssues = validateShape(r);
    for (const issue of shapeIssues) {
      if (issue.type === 'error') {
        errors.push(`${r.name}: ${issue.message}`);
      } else {
        warnings.push(`${r.name}: ${issue.message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  3. CIRCULATION VALIDATOR
// ============================================================================
export function CirculationValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const circIssues = validateCirculation(rooms);
  for (const issue of circIssues) {
    if (issue.type === 'error') {
      errors.push(issue.message);
    } else {
      warnings.push(issue.message);
    }
  }

  // Accessibility clear width check for rooms
  for (const r of rooms) {
    if (r.type === 'garden') continue;
    const minDim = Math.min(r.w, r.h);
    if (minDim < 3.0 && r.type !== 'toilet') {
      errors.push(`Circulation error: Room ${r.name} dimension is ${minDim.toFixed(1)} ft (minimum accessibility clear width: 3.0 ft)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  4. PRIVACY VALIDATOR
// ============================================================================
export function PrivacyValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mappedRooms = rooms.map(r => ({
    room: r,
    category: getStandardCategory(r.type, r.name),
    std: getRoomStandard(r.type, r.name)
  }));

  const publicRooms = mappedRooms.filter(x => x.std.privacyClass === 'PUBLIC');
  const privateRooms = mappedRooms.filter(x => x.std.privacyClass === 'PRIVATE');
  const serviceRooms = mappedRooms.filter(x => x.std.privacyClass === 'SERVICE');

  // Validate Privacy transitions
  for (const pr of privateRooms) {
    // Private bedrooms should not share doors directly with Public living/lobbies
    // They should be buffered by corridors/lobby spaces for privacy control.
    for (const pub of publicRooms) {
      const sharesDoor = pr.room.doors.some(d => d.id.includes(pub.room.id)) ||
                         pub.room.doors.some(d => d.id.includes(pr.room.id));

      if (sharesDoor) {
        // Living room leading directly into a bedroom is warning
        if (pub.category === 'living_room') {
          warnings.push(`Privacy warning: ${pr.room.name} opens directly into the ${pub.room.name} without a buffer corridor`);
        }
      }
    }
  }

  // Service toilets should not open directly into public living/lobby or dining
  for (const srv of serviceRooms) {
    if (srv.category === 'attached_bathroom' || srv.category === 'common_bathroom' || srv.category === 'powder_room') {
      for (const pub of publicRooms) {
        if (sharesEdge(srv.room, pub.room)) {
          const directDoor = srv.room.doors.some(d => d.id.includes(pub.room.id));
          if (directDoor) {
            errors.push(`Privacy error: Service toilet ${srv.room.name} opens directly into public area ${pub.room.name}`);
          }
        }
      }
      const diningRooms = mappedRooms.filter(x => x.category === 'dining_room');
      for (const din of diningRooms) {
        if (sharesEdge(srv.room, din.room)) {
          errors.push(`Privacy error: Toilet ${srv.room.name} is adjacent to Dining Room ${din.room.name} (unhygienic layout)`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  5. NATURAL LIGHT VALIDATOR
// ============================================================================
export function NaturalLightValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const interior = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');

  for (const r of interior) {
    const isHabitable = r.type === 'bedroom' || r.type === 'living' || r.type === 'kitchen';
    const std = getRoomStandard(r.type, r.name);

    if (isHabitable) {
      // Natural light window check
      const hasWindow = (r.windows || []).length > 0;
      if (!hasWindow) {
        errors.push(`Natural Light error: Habitable room ${r.name} has no exterior windows`);
      } else {
        const area = r.w * r.h;
        const totalWinWidth = (r.windows || []).reduce((sum, w) => sum + w.width, 0);
        const winArea = totalWinWidth * 4.0; // Assume 4ft window heights
        if (winArea < area * std.minWindowAreaFraction) {
          warnings.push(`Natural Light warning: ${r.name} window openings (${winArea.toFixed(1)} sq ft) are below standard daylight ratio ${Math.round(std.minWindowAreaFraction * 100)}% of floor area`);
        }
      }
    } else if (r.type === 'toilet') {
      // Bathrooms need ventilator/light
      const hasVent = (r.windows || []).length > 0;
      if (!hasVent) {
        errors.push(`Natural Light error: Bathroom ${r.name} has no ventilation opening`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  6. SERVICE CORE VALIDATOR
// ============================================================================
export function ServiceCoreValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const plumbIssues = validatePlumbing(rooms);
  for (const issue of plumbIssues) {
    if (issue.type === 'error') {
      errors.push(issue.message);
    } else {
      warnings.push(issue.message);
    }
  }

  // Verify wet services do not overlap or leak into public cores
  const wetRooms = rooms.filter(r => getRoomStandard(r.type, r.name).isWetArea);
  const electricalMeters = rooms.filter(r => r.type === 'staircase'); // typically staircase holds meters

  for (const wet of wetRooms) {
    for (const meter of electricalMeters) {
      if (sharesEdge(wet, meter)) {
        warnings.push(`Service Core warning: Wet room ${wet.name} is adjacent to Staircase electrical duct core`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  7. STRUCTURAL VALIDATOR
// ============================================================================
export function StructuralValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const r of rooms) {
    if (r.type === 'garden' || r.type === 'parking') continue;

    const std = getRoomStandard(r.type, r.name);
    const w = r.w;
    const h = r.h;
    // In structural design, floor slabs and beams span across the shorter dimension
    const span = Math.min(w, h);

    // Span check
    if (span > std.structural.maxSpan) {
      errors.push(`Structural error: ${r.name} span is ${span.toFixed(1)} ft, exceeding safety span limit of ${std.structural.maxSpan} ft without column support`);
    } else if (span > std.structural.preferredSpan) {
      warnings.push(`Structural warning: ${r.name} span ${span.toFixed(1)} ft exceeds preferred span of ${std.structural.preferredSpan} ft (increases beam sizing)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  MAIN LAYOUT VALIDATION ORCHESTRATOR
// ============================================================================
// ============================================================================
//  8. DIMENSION VALIDATOR
// ============================================================================
export function DimensionValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const r of rooms) {
    if (r.type === 'garden' || r.type === 'parking') continue;
    
    const roomIssues = validateRoom(r);
    for (const issue of roomIssues) {
      if (issue.type === 'error') {
        errors.push(`Dimensions: ${r.name} ${issue.field} error: ${issue.message}`);
      } else {
        warnings.push(`Dimensions: ${r.name} ${issue.field} warning: ${issue.message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  9. ROOM COUNT VALIDATOR
// ============================================================================
export function RoomCountValidator(
  rooms: RoomLayout[],
  expectedBedrooms: number,
  expectedFloors: number
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const interior = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
  const bedrooms = interior.filter(r => r.type === 'bedroom');
  const bathrooms = interior.filter(r => r.type === 'toilet');
  const livingRooms = interior.filter(r => r.type === 'living');
  const kitchens = interior.filter(r => r.type === 'kitchen');
  const utilities = rooms.filter(r => getStandardCategory(r.type, r.name) === 'utility_area');

  // Room Count: Bedrooms
  if (bedrooms.length !== expectedBedrooms) {
    errors.push(`Room Count: Layout has ${bedrooms.length} Bedrooms but the brief requires ${expectedBedrooms} BHK`);
  }

  // Room Count: Living Room
  if (livingRooms.length < 1) {
    errors.push('Room Count: Layout is missing a Living Room');
  }

  // Room Count: Kitchen
  if (kitchens.length < 1) {
    errors.push('Room Count: Layout is missing a Kitchen');
  }

  // Room Count: Bathroom Count
  const requiredBaths = expectedBedrooms >= 3 ? 2 : 1;
  if (bathrooms.length < requiredBaths) {
    errors.push(`Room Count: Layout has ${bathrooms.length} Bathrooms (minimum required for ${expectedBedrooms} BHK: ${requiredBaths})`);
  }

  // Multi-floor bathroom check
  if (expectedFloors > 1) {
    const groundBaths = bathrooms.filter(b => b.floor === 0);
    if (groundBaths.length === 0) {
      errors.push('Room Count: Layout requires at least 1 bathroom or powder room on the Ground Floor for multi-floor access');
    }
  }

  // Utility Room recommendation
  if (expectedBedrooms >= 3 && utilities.length === 0) {
    warnings.push(`Room Count: A Utility Area is recommended for larger ${expectedBedrooms} BHK layouts`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  10. RELATIONSHIP VALIDATOR
// ============================================================================
export function RelationshipValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mappedRooms = rooms.map(r => ({
    room: r,
    category: getStandardCategory(r.type, r.name)
  }));
  const getByCategory = (cat: string) => mappedRooms.filter(x => x.category === cat).map(x => x.room);

  const kRooms = getByCategory('kitchen');
  const dRooms = getByCategory('dining_room');
  const livRooms = getByCategory('living_room');
  // getStandardCategory maps lobby/foyer type to 'corridor' — include both
  const lobbies = [...getByCategory('corridor'), ...getByCategory('lobby')];
  const masters = getByCategory('master_bedroom');
  const attachedBaths = getByCategory('attached_bathroom');
  const utilRooms = getByCategory('utility_area');

  // Kitchen ↔ Dining (advisory — compact plans merge living/dining)
  if (kRooms.length && dRooms.length) {
    const connected = kRooms.some(k => dRooms.some(d => sharesEdge(k, d)));
    if (!connected) {
      warnings.push('Relationships: Kitchen and Dining area are not adjacent (preferred but not required)');
    }
  }

  // Living ↔ Entrance
  const entranceRooms = [...livRooms, ...lobbies];
  const mainEntranceExists = rooms.some(r => (r.doors || []).some(d => /entry|main/.test(d.id)));
  if (!mainEntranceExists) {
    errors.push('Relationships: Layout has no marked main entrance door');
  } else {
    const correctEntrance = entranceRooms.some(r => (r.doors || []).some(d => /entry|main/.test(d.id)));
    if (!correctEntrance) {
      errors.push('Relationships: Main entrance must lead directly into the Living Room or Foyer/Lobby');
    }
  }

  // Master Bedroom ↔ Attached Bathroom
  if (masters.length && attachedBaths.length) {
    const connected = masters.some(m => attachedBaths.some(b => sharesEdge(m, b)));
    if (!connected) {
      errors.push('Relationships: Master Bedroom must have a directly attached bathroom');
    }
  }

  // Utility ↔ Kitchen
  if (utilRooms.length && kRooms.length) {
    const connected = utilRooms.some(u => kRooms.some(k => sharesEdge(u, k)));
    if (!connected) {
      warnings.push('Relationships: Utility Room should connect directly to the Kitchen');
    }
  }

  // Dining ↔ Living
  if (dRooms.length && livRooms.length) {
    const connected = dRooms.some(d => livRooms.some(l => sharesEdge(d, l)));
    if (!connected) {
      warnings.push('Relationships: Dining Area should be adjacent to the Living Room for circulation');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  11. ACCESSIBILITY VALIDATOR
// ============================================================================
export function AccessibilityValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const r of rooms) {
    if (r.type === 'garden' || r.type === 'parking') continue;

    // Door clearances and blockages
    const doors = r.doors || [];
    const furniture = r.furniture || [];
    for (const d of doors) {
      for (const f of furniture) {
        if (overlapsDoorClearance(d, r.w, r.h, f, r.type)) {
          warnings.push(`Accessibility: Furniture '${f.type}' in ${r.name} may restrict door swing`);
        }
      }
      
      // Door width checks
      const doorIssues = validateDoor(d, r.type);
      for (const issue of doorIssues) {
        if (issue.type === 'error') {
          errors.push(`Accessibility: ${issue.message}`);
        } else {
          warnings.push(`Accessibility: ${issue.message}`);
        }
      }
    }

    // Room accessibility (clear width of at least 3.0 ft for non-toilet rooms)
    const minDim = Math.min(r.w, r.h);
    if (minDim < 3.0 && r.type !== 'toilet') {
      errors.push(`Accessibility: Room ${r.name} dimension is ${minDim.toFixed(1)} ft (minimum accessibility clear width: 3.0 ft)`);
    }
  }

  // Corridor width check
  const corridors = rooms.filter(r => r.type === 'corridor' || r.type === 'lobby');
  for (const c of corridors) {
    const width = Math.min(c.w, c.h);
    if (width < 3.0) {
      errors.push(`Accessibility: Corridor ${c.name} width is ${width.toFixed(1)} ft (minimum width: 3.0 ft)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  12. VENTILATION VALIDATOR
// ============================================================================
export function VentilationValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const interior = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');

  for (const r of interior) {
    const std = getRoomStandard(r.type, r.name);
    
    // External wall check
    if (std.requiresExternalWall) {
      const hasVent = (r.windows || []).length > 0 || (r.doors || []).some(d => /entry|main/.test(d.id));
      if (!hasVent) {
        errors.push(`Ventilation: ${r.name} requires contact with an external wall but has no windows/ventilators`);
      }
    }

    const isHabitable = r.type === 'bedroom' || r.type === 'living' || r.type === 'kitchen';

    if (isHabitable) {
      const hasWindow = (r.windows || []).length > 0;
      if (!hasWindow) {
        errors.push(`Ventilation: Habitable room ${r.name} has no exterior window`);
      } else {
        const area = r.w * r.h;
        const totalWinWidth = (r.windows || []).reduce((sum, w) => sum + w.width, 0);
        const winArea = totalWinWidth * 4.0; // Assume 4ft window heights
        if (winArea < area * std.minWindowAreaFraction) {
          warnings.push(`Ventilation: ${r.name} window openings (${winArea.toFixed(1)} sq ft) are below standard daylight ratio ${Math.round(std.minWindowAreaFraction * 100)}% of floor area`);
        }
      }
    } else if (r.type === 'toilet') {
      const hasVent = (r.windows || []).length > 0;
      if (!hasVent) {
        errors.push(`Ventilation: Bathroom ${r.name} is missing a ventilator`);
      }
    }

    // Window width checks
    for (const w of r.windows || []) {
      const winIssues = validateWindow(w, r.type);
      for (const issue of winIssues) {
        if (issue.type === 'error') {
          errors.push(`Ventilation: Window ${w.id} width is ${w.width} ft (minimum required: ${issue.message})`);
        } else {
          warnings.push(`Ventilation: Window ${w.id} width is ${w.width} ft (warning: ${issue.message})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  13. PLUMBING VALIDATOR
// ============================================================================
export function PlumbingValidator(rooms: RoomLayout[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const plumbIssues = validatePlumbing(rooms);
  for (const issue of plumbIssues) {
    if (issue.type === 'error') {
      errors.push(`Plumbing: ${issue.message}`);
    } else {
      warnings.push(`Plumbing: ${issue.message}`);
    }
  }

  // Additional pipe efficiency / clustering checks
  const wetRooms = rooms.filter(r => getRoomStandard(r.type, r.name).isWetArea);
  for (let i = 0; i < wetRooms.length; i++) {
    for (let j = i + 1; j < wetRooms.length; j++) {
      const r1 = wetRooms[i];
      const r2 = wetRooms[j];
      if (r1.floor === r2.floor) {
        const dist = Math.hypot((r1.x + r1.w/2) - (r2.x + r2.w/2), (r1.y + r1.h/2) - (r2.y + r2.h/2));
        if (dist > 15.0 && !sharesEdge(r1, r2)) {
          warnings.push(`Plumbing: Wet rooms '${r1.name}' and '${r2.name}' are far apart (${dist.toFixed(1)} ft) and do not share a wet wall, increasing piping runs`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
//  MAIN LAYOUT VALIDATION ORCHESTRATOR
// ============================================================================
export function validateLayout(
  rooms: RoomLayout[],
  expectedBedrooms: number,
  expectedFloors: number
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const addReport = (rep: ValidationReport) => {
    errors.push(...rep.errors);
    warnings.push(...rep.warnings);
  };

  // Run the 7 validators from step 197
  addReport(FurnitureLayoutValidator(rooms));
  addReport(ShapeValidator(rooms));
  addReport(CirculationValidator(rooms));
  addReport(PrivacyValidator(rooms));
  addReport(NaturalLightValidator(rooms));
  addReport(ServiceCoreValidator(rooms));
  addReport(StructuralValidator(rooms));

  // Run the 6 validators from step 125
  addReport(DimensionValidator(rooms));
  addReport(RoomCountValidator(rooms, expectedBedrooms, expectedFloors));
  addReport(RelationshipValidator(rooms));
  addReport(AccessibilityValidator(rooms));
  addReport(VentilationValidator(rooms));
  addReport(PlumbingValidator(rooms));

  // Deduplicate errors and warnings
  const uniqueErrors = Array.from(new Set(errors));
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    valid: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: uniqueWarnings
  };
}
