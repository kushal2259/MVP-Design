import type { Room, FloorPlan, ProjectRequirements, SpaceAllocation } from '@/types';

export const ROOM_COLORS: Record<string, string> = {
  living: '#dbeafe',
  dining: '#e0f2fe',
  kitchen: '#fef9c3',
  bedroom: '#f3e8ff',
  bathroom: '#dcfce7',
  balcony: '#d1fae5',
  study: '#fce7f3',
  garage: '#f1f5f9',
  utility: '#f0fdf4',
  pooja: '#fff7ed',
  terrace: '#ecfdf5',
  staircase: '#f8fafc',
  corridor: '#f8fafc',
  store: '#fafafa',
  'walk-in': '#fdf4ff',
};

export function generateFloorPlans(req: ProjectRequirements): FloorPlan[] {
  const plans: FloorPlan[] = [];
  const usableWidth = req.plotWidth - 6;   // 3ft side setbacks
  const usableDepth = req.plotDepth - 15;  // 10ft front + 5ft rear setbacks
  const gW = Math.max(4, Math.floor(usableWidth / 5));
  const gD = Math.max(4, Math.floor(usableDepth / 5));

  for (let floor = 0; floor < req.floors; floor++) {
    const rooms = generateRoomsForFloor(floor, req, gW, gD);
    const totalArea = rooms.reduce((s, r) => s + r.area, 0);
    plans.push({ floor, rooms, totalArea, builtUpArea: gW * gD * 25, furniture: [] });
  }
  return plans;
}

function makeGrid(gW: number, gD: number): boolean[][] {
  return Array.from({ length: gD }, () => new Array(gW).fill(false));
}

function tryPlace(
  grid: boolean[][],
  x: number, y: number, w: number, h: number
): boolean {
  const gD = grid.length, gW = grid[0].length;
  if (x < 0 || y < 0 || x + w > gW || y + h > gD) return false;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      if (grid[y + dy][x + dx]) return false;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      grid[y + dy][x + dx] = true;
  return true;
}

function generateRoomsForFloor(
  floor: number,
  req: ProjectRequirements,
  gW: number,
  gD: number
): Room[] {
  const grid = makeGrid(gW, gD);
  const rooms: Room[] = [];
  let id = 0;

  const addRoom = (
    name: string,
    type: Room['type'],
    x: number, y: number, w: number, h: number
  ): boolean => {
    w = Math.min(w, gW - x);
    h = Math.min(h, gD - y);
    if (w <= 0 || h <= 0) return false;
    if (!tryPlace(grid, x, y, w, h)) return false;
    const noWindows = ['staircase', 'corridor', 'garage', 'utility', 'store'].includes(type);
    rooms.push({
      id: `f${floor}_r${id++}`, name, type, floor,
      area: w * h * 25, x, y, width: w, height: h,
      color: ROOM_COLORS[type] || '#f5f5f5',
      windows: noWindows ? 0 : type === 'bathroom' ? 1 : 2,
      doors: 1,
    });
    return true;
  };

  if (floor === 0) {
    generateGroundFloor(req, gW, gD, addRoom);
  } else if (floor < req.floors - 1 || req.floors === 2) {
    generateUpperFloor(floor, req, gW, gD, addRoom);
  } else {
    generateTerraceFloor(req, gW, gD, addRoom);
  }

  return rooms;
}

function generateGroundFloor(
  req: ProjectRequirements,
  gW: number, gD: number,
  add: (name: string, type: Room['type'], x: number, y: number, w: number, h: number) => boolean
) {
  const stW = 2;
  const stH = Math.min(Math.max(2, Math.floor(gD * 0.40)), Math.floor(gD * 0.55));
  const frontH = Math.min(2, Math.floor(gD * 0.28));
  const parkW = Math.min(Math.max(2, Math.floor(gW * 0.35)), 4);

  // RIGHT COLUMN: Staircase (fixed position, far right)
  add('Staircase', 'staircase', gW - stW, 0, stW, stH);

  // FRONT STRIP: Parking + Entry
  add('Parking', 'garage', 0, 0, parkW, frontH);
  const entryW = gW - parkW - stW;
  if (entryW > 0) add('Entry Hall', 'corridor', parkW, 0, entryW, frontH);

  // LIVING ROOM: below front strip, spans most of width
  const livingH = Math.max(3, Math.min(Math.floor(gD * 0.40), gD - frontH - 3));
  add('Living Room', 'living', 0, frontH, gW - stW, livingH);

  // POOJA: fills gap beside staircase (between stair end and living end)
  const poojaStartY = stH;
  const poojaH = (frontH + livingH) - stH;
  if (poojaH > 1) add('Pooja Room', 'pooja', gW - stW, poojaStartY, stW, poojaH);

  // MIDDLE BAND: Dining + Bathroom + optional Guest Bedroom
  const midY = frontH + livingH;
  const midH = Math.max(2, Math.min(Math.floor(gD * 0.24), gD - midY - 2));
  const diningW = Math.min(Math.floor(gW * 0.52), gW - 4);

  add('Dining Room', 'dining', 0, midY, diningW, midH);
  add('Bathroom', 'bathroom', diningW, midY, Math.min(2, gW - diningW), midH);

  if (req.bhk >= 3) {
    const guestX = diningW + 2;
    const guestW = gW - guestX;
    if (guestW >= 2) add('Guest Bedroom', 'bedroom', guestX, midY, guestW, midH);
  } else if (gW - diningW - 2 >= 2) {
    add('Utility', 'utility', diningW + 2, midY, gW - diningW - 2, midH);
  }

  // REAR BAND: Kitchen + Utility/Store
  const kitY = midY + midH;
  const kitH = gD - kitY;
  if (kitH > 0) {
    const kitW = Math.floor(gW * 0.56);
    add('Kitchen', 'kitchen', 0, kitY, kitW, kitH);
    const restW = gW - kitW;
    if (restW >= 2) add('Utility', 'utility', kitW, kitY, restW, kitH);
  }

  // FRONT BALCONY / VERANDAH
  if (frontH === 0 && gD >= 7) {
    add('Front Verandah', 'balcony', parkW, gD - 1, gW - parkW - stW, 1);
  }
}

function generateUpperFloor(
  floor: number,
  req: ProjectRequirements,
  gW: number, gD: number,
  add: (name: string, type: Room['type'], x: number, y: number, w: number, h: number) => boolean
) {
  const stW = 2;
  const stH = Math.min(Math.max(2, Math.floor(gD * 0.38)), 4);

  // STAIRCASE (same right-column position)
  add('Staircase', 'staircase', gW - stW, 0, stW, stH);

  // FRONT ZONE: Master Bedroom (front half, most of width)
  const frontH = Math.max(3, Math.min(Math.floor(gD * 0.44), gD - 4));
  const mbW = Math.min(Math.max(3, Math.floor(gW * 0.56)), gW - stW);
  add('Master Bedroom', 'bedroom', 0, 0, mbW, frontH);

  // MASTER BATH (attached to master, beside it)
  const mbathW = Math.min(2, gW - mbW - stW);
  if (mbathW >= 1) add('Master Bath', 'bathroom', mbW, 0, mbathW, Math.min(3, frontH));

  // WALK-IN CLOSET (if large enough plot and budget)
  if (mbathW < gW - mbW - stW - 1 && req.budget > 50) {
    const wcW = gW - mbW - mbathW - stW;
    if (wcW >= 1) add('Walk-in Closet', 'study', mbW + mbathW, 0, wcW, Math.min(2, frontH));
  }

  // MASTER BALCONY
  add('Master Balcony', 'balcony', 0, frontH, Math.min(4, mbW), 1);

  // CORRIDOR (connects rooms)
  const corrY = frontH + 1;
  const corrH = 1;
  add('Corridor', 'corridor', 0, corrY, gW - stW, corrH);

  // Staircase landing extension fills remaining right column in front zone
  const stLandY = stH;
  const stLandH = corrY + corrH - stH;
  if (stLandH > 0) add('Staircase', 'staircase', gW - stW, stLandY, stW, stLandH);

  // REAR ZONE: bedrooms
  const rearY = corrY + corrH;
  const rearH = gD - rearY;

  if (rearH > 0) {
    if (req.bhk <= 2) {
      // Single bedroom at rear
      add('Bedroom 2', 'bedroom', 0, rearY, Math.floor(gW * 0.55), rearH);
      add('Bathroom 2', 'bathroom', Math.floor(gW * 0.55), rearY, 2, Math.min(2, rearH));
      add('Study', 'study', Math.floor(gW * 0.55) + 2, rearY, gW - Math.floor(gW * 0.55) - 2, rearH);
    } else if (req.bhk === 3) {
      const b2W = Math.floor(gW * 0.5);
      add('Bedroom 2', 'bedroom', 0, rearY, b2W, rearH);
      add('Bedroom 3', 'bedroom', b2W, rearY, gW - b2W - stW, rearH);
      add('Bathroom 2', 'bathroom', gW - stW - 2, rearY, 2, Math.min(2, rearH));
    } else {
      // BHK 4+
      const bW = Math.floor((gW - stW) / 3);
      add('Bedroom 2', 'bedroom', 0, rearY, bW, rearH);
      add('Bedroom 3', 'bedroom', bW, rearY, bW, rearH);
      add('Bedroom 4', 'bedroom', bW * 2, rearY, gW - bW * 2 - stW, rearH);
      add('Bathroom 2', 'bathroom', gW - stW - 2, rearY, 2, Math.min(2, rearH));
    }

    // Rear balcony
    add('Rear Balcony', 'balcony', gW - stW - 3, gD - 1, 3, 1);
  }
}

function generateTerraceFloor(
  req: ProjectRequirements,
  gW: number, gD: number,
  add: (name: string, type: Room['type'], x: number, y: number, w: number, h: number) => boolean
) {
  add('Staircase Cover', 'staircase', gW - 2, 0, 2, 3);
  add('Servant Room', 'store', 0, 0, 3, 3);
  add('Terrace Open Area', 'terrace', 3, 0, gW - 5, gD);
  add('Overhead Tank Room', 'utility', gW - 5, 0, 3, 3);
  add('Garden / Green Zone', 'balcony', 0, 3, gW - 2, gD - 3);
}

export function calculateSpaceAllocation(plans: FloorPlan[]): SpaceAllocation[] {
  const totals: Record<string, number> = {};
  let grand = 0;
  for (const plan of plans) {
    for (const room of plan.rooms) {
      totals[room.name] = (totals[room.name] || 0) + room.area;
      grand += room.area;
    }
  }
  return Object.entries(totals)
    .map(([room, area]) => ({
      room, area,
      percentage: Math.round((area / grand) * 100),
      floor: plans.find(p => p.rooms.find(r => r.name === room))?.floor ?? 0,
    }))
    .sort((a, b) => b.area - a.area);
}

export function generateCostEstimate(req: ProjectRequirements, plans: FloorPlan[]) {
  const builtUp = plans.reduce((s, p) => s + p.builtUpArea, 0);
  const metro = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'kolkata'];
  const isMetro = metro.some(c => req.location.toLowerCase().includes(c));
  const rateEconomy = isMetro ? 1900 : 1450;
  const rateStandard = rateEconomy * 1.38;
  const ratePremium = rateEconomy * 1.9;
  const base = (rate: number) => Math.round((builtUp * rate) / 100000);
  return {
    economy: base(rateEconomy),
    standard: base(rateStandard),
    premium: base(ratePremium),
    breakdown: {
      structure: Math.round(base(rateStandard) * 0.45),
      finishing: Math.round(base(rateStandard) * 0.20),
      electrical: Math.round(base(rateStandard) * 0.08),
      plumbing: Math.round(base(rateStandard) * 0.07),
      interiors: Math.round(base(rateStandard) * 0.20),
    },
    builtUp,
  };
}

export function generateBOQ(builtUp: number) {
  return [
    { material: 'Cement (OPC 53 Grade)', unit: 'Bags', quantity: Math.round(builtUp * 0.4), rateEconomy: 350, rateStandard: 380, ratePremium: 420 },
    { material: 'Steel (Fe500D TMT)', unit: 'MT', quantity: Math.round(builtUp * 0.004), rateEconomy: 58000, rateStandard: 62000, ratePremium: 68000 },
    { material: 'River Sand (M-sand)', unit: 'CFT', quantity: Math.round(builtUp * 0.8), rateEconomy: 55, rateStandard: 60, ratePremium: 65 },
    { material: 'Aggregate (20mm)', unit: 'CFT', quantity: Math.round(builtUp * 0.6), rateEconomy: 48, rateStandard: 52, ratePremium: 58 },
    { material: 'Bricks (Wire Cut)', unit: 'Nos', quantity: Math.round(builtUp * 8), rateEconomy: 7, rateStandard: 9, ratePremium: 12 },
    { material: 'Floor Tiles', unit: 'Sqft', quantity: Math.round(builtUp * 0.85), rateEconomy: 55, rateStandard: 95, ratePremium: 185 },
    { material: 'Wall Tiles (Bathrooms)', unit: 'Sqft', quantity: Math.round(builtUp * 0.15), rateEconomy: 60, rateStandard: 110, ratePremium: 220 },
    { material: 'Exterior Paint', unit: 'Ltr', quantity: Math.round(builtUp * 0.08), rateEconomy: 180, rateStandard: 280, ratePremium: 420 },
    { material: 'Interior Paint', unit: 'Ltr', quantity: Math.round(builtUp * 0.15), rateEconomy: 150, rateStandard: 250, ratePremium: 380 },
    { material: 'Doors (Main + Rooms)', unit: 'Nos', quantity: Math.round(builtUp / 200), rateEconomy: 8000, rateStandard: 18000, ratePremium: 45000 },
    { material: 'Windows (UPVC)', unit: 'Nos', quantity: Math.round(builtUp / 120), rateEconomy: 7000, rateStandard: 14000, ratePremium: 28000 },
    { material: 'Electrical Wiring (Copper)', unit: 'Rmt', quantity: Math.round(builtUp * 2.5), rateEconomy: 45, rateStandard: 65, ratePremium: 95 },
    { material: 'Plumbing (CPVC)', unit: 'Rmt', quantity: Math.round(builtUp * 1.2), rateEconomy: 120, rateStandard: 185, ratePremium: 260 },
    { material: 'Waterproofing', unit: 'Sqft', quantity: Math.round(builtUp * 0.3), rateEconomy: 35, rateStandard: 55, ratePremium: 90 },
  ];
}

export function generateTimeline(floors: number) {
  const phases = [
    { phase: 'Site Preparation & Excavation', duration: '2 weeks', startWeek: 1, endWeek: 2, tasks: ['Site clearing', 'Layout marking', 'Excavation', 'Soil testing'] },
    { phase: 'Foundation Work', duration: '3 weeks', startWeek: 3, endWeek: 5, tasks: ['PCC layer', 'Footing concrete', 'Column stubs', 'Plinth beam'] },
    { phase: 'Plinth & Ground Floor Structure', duration: '4 weeks', startWeek: 6, endWeek: 9, tasks: ['Columns (GF)', 'Slab formwork', 'Reinforcement', 'Concrete pour', 'Brick masonry'] },
    ...(floors > 1 ? [{ phase: 'First Floor Structure', duration: '4 weeks', startWeek: 10, endWeek: 13, tasks: ['1st floor columns', 'Slab work', 'Masonry', 'Staircase'] }] : []),
    ...(floors > 2 ? [{ phase: 'Second Floor & Terrace', duration: '3 weeks', startWeek: 14, endWeek: 16, tasks: ['2nd floor slab', 'Terrace slab', 'Parapet wall'] }] : []),
    { phase: 'Roof & Waterproofing', duration: '2 weeks', startWeek: floors > 1 ? 14 : 10, endWeek: floors > 1 ? 15 : 11, tasks: ['Roof slab', 'Waterproofing membrane', 'Brick-bat coba', 'Terrace tiles'] },
    { phase: 'Plastering & Masonry', duration: '4 weeks', startWeek: floors > 1 ? 16 : 12, endWeek: floors > 1 ? 19 : 15, tasks: ['Internal plaster', 'External plaster', 'Door/window frames', 'Chasing for MEP'] },
    { phase: 'MEP Rough-in', duration: '3 weeks', startWeek: floors > 1 ? 20 : 16, endWeek: floors > 1 ? 22 : 18, tasks: ['Electrical conduits', 'Plumbing lines', 'AC sleeves', 'CCTV/data points'] },
    { phase: 'Flooring & Wall Tiling', duration: '3 weeks', startWeek: floors > 1 ? 23 : 19, endWeek: floors > 1 ? 25 : 21, tasks: ['Floor tiles', 'Bathroom tiles', 'Kitchen tiles', 'Granite/marble work'] },
    { phase: 'Painting & Finishing', duration: '3 weeks', startWeek: floors > 1 ? 26 : 22, endWeek: floors > 1 ? 28 : 24, tasks: ['Primer coat', 'Interior painting', 'Exterior texture', 'Wood polish'] },
    { phase: 'MEP Finishing & Fixtures', duration: '2 weeks', startWeek: floors > 1 ? 29 : 25, endWeek: floors > 1 ? 30 : 26, tasks: ['Electrical fixtures', 'Sanitary ware', 'AC installation', 'Switch plates'] },
    { phase: 'Interior Work & Handover', duration: '2 weeks', startWeek: floors > 1 ? 31 : 27, endWeek: floors > 1 ? 32 : 28, tasks: ['Modular kitchen', 'Wardrobes', 'Main door', 'Final inspection', 'Handover'] },
  ];
  return phases;
}
