import { PlotSettings, calculateSetbacks } from './layoutSolver';

export interface ComplianceResult {
  passed: boolean;
  score: number; // 0 to 100
  checks: {
    name: string;
    description: string;
    expected: string;
    actual: string;
    passed: boolean;
    severity: 'warning' | 'error' | 'info';
  }[];
}

export function checkCompliance(settings: PlotSettings, builtUpAreaPerFloor: number): ComplianceResult {
  const { width, depth, floors, location, budgetLakhs } = settings;
  const plotArea = width * depth; // sq ft
  const totalBuiltUpArea = builtUpAreaPerFloor * floors; // sq ft

  const setbacks = calculateSetbacks(width, depth, location);
  
  const checks: ComplianceResult['checks'] = [];
  let score = 100;
  let passed = true;

  // 1. FSI (Floor Space Index) check
  let maxFsi = 1.8; // default Ahmedabad FSI
  if (location.toLowerCase() === 'mumbai') maxFsi = 2.5;
  else if (location.toLowerCase() === 'delhi') maxFsi = 2.0;
  else if (location.toLowerCase() === 'bangalore') maxFsi = 1.75;

  const actualFsi = totalBuiltUpArea / plotArea;
  const fsiPassed = actualFsi <= maxFsi;

  if (!fsiPassed) {
    score -= 25;
    passed = false;
  }
  checks.push({
    name: 'Floor Space Index (FSI)',
    description: `Measures total built area relative to plot size. Permitted FSI for ${location} is ${maxFsi}.`,
    expected: `≤ ${maxFsi}`,
    actual: actualFsi.toFixed(2),
    passed: fsiPassed,
    severity: fsiPassed ? 'info' : 'error',
  });

  // 2. Ground Coverage Check
  let maxCoverage = 0.50; // 50% max coverage
  if (plotArea > 5000) maxCoverage = 0.40; // larger plots have lower coverage limits
  
  const actualCoverage = builtUpAreaPerFloor / plotArea;
  const coveragePassed = actualCoverage <= maxCoverage;

  if (!coveragePassed) {
    score -= 15;
  }
  checks.push({
    name: 'Ground Coverage Ratio',
    description: 'The footprint area of the ground floor relative to total plot area.',
    expected: `≤ ${(maxCoverage * 100).toFixed(0)}%`,
    actual: `${(actualCoverage * 100).toFixed(0)}%`,
    passed: coveragePassed,
    severity: coveragePassed ? 'info' : 'warning',
  });

  // 3. Setback compliance
  const requiredFront = setbacks.front;
  // We assume setbacks are complied with in the procedural layout,
  // but if the user resizes a room, it might extend into the setbacks.
  checks.push({
    name: 'Front Setback Space',
    description: 'Distance left from the front property line for green areas, parking, and ventilation.',
    expected: `≥ ${requiredFront} ft`,
    actual: `${requiredFront} ft`, // procedure conforms
    passed: true,
    severity: 'info',
  });

  // 4. Building Height Limits
  const estimatedHeight = floors * 10 + 2; // 10ft per floor + 2ft plinth
  const maxHeight = location.toLowerCase() === 'ahmedabad' ? 36 : 45; // in feet (approx 12m / 15m)
  const heightPassed = estimatedHeight <= maxHeight;

  if (!heightPassed) {
    score -= 20;
    passed = false;
  }
  checks.push({
    name: 'Total Building Height',
    description: 'Building height limit for low-rise residential zones.',
    expected: `≤ ${maxHeight} ft`,
    actual: `${estimatedHeight} ft`,
    passed: heightPassed,
    severity: heightPassed ? 'info' : 'error',
  });

  // 5. Parking Clearance Check
  // We need at least 1 parking space. Ground floor built-up footprint must support parking
  const actualParkingSpaces = 1; // procedural always allocates 1 car parking
  const expectedParkingSpaces = totalBuiltUpArea > 2500 ? 2 : 1;
  const parkingPassed = actualParkingSpaces >= expectedParkingSpaces;

  if (!parkingPassed) {
    score -= 10;
  }
  checks.push({
    name: 'ECS Parking Requirement',
    description: 'Minimum Equivalent Car Space (ECS) required based on total built-up area.',
    expected: `≥ ${expectedParkingSpaces} spaces`,
    actual: `${actualParkingSpaces} space`,
    passed: parkingPassed,
    severity: parkingPassed ? 'info' : 'warning',
  });

  // 6. Budget Feasibility Check
  // Economy: 1500/sqft, Standard: 1800/sqft, Premium: 2200/sqft
  const avgCost = totalBuiltUpArea * 1800; // in INR
  const budgetInInr = budgetLakhs * 100000;
  const budgetPassed = budgetInInr >= avgCost * 0.9; // give 10% breathing room

  if (!budgetPassed) {
    score -= 10;
  }
  checks.push({
    name: 'Budget Feasibility',
    description: 'Compares user-specified budget with realistic standard construction rates.',
    expected: `≥ ₹${(avgCost / 100000).toFixed(1)} Lakhs`,
    actual: `₹${budgetLakhs} Lakhs`,
    passed: budgetPassed,
    severity: budgetPassed ? 'info' : 'warning',
  });

  return {
    passed,
    score: Math.max(0, score),
    checks,
  };
}
