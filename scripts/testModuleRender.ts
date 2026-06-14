// Exercise EVERY render/report path used by ModuleWorkspace against real engine
// output, to catch runtime throws the compiler can't see.
import { generateApartment } from '../src/lib/apartmentEngine';
import { generateMixedUse } from '../src/lib/mixedUseEngine';
import { generateCommercial, CommercialUse } from '../src/lib/commercialEngine';
import { renderDiscipline, renderSection, doorSchedule, windowSchedule, complianceReport, costEstimate, boq, Discipline } from '../src/lib/moduleEngineering';
import { generateElevation } from '../src/lib/elevationGenerator';
import type { PlotSettings } from '../src/types';

const DISCS: Discipline[] = ['plan', 'structural', 'plumbing', 'electrical', 'hvac', 'fire'];
let fail = 0; let checks = 0;
const ps = (w: number, d: number, f: number): PlotSettings => ({ width: w, depth: d, location: 'X', floors: f, style: 'modern', budgetLakhs: 100, bedrooms: 2, kitchenStyle: 'large', balconyRequired: true });

function exercise(label: string, rooms: any[], floorLabels: string[], pw: number, pd: number, builtUp: number) {
  const floorIds = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  try {
    for (const fl of floorIds) {
      const fr = rooms.filter(r => r.floor === fl);
      for (const disc of DISCS) { const svg = renderDiscipline(disc, fr, pw, pd); if (!svg.includes('<svg')) throw new Error(`${disc} empty`); checks++; }
      doorSchedule(fr); windowSchedule(fr); checks += 2;
    }
    renderSection(floorLabels, pw, floorIds.map(() => 10)); checks++;
    for (const side of ['front','rear','left','right'] as const) { const e = generateElevation(rooms as any, ps(pw, pd, floorIds.length), side, 'modern', floorIds.length); if (!e.includes('<svg')) throw new Error(`elev ${side} empty`); checks++; }
    complianceReport({ far: 2, floors: 4, parkingProvided: 10, parkingRequired: 8, kind: label }); checks++;
    costEstimate(builtUp, 2000, label); boq(builtUp); checks += 2;
    console.log(`OK  ${label} — floors=${floorIds.length} rooms=${rooms.length}`);
  } catch (e) { console.log(`THROW ${label}: ${(e as Error).message}`); fail++; }
}

for (const c of [
  { plotWidth: 80, plotDepth: 60, floors: 4, unitsPerFloor: 2, unitMix: ['2bhk','1bhk'], location: 'P', budgetLakhs: 800 },
  { plotWidth: 100, plotDepth: 80, floors: 10, unitsPerFloor: 4, unitMix: ['3bhk','2bhk','2bhk','1bhk'], location: 'P', budgetLakhs: 2000 },
] as any[]) { const r = generateApartment(c); exercise(`APT G+${c.floors}`, r.rooms, r.floorLabels, c.plotWidth, c.plotDepth, r.stats.builtUpPerFloor * c.floors); }

for (const c of [
  { plotWidth: 90, plotDepth: 70, commercialFloors: 2, residentialFloors: 4, shopsPerFloor: 6, unitsPerFloor: 2, unitMix: ['2bhk','1bhk'], location: 'P', budgetLakhs: 1200 },
] as any[]) { const r = generateMixedUse(c); exercise('MIX', r.rooms, r.floorLabels, c.plotWidth, c.plotDepth, r.stats.commercialArea + r.stats.residentialArea); }

for (const u of ['office','mall','hotel','hospital','school'] as CommercialUse[]) { const r = generateCommercial({ plotWidth: 100, plotDepth: 80, floors: 4, use: u, location: 'P', budgetLakhs: 3000 }); exercise(`COM ${u}`, r.rooms, r.floorLabels, 100, 80, r.stats.totalBuiltUp); }

console.log(`\n${fail === 0 ? 'ALL RENDER PATHS OK' : 'FAIL ' + fail} (${checks} checks)`);
