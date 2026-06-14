import {
  FurnitureLayoutValidator,
  ShapeValidator,
  CirculationValidator,
  PrivacyValidator,
  NaturalLightValidator,
  ServiceCoreValidator,
  StructuralValidator
} from '../src/lib/planner/validationEngine';
import type { RoomLayout } from '../src/types';

console.log('=== ADVANCED ARCHITECTURAL VALIDATORS TEST ===\n');

// Mock layout with specific errors for each of the 7 validators
const mockLayout: RoomLayout[] = [
  {
    id: 'master-1',
    name: 'Master Bedroom',
    type: 'bedroom',
    x: 0, y: 0, w: 24, h: 16, // w = 24 exceeds max structural span (20 ft)
    floor: 0,
    doors: [{ id: 'd-1', side: 'front', offset: 2, width: 3, openDirection: 'in-left' }],
    windows: [{ id: 'w-1', side: 'back', offset: 2, width: 4 }],
    // Overlapping furniture items
    furniture: [
      { id: 'f-bed1', type: 'bed-king', x: 5, y: 5, w: 6.5, h: 6.5, rotation: 0 },
      { id: 'f-bed2', type: 'bed-king', x: 6, y: 6, w: 6.5, h: 6.5, rotation: 0 } // Overlaps f-bed1!
    ]
  },
  {
    id: 'bath-1',
    name: 'Attached Bathroom',
    type: 'toilet',
    x: 14, y: 30, w: 4, h: 12, // adjacent to living-1 (x: 0, y: 30, w: 14)
    floor: 0,
    doors: [{ id: 'd-2', side: 'left', offset: 1, width: 2.5, openDirection: 'in-left' }],
    windows: [], // Missing windows/ventilation
    furniture: []
  },
  {
    id: 'living-1',
    name: 'Living Room',
    type: 'living',
    x: 0, y: 30, w: 14, h: 14,
    floor: 0,
    // Bathroom door opens directly to Living Room (privacy breach)
    doors: [
      { id: 'd-main', side: 'front', offset: 2, width: 3.5, openDirection: 'in-left' },
      { id: 'd-to-bath', side: 'right', offset: 2, width: 2.5, openDirection: 'in-left' }
    ],
    windows: [], // Missing windows
    furniture: []
  },
  {
    id: 'dining-1',
    name: 'Dining Space',
    type: 'dining',
    x: 35, y: 30, w: 6, h: 6, // too small
    floor: 0,
    doors: [], windows: [], furniture: []
  }
];

// 1. FurnitureLayoutValidator
console.log('1. Testing FurnitureLayoutValidator:');
const furnRep = FurnitureLayoutValidator(mockLayout);
console.log(`  Valid: ${furnRep.valid}, Errors: ${furnRep.errors.length}, Warnings: ${furnRep.warnings.length}`);
furnRep.errors.forEach(e => console.log(`    - [ERROR] ${e}`));

// 2. ShapeValidator
console.log('\n2. Testing ShapeValidator:');
const shapeRep = ShapeValidator(mockLayout);
console.log(`  Valid: ${shapeRep.valid}, Errors: ${shapeRep.errors.length}, Warnings: ${shapeRep.warnings.length}`);
shapeRep.warnings.forEach(w => console.log(`    - [WARNING] ${w}`));

// 3. CirculationValidator
console.log('\n3. Testing CirculationValidator:');
const circRep = CirculationValidator(mockLayout);
console.log(`  Valid: ${circRep.valid}, Errors: ${circRep.errors.length}, Warnings: ${circRep.warnings.length}`);
circRep.errors.forEach(e => console.log(`    - [ERROR] ${e}`));

// 4. PrivacyValidator
console.log('\n4. Testing PrivacyValidator:');
const privacyRep = PrivacyValidator(mockLayout);
console.log(`  Valid: ${privacyRep.valid}, Errors: ${privacyRep.errors.length}, Warnings: ${privacyRep.warnings.length}`);
privacyRep.errors.forEach(e => console.log(`    - [ERROR] ${e}`));
privacyRep.warnings.forEach(w => console.log(`    - [WARNING] ${w}`));

// 5. NaturalLightValidator
console.log('\n5. Testing NaturalLightValidator:');
const lightRep = NaturalLightValidator(mockLayout);
console.log(`  Valid: ${lightRep.valid}, Errors: ${lightRep.errors.length}, Warnings: ${lightRep.warnings.length}`);
lightRep.errors.forEach(e => console.log(`    - [ERROR] ${e}`));

// 6. ServiceCoreValidator
console.log('\n6. Testing ServiceCoreValidator:');
const coreRep = ServiceCoreValidator(mockLayout);
console.log(`  Valid: ${coreRep.valid}, Errors: ${coreRep.errors.length}, Warnings: ${coreRep.warnings.length}`);
coreRep.warnings.forEach(w => console.log(`    - [WARNING] ${w}`));

// 7. StructuralValidator
console.log('\n7. Testing StructuralValidator:');
const structRep = StructuralValidator(mockLayout);
console.log(`  Valid: ${structRep.valid}, Errors: ${structRep.errors.length}, Warnings: ${structRep.warnings.length}`);
structRep.errors.forEach(e => console.log(`    - [ERROR] ${e}`));
structRep.warnings.forEach(w => console.log(`    - [WARNING] ${w}`));

console.log('\n=== ADVANCED ARCHITECTURAL VALIDATORS TEST COMPLETED ===');
if (furnRep.errors.length > 0 && privacyRep.errors.length > 0 && lightRep.errors.length > 0 && structRep.errors.length > 0) {
  console.log('✓ ALL TEST PASSED!');
  process.exit(0);
} else {
  console.error('✗ TEST FAILURE: Some expected validation errors were missed!');
  process.exit(1);
}
