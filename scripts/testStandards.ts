import {
  getStandardCategory,
  getRoomStandard,
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
} from '../src/lib/planner/architecturalStandards';
import type { RoomLayout, DoorConfig, WindowConfig } from '../src/types';

console.log('=== ARCHITECTURAL STANDARDS TEST SUITE ===\n');

// 1. Lookup Category Mapping Tests
console.log('1. Category Lookup Tests:');
const mappings = [
  { type: 'bedroom', name: 'Master Bedroom', expected: 'master_bedroom' },
  { type: 'bedroom', name: 'Guest Bedroom', expected: 'guest_bedroom' },
  { type: 'bedroom', name: 'Children Room', expected: 'children_bedroom' },
  { type: 'toilet', name: 'Master Bath', expected: 'attached_bathroom' },
  { type: 'toilet', name: 'Common Toilet', expected: 'common_bathroom' },
  { type: 'toilet', name: 'Guest Powder Room', expected: 'powder_room' },
  { type: 'living', name: 'Family Lounge', expected: 'living_room' },
  { type: 'dining', name: 'Dining Space', expected: 'dining_room' },
  { type: 'kitchen', name: 'Modular Kitchen', expected: 'kitchen' },
  { type: 'corridor', name: 'Passage Store', expected: 'store_room' },
  { type: 'parking', name: 'Parking Portico', expected: 'parking_space' },
];

let lookupPassed = true;
for (const m of mappings) {
  const cat = getStandardCategory(m.type, m.name);
  if (cat !== m.expected) {
    console.error(`  ✗ FAIL: type="${m.type}" name="${m.name}" -> got "${cat}", expected "${m.expected}"`);
    lookupPassed = false;
  } else {
    console.log(`  ✓ PASS: type="${m.type}" name="${m.name}" -> mapped to "${cat}"`);
  }
}

// 2. Room Dimension & Furniture Fit Tests
console.log('\n2. Room Dimension & Furniture Fit Tests:');

// Test Case A: Valid Master Bedroom (14x16 ft)
const validMaster: RoomLayout = {
  id: 'master-1',
  name: 'Master Bedroom',
  type: 'bedroom',
  x: 0, y: 0, w: 14, h: 16,
  floor: 0,
  doors: [{ id: 'd-1', side: 'front', offset: 1, width: 3, openDirection: 'in-left' }],
  windows: [{ id: 'w-1', side: 'back', offset: 2, width: 5 }],
  furniture: []
};

const validMasterIssues = validateRoom(validMaster).concat(validateFurnitureFit(validMaster));
if (validMasterIssues.length === 0) {
  console.log('  ✓ PASS: Valid 14x16 Master Bedroom has 0 issues.');
} else {
  console.error('  ✗ FAIL: Valid Master Bedroom generated issues:', validMasterIssues);
}

// Test Case B: Too Cramped Master Bedroom (9x10 ft)
const crampedMaster: RoomLayout = {
  id: 'master-2',
  name: 'Master Bedroom',
  type: 'bedroom',
  x: 0, y: 0, w: 9, h: 10,
  floor: 0,
  doors: [{ id: 'd-1', side: 'front', offset: 1, width: 3, openDirection: 'in-left' }],
  windows: [{ id: 'w-1', side: 'back', offset: 2, width: 4 }],
  furniture: []
};

const crampedMasterIssues = validateRoom(crampedMaster).concat(validateFurnitureFit(crampedMaster));
const hasCrampedErrors = crampedMasterIssues.some(i => i.field === 'furnitureFit' || i.field === 'width' || i.field === 'length');
if (hasCrampedErrors) {
  console.log('  ✓ PASS: Cramped 9x10 Master Bedroom correctly flagged with dimension/furniture errors.');
  crampedMasterIssues.forEach(i => console.log(`    - [${i.type.toUpperCase()}] ${i.field}: ${i.message}`));
} else {
  console.error('  ✗ FAIL: Cramped Master Bedroom missed expected errors. Issues found:', crampedMasterIssues);
}

// Test Case C: Arbitrary/Unrealistic Bathroom (18x2.14 ft)
console.log('\n3. Unrealistic Bathroom Test (18x2.14 ft):');
const unrealisticBath: RoomLayout = {
  id: 'bath-1',
  name: 'Common Toilet',
  type: 'toilet',
  x: 0, y: 0, w: 2.14, h: 18,
  floor: 0,
  doors: [{ id: 'd-2', side: 'left', offset: 1, width: 2.5, openDirection: 'in-left' }],
  windows: [{ id: 'w-2', side: 'right', offset: 1, width: 2.0 }],
  furniture: []
};

const bathIssues = validateRoom(unrealisticBath).concat(validateFurnitureFit(unrealisticBath));
const hasAspectError = bathIssues.some(i => i.field === 'aspectRatio');
const hasWidthError = bathIssues.some(i => i.field === 'width');
const hasFurnitureFitError = bathIssues.some(i => i.field === 'furnitureFit');

if (hasAspectError && hasWidthError && hasFurnitureFitError) {
  console.log('  ✓ PASS: 18x2.14 ft Bathroom correctly flagged with aspectRatio, width, and furnitureFit errors!');
  bathIssues.forEach(i => console.log(`    - [${i.type.toUpperCase()}] ${i.field}: ${i.message}`));
} else {
  console.error('  ✗ FAIL: Unrealistic Bathroom was not fully flagged. Issues found:', bathIssues);
}

// 4. Ventilation & Window tests
console.log('\n4. Ventilation Tests:');
const darkKitchen: RoomLayout = {
  id: 'kitchen-1',
  name: 'Modular Kitchen',
  type: 'kitchen',
  x: 0, y: 0, w: 10, h: 10,
  floor: 0,
  doors: [],
  windows: [], // NO WINDOWS
  furniture: []
};
const kitchenVentIssues = validateVentilation(darkKitchen).concat(validateRoom(darkKitchen));
const hasVentError = kitchenVentIssues.some(i => i.field === 'ventilation');
if (hasVentError) {
  console.log('  ✓ PASS: Windowless Kitchen correctly flagged with ventilation/external-wall errors.');
  kitchenVentIssues.forEach(i => console.log(`    - [${i.type.toUpperCase()}] ${i.field}: ${i.message}`));
} else {
  console.error('  ✗ FAIL: Dark kitchen missed ventilation errors:', kitchenVentIssues);
}

// 5. Staircase Test
console.log('\n5. Staircase Landing & Flight Width Tests:');
const narrowStaircase: RoomLayout = {
  id: 'stair-1',
  name: 'Staircase',
  type: 'staircase',
  x: 0, y: 0, w: 5, h: 10, // too narrow
  floor: 0,
  doors: [],
  windows: [],
  furniture: []
};
const stairIssues = validateStairs(narrowStaircase);
if (stairIssues.length > 0) {
  console.log('  ✓ PASS: Narrow staircase room correctly flagged with errors.');
  stairIssues.forEach(i => console.log(`    - [${i.type.toUpperCase()}] ${i.field}: ${i.message}`));
} else {
  console.error('  ✗ FAIL: Narrow staircase room did not trigger errors.');
}

// 6. Plumbing Proximity Tests
console.log('\n6. Plumbing Core Proximity Tests:');
const scatteredWetRooms: RoomLayout[] = [
  {
    id: 'toilet-1',
    name: 'Toilet A',
    type: 'toilet',
    x: 0, y: 0, w: 6, h: 6, // NW
    floor: 0,
    doors: [], windows: [], furniture: []
  },
  {
    id: 'toilet-2',
    name: 'Toilet B',
    type: 'toilet',
    x: 35, y: 35, w: 6, h: 6, // SE (very far!)
    floor: 0,
    doors: [], windows: [], furniture: []
  }
];

const plumbingIssues = validatePlumbing(scatteredWetRooms);
if (plumbingIssues.length > 0) {
  console.log('  ✓ PASS: Scattered toilets correctly flagged with plumbing proximity warning.');
  plumbingIssues.forEach(i => console.log(`    - [${i.type.toUpperCase()}] ${i.field}: ${i.message}`));
} else {
  console.error('  ✗ FAIL: Scattered toilets did not trigger plumbing proximity warnings.');
}

console.log('\n=== TEST SUITE COMPLETED ===');
