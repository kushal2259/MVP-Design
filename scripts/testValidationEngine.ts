import { validateLayout } from '../src/lib/planner/validationEngine';
import type { RoomLayout } from '../src/types';

console.log('=== ARCHITECTURAL VALIDATION ENGINE TEST ===\n');

// 1. Setup a heavily invalid layout to test failures
const invalidLayout: RoomLayout[] = [
  // Bedroom count is only 2 bedrooms, but brief asks for 4 BHK
  {
    id: 'master-1',
    name: 'Master Bedroom',
    type: 'bedroom',
    x: 0, y: 0, w: 14, h: 16, // Valid dimensions
    floor: 0,
    doors: [{ id: 'd-m1', side: 'front', offset: 2, width: 3, openDirection: 'in-left' }],
    windows: [{ id: 'w-m1', side: 'back', offset: 2, width: 4 }],
    // Furniture item overlapping the door clearance (door side: front (bottom), y clearance: 13..16)
    // Furniture is placed at x=3, y=14, w=4, h=4 -> overlaps y=12..16, x=1..5 -> overlaps door offset 2 width 3!
    furniture: [{ id: 'bed-1', type: 'bed-king', x: 3, y: 14, w: 4, h: 4, rotation: 0 }]
  },
  {
    id: 'bed-f1-1',
    name: 'Bedroom 2',
    type: 'bedroom',
    x: 0, y: 20, w: 12, h: 12, // Valid
    floor: 0,
    doors: [{ id: 'd-b1', side: 'front', offset: 1, width: 3, openDirection: 'in-left' }],
    windows: [{ id: 'w-b1', side: 'back', offset: 2, width: 4 }],
    furniture: []
  },
  // Bathroom check: Attached Bathroom not connected to Master Bedroom (different coordinate/floors or far away)
  {
    id: 'bath-1',
    name: 'Attached Bathroom',
    type: 'toilet',
    x: 35, y: 0, w: 6, h: 8, // Far from Master (x=0, y=0)
    floor: 0,
    doors: [{ id: 'd-ba1', side: 'front', offset: 1, width: 2.5, openDirection: 'in-left' }],
    windows: [], // Missing ventilation window!
    furniture: []
  },
  // Kitchen and Dining: Not connected
  {
    id: 'kitchen-1',
    name: 'Kitchen',
    type: 'kitchen',
    x: 50, y: 50, w: 10, h: 12,
    floor: 0,
    doors: [],
    windows: [], // Windowless kitchen!
    furniture: []
  },
  {
    id: 'dining-1',
    name: 'Dining',
    type: 'dining',
    x: 0, y: 50, w: 10, h: 12, // Far from kitchen
    floor: 0,
    doors: [], windows: [], furniture: []
  },
  // Accessibility corridor dead end check
  {
    id: 'corridor-1',
    name: 'Corridor',
    type: 'corridor',
    x: 0, y: 35, w: 2.5, h: 20, // narrow corridor (<3ft) and dead end (>15ft)
    floor: 0,
    doors: [], windows: [], furniture: []
  }
];

console.log('Testing Invalid Layout (Brief: 4 BHK):');
const reportInvalid = validateLayout(invalidLayout, 4, 1);
console.log(`  Report Valid: ${reportInvalid.valid}`);
console.log(`  Errors Count: ${reportInvalid.errors.length}`);
console.log(`  Warnings Count: ${reportInvalid.warnings.length}`);

console.log('\n  Expected Errors Found:');
reportInvalid.errors.forEach(err => console.log(`    - ${err}`));

console.log('\n  Expected Warnings Found:');
reportInvalid.warnings.forEach(warn => console.log(`    - ${warn}`));

// Assertions
const hasBHKError = reportInvalid.errors.some(e => e.includes('Room Count: Layout has 2 Bedrooms'));
const hasBlockedDoorError = reportInvalid.errors.some(e => e.includes('Accessibility: Door') && e.includes('blocked'));
const hasKitchenDiningError = reportInvalid.errors.some(e => e.includes('Relationships: Kitchen must be adjacent to the Dining area'));
const hasMasterBathError = reportInvalid.errors.some(e => e.includes('Relationships: Master Bedroom must have a directly attached bathroom'));
const hasToiletVentError = reportInvalid.errors.some(e => e.includes('Ventilation: Bathroom') && e.includes('missing a ventilator'));
const hasKitchenVentError = reportInvalid.errors.some(e => e.includes('Ventilation: Habitable room') && e.includes('no exterior window'));

if (hasBHKError && hasBlockedDoorError && hasKitchenDiningError && hasMasterBathError && hasToiletVentError && hasKitchenVentError) {
  console.log('\n  ✓ SUCCESS: All critical architectural errors correctly detected!');
} else {
  console.error('\n  ✗ FAILURE: One or more validation checks failed to register properly.');
  process.exit(1);
}

console.log('\n=== VALIDATION ENGINE TEST COMPLETED ===');
