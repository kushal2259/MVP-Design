import { generatePlan } from '../src/lib/planner';
import { parseRequirementsLocal } from '../src/lib/planner/requirementParser';
import { analyzeVastu } from '../src/lib/vastuEngine';
import type { RoomLayout } from '../src/types';

function overlaps(a: RoomLayout, b: RoomLayout): boolean {
  // 0.3 ft (~3.5") tolerance absorbs 1-decimal rounding on shared wall edges
  const t = 0.3;
  return a.x < b.x + b.w - t && a.x + a.w > b.x + t &&
         a.y < b.y + b.h - t && a.y + a.h > b.y + t;
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
  console.log(`  generated ${plan.generated} candidates, ${plan.accepted} passed the critic → ${plan.candidates.length} options:`);
  const sharesWall = (a: RoomLayout, b: RoomLayout) =>
    (Math.abs((a.x + a.w) - b.x) < 0.4 || Math.abs((b.x + b.w) - a.x) < 0.4) && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2.5 ||
    (Math.abs((a.y + a.h) - b.y) < 0.4 || Math.abs((b.y + b.h) - a.y) < 0.4) && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2.5;
  const kdAdj = (rooms: RoomLayout[]) => {
    const g = rooms.filter(r => r.floor === 0);
    const k = g.find(r => r.type === 'kitchen'), d = g.find(r => r.type === 'dining');
    return k && d ? (sharesWall(k, d) ? 'YES' : 'no') : 'n/a';
  };
  const entranceType = (rooms: RoomLayout[]) => {
    const r = rooms.find(rm => rm.floor === 0 && rm.doors?.some(d => /entry|main/.test(d.id)));
    return r ? r.type : 'none';
  };
  plan.candidates.forEach((c, i) => {
    const o = plan.options[i];
    const s = c.scores;
    console.log(`  • ${c.strategyName.padEnd(20)} total=${s.total} adj=${s.adjacency} priv=${s.privacy} kitchen↔dining=${kdAdj(o.rooms)} entry-room=${entranceType(o.rooms)}`);
    if (c.auditorReport) {
      const allErrors = [...c.auditorReport.fatalIssues, ...c.auditorReport.majorIssues];
      if (allErrors.length) console.log('    Errors:', allErrors.map(e => `      - ${e}`).join('\n'));
    }
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
process.exit(totalOverlaps === 0 ? 0 : 1);
