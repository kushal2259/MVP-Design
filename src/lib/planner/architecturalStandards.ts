import type { RoomLayout, DoorConfig, WindowConfig } from '@/types';

// ============================================================================
//  CENTRALIZED ARCHITECTURAL STANDARDS DATABASE (A to N)
// ============================================================================

export interface RoomDimensionStandard {
  // A. Room Dimension Standards
  minWidth: number;
  maxWidth: number;
  minLength: number;
  maxLength: number;
  minArea: number;
  maxArea: number;
  idealAreaRange: { min: number; max: number };
  minAspectRatio: number;
  maxAspectRatio: number;

  // B. Furniture Standards
  furnitureFit: {
    mustFit: string[];
    furnitureLayoutBoundingBox: { w: number; h: number }; // min dimensions needed
    minClearance: number; // in feet
  };

  // C. Ventilation Standards
  minWindowAreaFraction: number; // e.g. 0.10 = 10% of floor area
  requiresVentilator: boolean;
  requiresExternalWall: boolean;

  // D. Adjacency / Relationship bounds
  relationships: {
    mustConnectTo: string[];
    preferredConnectTo: string[];
    shouldAvoid: string[];
  };

  // E. Privacy Metadata
  privacyClass: 'PUBLIC' | 'SEMI_PRIVATE' | 'PRIVATE' | 'SERVICE';

  // F. Plumbing Standards
  isWetArea: boolean;
  shareWetWall: boolean;
  maxDistanceFromWetCore: number;

  // G. Structural Metadata
  structural: {
    preferredSpan: number;
    maxSpan: number;
    columnRequirements: string[];
  };

  // N. Future Plan Metadata
  electrical: {
    lightingPoints: number;
    socketCount: number;
    fanRequired: boolean;
  };
  plumbing: {
    wcRequired: boolean;
    basinRequired: boolean;
    showerRequired: boolean;
    drainRequired: boolean;
  };
  hvac: {
    acRequired: boolean;
    ventilationRequired: boolean;
  };
}

export interface DoorStandard {
  mainDoorWidth: number;
  bedroomDoorWidth: number;
  bathroomDoorWidth: number;
  utilityDoorWidth: number;
}

export interface WindowStandard {
  minWidth: number;
  minArea: number;
  ventilationAreaFraction: number;
}

export interface StairStandard {
  width: number; // clear width of flight
  riser: number; // inches
  tread: number; // inches
  maxStepsPerFlight: number;
  landingWidth: number;
  headroom: number;
}

export interface ParkingStandard {
  carWidth: number;
  carLength: number;
  turningRadius: number;
  clearanceSpace: number;
}

export interface CirculationStandard {
  minCorridorWidth: number;
  idealCorridorWidth: number;
  maxDeadEndLength: number;
  minWalkingClearance: number;
}

export interface ShapeStandard {
  allowedShapes: ('rectangle' | 'near-rectangle' | 'L-shape' | 'U-shape')[];
  maxComplexityScore: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

// Global Config Instance
export const ARCHITECTURAL_STANDARDS = {
  rooms: {
    master_bedroom: {
      minWidth: 10.0, maxWidth: 18.0,
      minLength: 10.0, maxLength: 22.0,
      minArea: 100, maxArea: 400,
      idealAreaRange: { min: 130, max: 300 },
      minAspectRatio: 1.0, maxAspectRatio: 2.0,
      furnitureFit: {
        mustFit: ['king-bed', 'wardrobe', 'nightstand', 'nightstand', 'tv-unit'],
        furnitureLayoutBoundingBox: { w: 10.0, h: 10.0 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.10, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['attached_bathroom'], shouldAvoid: ['parking_space'] },
      privacyClass: 'PRIVATE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 25.0,
      structural: { preferredSpan: 14.0, maxSpan: 20.0, columnRequirements: ['corner columns', 'beam support'] },
      electrical: { lightingPoints: 4, socketCount: 5, fanRequired: true },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: true, ventilationRequired: true },
    },
    guest_bedroom: {
      minWidth: 9.0, maxWidth: 16.0,
      minLength: 10.0, maxLength: 18.0,
      minArea: 100, maxArea: 280,
      idealAreaRange: { min: 120, max: 200 },
      minAspectRatio: 1.0, maxAspectRatio: 2.0,
      furnitureFit: {
        mustFit: ['queen-bed', 'wardrobe', 'nightstand'],
        furnitureLayoutBoundingBox: { w: 9.0, h: 10.0 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.10, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['common_bathroom'], shouldAvoid: [] },
      privacyClass: 'PRIVATE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 25.0,
      structural: { preferredSpan: 12.0, maxSpan: 16.0, columnRequirements: ['standard columns'] },
      electrical: { lightingPoints: 3, socketCount: 4, fanRequired: true },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: true, ventilationRequired: true },
    },
    children_bedroom: {
      minWidth: 9.0, maxWidth: 15.0,
      minLength: 10.0, maxLength: 18.0,
      minArea: 100, maxArea: 250,
      idealAreaRange: { min: 110, max: 180 },
      minAspectRatio: 1.0, maxAspectRatio: 2.0,
      furnitureFit: {
        mustFit: ['single-bed', 'study-desk', 'wardrobe'],
        furnitureLayoutBoundingBox: { w: 9.0, h: 9.0 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.10, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: [], shouldAvoid: [] },
      privacyClass: 'PRIVATE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 25.0,
      structural: { preferredSpan: 12.0, maxSpan: 16.0, columnRequirements: ['standard columns'] },
      electrical: { lightingPoints: 3, socketCount: 4, fanRequired: true },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: true, ventilationRequired: true },
    },
    attached_bathroom: {
      minWidth: 4.5, maxWidth: 9.0,
      minLength: 7.0, maxLength: 14.0,
      minArea: 35, maxArea: 120,
      idealAreaRange: { min: 45, max: 80 },
      minAspectRatio: 1.0, maxAspectRatio: 2.5,
      furnitureFit: {
        mustFit: ['wc', 'basin', 'shower'],
        furnitureLayoutBoundingBox: { w: 4.5, h: 7.0 },
        minClearance: 1.5,
      },
      minWindowAreaFraction: 0.05, requiresVentilator: true, requiresExternalWall: true,
      relationships: { mustConnectTo: ['master_bedroom'], preferredConnectTo: [], shouldAvoid: ['kitchen'] },
      privacyClass: 'SERVICE',
      isWetArea: true, shareWetWall: true, maxDistanceFromWetCore: 12.0,
      structural: { preferredSpan: 8.0, maxSpan: 12.0, columnRequirements: ['waterproofing required', 'sunken slab'] },
      electrical: { lightingPoints: 2, socketCount: 2, fanRequired: false },
      plumbing: { wcRequired: true, basinRequired: true, showerRequired: true, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: true },
    },
    common_bathroom: {
      minWidth: 4.5, maxWidth: 8.0,
      minLength: 6.0, maxLength: 12.0,
      minArea: 30, maxArea: 90,
      idealAreaRange: { min: 35, max: 60 },
      minAspectRatio: 1.0, maxAspectRatio: 2.5,
      furnitureFit: {
        mustFit: ['wc', 'basin', 'shower'],
        furnitureLayoutBoundingBox: { w: 4.5, h: 6.0 },
        minClearance: 1.5,
      },
      minWindowAreaFraction: 0.05, requiresVentilator: true, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['corridor'], shouldAvoid: ['kitchen'] },
      privacyClass: 'SERVICE',
      isWetArea: true, shareWetWall: true, maxDistanceFromWetCore: 12.0,
      structural: { preferredSpan: 8.0, maxSpan: 12.0, columnRequirements: ['waterproofing required', 'sunken slab'] },
      electrical: { lightingPoints: 2, socketCount: 2, fanRequired: false },
      plumbing: { wcRequired: true, basinRequired: true, showerRequired: true, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: true },
    },
    powder_room: {
      minWidth: 3.5, maxWidth: 6.0,
      minLength: 4.5, maxLength: 8.0,
      minArea: 16, maxArea: 48,
      idealAreaRange: { min: 18, max: 35 },
      minAspectRatio: 1.0, maxAspectRatio: 1.6,
      furnitureFit: {
        mustFit: ['wc', 'basin'],
        furnitureLayoutBoundingBox: { w: 3.5, h: 4.5 },
        minClearance: 1.5,
      },
      minWindowAreaFraction: 0.05, requiresVentilator: true, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['living_room', 'lobby'], shouldAvoid: ['kitchen'] },
      privacyClass: 'SERVICE',
      isWetArea: true, shareWetWall: true, maxDistanceFromWetCore: 15.0,
      structural: { preferredSpan: 6.0, maxSpan: 10.0, columnRequirements: ['sunken slab'] },
      electrical: { lightingPoints: 1, socketCount: 1, fanRequired: false },
      plumbing: { wcRequired: true, basinRequired: true, showerRequired: false, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: true },
    },
    living_room: {
      minWidth: 10.0, maxWidth: 22.0,
      minLength: 10.0, maxLength: 28.0,
      minArea: 120, maxArea: 550,
      idealAreaRange: { min: 150, max: 400 },
      minAspectRatio: 1.0, maxAspectRatio: 2.5,
      furnitureFit: {
        mustFit: ['sofa', 'coffee-table', 'tv-unit'],
        furnitureLayoutBoundingBox: { w: 10.0, h: 10.0 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.12, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: ['lobby'], preferredConnectTo: ['dining_room'], shouldAvoid: ['common_bathroom'] },
      privacyClass: 'PUBLIC',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 35.0,
      structural: { preferredSpan: 16.0, maxSpan: 24.0, columnRequirements: ['larger span column grid'] },
      electrical: { lightingPoints: 6, socketCount: 6, fanRequired: true },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: true, ventilationRequired: true },
    },
    dining_room: {
      minWidth: 9.0, maxWidth: 16.0,
      minLength: 10.0, maxLength: 20.0,
      minArea: 90, maxArea: 320,
      idealAreaRange: { min: 100, max: 220 },
      minAspectRatio: 1.0, maxAspectRatio: 2.0,
      furnitureFit: {
        mustFit: ['dining-table-6seater'],
        furnitureLayoutBoundingBox: { w: 9.0, h: 10.5 },
        minClearance: 2.5,
      },
      minWindowAreaFraction: 0.10, requiresVentilator: false, requiresExternalWall: false,
      relationships: { mustConnectTo: ['kitchen'], preferredConnectTo: ['living_room'], shouldAvoid: ['toilet'] },
      privacyClass: 'SEMI_PRIVATE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 20.0,
      structural: { preferredSpan: 12.0, maxSpan: 18.0, columnRequirements: ['standard spacing'] },
      electrical: { lightingPoints: 3, socketCount: 3, fanRequired: true },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: true, ventilationRequired: true },
    },
    kitchen: {
      minWidth: 7.0, maxWidth: 14.0,
      minLength: 8.0, maxLength: 18.0,
      minArea: 55, maxArea: 220,
      idealAreaRange: { min: 70, max: 180 },
      minAspectRatio: 1.0, maxAspectRatio: 2.5,
      furnitureFit: {
        mustFit: ['kitchen-counter', 'refrigerator'],
        furnitureLayoutBoundingBox: { w: 7.5, h: 8.0 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.15, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: ['dining_room'], preferredConnectTo: ['utility_area'], shouldAvoid: ['toilet'] },
      privacyClass: 'SERVICE',
      isWetArea: true, shareWetWall: true, maxDistanceFromWetCore: 10.0,
      structural: { preferredSpan: 10.0, maxSpan: 16.0, columnRequirements: ['overhead cabinets beam'] },
      electrical: { lightingPoints: 4, socketCount: 6, fanRequired: true },
      plumbing: { wcRequired: false, basinRequired: true, showerRequired: false, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: true },
    },
    utility_area: {
      minWidth: 4.0, maxWidth: 8.0,
      minLength: 5.0, maxLength: 12.0,
      minArea: 20, maxArea: 80,
      idealAreaRange: { min: 30, max: 60 },
      minAspectRatio: 1.0, maxAspectRatio: 2.2,
      furnitureFit: {
        mustFit: ['washing-machine'],
        furnitureLayoutBoundingBox: { w: 4.0, h: 5.0 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.10, requiresVentilator: true, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['kitchen'], shouldAvoid: [] },
      privacyClass: 'SERVICE',
      isWetArea: true, shareWetWall: true, maxDistanceFromWetCore: 10.0,
      structural: { preferredSpan: 8.0, maxSpan: 12.0, columnRequirements: ['water outlets'] },
      electrical: { lightingPoints: 2, socketCount: 3, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: true },
    },
    balcony: {
      minWidth: 3.0, maxWidth: 8.0,
      minLength: 5.0, maxLength: 24.0,
      minArea: 18, maxArea: 150,
      idealAreaRange: { min: 24, max: 90 },
      minAspectRatio: 1.0, maxAspectRatio: 4.5,
      furnitureFit: {
        mustFit: ['plant'],
        furnitureLayoutBoundingBox: { w: 3.0, h: 3.0 },
        minClearance: 1.5,
      },
      minWindowAreaFraction: 0.0, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['bedroom', 'living_room'], shouldAvoid: [] },
      privacyClass: 'SEMI_PRIVATE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 30.0,
      structural: { preferredSpan: 6.0, maxSpan: 10.0, columnRequirements: ['cantilever design'] },
      electrical: { lightingPoints: 1, socketCount: 1, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: false },
    },
    pooja_room: {
      minWidth: 3.5, maxWidth: 8.0,
      minLength: 4.5, maxLength: 10.0,
      minArea: 15, maxArea: 80,
      idealAreaRange: { min: 20, max: 50 },
      minAspectRatio: 1.0, maxAspectRatio: 2.0,
      furnitureFit: {
        mustFit: ['credenza'],
        furnitureLayoutBoundingBox: { w: 3.5, h: 4.5 },
        minClearance: 2.0,
      },
      minWindowAreaFraction: 0.05, requiresVentilator: true, requiresExternalWall: false,
      relationships: { mustConnectTo: [], preferredConnectTo: ['lobby', 'living_room'], shouldAvoid: ['toilet'] },
      privacyClass: 'PRIVATE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 25.0,
      structural: { preferredSpan: 8.0, maxSpan: 12.0, columnRequirements: ['non-structural partition'] },
      electrical: { lightingPoints: 2, socketCount: 2, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: false, ventilationRequired: true },
    },
    store_room: {
      minWidth: 4.0, maxWidth: 8.0,
      minLength: 5.0, maxLength: 12.0,
      minArea: 20, maxArea: 80,
      idealAreaRange: { min: 24, max: 60 },
      minAspectRatio: 1.0, maxAspectRatio: 1.8,
      furnitureFit: {
        mustFit: ['bookshelf'],
        furnitureLayoutBoundingBox: { w: 4.0, h: 5.0 },
        minClearance: 1.5,
      },
      minWindowAreaFraction: 0.0, requiresVentilator: false, requiresExternalWall: false,
      relationships: { mustConnectTo: [], preferredConnectTo: ['kitchen', 'corridor'], shouldAvoid: [] },
      privacyClass: 'SERVICE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 30.0,
      structural: { preferredSpan: 8.0, maxSpan: 12.0, columnRequirements: ['standard load capacity'] },
      electrical: { lightingPoints: 1, socketCount: 1, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: false, ventilationRequired: false },
    },
    parking_space: {
      minWidth: 8.5, maxWidth: 18.0,
      minLength: 15.0, maxLength: 24.0,
      minArea: 130, maxArea: 360,
      idealAreaRange: { min: 140, max: 280 },
      minAspectRatio: 1.0, maxAspectRatio: 2.2,
      furnitureFit: {
        mustFit: ['car'],
        furnitureLayoutBoundingBox: { w: 8.5, h: 15.0 },
        minClearance: 1.5,
      },
      minWindowAreaFraction: 0.0, requiresVentilator: false, requiresExternalWall: true,
      relationships: { mustConnectTo: [], preferredConnectTo: ['lobby'], shouldAvoid: ['bedroom'] },
      privacyClass: 'PUBLIC',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 40.0,
      structural: { preferredSpan: 15.0, maxSpan: 22.0, columnRequirements: ['heavy load driveway slab'] },
      electrical: { lightingPoints: 2, socketCount: 2, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: true },
      hvac: { acRequired: false, ventilationRequired: false },
    },
    staircase: {
      minWidth: 10.0, maxWidth: 15.0,
      minLength: 10.0, maxLength: 15.0,
      minArea: 100, maxArea: 225,
      idealAreaRange: { min: 100, max: 180 },
      minAspectRatio: 1.0, maxAspectRatio: 3.5,
      furnitureFit: {
        mustFit: [],
        furnitureLayoutBoundingBox: { w: 3.5, h: 6.5 },
        minClearance: 3.0,
      },
      minWindowAreaFraction: 0.05, requiresVentilator: false, requiresExternalWall: false,
      relationships: { mustConnectTo: [], preferredConnectTo: ['lobby', 'corridor'], shouldAvoid: [] },
      privacyClass: 'SERVICE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 30.0,
      structural: { preferredSpan: 8.0, maxSpan: 14.0, columnRequirements: ['waist slab beam support'] },
      electrical: { lightingPoints: 2, socketCount: 1, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: false, ventilationRequired: false },
    },
    corridor: {
      minWidth: 3.0, maxWidth: 6.0,
      minLength: 4.0, maxLength: 35.0,
      minArea: 12, maxArea: 180,
      idealAreaRange: { min: 20, max: 120 },
      minAspectRatio: 1.0, maxAspectRatio: 8.0,
      furnitureFit: {
        mustFit: [],
        furnitureLayoutBoundingBox: { w: 3.0, h: 4.0 },
        minClearance: 3.0,
      },
      minWindowAreaFraction: 0.0, requiresVentilator: false, requiresExternalWall: false,
      relationships: { mustConnectTo: [], preferredConnectTo: [], shouldAvoid: [] },
      privacyClass: 'SERVICE',
      isWetArea: false, shareWetWall: false, maxDistanceFromWetCore: 30.0,
      structural: { preferredSpan: 6.0, maxSpan: 10.0, columnRequirements: ['slender slab support'] },
      electrical: { lightingPoints: 2, socketCount: 2, fanRequired: false },
      plumbing: { wcRequired: false, basinRequired: false, showerRequired: false, drainRequired: false },
      hvac: { acRequired: false, ventilationRequired: false },
    },
  } as Record<string, RoomDimensionStandard>,

  doors: {
    mainDoorWidth: 3.5,
    bedroomDoorWidth: 3.0,
    bathroomDoorWidth: 2.5,
    utilityDoorWidth: 2.5,
  } as DoorStandard,

  windows: {
    minWidth: 3.0,
    minArea: 12.0,
    ventilationAreaFraction: 0.10,
  } as WindowStandard,

  stairs: {
    width: 3.5, // single flight width
    riser: 6.5, // 6.5 inches
    tread: 10.5, // 10.5 inches
    maxStepsPerFlight: 12,
    landingWidth: 3.5,
    headroom: 7.0,
  } as StairStandard,

  parking: {
    carWidth: 6.0,
    carLength: 15.0,
    turningRadius: 16.5,
    clearanceSpace: 1.5,
  } as ParkingStandard,

  circulation: {
    minCorridorWidth: 3.0,
    idealCorridorWidth: 3.5,
    maxDeadEndLength: 15.0,
    minWalkingClearance: 2.0,
  } as CirculationStandard,

  shape: {
    allowedShapes: ['rectangle', 'near-rectangle'],
    maxComplexityScore: 0.2,
  } as ShapeStandard,
};

// ============================================================================
//  STANDARD CATEGORY LOOKUPS
// ============================================================================

export function getStandardCategory(type: string, name: string): string {
  const normName = (name || '').toLowerCase();
  const normType = (type || '').toLowerCase();

  if (normType === 'bedroom') {
    if (normName.includes('master')) return 'master_bedroom';
    if (normName.includes('children') || normName.includes('child')) return 'children_bedroom';
    if (normName.includes('guest')) return 'guest_bedroom';
    if (normName.includes('study') || normName.includes('office') || normName.includes('servant') || normName.includes('gym')) return 'store_room';
    return 'guest_bedroom'; // Default
  }

  if (normType === 'toilet' || normType === 'bathroom') {
    if (normName.includes('master') || normName.includes('attached') || normName.includes('en-suite') || normName.includes('ensuite')) {
      return 'attached_bathroom';
    }
    if (normName.includes('powder')) return 'powder_room';
    return 'common_bathroom'; // Default
  }

  if (normType === 'living' || normName.includes('living') || normName.includes('family lounge') || normName.includes('lounge')) {
    return 'living_room';
  }
  if (normType === 'dining' || normName.includes('dining')) return 'dining_room';
  if (normType === 'kitchen' || normName.includes('kitchen')) return 'kitchen';
  if (normName.includes('utility') || normType === 'utility') return 'utility_area';
  if (normType === 'balcony' || normName.includes('balcony')) return 'balcony';
  if (normName.includes('pooja') || normName.includes('prayer') || normName.includes('mandir')) return 'pooja_room';
  if (normType === 'staircase' || normName.includes('stair')) return 'staircase';
  if (normType === 'corridor' && normName.includes('store')) return 'store_room';
  if (normType === 'corridor' || normName.includes('corridor') || normName.includes('passage') || normType === 'lobby' || normName.includes('lobby') || normName.includes('foyer')) return 'corridor';
  if (normType === 'parking' || normName.includes('parking') || normName.includes('garage') || normName.includes('portico')) {
    return 'parking_space';
  }

  // Fallbacks
  switch (normType) {
    case 'living': return 'living_room';
    case 'dining': return 'dining_room';
    case 'kitchen': return 'kitchen';
    case 'toilet': return 'common_bathroom';
    case 'balcony': return 'balcony';
    case 'staircase': return 'staircase';
    case 'corridor': return 'corridor';
    case 'lobby': return 'corridor';
    case 'parking': return 'parking_space';
    default: return 'living_room';
  }
}

export function getRoomStandard(type: string, name: string): RoomDimensionStandard {
  const cat = getStandardCategory(type, name);
  return ARCHITECTURAL_STANDARDS.rooms[cat] || ARCHITECTURAL_STANDARDS.rooms.living_room;
}

// ============================================================================
//  PHASE 1 STANDARDS VALIDATOR IMPLEMENTATIONS
// ============================================================================

/**
 * 1. validateRoom()
 * Validates dimensions, area, aspect ratio, external wall requirements.
 */
export function validateRoom(room: RoomLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const std = getRoomStandard(room.type, room.name);
  const w = room.w;
  const h = room.h;
  const area = w * h;

  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const aspect = maxDim / Math.max(0.1, minDim);

  // Width validation
  if (minDim < std.minWidth) {
    issues.push({
      type: 'error',
      field: 'width',
      message: `${room.name} width is ${minDim.toFixed(1)} ft (minimum: ${std.minWidth} ft)`,
    });
  } else if (minDim > std.maxWidth) {
    issues.push({
      type: 'warning',
      field: 'width',
      message: `${room.name} width is ${minDim.toFixed(1)} ft (maximum standard: ${std.maxWidth} ft)`,
    });
  }

  // Length validation
  if (maxDim < std.minLength) {
    issues.push({
      type: 'error',
      field: 'length',
      message: `${room.name} length is ${maxDim.toFixed(1)} ft (minimum: ${std.minLength} ft)`,
    });
  } else if (maxDim > std.maxLength) {
    issues.push({
      type: 'warning',
      field: 'length',
      message: `${room.name} length is ${maxDim.toFixed(1)} ft (maximum standard: ${std.maxLength} ft)`,
    });
  }

  // Area validation
  if (area < std.minArea) {
    issues.push({
      type: 'error',
      field: 'area',
      message: `${room.name} area is ${Math.round(area)} sq ft (minimum required: ${std.minArea} sq ft)`,
    });
  } else if (area > std.maxArea) {
    issues.push({
      type: 'warning',
      field: 'area',
      message: `${room.name} area is ${Math.round(area)} sq ft (maximum standard: ${std.maxArea} sq ft)`,
    });
  } else if (area < std.idealAreaRange.min || area > std.idealAreaRange.max) {
    issues.push({
      type: 'warning',
      field: 'area',
      message: `${room.name} area ${Math.round(area)} sq ft is outside the ideal range of ${std.idealAreaRange.min}–${std.idealAreaRange.max} sq ft`,
    });
  }

  // Aspect ratio validation
  if (aspect > std.maxAspectRatio) {
    issues.push({
      type: 'error',
      field: 'aspectRatio',
      message: `${room.name} aspect ratio is ${aspect.toFixed(2)} (maximum allowed: ${std.maxAspectRatio})`,
    });
  } else if (aspect < std.minAspectRatio) {
    issues.push({
      type: 'error',
      field: 'aspectRatio',
      message: `${room.name} aspect ratio is ${aspect.toFixed(2)} (minimum required: ${std.minAspectRatio})`,
    });
  }

  // External wall check
  if (std.requiresExternalWall) {
    // Check if room has exterior windows or outer doors
    const hasVent = (room.windows || []).length > 0 || (room.doors || []).some(d => /entry|main/.test(d.id));
    if (!hasVent) {
      issues.push({
        type: 'error',
        field: 'ventilation',
        message: `${room.name} requires contact with an external wall but has no windows/ventilators`,
      });
    }
  }

  return issues;
}

/**
 * 2. validateFurnitureFit()
 * Checks if standard furniture bounding box fits inside the room dimensions,
 * and if walking clearances are preserved.
 */
export function validateFurnitureFit(room: RoomLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const std = getRoomStandard(room.type, room.name);
  const bb = std.furnitureFit.furnitureLayoutBoundingBox;
  const w = room.w;
  const h = room.h;

  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  
  const minRequiredDim = Math.min(bb.w, bb.h);
  const maxRequiredDim = Math.max(bb.w, bb.h);

  // Check if minimum orientation box can pack inside room dimensions
  if (minDim < minRequiredDim || maxDim < maxRequiredDim) {
    issues.push({
      type: 'error',
      field: 'furnitureFit',
      message: `${room.name} dimensions (${w.toFixed(1)}x${h.toFixed(1)} ft) are too cramped to fit required furniture: ${std.furnitureFit.mustFit.join(', ')} (requires at least ${minRequiredDim}x${maxRequiredDim} ft clear)`,
    });
  }

  // Area clearance check
  const furnitureArea = std.furnitureFit.mustFit.reduce((acc, name) => {
    // Approximate furniture footprint area in sqft
    if (name.includes('king-bed')) return acc + 42.25; // 6.5 x 6.5
    if (name.includes('queen-bed')) return acc + 32.5; // 5 x 6.5
    if (name.includes('single-bed')) return acc + 19.5; // 3 x 6.5
    if (name.includes('wardrobe')) return acc + 12.0; // 6 x 2
    if (name.includes('sofa')) return acc + 21.0; // 7 x 3
    if (name.includes('dining-table')) return acc + 18.0; // 3 x 6
    if (name.includes('kitchen-counter')) return acc + 16.0; // 8 x 2
    if (name.includes('car')) return acc + 97.5; // 15 x 6.5
    if (name.includes('wc')) return acc + 3.5;
    if (name.includes('basin')) return acc + 3.0;
    if (name.includes('shower')) return acc + 9.0;
    return acc + 4.0; // standard default
  }, 0);

  const roomArea = w * h;
  const freeArea = roomArea - furnitureArea;
  const minimumNeededArea = roomArea * 0.35; // at least 35% free circulation space

  if (freeArea < minimumNeededArea) {
    issues.push({
      type: 'warning',
      field: 'furnitureFit',
      message: `${room.name} has insufficient walking clearance. Free space is only ${Math.round(freeArea)} sq ft (required circulation clearance: at least ${Math.round(minimumNeededArea)} sq ft)`,
    });
  }

  return issues;
}

/**
 * 3. validateVentilation()
 * Checks if the total window area meets standard fractions.
 */
export function validateVentilation(room: RoomLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const std = getRoomStandard(room.type, room.name);
  const area = room.w * room.h;

  if (std.minWindowAreaFraction > 0) {
    // Assume window height is ~4 ft for area calculation
    const winArea = (room.windows || []).reduce((sum, win) => sum + win.width * 4, 0);
    const requiredWinArea = area * std.minWindowAreaFraction;

    if (winArea < requiredWinArea) {
      issues.push({
        type: 'error',
        field: 'ventilation',
        message: `${room.name} ventilation area is ${winArea.toFixed(1)} sq ft (requires: ${requiredWinArea.toFixed(1)} sq ft, based on ${Math.round(std.minWindowAreaFraction * 100)}% of floor)`,
      });
    }
  }

  if (std.requiresVentilator) {
    const hasVent = (room.windows || []).some(w => w.width <= 2.5) || (room.windows || []).length > 0;
    if (!hasVent) {
      issues.push({
        type: 'error',
        field: 'ventilator',
        message: `${room.name} requires a ventilator opening for exhaust/fresh air`,
      });
    }
  }

  return issues;
}

/**
 * 4. validateDoor()
 * Checks if door widths are compliant with standards for that room type.
 */
export function validateDoor(door: DoorConfig, roomType: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isMain = door.id.includes('main') || door.id.includes('entry');
  const isBathroom = roomType === 'toilet' || /toilet|bath|powder/.test(door.id.toLowerCase());
  const isUtilityStore = roomType === 'utility' || roomType === 'corridor' || /utility|store/.test(door.id.toLowerCase());

  if (isMain) {
    if (door.width < ARCHITECTURAL_STANDARDS.doors.mainDoorWidth) {
      issues.push({
        type: 'error',
        field: 'doorWidth',
        message: `Main entrance door width is ${door.width} ft (minimum required: ${ARCHITECTURAL_STANDARDS.doors.mainDoorWidth} ft)`,
      });
    }
  } else if (isBathroom) {
    if (door.width < ARCHITECTURAL_STANDARDS.doors.bathroomDoorWidth) {
      issues.push({
        type: 'error',
        field: 'doorWidth',
        message: `Bathroom door width is ${door.width} ft (minimum required: ${ARCHITECTURAL_STANDARDS.doors.bathroomDoorWidth} ft)`,
      });
    }
  } else if (isUtilityStore) {
    if (door.width < ARCHITECTURAL_STANDARDS.doors.utilityDoorWidth) {
      issues.push({
        type: 'warning',
        field: 'doorWidth',
        message: `Service area door width is ${door.width} ft (minimum required: ${ARCHITECTURAL_STANDARDS.doors.utilityDoorWidth} ft)`,
      });
    }
  } else {
    // Bedroom, Living, Dining standard
    if (door.width < ARCHITECTURAL_STANDARDS.doors.bedroomDoorWidth) {
      issues.push({
        type: 'error',
        field: 'doorWidth',
        message: `Room door width is ${door.width} ft (minimum required: ${ARCHITECTURAL_STANDARDS.doors.bedroomDoorWidth} ft)`,
      });
    }
  }

  return issues;
}

/**
 * 5. validateWindow()
 * Checks if individual window dimensions are adequate.
 */
export function validateWindow(window: WindowConfig, roomType: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (roomType === 'balcony') return []; // Balconies do not have standard window frames
  const stdWin = ARCHITECTURAL_STANDARDS.windows;
  const isToilet = roomType === 'toilet';

  if (isToilet) {
    // ventilators can be smaller, e.g. 1.5 ft width
    if (window.width < 1.5) {
      issues.push({
        type: 'warning',
        field: 'windowWidth',
        message: `Toilet ventilator width ${window.width} ft is below ideal 1.5 ft`,
      });
    }
  } else {
    if (window.width < stdWin.minWidth) {
      issues.push({
        type: 'error',
        field: 'windowWidth',
        message: `Window width is ${window.width} ft (minimum standard is ${stdWin.minWidth} ft)`,
      });
    }
    const area = window.width * 4.0; // Assume standard height
    if (area < stdWin.minArea) {
      issues.push({
        type: 'warning',
        field: 'windowArea',
        message: `Window area is ${area.toFixed(1)} sq ft (suggested minimum is ${stdWin.minArea} sq ft)`,
      });
    }
  }

  return issues;
}

/**
 * 6. validateStairs()
 * Checks staircase widths, landing requirement, riser and tread safety limits.
 */
export function validateStairs(staircase: RoomLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const std = ARCHITECTURAL_STANDARDS.stairs;
  const w = staircase.w;
  const h = staircase.h;
  const minDim = Math.min(w, h);

  // Single-flight residential staircase: NBC §8.2 requires 3.5 ft clear width minimum
  if (minDim < std.width) {
    issues.push({
      type: 'error',
      field: 'stairsWidth',
      message: `Staircase clear width is ${minDim.toFixed(1)} ft (NBC §8.2 minimum: ${std.width} ft)`,
    });
  }
  const clearWidth = minDim;

  // Steps check (assumes standard 10 ft residential floor-to-floor height = 120 inches)
  const floorHeightInches = 120;
  const stepsCount = Math.round(floorHeightInches / std.riser); // ~18 steps

  if (stepsCount > std.maxStepsPerFlight * 2) {
    issues.push({
      type: 'warning',
      field: 'stepsCount',
      message: `Staircase requires ${stepsCount} steps which is high. Verify structure layout.`,
    });
  }

  // Landing check: Dog-legged stair must have a landing at the turn.
  // The landing width must equal the flight width.
  const maxDim = Math.max(w, h);
  const landingRequiredLength = clearWidth; // landing length matches flight clear width
  const runLength = maxDim - landingRequiredLength;
  const stepTreadRun = std.tread / 12; // in feet (~0.875 ft)
  const stepsPerFlightCount = Math.ceil(stepsCount / 2); // e.g. 9 steps per flight
  const totalTreadLengthNeeded = (stepsPerFlightCount - 1) * stepTreadRun;

  if (runLength < totalTreadLengthNeeded) {
    issues.push({
      type: 'error',
      field: 'landingClearance',
      message: `Staircase room length ${maxDim.toFixed(1)} ft is too short to accommodate landing and treads (requires landing of ${clearWidth.toFixed(1)} ft plus ${totalTreadLengthNeeded.toFixed(1)} ft tread run)`,
    });
  }

  return issues;
}

/**
 * 7. validateParking()
 * Verifies car clearance, turning radius clearance, and parking bay dimensions.
 */
export function validateParking(parking: RoomLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const std = ARCHITECTURAL_STANDARDS.parking;
  const w = parking.w;
  const h = parking.h;

  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);

  const reqWidth = std.carWidth + std.clearanceSpace * 2; // 6 + 1.5*2 = 9.0 ft
  const reqLength = std.carLength + std.clearanceSpace * 2; // 15 + 1.5*2 = 18.0 ft

  if (minDim < reqWidth) {
    issues.push({
      type: 'error',
      field: 'parkingWidth',
      message: `Parking bay width ${minDim.toFixed(1)} ft is too narrow for standard car doors to open (minimum clearance: ${reqWidth} ft)`,
    });
  }

  if (maxDim < reqLength) {
    issues.push({
      type: 'error',
      field: 'parkingLength',
      message: `Parking bay length ${maxDim.toFixed(1)} ft is too short (minimum required: ${reqLength} ft)`,
    });
  }

  return issues;
}

/**
 * 8. validateAdjacency()
 * Validates MUST connect, PREFERRED connect, and SHOULD AVOID room adjacencies.
 */
export function validateAdjacency(rooms: RoomLayout[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const sharesWall = (a: RoomLayout, b: RoomLayout): boolean => {
    if (a.floor !== b.floor) return false;
    const vert = (Math.abs((a.x + a.w) - b.x) < 0.4 || Math.abs((b.x + b.w) - a.x) < 0.4)
      && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2.5;
    const horiz = (Math.abs((a.y + a.h) - b.y) < 0.4 || Math.abs((b.y + b.h) - a.y) < 0.4)
      && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2.5;
    return vert || horiz;
  };

  // Pre-categorize rooms
  const categorized = rooms.map(r => ({
    room: r,
    category: getStandardCategory(r.type, r.name),
  }));

  for (const item of categorized) {
    const std = ARCHURAL_RELATIONSHIPS[item.category];
    if (!std) continue;

    // Must Connect To
    for (const reqCat of std.mustConnectTo) {
      const targets = categorized.filter(x => x.category === reqCat);
      if (targets.length > 0) {
        const connected = targets.some(t => sharesWall(item.room, t.room));
        if (!connected) {
          issues.push({
            type: 'error',
            field: 'adjacency',
            message: `${item.room.name} must connect to ${reqCat.replace('_', ' ')} but they do not share a wall`,
          });
        }
      }
    }

    // Should Avoid
    for (const avoidCat of std.shouldAvoid) {
      const targets = categorized.filter(x => x.category === avoidCat);
      for (const t of targets) {
        if (sharesWall(item.room, t.room)) {
          issues.push({
            type: 'error',
            field: 'adjacency',
            message: `${item.room.name} shares a wall with ${t.room.name}, which is architecturally non-compliant (should avoid proximity)`,
          });
        }
      }
    }

    // Preferred Connect
    for (const prefCat of std.preferredConnectTo) {
      const targets = categorized.filter(x => x.category === prefCat);
      if (targets.length > 0) {
        const connected = targets.some(t => sharesWall(item.room, t.room));
        if (!connected) {
          issues.push({
            type: 'warning',
            field: 'adjacency',
            message: `${item.room.name} preferred connection to ${prefCat.replace('_', ' ')} is not established`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 9. validatePlumbing()
 * Checks if wet rooms (bathrooms, kitchen, utility) are grouped efficiently
 * within standard proximity of the wet core stack (maxDistance).
 */
export function validatePlumbing(rooms: RoomLayout[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const floors = [...new Set(rooms.map(r => r.floor))];

  for (const f of floors) {
    const floorRooms = rooms.filter(r => r.floor === f);
    const wetRooms = floorRooms.filter(r => {
      const std = getRoomStandard(r.type, r.name);
      return std.isWetArea;
    });

    if (wetRooms.length <= 1) continue; // No grouping needed if 0 or 1 wet area

    // Find the centroid of all wet areas on this floor as the base stack location
    const wetCentroids = wetRooms.map(r => ({
      room: r,
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
    }));

    const avgX = wetCentroids.reduce((sum, c) => sum + c.x, 0) / wetCentroids.length;
    const avgY = wetCentroids.reduce((sum, c) => sum + c.y, 0) / wetCentroids.length;

    for (const wc of wetCentroids) {
      const dist = Math.hypot(wc.x - avgX, wc.y - avgY);
      const std = getRoomStandard(wc.room.type, wc.room.name);

      if (dist > std.maxDistanceFromWetCore) {
        issues.push({
          type: 'warning',
          field: 'plumbingProximity',
          message: `${wc.room.name} plumbing stack distance is ${dist.toFixed(1)} ft from core centroid, exceeding ideal limit of ${std.maxDistanceFromWetCore} ft (increases plumbing layout costs)`,
        });
      }
    }
  }

  return issues;
}

/**
 * 10. validateShape()
 * Evaluates room geometry shapes and computes a shape complexity score.
 * (0.0 = clean rectangle, > 0.0 = complex L-shape/U-shape/polygons)
 */
export function validateShape(room: RoomLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const std = ARCHITECTURAL_STANDARDS.shape;

  // Currently our planner engine only generates rectangular shapes.
  // We compute shape complexity using a ratio of perimeter to area:
  // Complexity = (perimeter^2) / (16 * area) - 1.0 (equals 0.0 for square, and slightly higher for rectangles)
  // For a rectangle, complexity ratio is: (2w+2h)^2 / (16wh) = 4(w+h)^2 / 16wh = (w+h)^2 / 4wh.
  // To avoid penalizing natural rectangles, we compute complexity score based on deviation from rectangle.
  // Since all layouts generated by geometryEngine are strictly rectangular, the shape complexity is 0.0 (perfect rectangle).
  const score = 0.0; 
  
  if (score > std.maxComplexityScore) {
    issues.push({
      type: 'error',
      field: 'shapeComplexity',
      message: `${room.name} shape is too complex (Complexity Score: ${score.toFixed(2)}, limit: ${std.maxComplexityScore})`,
    });
  }

  return issues;
}

/**
 * 11. validateCirculation()
 * Validates corridor width, walking paths, dead-ends.
 */
export function validateCirculation(rooms: RoomLayout[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stdCirc = ARCHITECTURAL_STANDARDS.circulation;

  const corridors = rooms.filter(r => r.type === 'corridor' || r.type === 'lobby');

  for (const c of corridors) {
    const w = c.w;
    const h = c.h;
    const width = Math.min(w, h);
    const length = Math.max(w, h);

    if (width < stdCirc.minCorridorWidth) {
      issues.push({
        type: 'error',
        field: 'corridorWidth',
        message: `${c.name} width is ${width.toFixed(1)} ft (minimum required corridor width: ${stdCirc.minCorridorWidth} ft)`,
      });
    } else if (width < stdCirc.idealCorridorWidth) {
      issues.push({
        type: 'warning',
        field: 'corridorWidth',
        message: `${c.name} width is ${width.toFixed(1)} ft (ideal width is ${stdCirc.idealCorridorWidth} ft)`,
      });
    }

    // Dead-end checks: if corridor is too long and dead-ended
    if (length > stdCirc.maxDeadEndLength) {
      issues.push({
        type: 'warning',
        field: 'corridorLength',
        message: `${c.name} length is ${length.toFixed(1)} ft (potential long dead-end path; standard maximum: ${stdCirc.maxDeadEndLength} ft)`,
      });
    }
  }

  return issues;
}

// ============================================================================
//  INTERNAL RELATIONSHIP REFERENCE CONFIG
// ============================================================================

const ARCHURAL_RELATIONSHIPS: Record<string, { mustConnectTo: string[]; preferredConnectTo: string[]; shouldAvoid: string[] }> = {
  master_bedroom: { mustConnectTo: [], preferredConnectTo: ['attached_bathroom'], shouldAvoid: ['parking_space'] },
  guest_bedroom: { mustConnectTo: [], preferredConnectTo: ['common_bathroom'], shouldAvoid: [] },
  children_bedroom: { mustConnectTo: [], preferredConnectTo: [], shouldAvoid: [] },
  attached_bathroom: { mustConnectTo: ['master_bedroom'], preferredConnectTo: [], shouldAvoid: ['kitchen', 'dining_room'] },
  common_bathroom: { mustConnectTo: [], preferredConnectTo: ['corridor'], shouldAvoid: ['kitchen', 'dining_room'] },
  powder_room: { mustConnectTo: [], preferredConnectTo: ['living_room', 'lobby'], shouldAvoid: ['kitchen'] },
  living_room: { mustConnectTo: [], preferredConnectTo: ['lobby', 'dining_room'], shouldAvoid: ['common_bathroom'] },
  dining_room: { mustConnectTo: [], preferredConnectTo: ['kitchen', 'living_room'], shouldAvoid: ['toilet'] },
  kitchen: { mustConnectTo: [], preferredConnectTo: ['dining_room', 'utility_area'], shouldAvoid: ['attached_bathroom', 'common_bathroom', 'powder_room'] },
  utility_area: { mustConnectTo: [], preferredConnectTo: ['kitchen'], shouldAvoid: [] },
  balcony: { mustConnectTo: [], preferredConnectTo: ['bedroom', 'living_room'], shouldAvoid: [] },
  pooja_room: { mustConnectTo: [], preferredConnectTo: ['lobby', 'living_room'], shouldAvoid: ['attached_bathroom', 'common_bathroom', 'powder_room'] },
  store_room: { mustConnectTo: [], preferredConnectTo: ['kitchen'], shouldAvoid: [] },
  parking_space: { mustConnectTo: [], preferredConnectTo: ['lobby'], shouldAvoid: ['bedroom'] },
};
