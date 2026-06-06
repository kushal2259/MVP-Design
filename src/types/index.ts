export interface ProjectRequirements {
  plotSize: number;
  plotWidth: number;
  plotDepth: number;
  plotShape: 'rectangular' | 'square' | 'irregular' | 'corner';
  location: string;
  floors: number;
  budget: number;
  style: 'modern' | 'traditional' | 'contemporary' | 'mediterranean' | 'minimalist';
  bhk: number;
  specialRooms: string[];
  requirements: string;
}

export interface Room {
  id: string;
  name: string;
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'dining' | 'balcony' | 'study' | 'garage' | 'utility' | 'pooja' | 'terrace' | 'staircase' | 'corridor' | 'store' | 'walk-in';
  area: number;
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  windows: number;
  doors: number;
}

export interface FurnitureItem {
  id: string;
  catalogId: string;
  name: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floor: number;
  rotation?: number;
  color?: string;
}

export interface FloorPlan {
  floor: number;
  rooms: Room[];
  totalArea: number;
  builtUpArea: number;
  furniture?: FurnitureItem[];
}

export interface SpaceAllocation {
  room: string;
  area: number;
  percentage: number;
  floor: number;
}

export interface CostEstimate {
  economy: number;
  standard: number;
  premium: number;
  builtUp?: number;
  breakdown: {
    structure: number;
    finishing: number;
    electrical: number;
    plumbing: number;
    interiors: number;
  };
}

export interface BOQItem {
  material: string;
  unit: string;
  quantity: number;
  rateEconomy: number;
  rateStandard: number;
  ratePremium: number;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  startWeek: number;
  endWeek: number;
  tasks: string[];
}

export interface Project {
  id: string;
  name: string;
  requirements: ProjectRequirements;
  status: 'requirements' | 'analyzing' | 'planning' | 'generated' | 'reviewing';
  createdAt: string;
  analysis?: {
    parsedRequirements: Record<string, string | number>;
    validationNotes: string[];
    spaceAllocation: SpaceAllocation[];
  };
  floorPlans?: FloorPlan[];
  costEstimate?: CostEstimate;
  boq?: BOQItem[];
  timeline?: TimelinePhase[];
  complianceNotes?: string[];
  designNotes?: string;
  layoutOptions?: LayoutOption[];
  selectedLayoutId?: 'option-a' | 'option-b' | 'option-c';
  plotSettings?: PlotSettings;
  interiorConcepts?: {
    room: string;
    concept: string;
    materials: string[];
    colorPalette: string[];
    furniturePlan?: string;
    lightingConcept?: string;
  }[];
}

// ── MVP Architect types (RoomLayout uses actual feet, not 5ft grid units) ──

export interface WindowConfig {
  id: string;
  side: 'front' | 'back' | 'left' | 'right';
  offset: number;
  width: number;
}

export interface DoorConfig {
  id: string;
  side: 'front' | 'back' | 'left' | 'right';
  offset: number;
  width: number;
  openDirection: 'in-left' | 'in-right' | 'out-left' | 'out-right';
}

export interface FurnitureConfig {
  id: string;
  type: 'sofa' | 'sofa-sectional' | 'sofa-3seater' | 'armchair' | 'coffee-table' | 'tv-unit' | 'bookshelf' | 'fireplace'
    | 'bed' | 'bed-king' | 'bed-queen' | 'bed-single' | 'nightstand' | 'wardrobe' | 'wardrobe-sliding' | 'wardrobe-hinged' | 'dresser' | 'study-desk'
    | 'kitchen-counter' | 'kitchen-island' | 'kitchen-counter-l' | 'kitchen-counter-straight' | 'dining-table' | 'dining-table-4seater' | 'dining-table-6seater' | 'refrigerator' | 'microwave-oven'
    | 'wc' | 'basin' | 'basin-single' | 'basin-double' | 'bathtub' | 'shower' | 'shower-enclosure'
    | 'car' | 'car-sedan' | 'car-suv' | 'bike-motorcycle' | 'plant' | 'plant-potted' | 'plant-fiddle' | 'washing-machine' | 'office-chair' | 'piano' | 'pool-table' | 'gym-treadmill' | 'dining-chair' | 'chair'
    | 'bunk-bed' | 'bed-canopy' | 'crib' | 'jacuzzi' | 'bbq-grill' | 'outdoor-umbrella' | 'gaming-desk' | 'gaming-chair' | 'aquarium' | 'bar-counter' | 'bar-stool' | 'credenza' | 'vanity-makeup' | 'gym-bench' | 'gym-rack' | 'laundry-hamper' | 'pet-bed' | 'sun-lounger' | 'recliner' | 'beanbag' | 'accent-chair' | 'indoor-swing' | 'bidet' | 'conference-table';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface RoomLayout {
  id: string;
  name: string;
  type: 'living' | 'kitchen' | 'bedroom' | 'toilet' | 'balcony' | 'staircase' | 'corridor' | 'dining' | 'lobby' | 'parking' | 'garden';
  x: number;
  y: number;
  w: number;
  h: number;
  floor: number;
  isLocked?: boolean;
  color?: string;
  windows: WindowConfig[];
  doors: DoorConfig[];
  furniture: FurnitureConfig[];
}

export interface PlotSettings {
  width: number;
  depth: number;
  location: string;
  floors: number;
  style: 'modern' | 'contemporary' | 'traditional' | 'luxury';
  budgetLakhs: number;
  bedrooms: number;
  kitchenStyle: 'large' | 'compact' | 'open';
  balconyRequired: boolean;
  customOverrides?: { type: 'add-door' | 'add-window' | 'resize-room' | 'rename-room'; roomId: string; side?: 'front' | 'back' | 'left' | 'right'; offset?: number; width?: number; targetRoomId?: string }[];
}

export interface LayoutOption {
  id: 'option-a' | 'option-b' | 'option-c';
  name: string;
  tagline: string;
  description: string;
  rooms: RoomLayout[];
  costMultiplier: number;
}

export type ActiveTab =
  | 'overview'
  | 'floor-plans'
  | 'cad-editor'
  | '3d-view'
  | 'elevations'
  | 'interior'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'cost'
  | 'boq'
  | 'timeline'
  | 'compliance'
  | 'export';
