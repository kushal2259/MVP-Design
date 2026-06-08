import { generatePlan } from '../src/lib/planner';
import { parseRequirementsLocal } from '../src/lib/planner/requirementParser';
import type { RoomLayout } from '../src/types';

function overlaps(a: RoomLayout, b: RoomLayout): boolean {
  return a.x < b.x + b.w - 0.1 && a.x + a.w > b.x + 0.1 &&
         a.y < b.y + b.h - 0.1 && a.y + a.h > b.y + 0.1;
}

function checkFloor(rooms: RoomLayout[], floor: number, label: string) {
  const fr = rooms.filter(r => r.floor === floor && r.type !== 'parking' && r.type !== 'garden' && r.type !== 'balcony');
  let overlapCount = 0;
  for (let i = 0; i < fr.length; i++)
    for (let j = i + 1; j < fr.length; j++)
      if (overlaps(fr[i], fr[j])) { overlapCount++; }
  const minDim = Math.min(...fr.map(r => Math.min(r.w, r.h)));
  const area = fr.reduce((s, r) => s + r.w * r.h, 0);
  console.log(`    ${label} floor ${floor}: ${fr.length} rooms, area ${Math.round(area)} sqft, overlaps=${overlapCount}, minDim=${minDim.toFixed(1)}ft`);
  return overlapCount;
}

const briefs = [
  'I have a 250 sq yd plot and need a modern 4 BHK house with a large kitchen and large living room',
  '40x60 plot, 3 bhk, vastu compliant, good ventilation',
  '180 sq yd luxury villa 5 bhk with pooja room and study',
];

let totalOverlaps = 0;
for (const brief of briefs) {
  const req = parseRequirementsLocal(brief);
  console.log(`\nBRIEF: "${brief}"`);
  console.log(`  parsed: ${req.bedrooms}BHK ${req.floors}fl ${req.plotWidth}x${req.plotDepth} ${req.style}`);
  const plan = generatePlan(req);
  console.log(`  ${plan.options.length} options:`);
  plan.options.forEach(o => {
    console.log(`  • ${o.name}  (cost x${o.costMultiplier})`);
    for (let f = 0; f < req.floors; f++) totalOverlaps += checkFloor(o.rooms, f, o.id);
  });
  // diversity check: option-a vs option-b room name sets / sizes differ
  const a = plan.options[0], b = plan.options[1];
  if (a && b) {
    const sig = (o: typeof a) => o.rooms.filter(r => r.floor === 0).map(r => `${r.type}:${Math.round(r.w)}x${Math.round(r.h)}`).sort().join('|');
    console.log(`  diversity A!=B: ${sig(a) !== sig(b)}`);
  }
}
console.log(`\nTOTAL OVERLAPS ACROSS ALL: ${totalOverlaps}`);
console.log(totalOverlaps === 0 ? 'PASS ✓ no overlapping rooms' : 'FAIL ✗ overlaps detected');
