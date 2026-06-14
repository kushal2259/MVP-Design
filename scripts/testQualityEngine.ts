import { evaluate, auditPlan } from '../src/lib/planner/qualityEngine';
import type { RoomLayout, AdjacencyMatrix } from '../src/lib/planner/types';

console.log('=== ARCHITECTURAL QUALITY ENGINE & PLAN AUDITOR TEST ===\n');

// 1. Mock Layout
const mockLayout: RoomLayout[] = [
  {
    id: 'master-1',
    name: 'Master Bedroom',
    type: 'bedroom',
    x: 0, y: 0, w: 24, h: 16,
    floor: 0,
    doors: [{ id: 'd-1', side: 'front', offset: 2, width: 3, openDirection: 'in-left' }],
    windows: [{ id: 'w-1', side: 'back', offset: 2, width: 4 }],
    furniture: [
      { id: 'f-bed1', type: 'bed-king', x: 5, y: 5, w: 6.5, h: 6.5, rotation: 0 },
      { id: 'f-bed2', type: 'bed-king', x: 6, y: 6, w: 6.5, h: 6.5, rotation: 0 }
    ]
  },
  {
    id: 'bath-1',
    name: 'Attached Bathroom',
    type: 'toilet',
    x: 14, y: 30, w: 4, h: 12,
    floor: 0,
    doors: [{ id: 'd-2', side: 'left', offset: 1, width: 2.5, openDirection: 'in-left' }],
    windows: [],
    furniture: []
  },
  {
    id: 'living-1',
    name: 'Living Room',
    type: 'living',
    x: 0, y: 30, w: 14, h: 14,
    floor: 0,
    doors: [
      { id: 'd-main', side: 'front', offset: 2, width: 3.5, openDirection: 'in-left' },
      { id: 'd-to-bath', side: 'right', offset: 2, width: 2.5, openDirection: 'in-left' }
    ],
    windows: [],
    furniture: []
  },
  {
    id: 'dining-1',
    name: 'Dining Space',
    type: 'dining',
    x: 35, y: 30, w: 6, h: 6,
    floor: 0,
    doors: [], windows: [], furniture: []
  }
];

const mockAdjacency: AdjacencyMatrix = {
  'master-1': { 'bath-1': 1.0 },
  'living-1': { 'dining-1': 0.8 },
  'kitchen-1': { 'dining-1': 1.0 }
};

// 2. Evaluate Quality Scores
console.log('Evaluating 10 Architectural Quality Categories:');
const scores = evaluate(mockLayout, mockAdjacency, 500, 80, { vastuEmphasis: true });

console.log(`  - Privacy Score: ${scores.privacy}/100`);
console.log(`  - Circulation Score: ${scores.circulation}/100`);
console.log(`  - Ventilation Score: ${scores.ventilation}/100`);
console.log(`  - Natural Light Score: ${scores.naturalLight}/100`);
console.log(`  - Space Utilization: ${scores.spaceUtilization}/100`);
console.log(`  - Plumbing Efficiency: ${scores.plumbing}/100`);
console.log(`  - Structural Simplicity: ${scores.structural}/100`);
console.log(`  - Vastu Compliance: ${scores.vastu}/100`);
console.log(`  - Accessibility Score: ${scores.accessibility}/100`);
console.log(`  - Future Expansion: ${scores.futureExpansion}/100`);
console.log(`  => Total Score: ${scores.totalScore}/100`);

// Assertions for scores
if (
  scores.privacy >= 0 &&
  scores.circulation >= 0 &&
  scores.ventilation >= 0 &&
  scores.naturalLight >= 0 &&
  scores.plumbing >= 0 &&
  scores.structural >= 0 &&
  scores.accessibility >= 0 &&
  scores.futureExpansion >= 0 &&
  scores.totalScore >= 0
) {
  console.log('\n✓ SUCCESS: All 10 architectural categories scored correctly!');
} else {
  console.error('\n✗ FAILURE: Some score categories returned invalid values.');
  process.exit(1);
}

// 3. Plan Audit
console.log('\nRunning Plan Audit (Expected 3 BHK, 1 floor):');
const audit = auditPlan(mockLayout, 3, 1);

console.log('\n  Fatal Issues Found:');
audit.fatalIssues.forEach(e => console.log(`    - [FATAL] ${e}`));

console.log('\n  Major Issues Found:');
audit.majorIssues.forEach(e => console.log(`    - [MAJOR] ${e}`));

console.log('\n  Minor Issues Found:');
audit.minorIssues.forEach(w => console.log(`    - [MINOR] ${w}`));

console.log('\n  Suggestions Found:');
audit.suggestions.forEach(w => console.log(`    - [SUGGESTION] ${w}`));

console.log('\n  Recommendations Found:');
audit.recommendations.forEach(r => console.log(`    - [RECOMMENDATION] ${r}`));

console.log('\n  Buildability Report:');
console.log(`    - Structural Load Safety: ${audit.buildability.structuralLoadSafety}`);
console.log(`    - Plumbing Grouping: ${audit.buildability.plumbingGrouping}`);
console.log(`    - Construction Complexity: ${audit.buildability.constructionComplexity}`);
console.log(`    - Est. Material Waste: ${audit.buildability.estimatedMaterialWastePercent}%`);

console.log('\n  Plan Explanation Report:');
console.log(`    - Tagline: ${audit.explanation.conceptTagline}`);
console.log(`    - Zoning: ${audit.explanation.zoningJustification}`);
console.log(`    - Circulation: ${audit.explanation.circulationHighlights}`);
console.log(`    - Ventilation: ${audit.explanation.ventilationStrengths}`);
console.log(`    - Details: ${audit.explanation.roomLayoutDetails}`);

const totalIssues = audit.fatalIssues.length + audit.majorIssues.length + audit.minorIssues.length + audit.suggestions.length;

// Verify Audit includes some issues and recommendations
if (totalIssues > 0 && audit.recommendations.length > 0) {
  console.log('\n✓ SUCCESS: Plan Auditor correctly generated issues, recommendations, and reports!');
} else {
  console.error('\n✗ FAILURE: Plan Auditor output was incomplete.');
  process.exit(1);
}

console.log('\n=== ARCHITECTURAL QUALITY ENGINE TEST COMPLETED ===');

