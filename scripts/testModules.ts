import { generateApartment, validateNoOverlaps as apOv } from '../src/lib/apartmentEngine';
import { generateMixedUse, validateNoOverlaps as mxOv } from '../src/lib/mixedUseEngine';
import { generateCommercial, validateNoOverlaps as cmOv, CommercialUse } from '../src/lib/commercialEngine';

let fail = 0;
for (const c of [
  { plotWidth: 80, plotDepth: 60, floors: 4, unitsPerFloor: 2, unitMix: ['2bhk','1bhk'], location: 'Pune', budgetLakhs: 800 },
  { plotWidth: 100, plotDepth: 80, floors: 10, unitsPerFloor: 4, unitMix: ['3bhk','2bhk','2bhk','1bhk'], location: 'Pune', budgetLakhs: 2000 },
  { plotWidth: 70, plotDepth: 55, floors: 3, unitsPerFloor: 3, unitMix: ['1bhk','2bhk','1bhk'], location: 'Pune', budgetLakhs: 500 },
] as any[]) { const r = generateApartment(c); const iss = apOv(r.rooms); console.log(`APT ${c.plotWidth}x${c.plotDepth} G+${c.floors} u${c.unitsPerFloor}: floors=${r.floorLabels.length} rooms=${r.rooms.length} overlaps=${iss.length} units=${r.stats.totalUnits} far=${r.stats.far}`); if(iss.length) fail++; }

for (const c of [
  { plotWidth: 90, plotDepth: 70, commercialFloors: 2, residentialFloors: 4, shopsPerFloor: 6, unitsPerFloor: 2, unitMix: ['2bhk','1bhk'], location: 'Pune', budgetLakhs: 1200 },
  { plotWidth: 110, plotDepth: 80, commercialFloors: 1, residentialFloors: 6, shopsPerFloor: 8, unitsPerFloor: 3, unitMix: ['2bhk','2bhk','1bhk'], location: 'Pune', budgetLakhs: 1800 },
] as any[]) { const r = generateMixedUse(c); const iss = mxOv(r.rooms); console.log(`MIX ${c.plotWidth}x${c.plotDepth} c${c.commercialFloors}r${c.residentialFloors}: floors=${r.floorLabels.length} rooms=${r.rooms.length} overlaps=${iss.length} shops=${r.stats.totalShops} units=${r.stats.totalUnits}`); if(iss.length) fail++; }

for (const u of ['office','mall','hotel','hospital','school'] as CommercialUse[]) { const r = generateCommercial({ plotWidth: 100, plotDepth: 80, floors: 4, use: u, location: 'Pune', budgetLakhs: 3000 }); const iss = cmOv(r.rooms); console.log(`COM ${u} 100x80 G+4: floors=${r.floorLabels.length} rooms=${r.rooms.length} overlaps=${iss.length} occ=${r.stats.occupancyLoad} park=${r.stats.parkingSlots}`); if(iss.length) fail++; }

console.log(fail === 0 ? 'ALL PASS' : `FAIL (${fail})`);
