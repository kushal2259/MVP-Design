import { generatePlan } from '../src/lib/planner';
import { parseRequirementsLocal } from '../src/lib/planner/requirementParser';

const briefs = [
  '40x60 plot, 3 bhk, vastu compliant, 2 floors',
  '250 sq yd plot, 4 bhk modern house, 2 floors',
  '50x50 plot, 4 bhk, 2 floors, parking',
];

for (const brief of briefs) {
  console.log(`\nBRIEF: "${brief}"`);
  const req = parseRequirementsLocal(brief);
  const plan = generatePlan(req);

  plan.options.forEach((opt, i) => {
    const stairs = opt.rooms.filter(r => r.type === 'staircase');
    console.log(`  Option ${String.fromCharCode(65 + i)}: ${plan.candidates[i].strategyName}`);
    stairs.forEach(s => {
      console.log(`    Floor ${s.floor}: x=${s.x.toFixed(1)} y=${s.y.toFixed(1)} w=${s.w.toFixed(1)} h=${s.h.toFixed(1)}`);
    });

    const floorNums = [...new Set(stairs.map(s => s.floor))].sort();
    if (floorNums.length >= 2) {
      for (let fi = 0; fi < floorNums.length - 1; fi++) {
        const s0 = stairs.find(s => s.floor === floorNums[fi]);
        const s1 = stairs.find(s => s.floor === floorNums[fi + 1]);
        if (!s0 || !s1) { console.log(`    ✗ MISSING staircase on floor ${floorNums[fi + 1]}`); continue; }
        const dx = Math.abs(s0.x - s1.x);
        const dy = Math.abs(s0.y - s1.y);
        const dw = Math.abs(s0.w - s1.w);
        const dh = Math.abs(s0.h - s1.h);
        const aligned = dx < 0.5 && dy < 0.5 && dw < 0.5 && dh < 0.5;
        if (aligned) {
          console.log(`    ✅ Floor ${floorNums[fi]}→${floorNums[fi+1]} ALIGNED (same position)`);
        } else {
          console.log(`    ❌ Floor ${floorNums[fi]}→${floorNums[fi+1]} MISALIGNED — Δx=${dx.toFixed(1)} Δy=${dy.toFixed(1)} Δw=${dw.toFixed(1)} Δh=${dh.toFixed(1)}`);
        }
      }
    }
  });
}
